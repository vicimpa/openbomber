// Shared world analysis for bots: per-tile danger windows (when flames will arrive and
// when they'll be gone), predicted from fuses and chain reactions. Computed once per
// world tick and shared by every bot.

import { CHAIN_DELAY, FLAME_TIME, THROW_TIME } from '../contract/constants';
import { BombKind, BombMotion, PickupType, Tile, type WorldState } from '../contract/types';

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
}

interface PendingBomb {
  id: number;
  x: number;
  y: number;
  radius: number;
  pierce: boolean;
  time: number;
  done: boolean;
}

const cache = new WeakMap<WorldState, Analysis>();
const pending: PendingBomb[] = [];

const wrap = (v: number, n: number) => ((v % n) + n) % n;

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
) {
  const W = w.width;
  const mark = (i: number) => {
    if (t < ds[i]!) ds[i] = t;
    if (t + FLAME_TIME > de[i]!) de[i] = t + FLAME_TIME;
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
  const W = w.width;

  for (const k of w.pickups.values()) pickup[k.y * W + k.x] = k.type + 1;
  for (const p of w.players.values()) {
    if (!p.alive || !p.inRound) continue;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (x >= 0 && y >= 0 && x < W && y < w.height) players[y * W + x]++;
    if (p.effects.fire > 0) a.fire.push({ id: p.id, x, y });
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

  // bombs -> pending list with their expected detonation time
  pending.length = 0;
  for (const b of w.bombs.values()) {
    if (b.motion === BombMotion.Carried) continue;
    let x = Math.round(b.x);
    let y = Math.round(b.y);
    let time = b.fuse > 0 ? b.fuse : b.fuse < 0 ? (-b.fuse <= REMOTE_TIMED ? -b.fuse : INF) : 0;
    if (b.motion === BombMotion.Flying) {
      x = wrap(b.toX, W);
      y = wrap(b.toY, w.height);
      time = Math.max(time, Math.ceil((1 - b.progress) * THROW_TIME));
    } else bomb[y * W + x] = b.id;
    if (x < 0 || y < 0 || x >= W || y >= w.height) continue;
    pending.push({ id: b.id, x, y, radius: b.radius, pierce: b.kind === BombKind.Pierce, time, done: false });
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
    markBlast(w, bombGrid, pickups, gone, best.x, best.y, best.radius, best.pierce, best.time, ds, de, onBomb);
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

/** Danger windows with one extra (hypothetical) bomb added. Writes into ds/de copies. */
export function withExtraBomb(
  a: Analysis,
  x: number,
  y: number,
  radius: number,
  pierce: boolean,
  time: number,
  ds: Int32Array,
  de: Int32Array,
) {
  ds.set(a.dStart);
  de.set(a.dEnd);
  const w = a.world;
  const W = a.width;
  // our bomb goes off early if it already sits in a blast
  const t0 = Math.min(time, a.dStart[y * W + x]! < INF ? a.dStart[y * W + x]! + CHAIN_DELAY : INF);
  markBlast(w, a.bomb, a.pickup, a.gone, x, y, radius, pierce, t0, ds, de, (id, t) => {
    // a bomb we'd reach may now go off earlier: re-mark its blast from the chained time
    const b = w.bombs.get(id);
    if (!b) return;
    const bt = t + CHAIN_DELAY;
    const bx = Math.round(b.x);
    const by = Math.round(b.y);
    if (bt < a.dStart[by * W + bx]!) markBlast(w, a.bomb, a.pickup, a.gone, bx, by, b.radius, b.kind === BombKind.Pierce, bt, ds, de, null);
  });
}

export const isSkull = (a: Analysis, i: number) => a.pickup[i] === PickupType.Skull + 1;
