// One battle = one Colyseus room wrapping one authoritative Simulation.
//
// Canon: clients join as SPECTATORS (not in the sim). MSG.play true/false enters / leaves
// the arena. The main public room ('MAIN') is created at boot and never disposed; private
// and vs-bots rooms are extras.

import { Room, type Client } from '@colyseus/core';
import {
  Button, MAX_PLAYERS, MSG, PATCH_RATE, Phase, TICK_MS, TICK_RATE, unpackAxis,
  type ChatMessage, type GameEvent, type IBot, type ISimulation, type InputFrame, type JoinOptions,
  type RoomOptions,
} from '@ob/game';
import { getGameImpl, type GameImpl } from './game.ts';
import { BattleState, type PlayReply, type RoomMeta } from './schema.ts';
import { syncWorld } from './sync.ts';
import {
  CHAT_COOLDOWN_MS, CHAT_MAX, MAIN_ROOM_ID, NAME_MAX, SKIN_COUNT, TokenBucket, allocateRoomCode, clampInt,
  clampSkin, cleanText, releaseRoomCode, sanitizeName,
} from './util.ts';

export const DEFAULT_BOTS = 3;
/** Max frames accepted per input message (client sends 2 per message normally). */
export const MAX_INPUT_BATCH = 12;
/** Bots think every N ticks (staggered). Bot's internal timers assume 1. */
export const BOT_THINK_EVERY = 1;
/** Connected clients per room (players + spectators). */
export const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 200;
/** Main room: bots that keep a lone human company (only while exactly one human plays). */
export const BOTS_MAIN = clampInt(Number(process.env.BOTS_MAIN), 0, 4, 0);
/** Max fixed steps per timer callback before dropping the backlog (e.g. after a GC pause). */
const MAX_CATCHUP = 6;
const TICK_SAMPLES = 4096;

const BUTTON_MASK = Button.Bomb | Button.Action;
const BOT_NAMES = ['Bot Rusty', 'Bot Sparky', 'Bot Boomer', 'Bot Fuse', 'Bot Blaze', 'Bot Pixel', 'Bot Dyna',
  'Bot Nitro', 'Bot Cinder', 'Bot Volt', 'Bot Ember', 'Bot Kaboom', 'Bot Ash', 'Bot Flint', 'Bot Smokey'];

/** Canon system chat (sent from '@server', i.e. from === ''). */
export const T = {
  joined: (n: string) => `${n} подключился`,
  left: (n: string) => `${n} отключился`,
  renamed: (a: string, b: string) => `${a} теперь ${b}`,
  mapResized: 'Размер карты был изменен',
  winner: (n: string) => `${n} победил`,
  noWinner: 'Никто не выиграл',
  zoneWarning: (sec: number) => `Уменьшение размера карты через ${sec} сек`,
  zoneCancel: 'Уменьшение размера карты отменено',
  full: 'Нет свободных мест',
};

/** Server-only token: only startGameServer() may create the main room. */
export const MAIN_TOKEN = crypto.randomUUID();

interface Human {
  name: string;
  skin: number;
  playing: boolean;
  lastSeq: number;
  connected: boolean;
  lastChat: number;
  inputs: TokenBucket;
  profile: TokenBucket;
  pings: TokenBucket;
  plays: TokenBucket;
  droppedFrames: number;
}

interface BotSlot {
  bot: IBot;
  seq: number;
}

export type BattleCreateOptions = RoomOptions & Partial<JoinOptions> & { __main?: string; play?: boolean };

function parseFrame(raw: unknown): InputFrame | null {
  let seq: unknown, dx: number, dy: number, buttons: unknown;
  if (Array.isArray(raw)) {
    seq = raw[0];
    dx = unpackAxis(clampInt(raw[1], -127, 127, 0));
    dy = unpackAxis(clampInt(raw[2], -127, 127, 0));
    buttons = raw[3];
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    seq = o.seq;
    dx = typeof o.dx === 'number' && Number.isFinite(o.dx) ? Math.max(-1, Math.min(1, o.dx)) : 0;
    dy = typeof o.dy === 'number' && Number.isFinite(o.dy) ? Math.max(-1, Math.min(1, o.dy)) : 0;
    buttons = o.buttons;
  } else {
    return null;
  }
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1 || seq > 0x7fffffff) return null;
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  const b = typeof buttons === 'number' && Number.isInteger(buttons) ? buttons & BUTTON_MASK : 0;
  return { seq, dx, dy, buttons: b };
}

const evType = (e: GameEvent) => (e as { type: string }).type;

export class BattleRoom extends Room<{ state: BattleState; metadata: RoomMeta }> {
  /** Seconds a dropped client is kept (a player stays frozen in the sim) awaiting reconnection. */
  static reconnectSeconds = 20;

