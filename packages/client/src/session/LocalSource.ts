// Offline GameSource: runs the authoritative Simulation in the browser with bots.
// Used for «Против ботов» and as the live attract-mode world behind the menu.

import {
  Bot, BombMotion, Simulation, TICK_MS,
  type BotDifficulty, type GameEvent, type InputFrame, type PlayerState, type WorldState,
} from '@ob/game';
import type { GameSource } from '../contracts';
import { copyBomb, copyPlayer, emptyWorld, newBomb, newPlayer } from '../net/readModel';

const LOCAL_ID = 'local';
const BOT_NAMES = ['Бабах', 'Фитиль', 'Сапёр', 'Искра', 'Пороховой', 'Динамит', 'Шашка', 'Хлопушка', 'Петарда', 'Запал', 'Тротил'];
const MAX_CATCHUP = 8; // ticks per frame after a long stall (tab switch)
/** Moved farther than this in one tick (respawn, new round, wrap): no interpolation. */
const TELEPORT = 0.5;

interface Prev { x: number; y: number; progress: number; tick: number }

export interface LocalSourceOptions {
  bots: number;
  difficulty?: BotDifficulty;
  /** Join the arena right away as the local player. */
  play?: boolean;
  name?: string;
  skin?: number;
  seed?: number;
}

export class LocalSource implements GameSource {
  readonly sim: Simulation;
  readonly ping = 0;
  private bots: Bot[] = [];
  private events: GameEvent[] = [];
  private acc = 0;
  private seq = 0;
  private playing = false;
  private profile: { name: string; skin: number };
  /** What the renderer sees: the sim state with players / moving bombs drawn between the last
   *  two ticks (fixed-step interpolation), so motion is even at any refresh rate. */
  private readonly view: WorldState = emptyWorld();
  private readonly prevPlayers = new Map<string, Prev>();
  private readonly prevBombs = new Map<number, Prev>();

  constructor(opts: LocalSourceOptions) {
    this.sim = new Simulation({ seed: opts.seed ?? (Math.random() * 0x7fffffff) | 0 });
    this.profile = { name: opts.name ?? 'Игрок', skin: opts.skin ?? 0 };
    const difficulty = opts.difficulty ?? 'normal';
    for (let i = 0; i < opts.bots; i++) {
      const id = `bot${i}`;
      this.sim.addPlayer({ id, name: BOT_NAMES[i % BOT_NAMES.length], skin: (i * 3 + 1) % 11, isBot: true });
      this.bots.push(new Bot(id, difficulty));
    }
    if (opts.play) this.play(true);
    this.compose(0);
  }

  get world(): WorldState { return this.view; }
  get localId(): string { return this.playing ? LOCAL_ID : ''; }
  get isPlaying(): boolean { return this.playing; }

  get players(): PlayerState[] {
    return [...this.sim.state.players.values()];
  }

  play(enabled: boolean): Promise<boolean> {
    if (enabled && !this.playing) {
      this.sim.addPlayer({ id: LOCAL_ID, name: this.profile.name, skin: this.profile.skin });
      this.playing = true;
    } else if (!enabled && this.playing) {
      this.sim.removePlayer(LOCAL_ID);
      this.playing = false;
    }
    return Promise.resolve(this.playing);
  }

  setProfile(p: { name?: string; skin?: number }) {
    Object.assign(this.profile, p);
    if (this.playing) this.sim.updateProfile(LOCAL_ID, p);
  }

  update(dtMs: number, input: Omit<InputFrame, 'seq'>): void {
    this.acc = Math.min(this.acc + dtMs, TICK_MS * MAX_CATCHUP);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      const world = this.sim.state;
      for (const bot of this.bots) {
        if (world.players.has(bot.id)) this.sim.pushInput(bot.id, bot.think(world));
      }
      if (this.playing) this.sim.pushInput(LOCAL_ID, { ...input, seq: ++this.seq });
      this.remember();
      const evs = this.sim.step();
      for (let i = 0; i < evs.length; i++) this.events.push(evs[i]);
    }
    this.compose(this.acc / TICK_MS);
  }

  /** Positions before the coming tick. */
  private remember() {
    const w = this.sim.state;
    for (const p of w.players.values()) setPrev(this.prevPlayers, p.id, p.x, p.y, 0, w.tick);
    for (const b of w.bombs.values()) if (b.motion === BombMotion.Sliding || b.motion === BombMotion.Flying) setPrev(this.prevBombs, b.id, b.x, b.y, b.progress, w.tick);
  }

  private compose(a: number) {
    const w = this.sim.state;
    const v = this.view;
    v.tick = w.tick; v.seed = w.seed; v.phase = w.phase; v.phaseTicks = w.phaseTicks; v.round = w.round;
    v.width = w.width; v.height = w.height; v.tiles = w.tiles; v.winner = w.winner; v.nextId = w.nextId;
    v.flames = w.flames; v.pickups = w.pickups; v.falling = w.falling;
    v.zoneRing = w.zoneRing; v.zoneIn = w.zoneIn;
    const last = w.tick - 1; // prev entries written right before the newest tick

    for (const p of w.players.values()) {
      let q = v.players.get(p.id);
      if (!q) { q = newPlayer(p.id); v.players.set(p.id, q); }
      copyPlayer(p, q);
      const pr = this.prevPlayers.get(p.id);
      if (pr && pr.tick === last && Math.abs(p.x - pr.x) + Math.abs(p.y - pr.y) < TELEPORT) {
        q.x = pr.x + (p.x - pr.x) * a;
        q.y = pr.y + (p.y - pr.y) * a;
      }
    }
    if (v.players.size !== w.players.size) for (const id of v.players.keys()) if (!w.players.has(id)) { v.players.delete(id); this.prevPlayers.delete(id); }

    for (const b of w.bombs.values()) {
      let c = v.bombs.get(b.id);
      if (!c) { c = newBomb(b.id); v.bombs.set(b.id, c); }
      copyBomb(b, c);
      const pr = this.prevBombs.get(b.id);
      if (!pr || pr.tick !== last) continue;
      if (b.motion === BombMotion.Sliding && Math.abs(b.x - pr.x) + Math.abs(b.y - pr.y) < TELEPORT) {
        c.x = pr.x + (b.x - pr.x) * a;
        c.y = pr.y + (b.y - pr.y) * a;
      } else if (b.motion === BombMotion.Flying && b.progress >= pr.progress) {
        c.progress = pr.progress + (b.progress - pr.progress) * a;
      }
    }
    if (v.bombs.size !== w.bombs.size) for (const id of v.bombs.keys()) if (!w.bombs.has(id)) { v.bombs.delete(id); this.prevBombs.delete(id); }
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  dispose(): void {
    this.events = [];
    this.bots = [];
  }
}

function setPrev(m: Map<string, Prev>, id: string, x: number, y: number, progress: number, tick: number): void;
function setPrev(m: Map<number, Prev>, id: number, x: number, y: number, progress: number, tick: number): void;
function setPrev(m: Map<string | number, Prev>, id: string | number, x: number, y: number, progress: number, tick: number) {
  const p = m.get(id);
  if (p) { p.x = x; p.y = y; p.progress = progress; p.tick = tick; }
  else m.set(id, { x, y, progress, tick });
}
