// Shared world analysis for bots: per-tile danger windows (when flames will arrive and
// when they'll be gone), predicted from fuses and chain reactions. Computed once per
// world tick and shared by every bot.

import {
  BOUNCE_TIME,
  CHAIN_DELAY,
  CRAZY_FUSE_MAX,
  CRAZY_FUSE_MIN,
  CRAZY_RADIUS_MULT,
  FLAME_TIME,
  MAX_RADIUS,
  THROW_TIME,
} from '../contract/constants';
import { Ability, BombKind, BombMotion, Curse, PickupType, Tile, type BombState, type PlayerState, type WorldState } from '../contract/types';

export const INF = 0x3fffffff;
/** Remote bombs this close to their automatic detonation count as timed bombs. */
const REMOTE_TIMED = 90;

export interface Analysis {
  world: WorldState;
  tick: number;
  width: number;
  height: number;
  /** Ticks from now until the tile burns (INF = never), and until it stops burning. */
  dStart: Int32Array;
  dEnd: Int32Array;
  /**
   * Tiles in the blast of a remote bomb that can go off at any moment (untimed): fine to
   * walk through, never a place to stop.
   */
  soft: Uint8Array;
  /** When a brick / pickup is predicted to be destroyed (INF = not). */
  gone: Int32Array;
  /** Grounded bomb id per tile, 0 = none. */
  bomb: Int32Array;
  /** Pickup type + 1 per tile, 0 = none. */
  pickup: Int8Array;
  /** Alive, in-round players per tile. */
  players: Uint8Array;
  /** Tiles near players with the Fire effect (touch = death), keyed by player id. */
  fire: { id: string; x: number; y: number }[];
  /** Cursed players (touch = their curse). */
  cursed: { id: string; x: number; y: number }[];
  /** First tick each Crazy bomb was seen: its real fuse is a secret, only its age is known. */
  crazySeen: Map<number, number>;
}

interface PendingBomb {
  id: number;
  x: number;
  y: number;
  radius: number;
  pierce: boolean;
  time: number;
  /** How long after `time` the tiles may still burn (a Crazy fuse is a window). */
  dur: number;
  done: boolean;
}

const cache = new WeakMap<WorldState, Analysis>();
const pending: PendingBomb[] = [];


/**
 * Mark one bomb's blast cells with the window [t, t + FLAME_TIME] and call `onBomb` for
 * bombs it reaches. `gone` (optional) records when bricks / pickups get destroyed, so a
 * later blast passes through them once the earlier flame has died down.
 */
export function markBlast(
  w: WorldState,
  bombGrid: Int32Array,
  pickups: Int8Array,
  gone: Int32Array | null,
  x: number,
  y: number,
  radius: number,
  pierce: boolean,
  t: number,
  ds: Int32Array,
  de: Int32Array,
  onBomb: ((id: number, t: number) => void) | null,
  dur = FLAME_TIME,
) {
  const W = w.width;
  const mark = (i: number) => {
    if (t < ds[i]!) ds[i] = t;
    if (t + dur > de[i]!) de[i] = t + dur;
  };
  mark(y * W + x);
  for (let d = 0; d < 4; d++) {
    const dx = d === 1 ? -1 : d === 2 ? 1 : 0;
    const dy = d === 0 ? -1 : d === 3 ? 1 : 0;
    for (let k = 1; k <= radius; k++) {
      const cx = x + dx * k;
      const cy = y + dy * k;
      if (cx < 0 || cy < 0 || cx >= W || cy >= w.height) break;
      const i = cy * W + cx;
      const tile = w.tiles[i];
      if (tile === Tile.Wall) break;
      mark(i);
      if (bombGrid[i]) {
        onBomb?.(bombGrid[i]!, t);
        break;
      }
      const blocker = (tile === Tile.Brick && !pierce) || pickups[i];
      if (!blocker) continue;
      if (!gone) break;
      if (gone[i]! + FLAME_TIME < t) continue; // already burnt away by an earlier blast
      if (t < gone[i]!) gone[i] = t;
      break;
    }
  }
}

