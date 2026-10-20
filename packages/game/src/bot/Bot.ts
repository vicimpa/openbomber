// Bot brain. Produces InputFrames exactly like a human client, so the server treats bots
// uniformly. Planning is a time-aware BFS over tiles against the shared danger map; the
// search knows what the bot holds (Ghost walks bricks, BombPass walks bombs) and the
// tricks use the rest (kick, throw, punch, line bombs, remote, fire touch, curses).

import type { IBot } from '../contract/api';
import {
  BASE_SPEED,
  BOMB_FUSE,
  BOUNCE_TIME,
  CHAIN_DELAY,
  CRAZY_FUSE_MAX,
  CRAZY_FUSE_MIN,
  FIRE_SPEED_MULT,
  FLAME_TIME,
  KICK_SPEED,
  MAX_BOMBS,
  MAX_RADIUS,
  PLAYER_RADIUS,
  PUNCH_DISTANCE,
  SPEED_MULT,
  THROW_DISTANCE,
  THROW_TIME,
  TICK_RATE,
  sec,
} from '../contract/constants';
import { Button, type InputFrame } from '../contract/protocol';
import {
  Ability,
  BombKind,
  BombMotion,
  Curse,
  Dir,
  DIR_VEC,
  Phase,
  PickupType,
  Tile,
  type BombState,
  type PlayerState,
  type TimedEffects,
  type WorldState,
} from '../contract/types';
import { FAST_CURSE_MULT, playerSpeed, SLOW_CURSE_MULT } from '../sim/movement';
import { MAX_LIVES } from '../sim/pickups';
import { hashString, Rng } from '../sim/rng';
import {
  analyze,
  bombPierces,
  crazyRadius,
  inBlast,
  INF,
  isSkull,
  landHops,
  landing,
  restful,
  slideStop,
  withExtraBomb,
  type Analysis,
} from './danger';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

interface Tuning {
  /** Ticks between full replans. */
  replan: number;
  /** Safety margin (ticks) around danger windows when planning normal moves. */
  margin: number;
  /** Chance per opportunity to skip a good bomb (sloppiness). */
  sloppy: number;
  /** Weight of hunting players vs. farming bricks. */
  aggression: number;
  /** Chance to take a trick (kick / throw / punch / line) when one is on. */
  skill: number;
  /** Ticks an ability / effect must be held before the bot starts using it. */
  notice: number;
  /** Ticks a remote bomb must age before it's set off for bricks. */
  remoteDelay: number;
  /** A remote bomb laid for enemies waits this long for one to walk in, then goes off anyway. */
  remoteTrap: number;
  /** Ticks an enemy must stand in our remote blast before we notice. */
  remoteReact: number;
  /** Ticks we may carry a bomb looking for a good throw. */
  carry: number;
  /** Safe tiles that must be reachable before dropping a bomb (fewer = easier to trap). */
  minSafe: number;
}

const TUNING: Record<BotDifficulty, Tuning> = {
  easy: {
    replan: 14, margin: 4, sloppy: 0.45, aggression: 0.4, skill: 0.35, notice: sec(2),
    remoteDelay: sec(2.5), remoteTrap: sec(5), remoteReact: 18, carry: sec(1), minSafe: 1,
  },
  normal: {
    replan: 7, margin: 7, sloppy: 0.15, aggression: 1, skill: 0.7, notice: sec(0.8),
    remoteDelay: sec(1.2), remoteTrap: sec(4), remoteReact: 6, carry: sec(2), minSafe: 3,
  },
  hard: {
    replan: 3, margin: 9, sloppy: 0, aggression: 1.6, skill: 1, notice: 0,
    remoteDelay: sec(0.5), remoteTrap: sec(3.5), remoteReact: 0, carry: sec(3), minSafe: 4,
  },
};

// what the bot has "noticed" it holds (bits of Bot.known)
const K_GHOST = 1;
const K_PASS = 2;
const K_KICK = 4;
const K_GLOVE = 8;
const K_PUNCH = 16;
const K_REMOTE = 32;
const K_LINE = 64;
const K_PIERCE = 128;
const K_FIRE = 256;
const K_SHIELD = 512;
const NOTICE: readonly (readonly [keyof TimedEffects, number])[] = [
  ['ghost', K_GHOST], ['bombPass', K_PASS], ['kick', K_KICK], ['glove', K_GLOVE], ['punch', K_PUNCH],
  ['remote', K_REMOTE], ['lineBomb', K_LINE], ['pierce', K_PIERCE], ['fire', K_FIRE], ['shield', K_SHIELD],
];

const STEP_DIRS = [Dir.Up, Dir.Left, Dir.Right, Dir.Down] as const;
const DX = [0, -1, 1, 0];
const DY = [-1, 0, 0, 1];
/** Fire this close (ticks) cancels scripted tricks. */
const IMMINENT = 45;
/** Only the nearest few opponents steer target scoring (keeps 32-bot maps cheap). */
const NEAREST_ENEMIES = 4;
/** Planning horizon in steps: keeps a replan bounded on 75x75 maps (far goals come from the enemy drift). */
const PLAN_STEPS = 26;
/** Only bombs this close (tiles, Chebyshev) trigger an immediate replan when they appear / go off. */
const BOMB_WATCH = 11;
/** Leave a brick at least this long before Ghost runs out (steering is never exact). */
const GHOST_MARGIN = sec(0.6);
/** Stop on a bomb only with this much BombPass left. */
const PASS_MARGIN = sec(0.4);
/** A brick is a hiding place only while Ghost lasts this much longer. */
const GHOST_HIDE = sec(3);
/** A timed boost that runs out sooner than this doesn't count for escape-time estimates. */
const BOOST_SURE = sec(2.5);
/** After throwing / kicking / punching into a blast that covers us, we need this long to get out. */
const SAFE_FUSE = 70;
/** Tricks only aim at enemies this close (Manhattan). */
const TRICK_RANGE = 12;
/** After skipping a trick (sloppiness), don't look for one for this long. */
const TRICK_PAUSE = 30;
/** Fire / cursed bots ram an enemy this close (tiles) straight on. */
const RAM_DIST = 1.6;
/** Never carry a bomb longer than this. */
const CARRY_MAX = sec(6);

function countNear(w: WorldState, p: PlayerState, r: number): number {
  let n = 0;
  for (const b of w.bombs.values()) if (Math.abs(b.x - p.x) <= r && Math.abs(b.y - p.y) <= r) n++;
  return n;
}

/** Ticks per tile for escape estimates: boosts about to run out don't count. */
function planTpt(p: PlayerState): number {
  const e = p.effects;
  let s = BASE_SPEED;
  if (e.speed > BOOST_SURE) s *= SPEED_MULT;
  if (e.fire > 0) s *= FIRE_SPEED_MULT;
  if (p.curse === Curse.Slow) s *= SLOW_CURSE_MULT;
  else if (p.curse === Curse.Fast && e.curse > BOOST_SURE) s *= FAST_CURSE_MULT;
  return TICK_RATE / s;
}

