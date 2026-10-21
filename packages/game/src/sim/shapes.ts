// Arena shapes. The arena stays a width x height grid; only the cells inside the shape are
// playable, the rest are plain walls (the client draws them as the countryside around it).
// Everything here is a pure function of (shape, width, height), so the sim, the bots and the
// renderer all derive the same mask and zone rings from the synced WorldState.

import { ArenaShape } from '../contract/types';
import { nextFloat, randInt, type SeedHolder } from './rng';

export interface Point {
  x: number;
  y: number;
}

/** How often each shape comes up (by ArenaShape). The classic rectangle stays the most common. */
const SHAPE_WEIGHTS: readonly number[] = [4, 2, 2, 2, 2];

/**
 * Bounding box growth per shape, so the playable area stays about the size of the rectangle
 * the same players would get (circle pi/4, diamond 1/2, cross ~2/3, ring ~0.7 of the box).
 */
const SHAPE_SCALE: readonly number[] = [1, 1.13, 1.41, 1.23, 1.19];

/** Half-width of the cross arms and radius of the ring's hole, as a share of the half-size. */
const CROSS_ARM = 0.42;
const RING_HOLE = 0.34;

export function pickShape(rng: SeedHolder): ArenaShape {
  let total = 0;
  for (const w of SHAPE_WEIGHTS) total += w;
  let r = nextFloat(rng) * total;
  for (let i = 0; i < SHAPE_WEIGHTS.length; i++) {
    r -= SHAPE_WEIGHTS[i]!;
    if (r < 0) return i as ArenaShape;
  }
  return ArenaShape.Rect;
}

/** Bounding box for `shape` around a rectangle of w x h (both odd, like the canon sizes). */
export function shapeSize(shape: ArenaShape, w: number, h: number): [number, number] {
  const k = SHAPE_SCALE[shape] ?? 1;
  const odd = (n: number) => Math.min(255, 2 * Math.round((n * k - 1) / 2) + 1);
  return [odd(w), odd(h)];
}

const pillar = (x: number, y: number) => (x & 1) === 1 && (y & 1) === 1;

function rawInside(shape: ArenaShape, w: number, h: number, x: number, y: number): boolean {
  const hx = Math.max(1, (w - 1) / 2), hy = Math.max(1, (h - 1) / 2);
  const nx = (x - hx) / hx, ny = (y - hy) / hy;
  switch (shape) {
    case ArenaShape.Circle: return nx * nx + ny * ny <= 1.04;
    case ArenaShape.Diamond: return Math.abs(nx) + Math.abs(ny) <= 1.02;
    case ArenaShape.Cross: return Math.abs(nx) <= CROSS_ARM || Math.abs(ny) <= CROSS_ARM;
    case ArenaShape.Ring: {
      const d = nx * nx + ny * ny;
      return d <= 1.04 && d >= RING_HOLE * RING_HOLE;
    }
    default: return true;
  }
}

interface ShapeData { mask: Uint8Array; depth: Uint8Array; maxDepth: number }
const cache = new Map<string, ShapeData>();

function shapeData(shape: ArenaShape, w: number, h: number): ShapeData {
  const key = `${shape}:${w}x${h}`;
  let d = cache.get(key);
  if (d) return d;
  const n = w * h;
  const mask = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = rawInside(shape, w, h, x, y) ? 1 : 0;
  if (shape !== ArenaShape.Rect) keepReachable(mask, w, h);
  const depth = new Uint8Array(n).fill(255);
  const maxDepth = ringDepths(mask, depth, w, h);
  d = { mask, depth, maxDepth };
  if (cache.size > 16) cache.delete(cache.keys().next().value!);
  cache.set(key, d);
  return d;
}

/**
 * Cells a hero can't walk to (cut off by pillars at a slanted edge) are dropped from the shape:
 * flood fill over non-pillar cells from the most central one.
 */
