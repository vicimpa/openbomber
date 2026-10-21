// One battle = one Colyseus room wrapping one authoritative Simulation.
//
// Canon: clients join as SPECTATORS (not in the sim). MSG.play true/false enters / leaves
// the arena. The main public room ('MAIN') is created at boot and never disposed; private
// and vs-bots rooms are extras.

import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import {
  BOT_DIFFICULTIES, Button, MAX_PLAYERS, MSG, PATCH_RATE, Phase, TICK_MS, TICK_RATE, unpackAxis,
  type BotDifficultyName, type MatchConfig, type RoomSettings,
  type ChatMessage, type GameEvent, type IBot, type ISimulation, type InputFrame, type JoinOptions,
  type RoomOptions,
} from '@ob/game';
import { getGameImpl, type GameImpl } from './game.ts';
import { BattleState, type PlayReply, type RoomMeta } from './schema.ts';
import { admit, clientJoined, clientLeft, roomCreated, roomDisposed, sweepIps } from './limits.ts';
import { discordEnabled, discordUser, forgetDiscordRoom, type DiscordUser } from './discord.ts';
import { syncWorld } from './sync.ts';
import {
  CHAT_COOLDOWN_MS, CHAT_MAX, MAIN_ROOM_ID, NAME_MAX, SKIN_COUNT, TokenBucket, allocateRoomCode, clampInt,
  clampSkin, cleanText, cryptoU32, playerName, releaseRoomCode, uniqueName,
} from './util.ts';

/** Own rooms start without bots; the creator adds them in the room settings. */
export const DEFAULT_BOTS = 0;
/** Max frames accepted per input message (client sends 2 per message normally). */
export const MAX_INPUT_BATCH = 12;
/** Bots think every N ticks (staggered). Bot's internal timers assume 1. */
export const BOT_THINK_EVERY = 1;
/** Connected clients per room (players + spectators). */
export const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 200;
/** Shared arena: while anyone is watching or playing, bots top the arena up to this many players. */
export const MAIN_SPARRING = clampInt(Number(process.env.MAIN_SPARRING), 0, MAX_PLAYERS - 1, 1);
/** «Отключиться» mid-round: the hero stays in the arena this long (can't dodge a blast by leaving). */
export const LEAVE_GRACE_MS = 2000;
/** Nobody plays any more: the bots stand still this long (past the last hero's grace), then leave too. */
export const BOTS_LINGER_MS = LEAVE_GRACE_MS + 1000;
/** While playing, a rename is accepted (and announced) at most this often. */
export const RENAME_COOLDOWN_MS = 30_000;
/** Max fixed steps per timer callback before dropping the backlog (e.g. after a GC pause). */
const MAX_CATCHUP = 6;
const TICK_SAMPLES = 4096;
/** Host clicking the bot stepper: wait this long after the last click before restarting. */
const ROSTER_DEBOUNCE_MS = 1200;

const BUTTON_MASK = Button.Bomb | Button.Action | Button.Teleport;
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
  wait: 'Герой ещё уходит с арены, подожди пару секунд',
  chatSlow: 'Не так быстро: не больше одного сообщения в 2 секунды',
  newHost: (n: string) => `${n} теперь управляет комнатой`,
  rosterRestart: 'Состав ботов изменён: новый раунд',
  settings: (s: RoomSettings) =>
    `Настройки комнаты: ботов ${s.bots} (${DIFFICULTY_RU[s.botDifficulty]}), игроков до ${s.maxPlayers}, зона ${s.zone ? 'вкл' : 'выкл'}, дождь ${s.events ? 'вкл' : 'выкл'}`,
  rainPickups: 'С неба сыплются бонусы!',
  rainBombs: 'Бомбопад! Берегитесь теней',
};

const DIFFICULTY_RU: Record<BotDifficultyName, string> = { easy: 'легко', normal: 'нормально', hard: 'жёстко' };

/** Server-only token: only startGameServer() may create the main room. */
export const MAIN_TOKEN = crypto.randomUUID();