export function analyze(w: WorldState): Analysis {
  let a = cache.get(w);
  if (a && a.tick === w.tick && a.width === w.width && a.height === w.height) return a;
  const n = w.width * w.height;
  if (!a || a.dStart.length !== n) {
    a = {
      world: w,
      tick: -1,
      width: w.width,
      height: w.height,
      dStart: new Int32Array(n),
      dEnd: new Int32Array(n),
      gone: new Int32Array(n),
      soft: new Uint8Array(n),
      bomb: new Int32Array(n),
      pickup: new Int8Array(n),
      players: new Uint8Array(n),
      fire: [],
      cursed: [],
      crazySeen: new Map(),
    };
    cache.set(w, a);
  }
  a.tick = w.tick;
  a.width = w.width;
  a.height = w.height;
  const { dStart, dEnd, bomb, pickup, players, gone, soft } = a;
  gone.fill(INF);
  soft.fill(0);
  dStart.fill(INF);
  dEnd.fill(-1);
  bomb.fill(0);
  pickup.fill(0);
  players.fill(0);
  a.fire.length = 0;
  a.cursed.length = 0;
  const W = w.width;

  for (const k of w.pickups.values()) pickup[k.y * W + k.x] = k.type + 1;
  for (const p of w.players.values()) {
    if (!p.alive || !p.inRound) continue;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (x >= 0 && y >= 0 && x < W && y < w.height) players[y * W + x]++;
    if (p.effects.fire > 0) a.fire.push({ id: p.id, x, y });
    if (p.curse !== Curse.None) a.cursed.push({ id: p.id, x, y });
  }
  for (const f of w.flames.values()) {
    const i = f.y * W + f.x;
    dStart[i] = 0;
    if (f.ttl > dEnd[i]!) dEnd[i] = f.ttl;
  }
  for (const f of w.falling) {
    const i = f.y * W + f.x;
    if (f.ttl < dStart[i]!) dStart[i] = f.ttl;
    dEnd[i] = INF;
  }
  // the ring the zone will close next: get out before the warning runs out
  if (w.zoneIn > 0) {
    const r = w.zoneRing;
    const x1 = W - 1 - r;
    const y1 = w.height - 1 - r;
    const mark = (i: number) => {
      if (w.zoneIn < dStart[i]!) dStart[i] = w.zoneIn;
      dEnd[i] = INF;
    };
    for (let x = r; x <= x1; x++) {
      mark(r * W + x);
      mark(y1 * W + x);
    }
    for (let y = r; y <= y1; y++) {
      mark(y * W + r);
      mark(y * W + x1);
    }
  }

  // bombs -> pending list with their expected detonation time and where they'll be
  pending.length = 0;
  for (const b of w.bombs.values()) {
    if (b.motion !== BombMotion.Idle && b.motion !== BombMotion.Sliding) continue;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (x >= 0 && y >= 0 && x < W && y < w.height) bomb[y * W + x] = b.id;
  }
  const seen = a.crazySeen;
  if (seen.size > 64) for (const id of seen.keys()) if (!w.bombs.has(id)) seen.delete(id);
  for (const b of w.bombs.values()) {
    if (b.motion === BombMotion.Carried) continue;
    let x = Math.round(b.x);
    let y = Math.round(b.y);
    let time = b.fuse > 0 ? b.fuse : b.fuse < 0 ? (-b.fuse <= REMOTE_TIMED ? -b.fuse : INF) : 0;
    let dur = FLAME_TIME;
    const owner = w.players.get(b.owner);
    let radius = b.radius;
    if (b.kind === BombKind.Crazy) {
      // the real fuse / radius are secret: assume the shortest fuse and the biggest blast,
      // burning any time until the longest fuse runs out; overdue = may go off any moment
      let t0 = seen.get(b.id);
      if (t0 === undefined) seen.set(b.id, (t0 = w.tick));
      const age = w.tick - t0;
      radius = crazyRadius(owner);
      time = CRAZY_FUSE_MIN - age > 0 ? CRAZY_FUSE_MIN - age : INF;
      dur = CRAZY_FUSE_MAX - age - time + FLAME_TIME;
    }
    if (b.motion === BombMotion.Flying) {
      const dx = Math.sign(b.toX - b.fromX);
      const dy = Math.sign(b.toY - b.fromY);
      const at = landing(a, b.toX, b.toY, dx, dy, b.id); // off the map it evaporates
      if (at < 0) continue;
      x = at % W;
      y = (at / W) | 0;
      time = Math.max(time, Math.ceil((1 - b.progress) * THROW_TIME) + landHops * BOUNCE_TIME);
    } else if (b.motion === BombMotion.Sliding) {
      const at = slideStop(a, x, y, Math.sign(b.vx), Math.sign(b.vy), b.id);
      x = at % W;
      y = (at / W) | 0;
    }
    if (x < 0 || y < 0 || x >= W || y >= w.height) continue;
    pending.push({ id: b.id, x, y, radius, pierce: bombPierces(w, b), time, dur, done: false });
  }
  resolveChains(w, bomb, pickup, gone, dStart, dEnd, soft);
  return a;
}

