// Online GameSource: Colyseus room + client-side prediction + remote interpolation.
//
// Canon: a client joins as a SPECTATOR (`localId === ''`). `play(true)` enters the arena
// («Подключиться»), `play(false)` goes back to spectating («Отключиться»).

import type { Room } from '@colyseus/sdk';
import {
  Ability, BOMB_FUSE, BombKind, BombMotion, Button, Curse, MSG, Phase, TICK_MS, Tile, packAxis, predictMovement, unpackAxis,
  type BombState, type ChatMessage, type GameEvent, type InputFrame, type PlayerState, type PredictMovement,
  type WorldState,
} from '@ob/game';
import type { GameSource } from '../contracts.ts';
import type { BattleState, PlayReply } from '../../../server/src/schema.ts';
import { ReadModel, copyBomb, copyPlayer, emptyWorld, newBomb, newPlayer } from './readModel.ts';
import { BombTrack, INTERP_DELAY_TICKS, ServerClock, Track } from './interp.ts';

export type NetStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface NetSourceOptions {
  /** Override the movement predictor (defaults to `predictMovement` from @ob/game). */
  predict?: PredictMovement | null;
  /** Emit a predicted `bombPlaced` event (bomb = -1) immediately on the local press. Default true. */
  predictBombSound?: boolean;
}

/** Inputs are sent every N fixed ticks (batched). */
export const SEND_EVERY_TICKS = 2;
const PING_INTERVAL_MS = 2000;
const MAX_PENDING = 120;
const MAX_STEPS_PER_UPDATE = 8;
/** Prediction error is blended away with this time constant (~100 ms to vanish). */
const SMOOTH_TAU_MS = 35;
/** Errors larger than this snap instead of blending. */
const SNAP_DIST = 1;
const CHAT_LOG = 100;
const PLAY_TIMEOUT_MS = 3000;
/** A server bombPlaced matching a predicted one within this window is swallowed. */
const PREDICTED_BOMB_MS = 1000;
/** Local player moved farther than this in one tick (respawn, push-out): don't interpolate. */
const TICK_TELEPORT = 0.5;

type Listener<T> = (v: T) => void;

// Minimal DOM surface (keeps this module usable from Bun tests without DOM typings).
interface DocumentLike {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', cb: () => void): void;
  removeEventListener(type: 'visibilitychange', cb: () => void): void;
}
const doc = (globalThis as { document?: DocumentLike }).document;

export class NetSource implements GameSource {
  readonly roomId: string;
  /** This connection's Colyseus session id (= player id while playing). */
  readonly sessionId: string;
  status: NetStatus = 'connected';
  /** Close code when status is 'disconnected'. */
  closeCode = 0;
  ping = 0;
  /** Connected clients that are not in the arena (HUD «Наблюдателей: N»). */
  spectators = 0;
  /** Arena capacity (players incl. bots). */
  maxPlayers = 0;
  readonly chatLog: ChatMessage[] = [];

  private readonly room: Room<any, BattleState>;
  private readonly predict: PredictMovement | null;
  private readonly predictBombs: boolean;
  private readonly model = new ReadModel();
  private readonly view: WorldState = emptyWorld();
  private readonly clock = new ServerClock();
  private readonly tracks = new Map<string, Track>();
  private readonly bombTracks = new Map<number, BombTrack>();
  private events: GameEvent[] = [];
  private readonly chatListeners = new Set<Listener<ChatMessage>>();
  private readonly statusListeners = new Set<Listener<NetStatus>>();
  private readonly playWaiters: ((ok: boolean) => void)[] = [];
  /** Desired arena state (restored after a reconnect if the server lost it). */
  private wantPlay = false;
  private playing = false;

  // prediction
  private pred: PlayerState | null = null;
  private seq = 0;
  private acc = 0;
  private sinceSend = 0;
  private prevButtons = 0;
  private readonly pending: InputFrame[] = [];
  private unsent: InputFrame[] = [];
  private errX = 0;
  private errY = 0;
  private visX = NaN;
  private visY = NaN;
  /** Predicted position one tick earlier: the local player is drawn between it and `pred`. */
  private prevX = NaN;
  private prevY = NaN;
  private predictedBombs: { x: number; y: number; at: number }[] = [];
  /** Own bombs shown right away (negative ids in the view) until the server's bomb arrives. */
  private ghosts: { id: number; x: number; y: number; seq: number; at: number }[] = [];
  private ghostSeq = 0;

  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private readonly onVisibility = () => {
    if (doc?.hidden) this.sendNeutral();
  };