const TIMED_VALUE: Partial<Record<PickupType, [keyof TimedEffects, number]>> = {
  [PickupType.Kick]: ['kick', 30],
  [PickupType.Glove]: ['glove', 28],
  [PickupType.Punch]: ['punch', 20],
  [PickupType.Remote]: ['remote', 28],
  [PickupType.Pierce]: ['pierce', 30],
  [PickupType.LineBomb]: ['lineBomb', 22],
  [PickupType.BombPass]: ['bombPass', 25],
  [PickupType.Ghost]: ['ghost', 30],
  [PickupType.Shield]: ['shield', 45],
};

/** What a pickup is worth to `p` right now. */
function pickupValue(p: PlayerState, t: PickupType): number {
  const e = p.effects;
  switch (t) {
    case PickupType.BombUp:
      return p.bombs >= MAX_BOMBS ? 0 : p.bombs < 3 ? 45 : 30;
    case PickupType.FireUp:
      return p.radius >= MAX_RADIUS ? 0 : p.radius < 3 ? 45 : p.radius < 6 ? 30 : 12;
    case PickupType.FullFire:
      return p.radius >= MAX_RADIUS ? 0 : Math.min(60, 20 + 5 * (MAX_RADIUS - p.radius));
    case PickupType.SpeedUp:
      return e.fire > 0 ? 5 : e.speed > sec(10) ? 15 : 35; // it would cancel our Fire
    case PickupType.Fire:
      return e.speed > 0 ? 10 : e.fire > sec(10) ? 15 : 35;
    case PickupType.Heart:
      return p.lives >= MAX_LIVES ? 0 : 50;
    case PickupType.Crazy:
      return 2; // our own bombs turn unpredictable
    case PickupType.Skull:
      return -100;
    case PickupType.Random:
      return 20;
  }
  const tv = TIMED_VALUE[t];
  if (!tv) return 0;
  return e[tv[0]] > sec(10) ? tv[1] * 0.4 : tv[1]; // more time is worth less than the first dose
}

// ---------------------------------------------------------------- shared scratch buffers
// think() is synchronous, so all bots can share these.
let cap = 0;
/** Search stamp per tile: a tile is visited in the current search iff sMark[i] === mark. */
let sMark = new Int32Array(0);
let mark = 0;
let sSteps = new Int32Array(0);
let sPrev = new Int32Array(0);
let sQueue = new Int32Array(0);
let hStart = new Int32Array(0);
let hEnd = new Int32Array(0);
/** Blast stamp per tile (remote detonation checks). */
let bMark = new Int32Array(0);
let bStamp = 0;
function ensure(n: number) {
  if (n <= cap) return;
  cap = n;
  sMark = new Int32Array(n);
  mark = 0;
  sSteps = new Int32Array(n);
  sPrev = new Int32Array(n);
  sQueue = new Int32Array(n);
  hStart = new Int32Array(n);
  hEnd = new Int32Array(n);
  bMark = new Int32Array(n);
  bStamp = 0;
}

/** How the bot moves: ticks per tile, and ticks of Ghost / BombPass it may plan with. */
interface Mobility {
  tpt: number;
  /** Bricks are passable while (arrival + 1 tile) * tpt <= ghost. */
  ghost: number;
  /** Bombs are passable while (arrival + 1 tile) * tpt <= pass. */
  pass: number;
}

interface SearchOpts extends Mobility {
  start: number;
  margin: number;
  ds: Int32Array;
  de: Int32Array;
  allowSkull: boolean;
  selfId: string;
  maxSteps: number;
  /** Keep off tiles next to players on Fire (their touch kills). */
  fire: boolean;
  /** Keep off cursed players (their touch passes the curse). */
  curse: boolean;
  /** Ticks we wait on the start tile before setting off (fire in the way dies down first). */
  delay?: number;
  /** Ignore danger (emergency exit from a brick). */
  blind?: boolean;
  /** Treat tiles next to these players as blocked (they could drop a bomb there). */
  avoid?: { x: number; y: number }[];
}

/**
 * True when passing through a tile reached after `k` steps doesn't overlap its danger
 * window. The flame hitbox reaches ~0.65 tile beyond a tile's edge, so we count from
 * (k - 0.7) to (k + 0.7) tile-crossings.
 */
const safeAt = (ds: Int32Array, de: Int32Array, i: number, k: number, tpt: number, margin: number, delay = 0) => {
  const enter = Math.max(0, (k - 0.7) * tpt) + delay;
  const exit = (k + 0.7) * tpt + delay;
  return !(enter - margin <= de[i]! && exit + margin >= ds[i]!);
};

/** Tile `j`, reached after `k` steps, can be walked through (bricks while Ghost lasts, bombs while BombPass lasts). */
function passable(a: Analysis, m: Mobility, j: number, k: number): boolean {
  const t = a.world.tiles[j];
  if (t !== Tile.Floor && (t !== Tile.Brick || (k + 1) * m.tpt > m.ghost)) return false;
  // a sky bomb lands here: walking in after that means walking into a bomb
  const bombed = a.bomb[j] !== 0 || (a.land[j] !== 0 && (k - 0.7) * m.tpt >= a.land[j]! - 2);
  return !bombed || (k + 1) * m.tpt <= m.pass;
}

/** A tile to stop on after `k` steps: floor, or a brick while Ghost lasts long after. */
function stopOk(a: Analysis, m: Mobility, i: number, k: number): boolean {
  const t = a.world.tiles[i];
  if (a.bomb[i] && (k + 4) * m.tpt > m.pass) return false;
  return t === Tile.Floor || (t === Tile.Brick && m.ghost - (k + 1) * m.tpt > GHOST_HIDE);
}

/**
 * Time-aware BFS (no waiting). Fills sSteps / sPrev and returns the number of
 * visited tiles; their indices are sQueue[0..count).
 */
function search(a: Analysis, o: SearchOpts): number {
  const W = a.width;
  const m = ++mark; // bounded by maxSteps, so no O(map) reset per search
  let head = 0;
  let tail = 0;
  sQueue[tail++] = o.start;
  sMark[o.start] = m;
  sSteps[o.start] = 0;
  sPrev[o.start] = -1;
  while (head < tail) {
    const i = sQueue[head++]!;
    const k = sSteps[i]! + 1;
    if (k > o.maxSteps) continue;
    const x = i % W;
    const y = (i / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 1 ? -1 : d === 2 ? 1 : 0);
      const ny = y + (d === 0 ? -1 : d === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= a.height) continue;
      const j = ny * W + nx;
      if (sMark[j] === m) continue;
      if (!passable(a, o, j, k)) continue;
      if (!o.allowSkull && isSkull(a, j)) continue;
      if (!o.blind) {
        if (!safeAt(o.ds, o.de, j, k, o.tpt, o.margin, o.delay)) continue;
        if (o.fire && a.fire.length && nearFire(a, nx, ny, o.selfId)) continue;
      }
      if (o.curse && a.cursed.length && nearCursed(a, nx, ny, k <= 2 ? 1 : 0, o.selfId)) continue;
      if (o.avoid && nearAny(o.avoid, nx, ny, k >= 2 ? 1 : 0)) continue;
      sMark[j] = m;
      sSteps[j] = k;
      sPrev[j] = i;
      sQueue[tail++] = j;
    }
  }
  return tail;
}