  state = new BattleState();
  maxClients = MAX_CLIENTS;
  maxMessagesPerSecond = 120;

  sim!: ISimulation;
  /** Max players in the sim (humans + bots); everyone else spectates. */
  maxPlayers = MAX_PLAYERS;
  isMain = false;
  private game!: GameImpl;
  private code = '';
  private botTarget = DEFAULT_BOTS;
  private readonly humans = new Map<string, Human>();
  private readonly bots = new Map<string, BotSlot>();
  private botCounter = 0;
  private acc = 0;
  private events: GameEvent[] = [];
  private lastPhase = -1;
  private lastRound = -1;
  private lastW = 0;
  private lastH = 0;

  // tick timing stats (ms per sim step, incl. bots)
  private readonly tickSamples = new Float64Array(TICK_SAMPLES);
  private tickCount = 0;
  private tickTotal = 0;

  async onCreate(options: BattleCreateOptions = {}) {
    this.game = getGameImpl();
    this.maxPlayers = clampInt(options.maxPlayers, 1, MAX_PLAYERS, MAX_PLAYERS);
    this.isMain = options.__main === MAIN_TOKEN;
    if (this.isMain) {
      this.roomId = MAIN_ROOM_ID;
      this.autoDispose = false;
      this.botTarget = BOTS_MAIN;
    } else {
      this.botTarget = clampInt(options.bots, 0, this.maxPlayers - 1, DEFAULT_BOTS);
      this.code = allocateRoomCode();
      this.roomId = this.code;
      if (options.private) await this.setPrivate(true);
    }

    this.sim = this.game.createSimulation({ minPlayers: 2 });
    this.setPatchRate(1000 / PATCH_RATE);
    this.setSimulationInterval((dt) => this.update(dt), TICK_MS);

    this.onMessage(MSG.input, (client, msg: unknown) => this.handleInput(client, msg));
    this.onMessage(MSG.chat, (client, msg: unknown) => this.handleChat(client, msg));
    this.onMessage(MSG.profile, (client, msg: unknown) => this.handleProfile(client, msg));
    this.onMessage(MSG.play, (client, msg: unknown) => this.handlePlay(client, msg === true));
    this.onMessage(MSG.ping, (client, msg: unknown) => {
      const h = this.humans.get(client.sessionId);
      if (!h || typeof msg !== 'number' || !Number.isFinite(msg) || !h.pings.take()) return;
      client.send(MSG.ping, { t: msg });
    });
    this.updateMeta();
  }

  onJoin(client: Client, options?: Partial<JoinOptions> & { play?: boolean }) {
    this.humans.set(client.sessionId, {
      name: sanitizeName(options?.name),
      skin: clampSkin(options?.skin),
      playing: false,
      lastSeq: 0,
      connected: true,
      lastChat: 0,
      inputs: new TokenBucket(TICK_RATE / 2, TICK_RATE * 1.25),
      profile: new TokenBucket(3, 0.5),
      pings: new TokenBucket(5, 2),
      plays: new TokenBucket(4, 1),
      droppedFrames: 0,
    });
    if (options?.play === true) this.setPlaying(client, true);
    this.updateMeta();
  }

  onDrop(client: Client) {
    const h = this.humans.get(client.sessionId);
    if (h) {
      h.connected = false;
      if (h.playing) {
        // Freeze: the sim repeats the last input, so feed it a neutral one.
        h.lastSeq += 1;
        this.sim.pushInput(client.sessionId, { seq: h.lastSeq, dx: 0, dy: 0, buttons: 0 });
      }
    }
    // On expiry Colyseus calls onLeave(), which removes the player.
    // (rejects when the room is disposing, e.g. on shutdown)
    Promise.resolve(this.allowReconnection(client, BattleRoom.reconnectSeconds)).catch(() => {});
  }

  onReconnect(client: Client) {
    const h = this.humans.get(client.sessionId);
    if (h) h.connected = true; // a player is still in the sim: playing state is restored as-is
  }

  onLeave(client: Client) {
    const id = client.sessionId;
    const h = this.humans.get(id);
    if (!h) return;
    if (h.playing) this.leaveArena(id, h);
    this.humans.delete(id);
    this.reconcileBots();
    this.updateMeta();
  }

  onDispose() {
    if (this.code) releaseRoomCode(this.code);
  }

  onBeforePatch() {
    const s = this.state;
    syncWorld(s, this.sim.state);
    const spectators = this.humans.size - this.playingCount();
    if (s.spectators !== spectators) s.spectators = spectators;
    if (s.maxPlayers !== this.maxPlayers) s.maxPlayers = this.maxPlayers;
    if (this.events.length > 0) {
      (this as Room).broadcast(MSG.events, this.events, { afterNextPatch: true });
      this.events = [];
    }
  }