  constructor(room: Room<any, BattleState>, opts: NetSourceOptions = {}) {
    this.room = room;
    this.roomId = room.roomId;
    this.sessionId = room.sessionId;
    this.predict = opts.predict === undefined ? predictMovement : opts.predict;
    this.predictBombs = opts.predictBombSound ?? true;
    room.reconnection.minUptime = 1000;

    room.onStateChange((s) => this.onPatch(s));
    room.onMessage(MSG.events, (evs: GameEvent[]) => {
      if (Array.isArray(evs)) for (const e of evs) if (!this.swallowPredicted(e)) this.events.push(e);
    });
    room.onMessage(MSG.chat, (m: ChatMessage) => {
      this.chatLog.push(m);
      if (this.chatLog.length > CHAT_LOG) this.chatLog.shift();
      for (const cb of this.chatListeners) cb(m);
    });
    room.onMessage(MSG.ping, (m: { t: number }) => {
      const rtt = performance.now() - m.t;
      if (rtt >= 0 && rtt < 10_000) this.ping = this.ping ? Math.round(this.ping * 0.7 + rtt * 0.3) : Math.round(rtt);
    });
    room.onMessage(MSG.play, (r: PlayReply) => {
      if (!r.reason) this.wantPlay = r.playing;
      const w = this.playWaiters.shift();
      w?.(r.playing);
    });
    room.onDrop(() => this.setStatus('reconnecting'));
    room.onReconnect(() => {
      this.pending.length = 0;
      this.unsent = [];
      this.acc = 0;
      this.clock.reset();
      this.setStatus('connected');
      // The server keeps a dropped player in the arena; re-enter if it did not.
      setTimeout(() => {
        if (this.status === 'connected' && this.wantPlay && !this.isPlaying) this.room.send(MSG.play, true);
      }, 300);
    });
    room.onLeave((code) => {
      this.closeCode = code;
      this.setStatus('disconnected');
      this.stopTimers();
      for (const w of this.playWaiters.splice(0)) w(false);
    });

    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
    doc?.addEventListener('visibilitychange', this.onVisibility);
  }

  // ------------------------------------------------------------------ GameSource

  get world(): WorldState | null {
    return this.model.ready ? this.view : null;
  }

  /** Player id controlled here, '' while spectating. */
  get localId(): string {
    return this.playing ? this.sessionId : '';
  }

  update(dtMs: number, input: Omit<InputFrame, 'seq'>): void {
    if (this.disposed) return;
    const now = performance.now();
    if (this.status === 'connected' && this.model.ready && this.playing) {
      this.acc += dtMs;
      let steps = 0;
      while (this.acc >= TICK_MS) {
        if (++steps > MAX_STEPS_PER_UPDATE) { this.acc = 0; break; }
        this.localTick(input);
        this.acc -= TICK_MS;
      }
    } else {
      this.acc = 0;
    }
    this.compose(now, dtMs);
  }