/** Open neighbours of a tile. */
function exits(a: Analysis, m: Mobility, i: number): number {
  const W = a.width;
  const x = i % W;
  const y = (i / W) | 0;
  let n = 0;
  if (x > 0 && passable(a, m, i - 1, 1)) n++;
  if (x < W - 1 && passable(a, m, i + 1, 1)) n++;
  if (y > 0 && passable(a, m, i - W, 1)) n++;
  if (y < a.height - 1 && passable(a, m, i + W, 1)) n++;
  return n;
}

function nearAny(list: { x: number; y: number }[], x: number, y: number, r: number): boolean {
  for (const e of list) if (Math.abs(e.x - x) + Math.abs(e.y - y) <= r) return true;
  return false;
}

function nearFire(a: Analysis, x: number, y: number, self: string): boolean {
  for (const f of a.fire) if (f.id !== self && Math.abs(f.x - x) + Math.abs(f.y - y) <= 1) return true;
  return false;
}

function nearCursed(a: Analysis, x: number, y: number, r: number, self: string): boolean {
  for (const f of a.cursed) if (f.id !== self && Math.abs(f.x - x) + Math.abs(f.y - y) <= r) return true;
  return false;
}

/** Path (excluding start) to `goal` from the last search. */
function pathTo(goal: number): number[] {
  const out: number[] = [];
  for (let i = goal; sSteps[i]! > 0; i = sPrev[i]!) out.push(i);
  return out.reverse();
}

type Step = [number, number, number];

interface Foe {
  x: number;
  y: number;
  d: number;
  fire: boolean;
  cursed: boolean;
}

export class Bot implements IBot {
  readonly difficulty: BotDifficulty;
  private readonly tune: Tuning;
  private readonly rng: Rng;
  private seq = 0;
  private held = 0;
  private path: number[] = [];
  private fleeing = false;
  private cooldown = 0;
  private lastBombs = -1;
  private wantBomb = false;
  private script: Step[] = [];
  /** First tick each own remote bomb was seen (for detonation timing). */
  private remoteSeen = new Map<number, number>();
  /** Consecutive ticks an enemy stood in our remote blast. */
  private remoteHit = 0;
  private stuckX = 0;
  private stuckY = 0;
  private stuckTick = 0;
  private wander = 0;
  private wanderDir: Dir = Dir.Down;
  private arrived = false;
  private trickBomb = -1;
  private trickTick = -1000;
  private trickCool = 0;
  /** Safe tiles found by the last flee() search. */
  private safeFound = 0;
  /** Abilities / effects the bot has noticed it holds (K_* bits), and since when each is held. */
  private known = 0;
  private readonly since = new Int32Array(NOTICE.length).fill(-1);
  private now = 0;
  private reverse = false;
  private mob: Mobility = { tpt: 20, ghost: 0, pass: 0 };
  private carryStart = -1;
  /** Hold still until this tick before following the (delayed) escape path. */
  private waitUntil = 0;
  /** Enemies hit by the flight / slide scored last. */
  private hits = 0;
  private rx = 0;
  private ry = 0;

  constructor(
    readonly id: string,
    difficulty: BotDifficulty = 'normal',
    seed = hashString(id),
  ) {
    this.difficulty = difficulty;
    this.tune = TUNING[difficulty];
    this.rng = new Rng(seed);
    this.cooldown = this.rng.int(this.tune.replan); // stagger bots
  }

  think(world: WorldState): InputFrame {
    const p = world.players.get(this.id);
    if (!p || !p.alive || !p.inRound || world.phase === Phase.Countdown || world.phase === Phase.RoundOver) {
      this.path.length = 0;
      this.script.length = 0;
      this.wantBomb = false;
      this.reverse = false;
      return this.out(0, 0, 0);
    }
    this.now = world.tick;
    this.reverse = p.curse === Curse.Reverse;
    this.notice(p);
    const a = analyze(world);
    ensure(a.width * a.height);
    const W = a.width;
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    const cur = cy * W + cx;
    // timed danger forces a flee; untimed (remote) danger only keeps us from stopping there
    const inDanger = a.dStart[cur]! < INF;
    const imminent = a.dStart[cur]! <= IMMINENT;
    const tpt = planTpt(p);
    const k = this.known;
    this.mob.tpt = tpt;
    this.mob.ghost = k & K_GHOST ? p.effects.ghost - GHOST_MARGIN : 0;
    this.mob.pass = k & K_PASS ? p.effects.bombPass - PASS_MARGIN : 0;

    // scripted tricks (grab / punch / kick / line) run uninterrupted unless fire is imminent
    if (this.script.length && imminent) this.script.length = 0;
    if (this.script.length) return this.out(...this.script.shift()!);

    // carrying a bomb (Glove): hold Action, release it facing the chosen way
    let hold = 0;
    if (p.carrying >= 0) {
      if (this.carryStart < 0) this.carryStart = world.tick;
      const d = this.throwDir(a, p);
      if (d >= 0) {
        this.carryStart = -1;
        this.cooldown = 0;
        const [dx, dy] = DIR_VEC[d as Dir];
        return this.out(dx, dy, 0);
      }
      hold = Button.Action;
    } else this.carryStart = -1;

    this.checkStuck(a, p, cur);
    if (this.wander > 0) {
      this.wander--;
      const [dx, dy] = DIR_VEC[this.wanderDir];
      return this.out(dx, dy, hold);
    }

    const nearBombs = countNear(world, p, BOMB_WATCH);
    const next = this.path[0];
    const nextUnsafe = next !== undefined && (!safeAt(a.dStart, a.dEnd, next, 1, tpt, 1) || !passable(a, this.mob, next, 1));
    if (
      --this.cooldown <= 0 ||
      this.arrived ||
      nearBombs !== this.lastBombs ||
      (inDanger && !this.fleeing) ||
      nextUnsafe ||
      (this.path.length === 0 && world.tiles[cur] === Tile.Brick)
    ) {
      this.arrived = false;
      this.lastBombs = nearBombs;
      this.cooldown = this.tune.replan;
      this.plan(a, p, cur, inDanger, tpt);
      if (this.script.length) return this.out(...this.script.shift()!);
    }

    if (this.wantBomb && !(this.held & Button.Bomb)) {
      // stand still for the placement tick so the bomb lands on the planned tile
      this.wantBomb = false;
      return this.out(0, 0, Button.Bomb);
    }
    if (this.waitUntil > world.tick) {
      const [sx, sy] = this.settle(p);
      return this.out(sx, sy, hold);
    }
    let buttons = hold;
    if (!hold && !this.wantBomb && !(this.held & Button.Action) && this.shouldDetonate(a, p)) buttons |= Button.Action;
    let [dx, dy] = this.steer(p, W);
    if (!inDanger && this.ram(world, p)) {
      dx = this.rx;
      dy = this.ry;
    }
    return this.out(dx, dy, buttons);
  }

  /** Track how long each ability has been held; it counts once held for `notice` ticks. */
  private notice(p: PlayerState) {
    let k = 0;
    for (let n = 0; n < NOTICE.length; n++) {
      const [key, bit] = NOTICE[n]!;
      if (p.effects[key] <= 0) {
        this.since[n] = -1;
        continue;
      }
      if (this.since[n]! < 0) this.since[n] = this.now;
      if (this.now - this.since[n]! >= this.tune.notice) k |= bit;
    }
    this.known = k;
  }