interface Human {
  /** Per-IP limits key: the IP, or `discord:<user id>` (Discord's proxy hides the IPs). */
  ip: string;
  name: string;
  /** Joined from the Discord activity: the name is theirs from Discord and can't be changed. */
  discord: DiscordUser | null;
  skin: number;
  playing: boolean;
  /** Pending removal from the arena after «Отключиться» (LEAVE_GRACE_MS). */
  leaving: { clear(): void } | null;
  lastRename: number;
  lastSeq: number;
  connected: boolean;
  lastChat: number;
  /** Last «too fast» whisper (so the hint itself can't be spammed). */
  lastSlowHint: number;
  inputs: TokenBucket;
  profile: TokenBucket;
  pings: TokenBucket;
  plays: TokenBucket;
  settings: TokenBucket;
  droppedFrames: number;
}

interface BotSlot {
  bot: IBot;
  seq: number;
}

export type BattleCreateOptions = RoomOptions & Partial<JoinOptions> & { __main?: string; play?: boolean; discordInstance?: string };

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

  /**
   * Matchmaking gate (runs before a room is created or a seat reserved): per-IP request rate,
   * concurrent connections and room creations, plus a global room cap. See ./limits.ts.
   * `discord` (an access token, see ./discord.ts) is resolved to the Discord user here.
   */
  static async onAuth(_token: string, options: BattleCreateOptions, context: AuthContext) {
    let discord: DiscordUser | null = null;
    if (options?.discord !== undefined) {
      if (!discordEnabled()) throw new ServerError(503, 'Вход через Discord сейчас недоступен');
      discord = await discordUser(options.discord);
      if (!discord) throw new ServerError(401, 'Discord не подтвердил вход, перезапустите активность');
    }
    const ip = discord ? `discord:${discord.id}` : context.ip ?? 'unknown';
    const url = String((context.req as { url?: string } | undefined)?.url ?? '');
    const creating = /\/create\//.test(url) && options?.__main !== MAIN_TOKEN;
    const denied = admit(ip, creating);
    if (denied === 'rate') throw new ServerError(429, 'Слишком много запросов, попробуйте позже');
    if (denied === 'clients') throw new ServerError(429, 'Слишком много подключений с вашего адреса');
    if (denied === 'rooms') throw new ServerError(503, 'Сервер переполнен, попробуйте позже');
    return { ip, discord };
  }

  state = new BattleState();
  maxClients = MAX_CLIENTS;
  maxMessagesPerSecond = 120;

  sim!: ISimulation;
  /** Max players in the sim (humans + bots); everyone else spectates. */
  maxPlayers = MAX_PLAYERS;
  isMain = false;
  private game!: GameImpl;
  private code = '';
  /** Room of a Discord activity instance (see ./discord.ts). */
  private discordInstance = '';
  /** Own rooms: what the creator set (the shared arena ignores bots / maxPlayers here). */
  private rosterTimer: { clear(): void } | null = null;
  /** Set while the bots stand still with no human playing, until they leave (BOTS_LINGER_MS). */
  private botsLeaving: { clear(): void } | null = null;
  private rosterBefore: Set<string> | null = null;
  private settings: RoomSettings = { bots: DEFAULT_BOTS, botDifficulty: 'normal', maxPlayers: MAX_PLAYERS, zone: true, events: true };
  private simConfig!: MatchConfig;
  private ownerId = '';
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
    this.settings.maxPlayers = this.maxPlayers;
    if (this.isMain) {
      this.roomId = MAIN_ROOM_ID;
      this.autoDispose = false;
    } else {
      this.settings.bots = clampInt(options.bots, 0, this.maxPlayers - 1, DEFAULT_BOTS);
      if (BOT_DIFFICULTIES.includes(options.botDifficulty as BotDifficultyName)) this.settings.botDifficulty = options.botDifficulty!;
      this.code = allocateRoomCode();
      this.roomId = this.code;
      if (typeof options.discordInstance === 'string') this.discordInstance = options.discordInstance;
      if (options.private) await this.setPrivate(true);
    }

    roomCreated();
    // Crypto seed + entropy: hidden information (pickups in bricks, crazy bombs, Random rolls)
    // can't be reconstructed from the visible map by a client that runs the same simulation.
    this.simConfig = { minPlayers: 2, seed: cryptoU32(), entropy: cryptoU32, zone: true, overtime: true, shapes: true, scenery: true };
    this.sim = this.game.createSimulation(this.simConfig);
    this.setPatchRate(1000 / PATCH_RATE);
    this.setSimulationInterval((dt) => this.update(dt), TICK_MS);

    this.onMessage(MSG.input, (client, msg: unknown) => this.handleInput(client, msg));
    this.onMessage(MSG.chat, (client, msg: unknown) => this.handleChat(client, msg));
    this.onMessage(MSG.profile, (client, msg: unknown) => this.handleProfile(client, msg));
    this.onMessage(MSG.play, (client, msg: unknown) => this.handlePlay(client, msg === true));
    this.onMessage(MSG.settings, (client, msg: unknown) => this.handleSettings(client, msg));
    this.onMessage(MSG.ping, (client, msg: unknown) => {
      const h = this.humans.get(client.sessionId);
      if (!h || typeof msg !== 'number' || !Number.isFinite(msg) || !h.pings.take()) return;
      client.send(MSG.ping, { t: msg });
    });
    this.updateMeta();
  }

  onJoin(client: Client, options?: Partial<JoinOptions> & { play?: boolean }, auth?: { ip?: string; discord?: DiscordUser | null }) {
    const ip = auth?.ip ?? 'unknown';
    const discord = auth?.discord ?? null;
    clientJoined(ip);
    this.humans.set(client.sessionId, {
      ip,
      discord,
      name: uniqueName(playerName(discord ? discord.name : options?.name), this.names()),
      skin: clampSkin(options?.skin),
      playing: false,
      leaving: null,
      lastRename: 0,
      lastSeq: 0,
      connected: true,
      lastChat: 0,
      lastSlowHint: 0,
      inputs: new TokenBucket(TICK_RATE / 2, TICK_RATE * 1.25),
      profile: new TokenBucket(3, 0.5),
      pings: new TokenBucket(5, 2),
      plays: new TokenBucket(4, 1),
      settings: new TokenBucket(10, 4),
      droppedFrames: 0,
    });
    if (discord) this.state.avatars.set(client.sessionId, discord.avatar);
    // own rooms: the first person in becomes the host (room settings)
    if (!this.isMain && !this.ownerId) this.ownerId = client.sessionId;
    if (options?.play === true) this.setPlaying(client, true);
    this.reconcileBots();
    this.updateMeta();
  }

  onDrop(client: Client) {
    const h = this.humans.get(client.sessionId);
    if (h) {
      h.connected = false;
      // the host lost the connection: the room doesn't wait for them, the next one in takes over
      this.handOver(client.sessionId);
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
    if (!h) return;
    h.connected = true; // a player is still in the sim: playing state is restored as-is
    if (!this.isMain && !this.ownerId) this.ownerId = client.sessionId; // everyone else had left
  }

  onLeave(client: Client) {
    const id = client.sessionId;
    const h = this.humans.get(id);
    if (!h) return;
    if (h.playing || h.leaving) this.leaveArena(id, h, true);
    this.humans.delete(id);
    this.state.avatars.delete(id);
    clientLeft(h.ip);
    this.handOver(id);
    this.reconcileBots();
    this.updateMeta();
  }

  /** The host is gone: the room passes to whoever joined next (join order) and is still connected. */
  private handOver(from: string) {
    if (this.isMain || this.ownerId !== from) return;
    this.ownerId = '';
    for (const [id, h] of this.humans) {
      if (id === from || !h.connected) continue;
      this.ownerId = id;
      this.systemChat(T.newHost(h.name));
      break;
    }
  }

  onDispose() {
    if (this.code) releaseRoomCode(this.code);
    if (this.discordInstance) forgetDiscordRoom(this.discordInstance, this.roomId);
    roomDisposed();
    sweepIps();
  }

  /** Names in use in this room (humans + bots). */
  private *names(except?: string) {
    for (const [id, h] of this.humans) if (id !== except) yield h.name;
    for (const p of this.sim.state.players.values()) if (p.id !== except && p.isBot) yield p.name;
  }

  onBeforePatch() {
    const s = this.state;
    syncWorld(s, this.sim.state);
    const spectators = this.humans.size - this.playingCount();
    if (s.spectators !== spectators) s.spectators = spectators;
    if (s.maxPlayers !== this.maxPlayers) s.maxPlayers = this.maxPlayers;
    if (s.ownerId !== this.ownerId) s.ownerId = this.ownerId;
    const st = this.settings;
    if (s.bots !== st.bots) s.bots = st.bots;
    const diff = BOT_DIFFICULTIES.indexOf(st.botDifficulty);
    if (s.botDifficulty !== diff) s.botDifficulty = diff;
    if (s.zone !== st.zone) s.zone = st.zone;
    if (s.events !== st.events) s.events = st.events;
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
    if (enabled && h.leaving) {
      // still walking out of the arena (LEAVE_GRACE_MS after «Отключиться»): no coming straight
      // back, or leaving could be used to dodge and then carry on
      this.whisper(client, T.wait);
      this.reply(client, { playing: false, reason: 'wait' });
      return;
    }
    if (enabled === h.playing) { this.reply(client, { playing: h.playing }); return; }
    if (!enabled) {
      this.leaveArena(id, h, true);
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

  /**
   * Take a hero out of the arena. With `grace`, a hero still alive in a running round stays
   * (standing still, still killable) for LEAVE_GRACE_MS, so leaving can't dodge a blast or
   * deny a kill.
   */
  private leaveArena(id: string, h: Human, grace = false) {
    h.playing = false;
    const p = this.sim.state.players.get(id);
    const live = !!p && p.alive && p.inRound
      && (this.sim.state.phase === Phase.Playing || this.sim.state.phase === Phase.SuddenDeath);
    if (h.leaving) { h.leaving.clear(); h.leaving = null; }
    if (grace && live) {
      h.lastSeq += 1;
      this.sim.pushInput(id, { seq: h.lastSeq, dx: 0, dy: 0, buttons: 0 });
      h.leaving = this.clock.setTimeout(() => {
        h.leaving = null;
        if (h.playing) return;
        this.sim.removePlayer(id);
        this.systemChat(T.left(h.name));
        this.reconcileBots();
        this.updateMeta();
      }, LEAVE_GRACE_MS);
      return;
    }
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
    if (this.bots.size > 0 && !this.botsLeaving) {
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
        case 'skyRain': this.systemChat((e as { kind: string }).kind === 'bombs' ? T.rainBombs : T.rainPickups); break;
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
   * Shared arena: empty without players; a lone player gets MAIN_SPARRING sparring bots, which
   * leave once a second player is in (at the end of the round: live bots go between rounds).
   * Own rooms: exactly the creator's `bots`, as far as free slots allow.
   * Other rooms: fill up to `bots` while human players are few, never below 2 players total.
   */
  private desiredBots(): number {
    const n = this.playingCount();
    if (this.isMain) return n === 1 ? Math.min(MAIN_SPARRING, this.maxPlayers - 1) : 0;
    if (n === 0) return 0;
    return Math.max(0, Math.min(this.settings.bots, this.maxPlayers - n));
  }

  /** `force`: remove live bots too (the round is about to restart anyway). */
  private reconcileBots(force = false) {
    const want = this.desiredBots();
    while (this.bots.size < want && this.sim.state.players.size < this.maxPlayers) this.addBot();
    if (this.bots.size > want) {
      const phase = this.sim.state.phase;
      const between = phase === Phase.Waiting || phase === Phase.RoundOver || phase === Phase.Countdown;
      this.removeBots(this.bots.size - want, force || between || this.sim.state.players.size > this.maxPlayers);
      this.updateMeta();
    }
    this.idleBots(this.bots.size > 0 && this.playingCount() === 0);
  }

  /**
   * The last human stopped playing mid-round (e.g. a 1-on-1 with the sparring bot): the bots
   * freeze, still killable, and leave the arena a moment after that hero is gone.
   */
  private idleBots(idle: boolean) {
    if (!idle) {
      this.botsLeaving?.clear();
      this.botsLeaving = null;
      return;
    }
    if (this.botsLeaving) return;
    for (const [id, slot] of this.bots) this.sim.pushInput(id, { seq: ++slot.seq, dx: 0, dy: 0, buttons: 0 });
    this.botsLeaving = this.clock.setTimeout(() => {
      this.botsLeaving = null;
      if (this.playingCount() > 0) return;
      this.removeBots(this.bots.size, true);
      this.updateMeta();
    }, BOTS_LINGER_MS);
  }

  /**
   * The host changed the bot count: once they stop clicking, swap the roster and restart the
   * round, so the change shows up right away on a map sized for it (not a round later).
   */
  private scheduleRosterRestart() {
    this.rosterTimer?.clear();
    // the roster before the first click (the periodic reconcile may add bots meanwhile)
    this.rosterBefore ??= new Set(this.bots.keys());
    this.rosterTimer = this.clock.setTimeout(() => {
      const before = this.rosterBefore!;
      this.rosterTimer = null;
      this.rosterBefore = null;
      this.reconcileBots(true);
      const changed = before.size !== this.bots.size || [...this.bots.keys()].some((id) => !before.has(id));
      if (!changed) return;
      this.sim.restartRound();
      this.systemChat(T.rosterRestart);
      this.updateMeta();
    }, ROSTER_DEBOUNCE_MS);
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
    this.bots.set(id, { bot: this.game.createBot(id, this.sim, this.settings.botDifficulty), seq: 0 });
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
    if (now - h.lastChat < CHAT_COOLDOWN_MS) {
      if (now - h.lastSlowHint >= CHAT_COOLDOWN_MS) {
        h.lastSlowHint = now;
        this.whisper(client, T.chatSlow);
      }
      return;
    }
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
    // Discord players keep their Discord name
    if (typeof o.name === 'string' && !h.discord && cleanText(o.name, NAME_MAX)) {
      const name = uniqueName(playerName(o.name), this.names(id));
      const now = Date.now();
      // a player in the arena may rename (and be announced) at most every RENAME_COOLDOWN_MS
      if (name !== h.name && (!h.playing || now - h.lastRename >= RENAME_COOLDOWN_MS)) {
        if (h.playing) {
          this.systemChat(T.renamed(h.name, name));
          h.lastRename = now;
        }
        h.name = p.name = name;
      }
    }
    if (o.skin !== undefined) h.skin = p.skin = clampSkin(o.skin);
    if (h.playing && (p.name !== undefined || p.skin !== undefined)) this.sim.updateProfile(id, p);
  }

  /** Own rooms: the host changes the room settings (validated, rate limited, announced). */
  private handleSettings(client: Client, msg: unknown) {
    const h = this.humans.get(client.sessionId);
    if (this.isMain || !h || client.sessionId !== this.ownerId || !msg || typeof msg !== 'object' || !h.settings.take()) return;
    const o = msg as Partial<Record<keyof RoomSettings, unknown>>;
    const s = this.settings;
    const prev = { ...s };
    if (o.maxPlayers !== undefined) s.maxPlayers = clampInt(o.maxPlayers, 2, MAX_PLAYERS, s.maxPlayers);
    if (o.bots !== undefined) s.bots = clampInt(o.bots, 0, MAX_PLAYERS - 1, s.bots);
    s.bots = Math.min(s.bots, s.maxPlayers - 1);
    if (BOT_DIFFICULTIES.includes(o.botDifficulty as BotDifficultyName)) s.botDifficulty = o.botDifficulty as BotDifficultyName;
    if (typeof o.zone === 'boolean') s.zone = o.zone;
    if (typeof o.events === 'boolean') s.events = o.events;
    if (prev.bots === s.bots && prev.botDifficulty === s.botDifficulty && prev.maxPlayers === s.maxPlayers
      && prev.zone === s.zone && prev.events === s.events) return;

    this.maxPlayers = s.maxPlayers;
    this.simConfig.zone = s.zone;
    this.simConfig.overtime = s.events;
    if (prev.botDifficulty !== s.botDifficulty) {
      for (const [id, slot] of this.bots) slot.bot = this.game.createBot(id, this.sim, s.botDifficulty);
    }
    if (prev.bots !== s.bots) this.scheduleRosterRestart();
    else this.reconcileBots();
    this.systemChat(T.settings(s));
    this.updateMeta();
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