  drainEvents(): GameEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events;
    this.events = [];
    return out;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTimers();
    doc?.removeEventListener('visibilitychange', this.onVisibility);
    this.chatListeners.clear();
    this.statusListeners.clear();
    void this.room.leave(true).catch(() => {});
  }

  // ------------------------------------------------------------------ extras

  /** True while this client is in the arena (a sim player), false while spectating. */
  get isPlaying(): boolean {
    return this.playing;
  }

  /** Players in the arena (humans + bots): HUD «👥 alive / total». */
  get playersCount(): number {
    return this.model.world.players.size;
  }

  get aliveCount(): number {
    let n = 0;
    for (const p of this.model.world.players.values()) if (p.alive && p.inRound) n++;
    return n;
  }

  /**
   * «Подключиться» (true) / «Отключиться» (false). Resolves with the resulting playing
   * state; false + a system chat «Нет свободных мест» when the arena is full.
   */
  play(enabled: boolean): Promise<boolean> {
    if (this.status !== 'connected') return Promise.resolve(this.playing);
    this.wantPlay = enabled;
    this.room.send(MSG.play, enabled);
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok); } };
      this.playWaiters.push(finish);
      setTimeout(() => finish(this.playing), PLAY_TIMEOUT_MS);
    });
  }

  /** Players sorted for a scoreboard (wins, then kills). */
  get players(): PlayerState[] {
    return [...this.view.players.values()].sort((a, b) => b.wins - a.wins || b.kills - a.kills || a.deaths - b.deaths);
  }

  sendChat(text: string) {
    if (this.status === 'connected' && text.trim()) this.room.send(MSG.chat, text.slice(0, 100));
  }

  setProfile(p: { name?: string; skin?: number }) {
    if (this.status === 'connected') this.room.send(MSG.profile, p);
  }

  /** Subscribe to chat (incl. system messages from '@server', `from === ''`). Returns an unsubscribe fn. */
  onChat(cb: Listener<ChatMessage>): () => void {
    this.chatListeners.add(cb);
    return () => this.chatListeners.delete(cb);
  }

  /** Subscribe to connection status changes. Returns an unsubscribe fn. */
  onStatus(cb: Listener<NetStatus>): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  // ------------------------------------------------------------------ internals

  private setStatus(s: NetStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const cb of this.statusListeners) cb(s);
  }

  private stopTimers() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  private sendPing() {
    if (this.status === 'connected') this.room.send(MSG.ping, performance.now());
  }

  private sendNeutral() {
    if (this.status !== 'connected' || !this.model.ready || !this.playing) return;
    const f: InputFrame = { seq: ++this.seq, dx: 0, dy: 0, buttons: 0 };
    this.pending.push(f);
    this.unsent.push(f);
    this.prevButtons = 0;
    this.flush();
  }

  private localTick(input: Omit<InputFrame, 'seq'>) {
    // Quantise exactly like the wire so prediction matches the server bit for bit.
    const f: InputFrame = {
      seq: ++this.seq,
      dx: unpackAxis(packAxis(input.dx)),
      dy: unpackAxis(packAxis(input.dy)),
      buttons: input.buttons | 0,
    };
    this.pending.push(f);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    this.unsent.push(f);
    if (this.pred) { this.prevX = this.pred.x; this.prevY = this.pred.y; }
    if (this.pred && this.predict) this.predict(this.model.world, this.pred, f);
    if (f.buttons & Button.Bomb && !(this.prevButtons & Button.Bomb)) this.predictBomb(f.seq);
    this.prevButtons = f.buttons;
    if (++this.sinceSend >= SEND_EVERY_TICKS) this.flush();
  }

  /** Cosmetic: emit the local bombPlaced right away when it will almost surely succeed. */
  private predictBomb(seq: number) {
    const p = this.pred;
    const w = this.model.world;
    if (!this.predictBombs || !p || !p.alive || !p.inRound || p.carrying >= 0 || p.curse === Curse.Constipation) return;
    if (w.phase !== Phase.Playing && w.phase !== Phase.SuddenDeath) return;
    // sim: bombs are off while a lone survivor waits for the round to end
    if (w.players.size > 1) {
      let alive = 0;
      for (const q of w.players.values()) if (q.alive && q.inRound) alive++;
      if (alive < 2) return;
    }
    // float32 positions: too close to a tile edge, the server may round the other way
    const fx = p.x - Math.floor(p.x), fy = p.y - Math.floor(p.y);
    if (Math.abs(fx - 0.5) < 0.02 || Math.abs(fy - 0.5) < 0.02) return;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (w.tiles[y * w.width + x] !== Tile.Floor) return;
    for (const k of w.pickups.values()) if (k.x === x && k.y === y) return;
    let own = 0;
    for (const b of w.bombs.values()) {
      if (b.owner === p.id) own++;
      if (b.motion !== BombMotion.Flying && Math.round(b.x) === x && Math.round(b.y) === y) return;
    }
    for (const g of this.ghosts) {
      if (g.x === x && g.y === y) return;
      own++;
    }
    if (own >= p.bombs) return;
    const now = performance.now();
    this.predictedBombs.push({ x, y, at: now });
    this.events.push({ type: 'bombPlaced', bomb: -1, x, y, owner: p.id });
    const id = -(++this.ghostSeq);
    const g = newBomb(id);
    g.owner = p.id; g.x = g.fromX = g.toX = x; g.y = g.fromY = g.toY = y;
    g.radius = p.curse === Curse.TinyFlame ? 1 : p.radius;
    g.fuse = BOMB_FUSE;
    g.kind = p.effects.crazy > 0 ? BombKind.Crazy : p.abilities & Ability.Remote ? BombKind.Remote
      : p.abilities & Ability.Pierce ? BombKind.Pierce : BombKind.Normal;
    if (g.kind === BombKind.Remote) g.fuse = -1;
    g.passers.push(p.id);
    this.view.bombs.set(id, g);
    this.ghosts.push({ id, x, y, seq, at: now });
  }

  /** Drop predicted bombs once the server placed the real one (or clearly did not). */
  private settleGhosts(ackSeq: number, now: number) {
    if (this.ghosts.length === 0) return;
    const w = this.model.world;
    this.ghosts = this.ghosts.filter((g) => {
      let real = false;
      for (const b of w.bombs.values()) {
        if (b.owner === this.sessionId && Math.round(b.x) === g.x && Math.round(b.y) === g.y) { real = true; break; }
      }
      // acked without a bomb there: the server refused it (or it already went off)
      const keep = !real && g.seq > ackSeq - 2 && now - g.at < PREDICTED_BOMB_MS;
      if (!keep) this.view.bombs.delete(g.id);
      return keep;
    });
  }

  private swallowPredicted(e: GameEvent): boolean {
    if (e.type !== 'bombPlaced' || e.owner !== this.sessionId || this.predictedBombs.length === 0) return false;
    const now = performance.now();
    this.predictedBombs = this.predictedBombs.filter((b) => now - b.at < PREDICTED_BOMB_MS);
    let i = this.predictedBombs.findIndex((b) => b.x === e.x && b.y === e.y);
    if (i < 0) i = this.predictedBombs.findIndex((b) => Math.abs(b.x - e.x) + Math.abs(b.y - e.y) <= 1);
    if (i < 0) return false;
    this.predictedBombs.splice(i, 1);
    return true;
  }

  private flush() {
    this.sinceSend = 0;
    if (this.unsent.length === 0) return;
    const wire = this.unsent.map((f) => [f.seq, packAxis(f.dx), packAxis(f.dy), f.buttons]);
    this.unsent = [];
    this.room.send(MSG.input, wire);
  }

  private onPatch(s: BattleState) {
    const model = this.model;
    model.apply(s);
    this.spectators = s.spectators ?? 0;
    this.maxPlayers = s.maxPlayers ?? 0;
    if (!model.ready) return;
    const w = model.world;
    const now = performance.now();
    this.clock.onSnapshot(w.tick, now);

    const playing = w.players.has(this.sessionId);
    if (playing !== this.playing) {
      this.playing = playing;
      this.pending.length = 0;
      this.unsent = [];
      this.pred = null;
      this.visX = this.visY = NaN;
      this.prevX = this.prevY = NaN;
      this.errX = this.errY = 0;
    }
    const localId = this.localId;

    // remote snapshot buffers
    for (const [id, p] of w.players) {
      if (id === localId) continue;
      let t = this.tracks.get(id);
      if (!t) { t = new Track(); this.tracks.set(id, t); }
      t.push(w.tick, p.x, p.y, p.dir, p.moving);
    }
    if (this.tracks.size >= w.players.size) {
      for (const id of this.tracks.keys()) if (!w.players.has(id)) this.tracks.delete(id);
    }

    // view players: copy authoritative fields (positions are filled per frame)
    const vp = this.view.players;
    for (const [id, p] of w.players) {
      let v = vp.get(id);
      if (!v) { v = newPlayer(id); vp.set(id, v); v.x = p.x; v.y = p.y; }
      const x = v.x, y = v.y, dir = v.dir, moving = v.moving;
      copyPlayer(p, v);
      v.x = x; v.y = y; v.dir = dir; v.moving = moving;
    }
    if (vp.size !== w.players.size) for (const id of vp.keys()) if (!w.players.has(id)) vp.delete(id);

    // view bombs: copies (positions interpolated per frame like remote players)
    const vb = this.view.bombs;
    for (const [id, b] of w.bombs) {
      let v = vb.get(id);
      if (!v) { v = newBomb(id); vb.set(id, v); copyBomb(b, v); }
      const x = v.x, y = v.y, progress = v.progress;
      copyBomb(b, v);
      v.x = x; v.y = y; v.progress = progress;
      let t = this.bombTracks.get(id);
      if (!t) { t = new BombTrack(); this.bombTracks.set(id, t); }
      t.push(w.tick, b.x, b.y, b.progress);
    }
    if (vb.size !== w.bombs.size) {
      for (const id of vb.keys()) if (id >= 0 && !w.bombs.has(id)) { vb.delete(id); this.bombTracks.delete(id); }
    }

    this.rebase();
    this.settleGhosts(this.playing ? (w.players.get(this.sessionId)?.ackSeq ?? 0) : Infinity, now);
  }

  /** Reconcile the local predicted player with the newest authoritative state. */
  private rebase() {
    const auth = this.playing ? this.model.world.players.get(this.sessionId) : undefined;
    if (!auth) { this.pred = null; this.pending.length = 0; return; }
    const pending = this.pending;
    let drop = 0;
    while (drop < pending.length && pending[drop]!.seq <= auth.ackSeq) drop++;
    if (drop) pending.splice(0, drop);

    const pred = this.pred ?? (this.pred = newPlayer(auth.id));
    copyPlayer(auth, pred);
    this.prevX = pred.x; this.prevY = pred.y;
    if (this.predict) {
      // predictMovement freezes dead / spectating / countdown players itself
      const w = this.model.world;
      for (let i = 0; i < pending.length; i++) {
        if (i === pending.length - 1) { this.prevX = pred.x; this.prevY = pred.y; }
        this.predict(w, pred, pending[i]!);
      }
    }

    if (!Number.isNaN(this.visX)) {
      this.tickLerp(pred);
      const ex = this.visX - this.lerpX, ey = this.visY - this.lerpY;
      if (Math.hypot(ex, ey) > SNAP_DIST || !auth.alive) { this.errX = 0; this.errY = 0; }
      else { this.errX = ex; this.errY = ey; }
    }
  }

  /** Build the exposed world for this frame: interpolated remotes / bombs + smoothed local player. */
  private compose(nowMs: number, dtMs: number) {
    const w = this.model.world;
    if (!this.model.ready) return;
    const v = this.view;
    v.tick = w.tick; v.seed = 0; v.phase = w.phase; v.phaseTicks = w.phaseTicks; v.round = w.round;
    v.width = w.width; v.height = w.height; v.tiles = w.tiles; v.winner = w.winner;
    v.flames = w.flames; v.pickups = w.pickups; v.falling = w.falling;
    v.zoneRing = w.zoneRing; v.zoneIn = w.zoneIn;

    const renderTick = this.clock.now(nowMs) - INTERP_DELAY_TICKS;
    const k = Math.exp(-Math.max(0, dtMs) / SMOOTH_TAU_MS);
    this.errX *= k; this.errY *= k;
    if (Math.abs(this.errX) < 1e-4) this.errX = 0;
    if (Math.abs(this.errY) < 1e-4) this.errY = 0;

    const localId = this.localId;
    for (const [id, p] of v.players) {
      if (id === localId) {
        const src = this.pred ?? w.players.get(id);
        if (!src) continue;
        this.tickLerp(src);
        p.x = this.lerpX + this.errX; p.y = this.lerpY + this.errY; p.dir = src.dir; p.moving = src.moving;
        this.visX = p.x; this.visY = p.y;
      } else {
        this.tracks.get(id)?.sample(renderTick, p);
      }
    }

    for (const [id, b] of v.bombs) if (id >= 0) this.placeBomb(id, b, renderTick);
  }

  private lerpX = 0;
  private lerpY = 0;
  /** Fixed-step interpolation: draw the local player between the last two predicted ticks, so
   *  movement stays even on 90/120/144 Hz screens (where frames and 60 Hz ticks don't line up). */
  private tickLerp(src: PlayerState) {
    const px = this.prevX, py = this.prevY;
    if (src !== this.pred || Number.isNaN(px) || Math.abs(src.x - px) + Math.abs(src.y - py) > TICK_TELEPORT) {
      this.lerpX = src.x; this.lerpY = src.y;
      return;
    }
    const a = Math.min(1, Math.max(0, this.acc / TICK_MS));
    this.lerpX = px + (src.x - px) * a;
    this.lerpY = py + (src.y - py) * a;
  }

  private placeBomb(id: number, b: BombState, renderTick: number) {
    if (b.motion === BombMotion.Carried) {
      const carrier = this.view.players.get(b.owner);
      const holder = carrier && carrier.carrying === id ? carrier : undefined;
      if (holder) { b.x = holder.x; b.y = holder.y; return; }
      const a = this.model.world.bombs.get(id);
      if (a) { b.x = a.x; b.y = a.y; }
      return;
    }
    this.bombTracks.get(id)?.sample(renderTick, b);
  }
}