function keepReachable(mask: Uint8Array, w: number, h: number) {
  let start = -1, best = Infinity;
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  for (let i = 0; i < mask.length; i++) {
    const x = i % w, y = (i / w) | 0;
    if (!mask[i] || pillar(x, y)) continue;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < best) { best = d; start = i; }
  }
  if (start < 0) return;
  const seen = new Uint8Array(mask.length);
  const queue = [start];
  seen[start] = 1;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!, x = i % w, y = (i / w) | 0;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of next) {
      if (j < 0 || seen[j] || !mask[j] || pillar(j % w, (j / w) | 0)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  // pillars stay where they touch a reachable cell, everything else unreachable goes
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    const x = i % w, y = (i / w) | 0;
    const touches = pillar(x, y) && ((x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (y > 0 && seen[i - w]) || (y < h - 1 && seen[i + w]));
    if (!touches) mask[i] = 0;
  }
}

/** Chebyshev distance to the outside (8-neighbour BFS) minus one: the zone ring of every cell. */
function ringDepths(mask: Uint8Array, depth: Uint8Array, w: number, h: number): number {
  const queue: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % w, y = (i / w) | 0;
    let edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1 && !edge; dx++) {
      if (!mask[(y + dy) * w + x + dx]) edge = true;
    }
    if (edge) { depth[i] = 0; queue.push(i); }
  }
  let max = queue.length ? 0 : -1;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!, x = i % w, y = (i / w) | 0, d = depth[i]! + 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!mask[j] || depth[j]! <= d) continue;
      depth[j] = d;
      if (d > max) max = d;
      queue.push(j);
    }
  }
  return max;
}

/** 1 = playable cell of the arena. */
export function shapeMask(shape: ArenaShape, w: number, h: number): Uint8Array {
  return shapeData(shape, w, h).mask;
}

export function insideShape(shape: ArenaShape, w: number, h: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h && shapeData(shape, w, h).mask[y * w + x] === 1;
}

/** Zone ring that closes each cell (0 = the outer edge), 255 outside the shape. */
export function zoneDepth(shape: ArenaShape, w: number, h: number): Uint8Array {
  return shapeData(shape, w, h).depth;
}

/** The innermost ring (the zone is fully closed once ring maxDepth has fallen). */
export function maxZoneDepth(shape: ArenaShape, w: number, h: number): number {
  return shapeData(shape, w, h).maxDepth;
}

/** Cells of zone ring `ring`, clockwise from the top-left (the order the blocks fall in). */
export function shapeRingTiles(shape: ArenaShape, w: number, h: number, ring: number): number[] {
  const depth = zoneDepth(shape, w, h);
  const out: number[] = [];
  for (let i = 0; i < depth.length; i++) if (depth[i] === ring) out.push(i);
  const cx = (w - 1) / 2, cy = (h - 1) / 2, start = Math.atan2(-1, -1);
  const angle = (i: number) => {
    const a = Math.atan2(((i / w) | 0) - cy, (i % w) - cx) - start;
    return a < 0 ? a + Math.PI * 2 : a;
  };
  return out.map((i) => [i, angle(i)] as const).sort((a, b) => a[1] - b[1] || a[0] - b[0]).map((p) => p[0]);
}

/**
 * Spawn points inside a shape: `count` cells on even coordinates (never a pillar), at least two
 * rings in so the free plus around them fits, spread out by farthest-point sampling.
 */
export function shapeSpawns(rng: SeedHolder, shape: ArenaShape, w: number, h: number, count: number): Point[] {
  const depth = zoneDepth(shape, w, h);
  let cands: Point[] = [];
  for (let need = 2; need >= 0 && cands.length < count; need--) {
    cands = [];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const d = depth[y * w + x]!;
      if (d !== 255 && d >= need) cands.push({ x, y });
    }
  }
  if (!cands.length) return [{ x: (w - 1) & ~1, y: (h - 1) & ~1 }];
  const out: Point[] = [cands[randInt(rng, cands.length)]!];
  const near = cands.map((c) => (c.x - out[0]!.x) ** 2 + (c.y - out[0]!.y) ** 2);
  while (out.length < count && out.length < cands.length) {
    let bi = 0;
    for (let i = 1; i < cands.length; i++) if (near[i]! > near[bi]!) bi = i;
    const p = cands[bi]!;
    out.push(p);
    for (let i = 0; i < cands.length; i++) near[i] = Math.min(near[i]!, (cands[i]!.x - p.x) ** 2 + (cands[i]!.y - p.y) ** 2);
  }
  return out;
}