  // ------------------------------------------------------------ planning

  private opts(a: Analysis, p: PlayerState, cur: number): SearchOpts {
    return {
      start: cur,
      tpt: this.mob.tpt,
      ghost: this.mob.ghost,
      pass: this.mob.pass,
      margin: this.tune.margin,
      ds: a.dStart,
      de: a.dEnd,
      allowSkull: false,
      selfId: p.id,
      maxSteps: PLAN_STEPS,
      fire: !(this.known & K_FIRE),
      curse: p.curse === Curse.None,
    };
  }

  private plan(a: Analysis, p: PlayerState, cur: number, inDanger: boolean, tpt: number) {
    this.wantBomb = false;
    this.waitUntil = 0;
    const base = this.opts(a, p, cur);
    const enemies = this.enemies(a, p, NEAREST_ENEMIES);
    if (p.carrying < 0 && a.dStart[cur]! > IMMINENT && this.tryTricks(a, p, cur, enemies)) return;
    if (inDanger) {
      // keep a planned escape (e.g. chosen when dropping the bomb) while it still works
      if (this.fleeing && this.pathStillSafe(a)) return;
      this.fleeing = true;
      const flee: SearchOpts = { ...base, margin: 2, allowSkull: true, curse: false };
      const near = this.nearEnemies(a, p, cur);
      this.path = near.length ? this.flee(a, { ...flee, avoid: near }) : [];
      if (this.path.length === 0) this.path = this.flee(a, flee);
      if (this.path.length === 0 && this.safeFound === 0) this.waitOut(a, flee, cur);
      if (this.path.length === 0 && this.safeFound === 0) this.rescue(a, p, cur);
      return;
    }
    this.fleeing = false;

    const w = a.world;
    const W = a.width;
    const canBomb = p.curse !== Curse.Constipation && p.carrying < 0 && this.ownBombs(a, p) < p.bombs;
    const radius = p.curse === Curse.TinyFlame ? 1 : p.radius;
    // Diarrhea drops a bomb under us whenever we have one spare: always have the escape ready
    if (p.curse === Curse.Diarrhea && canBomb && w.tiles[cur] === Tile.Floor && !a.bomb[cur] && !a.pickup[cur]) {
      this.tryBomb(a, p, cur, radius, tpt, true);
      if (this.path.length) return;
    }

    const count = search(a, base);
    const k = this.known;
    const shielded = (k & K_SHIELD) !== 0 && p.effects.shield > BOOST_SURE;
    const aggression = this.tune.aggression * (shielded ? 1.5 : 1);
    const onFire = (k & K_FIRE) !== 0 && p.effects.fire > BOOST_SURE;
    const cursed = p.curse !== Curse.None;
    const pierce = (k & K_PIERCE) !== 0 && (p.abilities & Ability.Pierce) !== 0;
    const sudden = w.zoneRing > 0 || w.zoneIn > 0;
    const midX = (a.width - 1) / 2;
    const midY = (a.height - 1) / 2;
    let best = -1;
    let bestScore = -INF;
    let bestIsBomb = false;
    for (let q = 0; q < count; q++) {
      const i = sQueue[q]!;
      // only plan to stand on floor tiles that stay safe
      if (w.tiles[i] !== Tile.Floor || a.bomb[i] || !restful(a, a.dStart, i)) continue;
      const steps = sSteps[i]!;
      const x = i % W;
      const y = (i / W) | 0;
      let score = -steps * 2;
      let bombValue = 0;
      const pk = a.pickup[i]! - 1;
      if (pk >= 0) score += pickupValue(p, pk as PickupType);
      const fall = a.dropPickup[i]! - 1; // overtime: about to land here, worth waiting for
      if (fall >= 0) score += pickupValue(p, fall as PickupType) * 0.8;
      if (canBomb) {
        bombValue = this.bombValue(a, x, y, radius, pierce, cur);
        score += bombValue;
      }
      // drift towards the nearest enemy; fire / cursed bots hunt someone they can touch
      let near = INF;
      let prey = INF;
      for (const e of enemies) {
        const d = Math.abs(e.x - x) + Math.abs(e.y - y);
        if (d < near) near = d;
        if (e.fire) {
          if (!onFire && d <= 2) score -= (3 - d) * 15; // touch kills
        } else if (e.cursed) {
          if (!cursed && d <= 1) score -= 15;
        } else if (d < prey) prey = d;
        if (onFire && !e.fire && d < prey) prey = d;
      }
      if (near < INF) score -= near * 0.6 * aggression;
      if (prey < INF) {
        if (onFire) score -= prey * (2 + aggression); // fire touch kills: chase
        else if (cursed) score -= prey * 1.5; // pass the curse on
      }
      if (sudden) score -= (Math.abs(x - midX) + Math.abs(y - midY)) * 3;
      if (score > bestScore) {
        bestScore = score;
        best = i;
        bestIsBomb = bombValue > 0;
      }
    }
    if (best < 0) {
      this.path.length = 0;
      if (w.tiles[cur] === Tile.Brick) this.exitBrick(a, p, cur);
      return;
    }
    if (best === cur) {
      this.path.length = 0;
      if (bestIsBomb && !this.rng.chance(this.tune.sloppy)) this.tryBomb(a, p, cur, radius, tpt, false);
      return;
    }
    this.path = pathTo(best);
  }

  /**
   * No way out right now (e.g. fire still burning in the only corridor): wait on this tile
   * while it stays safe, then go. The BFS itself never waits.
   */
  private waitOut(a: Analysis, o: SearchOpts, cur: number) {
    const stay = a.dStart[cur]! - o.tpt; // must be off this tile before it burns
    for (let delay = 8; delay + o.margin < stay; delay += 8) {
      const path = this.flee(a, { ...o, delay, ghost: o.ghost - delay, pass: o.pass - delay });
      if (path.length && this.safeFound > 0) {
        this.path = path;
        this.waitUntil = this.now + delay;
        return;
      }
    }
  }

  /** Inside a brick with nowhere safe to go: get onto the nearest floor before Ghost runs out. */
  private exitBrick(a: Analysis, p: PlayerState, cur: number) {
    const o = { ...this.opts(a, p, cur), blind: true, allowSkull: true, curse: false, maxSteps: 12 };
    o.ghost = p.effects.ghost - 4; // no planning margin left: use every tick there is
    const count = search(a, o);
    for (let q = 1; q < count; q++) {
      const i = sQueue[q]!;
      if (a.world.tiles[i] === Tile.Floor && !a.bomb[i]) {
        this.path = pathTo(i);
        return;
      }
    }
  }