/** Explode pending bombs in time order, pulling chained bombs forward (Dijkstra-like). */
function resolveChains(
  w: WorldState,
  bombGrid: Int32Array,
  pickups: Int8Array,
  gone: Int32Array,
  ds: Int32Array,
  de: Int32Array,
  soft: Uint8Array,
) {
  const onBomb = (id: number, t: number) => {
    for (const q of pending) if (q.id === id && !q.done && q.time > t + CHAIN_DELAY) q.time = t + CHAIN_DELAY;
  };
  for (;;) {
    let best: PendingBomb | null = null;
    for (const q of pending) if (!q.done && (!best || q.time < best.time)) best = q;
    if (!best) break;
    best.done = true;
    if (best.time >= INF) {
      markSoft(w, bombGrid, pickups, best.x, best.y, best.radius, best.pierce, soft);
      continue;
    }
    markBlast(w, bombGrid, pickups, gone, best.x, best.y, best.radius, best.pierce, best.time, ds, de, onBomb, best.dur);
  }
}

/** Blast cells of an untimed (remote) bomb. */
function markSoft(w: WorldState, bombGrid: Int32Array, pickups: Int8Array, x: number, y: number, radius: number, pierce: boolean, soft: Uint8Array) {
  const W = w.width;
  soft[y * W + x] = 1;
  for (let d = 0; d < 4; d++) {
    const dx = d === 1 ? -1 : d === 2 ? 1 : 0;
    const dy = d === 0 ? -1 : d === 3 ? 1 : 0;
    for (let k = 1; k <= radius; k++) {
      const cx = x + dx * k;
      const cy = y + dy * k;
      if (cx < 0 || cy < 0 || cx >= W || cy >= w.height) break;
      const i = cy * W + cx;
      const tile = w.tiles[i];
      if (tile === Tile.Wall) break;
      soft[i] = 1;
      if (bombGrid[i] || (tile === Tile.Brick && !pierce) || pickups[i]) break;
    }
  }
}

/** A tile that is neither timed danger nor in an untimed remote blast. */
export const restful = (a: Analysis, ds: Int32Array, i: number) => ds[i]! >= INF && !a.soft[i];

/**
 * Danger windows with extra (hypothetical) bombs added: one at (x, y), plus `more` (tile
 * indices, e.g. a LineBomb line) with the same fuse. Writes into ds/de copies.
 */
export function withExtraBomb(
  a: Analysis,
  x: number,
  y: number,
  radius: number,
  pierce: boolean,
  time: number,
  ds: Int32Array,
  de: Int32Array,
  dur = FLAME_TIME,
  more?: readonly number[],
) {
  ds.set(a.dStart);
  de.set(a.dEnd);
  const w = a.world;
  const W = a.width;
  const chain = (id: number, t: number) => {
    // a bomb we'd reach may now go off earlier: re-mark its blast from the chained time
    const b = w.bombs.get(id);
    if (!b) return;
    const bt = t + CHAIN_DELAY;
    const bx = Math.round(b.x);
    const by = Math.round(b.y);
    if (bt < a.dStart[by * W + bx]!) markBlast(w, a.bomb, a.pickup, a.gone, bx, by, b.radius, bombPierces(w, b), bt, ds, de, null);
  };
  const one = (bx: number, by: number) => {
    // our bomb goes off early if it already sits in a blast
    const i = by * W + bx;
    const t0 = Math.min(time, a.dStart[i]! < INF ? a.dStart[i]! + CHAIN_DELAY : INF);
    markBlast(w, a.bomb, a.pickup, a.gone, bx, by, radius, pierce, t0, ds, de, chain, dur);
  };
  one(x, y);
  if (more) for (const i of more) one(i % W, (i / W) | 0);
}

