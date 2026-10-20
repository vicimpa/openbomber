// Bot brain. Produces InputFrames exactly like a human client, so the server treats bots
// uniformly. Planning is a time-aware BFS over tiles against the shared danger map.

import type { IBot } from '../contract/api';
import { BOMB_FUSE, CRAZY_FUSE_MIN, PLAYER_RADIUS, THROW_DISTANCE, sec } from '../contract/constants';
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
  type WorldState,
} from '../contract/types';
import { playerSpeed } from '../sim/movement';
import { hashString, Rng } from '../sim/rng';
import { analyze, INF, isSkull, markBlast, restful, withExtraBomb, type Analysis } from './danger';

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
  /** Kick / Glove / Punch tricks. */
  tricks: boolean;
  /** Ticks a remote bomb must age before detonation. */
  remoteDelay: number;
  /** Safe tiles that must be reachable before dropping a bomb (fewer = easier to trap). */
  minSafe: number;
}

const TUNING: Record<BotDifficulty, Tuning> = {
  easy: { replan: 14, margin: 4, sloppy: 0.45, aggression: 0.4, tricks: false, remoteDelay: sec(2.5), minSafe: 1 },
  normal: { replan: 7, margin: 7, sloppy: 0.15, aggression: 1, tricks: false, remoteDelay: sec(1.2), minSafe: 3 },
  hard: { replan: 3, margin: 9, sloppy: 0, aggression: 1.6, tricks: true, remoteDelay: sec(0.5), minSafe: 4 },
};

const PICKUP_VALUE: Partial<Record<PickupType, number>> = {
  [PickupType.BombUp]: 40,
  [PickupType.FireUp]: 40,
  [PickupType.SpeedUp]: 35,
  [PickupType.FullFire]: 45,
  [PickupType.Kick]: 30,
  [PickupType.Glove]: 25,
  [PickupType.Punch]: 20,
  [PickupType.Remote]: 25,
  [PickupType.Pierce]: 30,
  [PickupType.LineBomb]: 20,
  [PickupType.BombPass]: 25,
  [PickupType.Shield]: 40,
  [PickupType.Ghost]: 15,
  [PickupType.Crazy]: 5,
  [PickupType.Fire]: 30,
  [PickupType.Heart]: 50,
  [PickupType.Random]: 20,
};

const STEP_DIRS = [Dir.Up, Dir.Left, Dir.Right, Dir.Down] as const;
/** Fire this close (ticks) cancels scripted tricks. */
const IMMINENT = 45;
/** Only the nearest few opponents steer target scoring (keeps 32-bot maps cheap). */
const NEAREST_ENEMIES = 4;
/** Planning horizon in steps: keeps a replan bounded on 75x75 maps (far goals come from the enemy drift). */
const PLAN_STEPS = 26;
/** Only bombs this close (tiles, Chebyshev) trigger an immediate replan when they appear / go off. */
const BOMB_WATCH = 11;

function countNear(w: WorldState, p: PlayerState, r: number): number {
  let n = 0;
  for (const b of w.bombs.values()) if (Math.abs(b.x - p.x) <= r && Math.abs(b.y - p.y) <= r) n++;
  return n;
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
}

interface SearchOpts {
  start: number;
  tpt: number;
  margin: number;
  ds: Int32Array;
  de: Int32Array;
  allowSkull: boolean;
  selfId: string;
  maxSteps: number;
  /** Treat tiles next to these players as blocked (they could drop a bomb there). */
  avoid?: { x: number; y: number }[];
}

/**
 * True when passing through a tile reached after `k` steps doesn't overlap its danger
 * window. The flame hitbox reaches ~0.65 tile beyond a tile's edge, so we count from
 * (k - 0.7) to (k + 0.7) tile-crossings.
 */
const safeAt = (ds: Int32Array, de: Int32Array, i: number, k: number, tpt: number, margin: number) => {
  const enter = Math.max(0, (k - 0.7) * tpt);
  const exit = (k + 0.7) * tpt;
  return !(enter - margin <= de[i]! && exit + margin >= ds[i]!);
};

/**
 * Time-aware BFS (no waiting). Fills sSteps / sPrev and returns the number of
 * visited tiles; their indices are sQueue[0..count).
 */