  /**
   * Nearest tile that never burns (dead ends count as farther: easy to get trapped);
   * otherwise the one that burns last.
   */
  private flee(a: Analysis, o: SearchOpts): number[] {
    const count = search(a, o);
    let best = -1;
    let bestCost = INF;
    let late = -1;
    let lateStart = -1;
    this.safeFound = 0;
    for (let q = 0; q < count; q++) {
      const i = sQueue[q]!;
      const ds = o.ds[i]!;
      if (restful(a, o.ds, i) && stopOk(a, o, i, sSteps[i]!)) {
        this.safeFound++;
        const cost = sSteps[i]! + (exits(a, o, i) <= 1 ? 3 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = i;
        }
      } else if (ds > lateStart) {
        lateStart = ds;
        late = i;
      }
    }
    const goal = best >= 0 ? best : late;
    return goal < 0 || goal === o.start ? [] : pathTo(goal);
  }

  /**
   * Place a bomb here only if an escape route exists; the escape becomes the path.
   * `forced`: the bomb drops anyway (Diarrhea), so just plan the escape.
   */
  private tryBomb(a: Analysis, p: PlayerState, cur: number, radius: number, tpt: number, forced: boolean) {
    const W = a.width;
    const x = cur % W;
    const y = (cur / W) | 0;
    const crazy = p.effects.crazy > 0;
    // a Crazy fuse / radius is random: plan for the shortest fuse and the biggest blast
    const fuse = crazy ? CRAZY_FUSE_MIN : BOMB_FUSE;
    const r = crazy ? crazyRadius(p) : radius;
    const dur = crazy ? CRAZY_FUSE_MAX - CRAZY_FUSE_MIN + FLAME_TIME : FLAME_TIME;
    withExtraBomb(a, x, y, r, (p.abilities & Ability.Pierce) !== 0, fuse, hStart, hEnd, dur);
    const route = this.escape(a, p, cur, tpt, forced);
    if (route.length === 0) return;
    if (!forced) this.wantBomb = true;
    this.fleeing = true;
    this.path = route;
  }

  /** Escape from the hypothetical danger in hStart / hEnd, or [] if there's none good enough. */
  private escape(a: Analysis, p: PlayerState, cur: number, tpt: number, forced: boolean): number[] {
    const near = this.nearEnemies(a, p, cur);
    const route = this.flee(a, {
      ...this.opts(a, p, cur),
      tpt,
      margin: 3,
      ds: hStart,
      de: hEnd,
      maxSteps: 30,
      curse: false,
      avoid: near.length ? near : undefined,
    });
    const shielded = (this.known & K_SHIELD) !== 0 && p.effects.shield > BOOST_SURE;
    const need = forced || shielded || !near.length ? 1 : this.tune.minSafe;
    if (route.length === 0 || this.safeFound < need) return [];
    if (!restful(a, hStart, route[route.length - 1]!)) return []; // no fully safe tile
    return route;
  }