  // ------------------------------------------------------------------ arena entry / exit

  private playingCount() {
    let n = 0;
    for (const h of this.humans.values()) if (h.playing) n++;
    return n;
  }

  private handlePlay(client: Client, enabled: boolean) {
    const h = this.humans.get(client.sessionId);
    if (!h) return;
    if (!h.plays.take()) {
      this.reply(client, { playing: h.playing, reason: 'rate' });
      return;
    }
    this.setPlaying(client, enabled);
    this.updateMeta();
  }

  private setPlaying(client: Client, enabled: boolean) {
    const id = client.sessionId;
    const h = this.humans.get(id)!;
    if (enabled === h.playing) { this.reply(client, { playing: h.playing }); return; }
    if (!enabled) {
      this.leaveArena(id, h);
      this.reconcileBots();
      this.reply(client, { playing: false });
      return;
    }
    // need a free slot: drop a bot first if the arena is full
    if (this.sim.state.players.size >= this.maxPlayers) this.removeBots(1, true);
    if (this.sim.state.players.size >= this.maxPlayers) {
      this.whisper(client, T.full);
      this.reply(client, { playing: false, reason: 'full' });
      return;
    }
    h.playing = true;
    this.sim.addPlayer({ id, name: h.name, skin: h.skin });
    this.systemChat(T.joined(h.name));
    this.reconcileBots();
    this.reply(client, { playing: true });
  }

  private leaveArena(id: string, h: Human) {
    h.playing = false;
    this.sim.removePlayer(id);
    this.systemChat(T.left(h.name));
  }

  private reply(client: Client, r: PlayReply) {
    client.send(MSG.play, r);
  }

  // ------------------------------------------------------------------ simulation

  private update(dtMs: number) {
    this.acc += dtMs;
    let steps = 0;
    while (this.acc >= TICK_MS) {
      if (steps >= MAX_CATCHUP) { this.acc = 0; break; }
      this.stepOnce();
      this.acc -= TICK_MS;
      steps++;
    }
  }