function search(a: Analysis, o: SearchOpts): number {
  const w = a.world;
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
      if (w.tiles[j] !== Tile.Floor || a.bomb[j]) continue;
      if (!o.allowSkull && isSkull(a, j)) continue;
      if (!safeAt(o.ds, o.de, j, k, o.tpt, o.margin)) continue;
      if (nearFire(a, nx, ny, o.selfId)) continue;
      if (o.avoid && nearAny(o.avoid, nx, ny, k >= 2 ? 1 : 0)) continue;
      sMark[j] = m;
      sSteps[j] = k;
      sPrev[j] = i;
      sQueue[tail++] = j;
    }
  }
  return tail;
}

/** Open neighbours of a tile (floor without bombs). */
function exits(a: Analysis, i: number): number {
  const W = a.width;
  const x = i % W;
  const y = (i / W) | 0;
  let n = 0;
  if (x > 0 && a.world.tiles[i - 1] === Tile.Floor && !a.bomb[i - 1]) n++;
  if (x < W - 1 && a.world.tiles[i + 1] === Tile.Floor && !a.bomb[i + 1]) n++;
  if (y > 0 && a.world.tiles[i - W] === Tile.Floor && !a.bomb[i - W]) n++;
  if (y < a.height - 1 && a.world.tiles[i + W] === Tile.Floor && !a.bomb[i + W]) n++;
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

/** Path (excluding start) to `goal` from the last search. */
function pathTo(goal: number): number[] {
  const out: number[] = [];
  for (let i = goal; sSteps[i]! > 0; i = sPrev[i]!) out.push(i);
  return out.reverse();
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
  private script: [number, number, number][] = [];
  /** First tick each own remote bomb was seen (for detonation timing). */
  private remoteSeen = new Map<number, number>();
  private stuckX = 0;
  private stuckY = 0;
  private stuckTick = 0;
  private wander = 0;
  private wanderDir: Dir = Dir.Down;
  private arrived = false;
  private trickBomb = -1;
  private trickTick = -1000;
  /** Safe tiles found by the last flee() search. */
  private safeFound = 0;

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
      return this.out(0, 0, 0);
    }
    const a = analyze(world);
    ensure(a.width * a.height);
    const W = a.width;
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    const cur = cy * W + cx;
    // timed danger forces a flee; untimed (remote) danger only keeps us from stopping there
    const inDanger = a.dStart[cur]! < INF;
    const imminent = a.dStart[cur]! <= IMMINENT;
    const tpt = 1 / playerSpeed(p);

    // scripted tricks (throw / punch / kick) run uninterrupted unless fire is imminent
    if (this.script.length && imminent) this.script.length = 0;
    if (this.script.length) return this.out(...this.script.shift()!);

    this.checkStuck(a, p, cur, tpt);
    if (this.wander > 0) {
      this.wander--;
      const [dx, dy] = DIR_VEC[this.wanderDir];
      return this.out(dx, dy, 0);
    }

    const nearBombs = countNear(world, p, BOMB_WATCH);
    const next = this.path[0];
    const nextUnsafe = next !== undefined && (!safeAt(a.dStart, a.dEnd, next, 1, tpt, 1) || a.bomb[next] !== 0);
    if (
      --this.cooldown <= 0 ||
      this.arrived ||
      nearBombs !== this.lastBombs ||
      (inDanger && !this.fleeing) ||
      nextUnsafe
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
    let buttons = 0;
    if (!this.wantBomb && this.shouldDetonate(a, p) && !(this.held & Button.Action)) buttons |= Button.Action;
    const [dx, dy] = this.steer(p, W);
    return this.out(dx, dy, buttons);
  }

  // ------------------------------------------------------------ planning

  private plan(a: Analysis, p: PlayerState, cur: number, inDanger: boolean, tpt: number) {
    this.wantBomb = false;
    const base: SearchOpts = {
      start: cur,
      tpt,
      margin: this.tune.margin,
      ds: a.dStart,
      de: a.dEnd,
      allowSkull: false,
      selfId: p.id,
      maxSteps: PLAN_STEPS,
    };
    if (this.tune.tricks && a.dStart[cur]! > IMMINENT && this.tryTricks(a, p, cur)) return;
    if (inDanger) {
      // keep a planned escape (e.g. chosen when dropping the bomb) while it still works
      if (this.fleeing && this.pathStillSafe(a, tpt)) return;
      this.fleeing = true;
      const flee = { ...base, margin: 2, allowSkull: true };
      const near = this.nearEnemies(a, p, cur);
      this.path = near.length ? this.flee(a, { ...flee, avoid: near }) : [];
      if (this.path.length === 0) this.path = this.flee(a, flee);
      if (this.path.length === 0 && this.safeFound === 0) this.kickOut(a, p, cur);
      return;
    }
    this.fleeing = false;

    const count = search(a, base);
    const W = a.width;
    const canBomb = p.curse !== Curse.Constipation && p.carrying < 0 && this.ownBombs(a, p) < p.bombs;
    const radius = p.curse === Curse.TinyFlame ? 1 : p.radius;
    const enemies = this.enemies(a, p, NEAREST_ENEMIES);
    const sudden = a.world.zoneRing > 0 || a.world.zoneIn > 0;
    const midX = (a.width - 1) / 2;
    const midY = (a.height - 1) / 2;
    let best = -1;
    let bestScore = -INF;
    let bestIsBomb = false;
    for (let q = 0; q < count; q++) {
      const i = sQueue[q]!;
      if (!restful(a, a.dStart, i)) continue; // only plan to stand on tiles that stay safe
      const steps = sSteps[i]!;
      const x = i % W;
      const y = (i / W) | 0;
      let score = -steps * 2;
      let bombValue = 0;
      const pk = a.pickup[i]! - 1;
      if (pk >= 0) score += PICKUP_VALUE[pk as PickupType] ?? 0;
      if (canBomb) {
        bombValue = this.bombValue(a, x, y, radius, cur);
        score += bombValue;
      }
      // drift towards the nearest enemy
      let near = INF;
      for (const e of enemies) near = Math.min(near, Math.abs(e.x - x) + Math.abs(e.y - y));
      if (near < INF) {
        score -= near * 0.6 * this.tune.aggression;
        if (p.effects.fire > 0) score -= near * 3; // fire touch kills: chase
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
      return;
    }
    if (best === cur) {
      this.path.length = 0;
      if (bestIsBomb && !this.rng.chance(this.tune.sloppy)) this.tryBomb(a, p, cur, radius, tpt);
      return;
    }
    this.path = pathTo(best);
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
      if (restful(a, o.ds, i)) {
        this.safeFound++;
        const cost = sSteps[i]! + (exits(a, i) <= 1 ? 3 : 0);
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

  /** Place a bomb here only if an escape route exists; the escape becomes the path. */
  private tryBomb(a: Analysis, p: PlayerState, cur: number, radius: number, tpt: number) {
    const W = a.width;
    const x = cur % W;
    const y = (cur / W) | 0;
    const crazy = p.effects.crazy > 0;
    const fuse = crazy ? CRAZY_FUSE_MIN : BOMB_FUSE;
    const r = crazy ? Math.min(10, radius * 3) : radius;
    withExtraBomb(a, x, y, r, (p.abilities & Ability.Pierce) !== 0, fuse, hStart, hEnd);
    const near = this.nearEnemies(a, p, cur);
    const route = this.flee(a, {
      start: cur,
      tpt,
      margin: 3,
      ds: hStart,
      de: hEnd,
      allowSkull: false,
      selfId: p.id,
      maxSteps: 30,
      avoid: near.length ? near : undefined,
    });
    if (route.length === 0 || this.safeFound < (near.length ? this.tune.minSafe : 1)) return;
    const goal = route[route.length - 1]!;
    if (!restful(a, hStart, goal)) return; // no fully safe tile
    this.wantBomb = true;
    this.fleeing = true;
    this.path = route;
  }

  /** Bricks / enemies a bomb at (x, y) would hit. */
  private bombValue(a: Analysis, x: number, y: number, radius: number, self: number): number {
    const w = a.world;
    const W = a.width;
    let bricks = 0;
    const at = y * W + x;
    let foes = a.players[at]! - (at === self ? 1 : 0);
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIR_VEC[STEP_DIRS[d]!];
      for (let k = 1; k <= radius; k++) {
        const cx = x + dx * k;
        const cy = y + dy * k;
        if (cx < 0 || cy < 0 || cx >= W || cy >= a.height) break;
        const i = cy * W + cx;
        const t = w.tiles[i];
        if (t === Tile.Wall) break;
        if (t === Tile.Brick) {
          if (a.dStart[i]! >= INF) bricks++; // not already being blown up
          break;
        }
        foes += a.players[i]! - (i === self ? 1 : 0);
        if (a.bomb[i] || a.pickup[i]) break;
      }
    }
    return bricks * 12 + foes * 30 * this.tune.aggression;
  }

  /** Living opponents, nearest first (optionally only the `limit` nearest). */
  private enemies(a: Analysis, p: PlayerState, limit = Infinity): { x: number; y: number; d: number }[] {
    const out: { x: number; y: number; d: number }[] = [];
    for (const q of a.world.players.values()) {
      if (q === p || !q.alive || !q.inRound) continue;
      const x = Math.round(q.x);
      const y = Math.round(q.y);
      out.push({ x, y, d: Math.abs(x - p.x) + Math.abs(y - p.y) });
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
  private pathStillSafe(a: Analysis, tpt: number): boolean {
    const path = this.path;
    if (path.length === 0) return false;
    for (let k = 0; k < path.length; k++) {
      const i = path[k]!;
      if (a.world.tiles[i] !== Tile.Floor || a.bomb[i] || !safeAt(a.dStart, a.dEnd, i, k + 1, tpt, 1)) return false;
    }
    return restful(a, a.dStart, path[path.length - 1]!);
  }

  private ownBombs(a: Analysis, p: PlayerState): number {
    let n = 0;
    for (const b of a.world.bombs.values()) if (b.owner === p.id) n++;
    return n;
  }

  // ------------------------------------------------------------ abilities

  /** Detonate own remote bombs once we're clear of all of them. */
  private shouldDetonate(a: Analysis, p: PlayerState): boolean {
    if (!(p.abilities & Ability.Remote) || p.carrying >= 0) return false;
    const w = a.world;
    let oldest = -1;
    for (const b of w.bombs.values()) {
      if (b.owner !== p.id || b.fuse >= 0) continue;
      if (!this.remoteSeen.has(b.id)) this.remoteSeen.set(b.id, w.tick);
      if (oldest < 0) oldest = b.id;
    }
    if (this.remoteSeen.size > 32) for (const id of this.remoteSeen.keys()) if (!w.bombs.has(id)) this.remoteSeen.delete(id);
    if (oldest < 0 || w.tick - this.remoteSeen.get(oldest)! < this.tune.remoteDelay) return false;
    // safe from every own remote bomb (they may chain)?
    const n = a.width * a.height;
    hStart.fill(INF, 0, n);
    hEnd.fill(-1, 0, n);
    // everything our remote bombs would set off, chains included
    const seen = new Set<number>();
    const blast = (id: number) => {
      const b = w.bombs.get(id);
      if (!b || seen.has(id) || b.motion === BombMotion.Flying || b.motion === BombMotion.Carried) return;
      seen.add(id);
      markBlast(w, a.bomb, a.pickup, null, Math.round(b.x), Math.round(b.y), b.radius, b.kind === BombKind.Pierce || (b.owner === p.id && (p.abilities & Ability.Pierce) !== 0), 0, hStart, hEnd, blast);
    };
    for (const b of w.bombs.values()) if (b.owner === p.id && b.fuse < 0) blast(b.id);
    // every tile our (generous) hitbox touches must be clear, and the next step too
    const W = a.width;
    const x0 = Math.round(p.x - PLAYER_RADIUS);
    const x1 = Math.round(p.x + PLAYER_RADIUS);
    const y0 = Math.round(p.y - PLAYER_RADIUS);
    const y1 = Math.round(p.y + PLAYER_RADIUS);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && y >= 0 && x < W && y < a.height && hStart[y * W + x]! < INF) return false;
      }
    }
    const next = this.path[0];
    return next === undefined || hStart[next]! >= INF;
  }

  /** Hard bots: kick a bomb at an enemy, or grab-and-throw / punch one their way. */
  private tryTricks(a: Analysis, p: PlayerState, cur: number): boolean {
    const w = a.world;
    const W = a.width;
    const x = cur % W;
    const y = (cur / W) | 0;
    const enemies = this.enemies(a, p);
    if (enemies.length === 0) return false;
    const inLine = (bx: number, by: number, d: Dir, min: number, max: number) => {
      const [dx, dy] = DIR_VEC[d];
      for (const e of enemies) {
        const along = (e.x - bx) * dx + (e.y - by) * dy;
        const perp = Math.abs((e.x - bx) * dy - (e.y - by) * dx);
        if (along >= min && along <= max && perp <= 1) return true;
      }
      return false;
    };
    // Glove: just placed our bomb underfoot -> throw it at someone
    if (p.abilities & Ability.Glove) {
      const b = a.bomb[cur] ? w.bombs.get(a.bomb[cur]!) : undefined;
      if (b && b.owner === p.id && b.fuse > BOMB_FUSE / 2) {
        for (const d of STEP_DIRS) {
          if (!inLine(x, y, d, THROW_DISTANCE - 1, THROW_DISTANCE + 2)) continue;
          const [dx, dy] = DIR_VEC[d];
          this.script = [
            [dx, dy, Button.Action],
            [0, 0, 0],
          ];
          this.path.length = 0;
          return true;
        }
      }
    }
    for (const d of STEP_DIRS) {
      const [dx, dy] = DIR_VEC[d];
      const bx = x + dx;
      const by = y + dy;
      if (bx < 0 || by < 0 || bx >= W || by >= a.height) continue;
      const id = a.bomb[by * W + bx];
      if (!id) continue;
      const b = w.bombs.get(id)!;
      if (b.motion !== BombMotion.Idle || (b.fuse > 0 && b.fuse < 20)) continue;
      if (this.trickBomb === id && w.tick - this.trickTick < 60) continue; // tried that one already
      this.trickBomb = id;
      this.trickTick = w.tick;
      if (p.abilities & Ability.Punch && inLine(bx, by, d, 2, 5)) {
        this.script = [
          [dx, dy, 0],
          [0, 0, Button.Action],
          [0, 0, 0],
        ];
        this.path.length = 0;
        return true;
      }
      if (p.abilities & Ability.Kick && canKick(b, p) && inLine(bx, by, d, 2, 9) && this.clearLane(a, bx, by, d)) {
        this.script = Array.from({ length: 10 }, () => [dx, dy, 0] as [number, number, number]);
        this.path.length = 0;
        return true;
      }
    }
    return false;
  }

  /** Trapped: kick an adjacent bomb out of the way if we can. */
  private kickOut(a: Analysis, p: PlayerState, cur: number) {
    if (!(p.abilities & Ability.Kick)) return;
    const W = a.width;
    const x = cur % W;
    const y = (cur / W) | 0;
    for (const d of STEP_DIRS) {
      const [dx, dy] = DIR_VEC[d];
      const bx = x + dx;
      const by = y + dy;
      if (bx < 0 || by < 0 || bx >= W || by >= a.height || !a.bomb[by * W + bx]) continue;
      const b = a.world.bombs.get(a.bomb[by * W + bx]!);
      if (!b || !canKick(b, p) || !this.clearLane(a, bx, by, d)) continue;
      this.script = Array.from({ length: 8 }, () => [dx, dy, 0] as [number, number, number]);
      return;
    }
  }

  /** The tile past the bomb is open floor (so a kick actually goes somewhere). */
  private clearLane(a: Analysis, bx: number, by: number, d: Dir): boolean {
    const [dx, dy] = DIR_VEC[d];
    const x = bx + dx;
    const y = by + dy;
    if (x < 0 || y < 0 || x >= a.width || y >= a.height) return false;
    const i = y * a.width + x;
    return a.world.tiles[i] === Tile.Floor && !a.bomb[i] && !a.pickup[i];
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
    // idle: settle on the tile centre so bombs land where we expect
    const ox = Math.round(p.x) - p.x;
    const oy = Math.round(p.y) - p.y;
    if (Math.abs(ox) + Math.abs(oy) < 0.08) return [0, 0];
    return Math.abs(ox) > Math.abs(oy) ? [Math.sign(ox), 0] : [0, Math.sign(oy)];
  }

  /** No progress for a second while trying to move: take a random safe step and replan. */
  private checkStuck(a: Analysis, p: PlayerState, cur: number, tpt: number) {
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
    for (let k = 0; k < 4; k++) {
      const d = STEP_DIRS[(first + k) & 3]!;
      const [dx, dy] = DIR_VEC[d];
      const x = (cur % W) + dx;
      const y = ((cur / W) | 0) + dy;
      if (x < 0 || y < 0 || x >= W || y >= a.height) continue;
      const i = y * W + x;
      if (w.tiles[i] !== Tile.Floor || a.bomb[i] || !safeAt(a.dStart, a.dEnd, i, 1, tpt, 4)) continue;
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
    return { seq: ++this.seq, dx, dy, buttons };
  }
}

/** Walking into a bomb only kicks it when we actually collide with it. */
const canKick = (b: BombState, p: PlayerState) =>
  b.motion === BombMotion.Idle && !(p.abilities & Ability.BombPass) && !b.passers.includes(p.id);

const clampAxis = (v: number) => (v > 0.5 ? 0.5 : v < -0.5 ? -0.5 : v);