/** Largest blast a Crazy bomb of this owner can have. */
export const crazyRadius = (owner: PlayerState | undefined) =>
  owner ? Math.min(MAX_RADIUS, (owner.curse === Curse.TinyFlame ? 1 : owner.radius) * CRAZY_RADIUS_MULT) : MAX_RADIUS;

/** Hops taken by the last landing() call. */
export let landHops = 0;

/**
 * Where a thrown / punched bomb aimed at (x, y), flying along (dx, dy), comes down: a
 * blocked tile or a head makes it hop one tile on. -1 = off the map (it evaporates).
 */
export function landing(a: Analysis, x: number, y: number, dx: number, dy: number, self: number): number {
  const w = a.world;
  const W = a.width;
  landHops = 0;
  if (dx === 0 && dy === 0) return x >= 0 && y >= 0 && x < W && y < a.height ? y * W + x : -1;
  for (let h = 0; h <= 64; h++) {
    if (x < 0 || y < 0 || x >= W || y >= a.height) return -1;
    const i = y * W + x;
    const id = a.bomb[i]!;
    if (w.tiles[i] === Tile.Floor && (!id || id === self) && !a.pickup[i] && !a.players[i]) {
      landHops = h;
      return i;
    }
    x += dx;
    y += dy;
  }
  return -1;
}

/** Tile where a bomb sliding from (x, y) along (dx, dy) stops (before walls, bombs, pickups, players). */
export function slideStop(a: Analysis, x: number, y: number, dx: number, dy: number, self: number): number {
  const w = a.world;
  const W = a.width;
  let i = y * W + x;
  if (dx === 0 && dy === 0) return i;
  for (let k = 0; k < 128; k++) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= a.height) break;
    const j = ny * W + nx;
    const id = a.bomb[j]!;
    if (w.tiles[j] !== Tile.Floor || (id && id !== self) || a.pickup[j] || a.players[j]) break;
    x = nx;
    y = ny;
    i = j;
  }
  return i;
}

/**
 * Whether a bomb at (bx, by) with `radius` burns tile (tx, ty): same row / column, in
 * reach, nothing in between that soaks up the flame (walls, bricks unless piercing,
 * bombs, pickups).
 */
export function inBlast(a: Analysis, bx: number, by: number, radius: number, pierce: boolean, tx: number, ty: number): boolean {
  if (bx === tx && by === ty) return true;
  if (bx !== tx && by !== ty) return false;
  const dist = Math.abs(tx - bx) + Math.abs(ty - by);
  if (dist > radius) return false;
  const W = a.width;
  const dx = Math.sign(tx - bx);
  const dy = Math.sign(ty - by);
  const tiles = a.world.tiles;
  for (let k = 1; k < dist; k++) {
    const i = (by + dy * k) * W + bx + dx * k;
    const t = tiles[i];
    if (t === Tile.Wall || (t === Tile.Brick && !pierce) || a.bomb[i] || a.pickup[i]) return false;
  }
  return tiles[ty * W + tx] !== Tile.Wall;
}

/** The Pierce flag a bomb will explode with (kind, or the owner's ability baked in at placement). */
export const bombPierces = (w: WorldState, b: BombState) => {
  if (b.kind === BombKind.Pierce) return true;
  const o = w.players.get(b.owner);
  return o !== undefined && (o.abilities & Ability.Pierce) !== 0;
};

export const isSkull = (a: Analysis, i: number) => a.pickup[i] === PickupType.Skull + 1;