  private stepOnce() {
    const t0 = performance.now();
    const sim = this.sim;
    const world = sim.state;
    if (this.bots.size > 0) {
      let i = 0;
      for (const [id, slot] of this.bots) {
        if ((world.tick + i++) % BOT_THINK_EVERY !== 0) continue;
        const f = slot.bot.think(world);
        sim.pushInput(id, { seq: ++slot.seq, dx: f.dx, dy: f.dy, buttons: f.buttons });
      }
    }
    const ev = sim.step();
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i]!;
      this.events.push(e);
      switch (evType(e)) {
        case 'roundOver': this.announceWinner((e as { winner: string }).winner); break;
        case 'zoneWarning': this.systemChat(T.zoneWarning((e as { seconds?: number }).seconds ?? 15)); break;
        case 'zoneCancel': this.systemChat(T.zoneCancel); break;
      }
    }
    const w = sim.state;
    if (w.width !== this.lastW || w.height !== this.lastH) {
      if (this.lastW !== 0) this.systemChat(T.mapResized);
      this.lastW = w.width;
      this.lastH = w.height;
    }
    if (w.phase !== this.lastPhase || w.round !== this.lastRound) {
      this.lastPhase = w.phase;
      this.lastRound = w.round;
      this.reconcileBots();
      this.updateMeta();
    } else if (w.tick % TICK_RATE === 0) {
      this.reconcileBots();
    }
    const dt = performance.now() - t0;
    this.tickSamples[this.tickCount % TICK_SAMPLES] = dt;
    this.tickCount++;
    this.tickTotal += dt;
  }

  resetTickStats() {
    this.tickCount = 0;
    this.tickTotal = 0;
  }

  /** Tick timing (ms): avg since the last reset, p99 / max over the last 4096 ticks. */
  getTickStats() {
    const n = Math.min(this.tickCount, TICK_SAMPLES);
    const s = Array.from(this.tickSamples.subarray(0, n)).sort((a, b) => a - b);
    return {
      ticks: this.tickCount,
      avg: this.tickCount ? this.tickTotal / this.tickCount : 0,
      p99: n ? s[Math.min(n - 1, Math.floor(n * 0.99))]! : 0,
      max: n ? s[n - 1]! : 0,
    };
  }

  // ------------------------------------------------------------------ bots

  /**
   * Main room: BOTS_MAIN bots only while exactly one human plays (default 0, canon).
   * Other rooms: fill up to `bots` while human players are few, never below 2 players total.
   */
  private desiredBots(): number {
    const n = this.playingCount();
    if (this.isMain) return n === 1 ? Math.min(this.botTarget, this.maxPlayers - 1) : 0;
    if (n === 0 || this.botTarget === 0) return 0;
    const want = Math.max(this.botTarget - (n - 1), 2 - n, 0);
    return Math.min(want, this.maxPlayers - n);
  }

  private reconcileBots() {
    const want = this.desiredBots();
    while (this.bots.size < want && this.sim.state.players.size < this.maxPlayers) this.addBot();
    if (this.bots.size <= want) return;
    const phase = this.sim.state.phase;
    const between = phase === Phase.Waiting || phase === Phase.RoundOver || phase === Phase.Countdown;
    this.removeBots(this.bots.size - want, between || this.sim.state.players.size > this.maxPlayers);
    this.updateMeta();
  }

  /** Remove up to `n` bots; dead / spectating bots first, live ones only if `force`. */
  private removeBots(n: number, force: boolean) {
    const ordered = [...this.bots.keys()].sort((a, b) => this.botScore(a) - this.botScore(b));
    for (const id of ordered) {
      if (n <= 0) break;
      if (!force && this.botScore(id) > 0) continue;
      this.bots.delete(id);
      this.sim.removePlayer(id);
      n--;
    }
  }

  private botScore(id: string) {
    const p = this.sim.state.players.get(id);
    return !p || !p.alive || !p.inRound ? 0 : 1;
  }

  private addBot() {
    const n = this.botCounter++;
    const id = `bot-${n}`;
    const name = BOT_NAMES[n % BOT_NAMES.length]!.slice(0, NAME_MAX);
    this.sim.addPlayer({ id, name, skin: (n * 7 + 3) % SKIN_COUNT, isBot: true });
    this.bots.set(id, { bot: this.game.createBot(id, this.sim), seq: 0 });
  }

  // ------------------------------------------------------------------ messages

  private handleInput(client: Client, msg: unknown) {
    const id = client.sessionId;
    const h = this.humans.get(id);
    if (!h || !h.playing || !Array.isArray(msg) || msg.length === 0) return;
    const start = Math.max(0, msg.length - MAX_INPUT_BATCH);
    for (let i = start; i < msg.length; i++) {
      const f = parseFrame(msg[i]);
      if (!f || f.seq <= h.lastSeq) continue;
      if (!h.inputs.take()) { h.droppedFrames++; continue; }
      h.lastSeq = f.seq;
      this.sim.pushInput(id, f);
    }
  }

  private handleChat(client: Client, msg: unknown) {
    const h = this.humans.get(client.sessionId);
    if (!h) return;
    const now = Date.now();
    if (now - h.lastChat < CHAT_COOLDOWN_MS) return;
    const text = cleanText(msg, CHAT_MAX);
    if (!text) return;
    h.lastChat = now;
    const m: ChatMessage = { from: client.sessionId, name: h.name, text, at: now };
    this.broadcast(MSG.chat, m);
  }

  private handleProfile(client: Client, msg: unknown) {
    const id = client.sessionId;
    const h = this.humans.get(id);
    if (!h || !msg || typeof msg !== 'object' || !h.profile.take()) return;
    const o = msg as Record<string, unknown>;
    const p: { name?: string; skin?: number } = {};
    if (typeof o.name === 'string') {
      const name = cleanText(o.name, NAME_MAX);
      if (name && name !== h.name) {
        if (h.playing) this.systemChat(T.renamed(h.name, name));
        h.name = p.name = name;
      }
    }
    if (o.skin !== undefined) h.skin = p.skin = clampSkin(o.skin);
    if (h.playing && (p.name !== undefined || p.skin !== undefined)) this.sim.updateProfile(id, p);
  }

  private systemChat(text: string) {
    const m: ChatMessage = { from: '', name: '', text, at: Date.now() };
    this.broadcast(MSG.chat, m);
  }

  private whisper(client: Client, text: string) {
    const m: ChatMessage = { from: '', name: '', text, at: Date.now() };
    client.send(MSG.chat, m);
  }

  private announceWinner(winner: string) {
    const p = winner ? this.sim.state.players.get(winner) : undefined;
    this.systemChat(p ? T.winner(p.name) : T.noWinner);
  }

  private updateMeta() {
    const w = this.sim?.state;
    const players = this.playingCount();
    const meta: RoomMeta = {
      humans: players,
      bots: this.bots.size,
      spectators: this.humans.size - players,
      phase: w?.phase ?? Phase.Waiting,
      round: w?.round ?? 0,
      maxPlayers: this.maxPlayers,
      main: this.isMain,
    };
    const m = this.metadata;
    if (m && m.humans === meta.humans && m.bots === meta.bots && m.spectators === meta.spectators
      && m.phase === meta.phase && m.round === meta.round) return;
    void this.setMetadata(meta);
  }

  // test / diagnostics helpers
  get humanCount() { return this.playingCount(); }
  get clientCount() { return this.humans.size; }
  get botCount() { return this.bots.size; }
  get roomCode() { return this.code || this.roomId; }
}