  /** Bricks / enemies a bomb at (x, y) would hit (Pierce: bricks behind bricks too). Hot: keep it lean. */
  private bombValue(a: Analysis, x: number, y: number, radius: number, pierce: boolean, self: number): number {
    const tiles = a.world.tiles;
    const players = a.players;
    const ds = a.dStart;
    const W = a.width;
    const H = a.height;
    let bricks = 0;
    const at = y * W + x;
    let foes = players[at]! - (at === self ? 1 : 0);
    for (let d = 0; d < 4; d++) {
      const dx = DX[d]!;
      const dy = DY[d]!;
      const step = dy * W + dx;
      let cx = x;
      let cy = y;
      let i = at;
      for (let k = 1; k <= radius; k++) {
        cx += dx;
        cy += dy;
        i += step;
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) break;
        const t = tiles[i];
        if (t === Tile.Wall) break;
        if (players[i]) foes += players[i]! - (i === self ? 1 : 0);
        if (t === Tile.Brick) {
          if (ds[i]! >= INF) bricks++; // not already being blown up
          if (!pierce) break;
          continue;
        }
        if (a.bomb[i] || a.pickup[i]) break;
      }
    }
    return bricks * 12 + foes * 30 * this.tune.aggression;
  }

  /** Living opponents, nearest first (optionally only the `limit` nearest). */
  private enemies(a: Analysis, p: PlayerState, limit = Infinity): Foe[] {
    const out: Foe[] = [];
    for (const q of a.world.players.values()) {
      if (q === p || !q.alive || !q.inRound) continue;
      const x = Math.round(q.x);
      const y = Math.round(q.y);
      out.push({ x, y, d: Math.abs(x - p.x) + Math.abs(y - p.y), fire: q.effects.fire > 0, cursed: q.curse !== Curse.None });
    }
    if (out.length > limit) {
      out.sort((u, v) => u.d - v.d);
      out.length = limit;
    }
    return out;
  }

  /** Enemies close enough to cut our escape off with a bomb of their own (not for easy bots). */
  private nearEnemies(a: Analysis, p: PlayerState, cur: number): { x: number; y: number }[] {
    if (this.tune.minSafe <= 1) return [];
    const x = cur % a.width;
    const y = (cur / a.width) | 0;
    return this.enemies(a, p).filter((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 6);
  }

  /** Current path is walkable, safe at arrival and ends on a tile that never burns. */
  private pathStillSafe(a: Analysis): boolean {
    const path = this.path;
    if (path.length === 0) return false;
    const m = this.mob;
    for (let k = 0; k < path.length; k++) {
      const i = path[k]!;
      if (!passable(a, m, i, k + 1) || !safeAt(a.dStart, a.dEnd, i, k + 1, m.tpt, 1)) return false;
    }
    const last = path[path.length - 1]!;
    return restful(a, a.dStart, last) && stopOk(a, m, last, path.length);
  }

  private ownBombs(a: Analysis, p: PlayerState): number {
    let n = 0;
    for (const b of a.world.bombs.values()) if (b.owner === p.id) n++;
    return n;
  }

  // ------------------------------------------------------------ remote

  /**
   * Remote: an Action press sets off our oldest waiting bomb (and whatever it chains).
   * Do it when an enemy stands in that blast, or once it has done its job (bricks) or
   * waited long enough, and only while we're clear of it.
   */
  private shouldDetonate(a: Analysis, p: PlayerState): boolean {
    if (!(p.abilities & Ability.Remote) || p.carrying >= 0 || !(this.known & K_REMOTE)) return false;
    const w = a.world;
    let first: BombState | undefined;
    for (const b of w.bombs.values()) {
      if (b.owner !== p.id || b.fuse >= 0) continue;
      if (!this.remoteSeen.has(b.id)) this.remoteSeen.set(b.id, w.tick);
      if (!first && (b.motion === BombMotion.Idle || b.motion === BombMotion.Sliding)) first = b;
    }
    if (this.remoteSeen.size > 32) for (const id of this.remoteSeen.keys()) if (!w.bombs.has(id)) this.remoteSeen.delete(id);
    if (!first) {
      this.remoteHit = 0;
      return false;
    }
    if (p.abilities & (Ability.Glove | Ability.Punch) && this.wouldGrab(a, p)) return false;
    const stamp = ++bStamp;
    const bricks = this.stampBlast(a, first, stamp, 0);
    // every tile our (generous) hitbox touches must be clear, and the next step too
    const W = a.width;
    const x0 = Math.round(p.x - PLAYER_RADIUS);
    const x1 = Math.round(p.x + PLAYER_RADIUS);
    const y0 = Math.round(p.y - PLAYER_RADIUS);
    const y1 = Math.round(p.y + PLAYER_RADIUS);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && y >= 0 && x < W && y < a.height && bMark[y * W + x] === stamp) return false;
      }
    }
    const next = this.path[0];
    if (next !== undefined && bMark[next] === stamp) return false;
    let enemyIn = false;
    for (const q of w.players.values()) {
      if (q === p || !q.alive || !q.inRound || q.effects.invulnerable > 0) continue;
      const qx = Math.round(q.x);
      const qy = Math.round(q.y);
      if (qx >= 0 && qy >= 0 && qx < W && qy < a.height && bMark[qy * W + qx] === stamp) enemyIn = true;
    }
    if (enemyIn) {
      if (++this.remoteHit > this.tune.remoteReact) return true;
    } else this.remoteHit = 0;
    const age = w.tick - this.remoteSeen.get(first.id)!;
    if (age < this.tune.remoteDelay) return false;
    return bricks > 0 || age >= this.tune.remoteTrap;
  }

  /** Stamp a bomb's blast (and the bombs it chains) into bMark; returns bricks hit. */
  private stampBlast(a: Analysis, b: BombState, stamp: number, depth: number): number {
    const w = a.world;
    const W = a.width;
    const bx = Math.round(b.x);
    const by = Math.round(b.y);
    const radius = b.kind === BombKind.Crazy ? crazyRadius(w.players.get(b.owner)) : b.radius;
    const pierce = bombPierces(w, b);
    let bricks = 0;
    bMark[by * W + bx] = stamp;
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIR_VEC[STEP_DIRS[d]!];
      for (let k = 1; k <= radius; k++) {
        const x = bx + dx * k;
        const y = by + dy * k;
        if (x < 0 || y < 0 || x >= W || y >= a.height) break;
        const i = y * W + x;
        const t = w.tiles[i];
        if (t === Tile.Wall) break;
        const seen = bMark[i] === stamp;
        bMark[i] = stamp;
        if (t === Tile.Brick) {
          bricks++;
          if (!pierce) break;
          continue;
        }
        if (a.bomb[i]) {
          const o = w.bombs.get(a.bomb[i]!);
          if (o && !seen && depth < 8) bricks += this.stampBlast(a, o, stamp, depth + 1);
          break;
        }
        if (a.pickup[i]) break;
      }
    }
    return bricks;
  }

  /** An Action press now would grab (Glove) or punch (Punch) a bomb instead of detonating. */
  private wouldGrab(a: Analysis, p: PlayerState): boolean {
    const W = a.width;
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    if (p.abilities & Ability.Glove && a.bomb[cy * W + cx]) return true;
    const [dx, dy] = DIR_VEC[p.dir];
    const fx = cx + dx;
    const fy = cy + dy;
    if (fx < 0 || fy < 0 || fx >= W || fy >= a.height) return false;
    const b = a.bomb[fy * W + fx] ? a.world.bombs.get(a.bomb[fy * W + fx]!) : undefined;
    return b !== undefined && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 <= 1.1;
  }

  // ------------------------------------------------------------ tricks

  /** Kick a bomb at an enemy, grab-and-throw / punch one their way, or lay a line at them. */
  private tryTricks(a: Analysis, p: PlayerState, cur: number, enemies: Foe[]): boolean {
    const k = this.known;
    if (!(k & (K_GLOVE | K_PUNCH | K_KICK | K_LINE)) || this.now < this.trickCool) return false;
    const W = a.width;
    const x = cur % W;
    const y = (cur / W) | 0;
    // grabs, punches and kicks act from the tile we're on: be near its centre
    if (Math.abs(p.x - x) > 0.3 || Math.abs(p.y - y) > 0.3) return false;
    const foes = enemies.filter((e) => e.d <= TRICK_RANGE);
    if (foes.length === 0) return false;
    let script: Step[] | null = null;
    if (k & K_GLOVE) script = this.gloveTrick(a, p, cur, foes);
    if (!script && k & K_PUNCH && !(p.abilities & Ability.Glove)) script = this.punchTrick(a, p, cur, foes, true);
    if (!script && k & K_KICK) script = this.kickTrick(a, p, cur, foes, true);
    if (script) {
      if (!this.rng.chance(this.tune.skill)) {
        this.trickCool = this.now + TRICK_PAUSE;
        return false;
      }
      this.script = script;
      this.path.length = 0;
      return true;
    }
    return (k & K_LINE) !== 0 && this.lineTrick(a, p, cur, foes);
  }

  /** Adjacent Idle bomb in direction d, close enough to touch / grab / punch. */
  private adjacentBomb(a: Analysis, p: PlayerState, cur: number, d: Dir): BombState | undefined {
    const W = a.width;
    const [dx, dy] = DIR_VEC[d];
    const bx = (cur % W) + dx;
    const by = ((cur / W) | 0) + dy;
    if (bx < 0 || by < 0 || bx >= W || by >= a.height) return undefined;
    const id = a.bomb[by * W + bx];
    if (!id) return undefined;
    const b = a.world.bombs.get(id);
    if (!b || b.motion !== BombMotion.Idle || (b.fuse > 0 && b.fuse < 20)) return undefined;
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 > 1.0) return undefined;
    if (this.trickBomb === id && this.now - this.trickTick < 60) return undefined; // tried that one already
    return b;
  }

  private tried(b: BombState) {
    this.trickBomb = b.id;
    this.trickTick = this.now;
  }

  /**
   * Score a bomb coming down at landing tile `at` after `delay` ticks: enemies in its blast
   * (this.hits), bricks, and closeness to the nearest enemy. -INF = it would catch us at
   * (ox, oy) without time to get away.
   */
  private blastScore(a: Analysis, p: PlayerState, b: BombState, at: number, delay: number, ox: number, oy: number, foes: Foe[]): number {
    const w = a.world;
    const W = a.width;
    this.hits = 0;
    if (at < 0) return 0; // evaporates off the map: harmless disposal
    const lx = at % W;
    const ly = (at / W) | 0;
    let fuseAfter = b.fuse > 0 ? Math.max(1, b.fuse - delay) : b.fuse < 0 ? (b.owner === p.id ? INF : 30) : 1;
    // coming down in (or next to) a blast: it chains and goes off early
    if (a.dStart[at]! < INF && (b.fuse <= 0 || a.dStart[at]! < b.fuse)) fuseAfter = Math.min(fuseAfter, Math.max(1, a.dStart[at]! - delay) + CHAIN_DELAY);
    const radius = b.kind === BombKind.Crazy ? crazyRadius(w.players.get(b.owner)) : b.radius;
    const pierce = bombPierces(w, b);
    if (fuseAfter < SAFE_FUSE && inBlast(a, lx, ly, radius, pierce, ox, oy)) return -INF;
    let score = 1;
    let near = INF;
    for (const e of foes) {
      if (inBlast(a, lx, ly, radius, pierce, e.x, e.y)) this.hits++;
      near = Math.min(near, Math.abs(e.x - lx) + Math.abs(e.y - ly));
    }
    if (near < INF) score -= near;
    return score + this.hits * 100 + (fuseAfter < 60 ? this.hits * 20 : 0);
  }

  /** Glove: grab a bomb under us or next to us when a throw from here would catch someone. */
  private gloveTrick(a: Analysis, p: PlayerState, cur: number, foes: Foe[]): Step[] | null {
    const W = a.width;
    const x = cur % W;
    const y = (cur / W) | 0;
    const under = a.bomb[cur] ? a.world.bombs.get(a.bomb[cur]!) : undefined;
    if (under) {
      if (under.motion !== BombMotion.Idle || (under.fuse > 0 && under.fuse < 20)) return null;
      if (this.trickBomb === under.id && this.now - this.trickTick < 60) return null;
      if (this.bestThrow(a, p, under, x, y, foes, cur) < 0 || this.hits === 0) return null;
      this.tried(under);
      return [[0, 0, Button.Action]];
    }
    for (const d of STEP_DIRS) {
      const b = this.adjacentBomb(a, p, cur, d);
      if (!b) continue;
      if (this.bestThrow(a, p, b, x, y, foes, Math.round(b.y) * W + Math.round(b.x)) < 0 || this.hits === 0) continue;
      this.tried(b);
      const [dx, dy] = DIR_VEC[d];
      return [[dx, dy, Button.Action]];
    }
    return null;
  }

  /**
   * Best direction to throw bomb `b` from (ox, oy) (-1 = none safe); this.hits holds the
   * enemies it would catch. `from` is the tile the bomb leaves (it won't block the blast).
   */
  private bestThrow(a: Analysis, p: PlayerState, b: BombState, ox: number, oy: number, foes: Foe[], from = -1): number {
    const saved = from >= 0 ? a.bomb[from]! : 0;
    if (from >= 0) a.bomb[from] = 0;
    let best = -1;
    let bestScore = -INF;
    let bestHits = 0;
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIR_VEC[STEP_DIRS[d]!];
      const at = landing(a, ox + dx * THROW_DISTANCE, oy + dy * THROW_DISTANCE, dx, dy, b.id);
      const s = this.blastScore(a, p, b, at, THROW_TIME + landHops * BOUNCE_TIME, ox, oy, foes);
      if (s > bestScore) {
        bestScore = s;
        best = STEP_DIRS[d]!;
        bestHits = this.hits;
      }
    }
    if (from >= 0) a.bomb[from] = saved;
    this.hits = bestHits;
    return bestScore === -INF ? -1 : best;
  }

  /** Carrying: the direction to throw now, or -1 to keep carrying. */
  private throwDir(a: Analysis, p: PlayerState): number {
    const b = a.world.bombs.get(p.carrying);
    if (!b) return -1;
    const foes = this.enemies(a, p, NEAREST_ENEMIES).filter((e) => e.d <= TRICK_RANGE);
    const d = this.bestThrow(a, p, b, Math.round(p.x), Math.round(p.y), foes);
    if (d >= 0 && this.hits > 0) return d;
    const held = this.now - this.carryStart;
    if (held >= CARRY_MAX) return d >= 0 ? d : p.dir; // never hold one forever
    return held >= this.tune.carry ? d : -1;
  }

  /** Punch an adjacent bomb at an enemy (or, `aim` false, anywhere it won't catch us). */
  private punchTrick(a: Analysis, p: PlayerState, cur: number, foes: Foe[], aim: boolean): Step[] | null {
    const W = a.width;
    const x = cur % W;
    const y = (cur / W) | 0;
    for (const d of STEP_DIRS) {
      const b = this.adjacentBomb(a, p, cur, d);
      if (!b) continue;
      const [dx, dy] = DIR_VEC[d];
      const bx = x + dx;
      const by = y + dy;
      const from = by * W + bx;
      const saved = a.bomb[from]!;
      a.bomb[from] = 0;
      const at = landing(a, bx + dx * PUNCH_DISTANCE, by + dy * PUNCH_DISTANCE, dx, dy, b.id);
      const s = this.blastScore(a, p, b, at, THROW_TIME + landHops * BOUNCE_TIME, x, y, foes);
      a.bomb[from] = saved;
      if (s === -INF || (aim && this.hits === 0)) continue;
      // trapped (no aim): only worth it if the bomb's blast no longer reaches us
      if (!aim && at >= 0 && inBlast(a, at % W, (at / W) | 0, b.radius, bombPierces(a.world, b), x, y)) continue;
      this.tried(b);
      return [[dx, dy, Button.Action], [0, 0, 0]];
    }
    return null;
  }

  /** Kick an adjacent bomb so it stops where its blast catches an enemy (or, `aim` false, out of the way). */
  private kickTrick(a: Analysis, p: PlayerState, cur: number, foes: Foe[], aim: boolean): Step[] | null {
    const W = a.width;
    const x = cur % W;
    const y = (cur / W) | 0;
    const speed = playerSpeed(p);
    for (const d of STEP_DIRS) {
      const b = this.adjacentBomb(a, p, cur, d);
      if (!b || !canKick(b, p)) continue;
      const [dx, dy] = DIR_VEC[d];
      // the kick needs us square in the lane
      if (Math.abs(dx !== 0 ? p.y - y : p.x - x) > 0.25) continue;
      const bx = x + dx;
      const by = y + dy;
      const stop = slideStop(a, bx, by, dx, dy, b.id);
      const dist = Math.abs((stop % W) - bx) + Math.abs(((stop / W) | 0) - by);
      if (dist === 0) continue;
      const from = by * W + bx;
      const saved = a.bomb[from]!;
      a.bomb[from] = 0;
      const slideTicks = Math.ceil(dist / (KICK_SPEED / TICK_RATE)) + 6;
      let burns = false; // sliding through a blast sets it off on the way
      for (let j = 1, i = from; j <= dist; j++) {
        const t = a.dStart[(i += dy * W + dx)]!; // (the bomb's own blast doesn't count)
        burns ||= t < INF && (b.fuse <= 0 || t + CHAIN_DELAY < b.fuse);
      }
      if (burns) {
        a.bomb[from] = saved;
        continue;
      }
      const s = this.blastScore(a, p, b, stop, slideTicks, x, y, foes);
      a.bomb[from] = saved;
      if (s === -INF || (aim && this.hits === 0)) continue;
      if (b.fuse > 0 && b.fuse < slideTicks + 5) continue;
      if (!aim && inBlast(a, stop % W, (stop / W) | 0, b.radius, bombPierces(a.world, b), x, y)) continue;
      this.tried(b);
      const along = Math.abs(dx !== 0 ? b.x - p.x : b.y - p.y);
      const n = Math.max(2, Math.ceil((along - 0.62) / speed) + 2);
      return Array.from({ length: n }, () => [dx, dy, 0] as Step);
    }
    return null;
  }

  /**
   * LineBomb: standing on our bomb, Bomb again lays a line the way we face. Lay one down a
   * corridor when its blasts catch an enemy and the escape stays safe.
   */
  private lineTrick(a: Analysis, p: PlayerState, cur: number, foes: Foe[]): boolean {
    const w = a.world;
    const W = a.width;
    if (!(p.abilities & Ability.LineBomb) || p.curse === Curse.Constipation || p.effects.crazy > 0) return false;
    if (w.tiles[cur] !== Tile.Floor || a.pickup[cur]) return false;
    const under = a.bomb[cur] ? w.bombs.get(a.bomb[cur]!) : undefined;
    if (under && under.owner !== p.id) return false;
    const spare = p.bombs - this.ownBombs(a, p) - (under ? 0 : 1);
    if (spare < 1) return false;
    const x = cur % W;
    const y = (cur / W) | 0;
    const radius = p.curse === Curse.TinyFlame ? 1 : p.radius;
    const pierce = (p.abilities & Ability.Pierce) !== 0;
    const line: number[] = [];
    for (const d of STEP_DIRS) {
      const [dx, dy] = DIR_VEC[d];
      line.length = 0;
      for (let k = 1; k <= spare; k++) {
        const lx = x + dx * k;
        const ly = y + dy * k;
        if (lx < 0 || ly < 0 || lx >= W || ly >= a.height) break;
        const i = ly * W + lx;
        if (w.tiles[i] !== Tile.Floor || a.bomb[i] || a.pickup[i]) break;
        if (a.dStart[i]! < INF) {
          line.length = 0; // a line bomb laid into a blast chains the whole line early
          break;
        }
        line.push(i);
      }
      if (line.length === 0) continue;
      let hit = false;
      for (const e of foes) {
        if (Math.abs(e.x - x) + Math.abs(e.y - y) > spare + radius + 1) continue;
        if (inBlast(a, x, y, radius, pierce, e.x, e.y)) hit = true;
        for (const i of line) if (!hit && inBlast(a, i % W, (i / W) | 0, radius, pierce, e.x, e.y)) hit = true;
        if (hit) break;
      }
      if (!hit) continue;
      withExtraBomb(a, x, y, radius, pierce, under ? under.fuse > 0 ? under.fuse : BOMB_FUSE : BOMB_FUSE, hStart, hEnd, FLAME_TIME, line);
      for (const i of line) a.bomb[i] = -1; // the line blocks our way out
      const route = this.escape(a, p, cur, this.mob.tpt, false);
      for (const i of line) a.bomb[i] = 0;
      if (route.length === 0) continue;
      if (!this.rng.chance(this.tune.skill)) {
        this.trickCool = this.now + TRICK_PAUSE;
        return false;
      }
      const s: Step[] = this.held & Button.Bomb ? [[0, 0, 0]] : [];
      if (!under) s.push([0, 0, Button.Bomb], [0, 0, 0]);
      s.push([dx, dy, Button.Bomb], [0, 0, 0]);
      this.script = s;
      this.path = route;
      this.fleeing = true;
      return true;
    }
    return false;
  }

  /** Trapped: kick, grab or punch a bomb out of the way if we can. */
  private rescue(a: Analysis, p: PlayerState, cur: number) {
    const k = this.known;
    const foes: Foe[] = [];
    let s: Step[] | null = null;
    if (k & K_GLOVE && p.carrying < 0) {
      // a carried bomb's fuse stops: grab the one under us (or next to us), throw it later
      if (a.bomb[cur]) s = [[0, 0, Button.Action]];
      else {
        for (const d of STEP_DIRS) {
          if (!this.adjacentBomb(a, p, cur, d)) continue;
          const [dx, dy] = DIR_VEC[d];
          s = [[dx, dy, Button.Action]];
          break;
        }
      }
    }
    if (!s && k & K_KICK) s = this.kickTrick(a, p, cur, foes, false);
    if (!s && k & K_PUNCH && !(p.abilities & Ability.Glove)) s = this.punchTrick(a, p, cur, foes, false);
    if (s) this.script = s;
  }

  /** Fire: touching kills. Cursed: touching passes it on. Ram the nearest such enemy when close. */
  private ram(w: WorldState, p: PlayerState): boolean {
    const onFire = (this.known & K_FIRE) !== 0 && p.effects.fire > 0;
    const cursed = p.curse !== Curse.None;
    if (!onFire && !cursed) return false;
    let best = RAM_DIST * RAM_DIST;
    let found = false;
    for (const q of w.players.values()) {
      if (q === p || !q.alive || !q.inRound || q.effects.fire > 0) continue;
      if (!onFire && q.curse !== Curse.None) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        this.rx = dx;
        this.ry = dy;
        found = true;
      }
    }
    return found;
  }

  // ------------------------------------------------------------ steering

  private steer(p: PlayerState, W: number): [number, number] {
    while (this.path.length > 0) {
      const t = this.path[0]!;
      const tx = t % W;
      const ty = (t / W) | 0;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < 0.12 && this.path.length > 1) {
        this.path.shift();
        continue;
      }
      if (dist < 0.06) {
        this.path.shift();
        this.arrived = true;
        return [0, 0];
      }
      // mostly axis-aligned: correct the perpendicular offset gently
      return Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), clampAxis(dy * 2)] : [clampAxis(dx * 2), Math.sign(dy)];
    }
    return this.settle(p);
  }

  /** Idle: settle on the tile centre so bombs land where we expect. */
  private settle(p: PlayerState): [number, number] {
    const ox = Math.round(p.x) - p.x;
    const oy = Math.round(p.y) - p.y;
    if (Math.abs(ox) + Math.abs(oy) < 0.08) return [0, 0];
    return Math.abs(ox) > Math.abs(oy) ? [Math.sign(ox), 0] : [0, Math.sign(oy)];
  }

  /** No progress for a second while trying to move: take a random safe step and replan. */
  private checkStuck(a: Analysis, p: PlayerState, cur: number) {
    const w = a.world;
    if (w.tick - this.stuckTick < 60) return;
    const moved = Math.abs(p.x - this.stuckX) + Math.abs(p.y - this.stuckY);
    const wanted = this.path.length > 0;
    this.stuckTick = w.tick;
    this.stuckX = p.x;
    this.stuckY = p.y;
    if (!wanted || moved >= 0.1 || p.effects.stun > 0) return;
    this.path.length = 0;
    const W = a.width;
    const first = this.rng.int(4);
    const tpt = this.mob.tpt;
    for (let k = 0; k < 4; k++) {
      const d = STEP_DIRS[(first + k) & 3]!;
      const [dx, dy] = DIR_VEC[d];
      const x = (cur % W) + dx;
      const y = ((cur / W) | 0) + dy;
      if (x < 0 || y < 0 || x >= W || y >= a.height) continue;
      const i = y * W + x;
      if (!passable(a, this.mob, i, 1) || !safeAt(a.dStart, a.dEnd, i, 1, tpt, 4)) continue;
      this.wanderDir = d;
      this.wander = Math.ceil(tpt * 0.8);
      return;
    }
  }

  private out(dx: number, dy: number, buttons: number): InputFrame {
    this.held = buttons;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    if (this.reverse) {
      // Reverse curse: the sim inverts the input, so invert the plan first
      dx = -dx;
      dy = -dy;
    }
    return { seq: ++this.seq, dx: dx + 0, dy: dy + 0, buttons };
  }
}

/** Walking into a bomb only kicks it when we actually collide with it. */
const canKick = (b: BombState, p: PlayerState) =>
  b.motion === BombMotion.Idle && !(p.abilities & Ability.BombPass) && !b.passers.includes(p.id);

const clampAxis = (v: number) => (v > 0.5 ? 0.5 : v < -0.5 ? -0.5 : v);
