// Online GameSource: Colyseus room + client-side prediction + remote interpolation.

import type { Room } from '@colyseus/sdk';
import {
  MSG, TICK_MS, packAxis, predictMovement, unpackAxis,
  type ChatMessage, type GameEvent, type InputFrame, type PlayerState, type PredictMovement, type WorldState,
} from '@ob/game';
import type { GameSource } from '../contracts.ts';
import type { BattleState } from '../../../server/src/schema.ts';
import { ReadModel, copyPlayer, emptyWorld, newPlayer } from './readModel.ts';
import { INTERP_DELAY_TICKS, ServerClock, Track } from './interp.ts';

export type NetStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface NetSourceOptions {
  /** Override the movement predictor (defaults to `predictMovement` from @ob/game). */
  predict?: PredictMovement | null;
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
  readonly localId: string;
  status: NetStatus = 'connected';
  /** Close code when status is 'disconnected'. */
  closeCode = 0;
  ping = 0;
  readonly chatLog: ChatMessage[] = [];

  private readonly room: Room<any, BattleState>;
  private readonly predict: PredictMovement | null;
  private readonly model = new ReadModel();
  private readonly view: WorldState = emptyWorld();
  private readonly clock = new ServerClock();
  private readonly tracks = new Map<string, Track>();
  private events: GameEvent[] = [];
  private readonly chatListeners = new Set<Listener<ChatMessage>>();
  private readonly statusListeners = new Set<Listener<NetStatus>>();

  // prediction
  private pred: PlayerState | null = null;
  private seq = 0;
  private acc = 0;
  private sinceSend = 0;
  private readonly pending: InputFrame[] = [];
  private unsent: InputFrame[] = [];
  private errX = 0;
  private errY = 0;
  private visX = NaN;
  private visY = NaN;

  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private readonly onVisibility = () => {
    if (doc?.hidden) this.sendNeutral();
  };

  constructor(room: Room<any, BattleState>, opts: NetSourceOptions = {}) {
    this.room = room;
    this.roomId = room.roomId;
    this.localId = room.sessionId;
    this.predict = opts.predict === undefined ? predictMovement : opts.predict;
    room.reconnection.minUptime = 1000;

    room.onStateChange((s) => this.onPatch(s));
    room.onMessage(MSG.events, (evs: GameEvent[]) => {
      if (Array.isArray(evs)) for (const e of evs) this.events.push(e);
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
    room.onDrop(() => this.setStatus('reconnecting'));
    room.onReconnect(() => {
      this.pending.length = 0;
      this.unsent = [];
      this.acc = 0;
      this.clock.reset();
      this.setStatus('connected');
    });
    room.onLeave((code) => {
      this.closeCode = code;
      this.setStatus('disconnected');
      this.stopTimers();
    });

    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
    doc?.addEventListener('visibilitychange', this.onVisibility);
  }

  // ------------------------------------------------------------------ GameSource

  get world(): WorldState | null {
    return this.model.ready ? this.view : null;
  }

  update(dtMs: number, input: Omit<InputFrame, 'seq'>): void {
    if (this.disposed) return;
    const now = performance.now();
    if (this.status === 'connected' && this.model.ready && this.model.world.players.has(this.localId)) {
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

  /** Subscribe to chat (incl. system messages, `from === ''`). Returns an unsubscribe fn. */
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
    if (this.status !== 'connected' || !this.model.ready) return;
    const f: InputFrame = { seq: ++this.seq, dx: 0, dy: 0, buttons: 0 };
    this.pending.push(f);
    this.unsent.push(f);
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
    if (this.pred && this.canPredict()) this.predict!(this.model.world, this.pred, f);
    if (++this.sinceSend >= SEND_EVERY_TICKS) this.flush();
  }

  private flush() {
    this.sinceSend = 0;
    if (this.unsent.length === 0) return;
    const wire = this.unsent.map((f) => [f.seq, packAxis(f.dx), packAxis(f.dy), f.buttons]);
    this.unsent = [];
    this.room.send(MSG.input, wire);
  }

  /** predictMovement itself freezes dead / spectating / countdown players. */
  private canPredict(): boolean {
    return this.predict !== null && this.pred !== null;
  }

  private onPatch(s: BattleState) {
    const model = this.model;
    model.apply(s);
    if (!model.ready) return;
    const w = model.world;
    const now = performance.now();
    this.clock.onSnapshot(w.tick, now);

    // remote snapshot buffers
    for (const [id, p] of w.players) {
      if (id === this.localId) continue;
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

    this.rebase();
  }

  /** Reconcile the local predicted player with the newest authoritative state. */
  private rebase() {
    const auth = this.model.world.players.get(this.localId);
    if (!auth) { this.pred = null; this.pending.length = 0; return; }
    const pending = this.pending;
    let drop = 0;
    while (drop < pending.length && pending[drop]!.seq <= auth.ackSeq) drop++;
    if (drop) pending.splice(0, drop);

    const pred = this.pred ?? (this.pred = newPlayer(auth.id));
    copyPlayer(auth, pred);
    if (this.canPredict()) {
      const w = this.model.world;
      for (let i = 0; i < pending.length; i++) this.predict!(w, pred, pending[i]!);
    }

    if (!Number.isNaN(this.visX)) {
      const ex = this.visX - pred.x, ey = this.visY - pred.y;
      if (Math.hypot(ex, ey) > SNAP_DIST || !auth.alive) { this.errX = 0; this.errY = 0; }
      else { this.errX = ex; this.errY = ey; }
    }
  }

  /** Build the exposed world for this frame: interpolated remotes + smoothed local player. */
  private compose(nowMs: number, dtMs: number) {
    const w = this.model.world;
    if (!this.model.ready) return;
    const v = this.view;
    v.tick = w.tick; v.seed = 0; v.phase = w.phase; v.phaseTicks = w.phaseTicks; v.round = w.round;
    v.width = w.width; v.height = w.height; v.tiles = w.tiles; v.winner = w.winner;
    v.bombs = w.bombs; v.flames = w.flames; v.pickups = w.pickups; v.falling = w.falling;

    const renderTick = this.clock.now(nowMs) - INTERP_DELAY_TICKS;
    const k = Math.exp(-Math.max(0, dtMs) / SMOOTH_TAU_MS);
    this.errX *= k; this.errY *= k;
    if (Math.abs(this.errX) < 1e-4) this.errX = 0;
    if (Math.abs(this.errY) < 1e-4) this.errY = 0;

    for (const [id, p] of v.players) {
      if (id === this.localId) {
        const src = this.pred ?? w.players.get(id);
        if (!src) continue;
        p.x = src.x + this.errX; p.y = src.y + this.errY; p.dir = src.dir; p.moving = src.moving;
        this.visX = p.x; this.visY = p.y;
      } else {
        this.tracks.get(id)?.sample(renderTick, p);
      }
    }
  }
}
