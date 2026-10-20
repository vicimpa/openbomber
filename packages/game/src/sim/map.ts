// Arena generation: pillars on odd/odd tiles, spawn safe zones, random bricks with
// hidden pickups, and the sudden-death spiral order.

import { BRICK_FILL, PICKUP_FILL } from '../contract/constants';
import { Tile } from '../contract/types';
import { randInt, shuffle, type SeedHolder } from './rng';
import { rollPickup } from './pickups';

export interface Point {
  x: number;
  y: number;
}

export interface GeneratedMap {
  width: number;
  height: number;
  tiles: Uint8Array;
  hidden: Int8Array;
  spawns: Point[];
}

/** Arena size by player count (from the plan). */
export function mapSizeFor(players: number): [number, number] {
  if (players <= 4) return [15, 13];
  if (players <= 8) return [19, 15];
  if (players <= 12) return [23, 17];
  return [27, 19];
}

export const isPillar = (x: number, y: number) => (x & 1) === 1 && (y & 1) === 1;

/**
 * Spawn points: the four corners first (diagonal pair first so 2 players start far
 * apart), then greedy farthest-point picks among even/even tiles. Deterministic.
 */
export function spawnPoints(width: number, height: number, count: number): Point[] {
  const W = width - 1;
  const H = height - 1;
  const pts: Point[] = [
    { x: 0, y: 0 },
    { x: W, y: H },
    { x: W, y: 0 },
    { x: 0, y: H },
  ];
  // corners must be even tiles to have free neighbours (matters for even-sized custom arenas)
  for (const p of pts) {
    p.x -= p.x & 1;
    p.y -= p.y & 1;
  }
  const out = pts.slice(0, Math.min(count, 4));
  while (out.length < count) {
    let best: Point | null = null;
    let bestD = -1;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        let d = Infinity;
        for (const p of out) {
          const dx = p.x - x;
          const dy = p.y - y;
          const dd = dx * dx + dy * dy;
          if (dd < d) d = dd;
        }
        if (d > bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (!best || bestD <= 0) break;
    out.push(best);
  }
  // tiny arenas can run out of distinct points: reuse
  for (let i = out.length; i < count; i++) out.push({ ...out[i % Math.max(1, out.length)]! });
  return out;
}

/** Mark the spawn and an L of two tiles along each axis (towards the centre). */
function markSafeZone(width: number, height: number, safe: Uint8Array, s: Point) {
  safe[s.y * width + s.x] = 1;
  let hx = s.x < width / 2 ? 1 : -1;
  if (s.x + hx * 2 < 0 || s.x + hx * 2 >= width) hx = -hx;
  let vy = s.y < height / 2 ? 1 : -1;
  if (s.y + vy * 2 < 0 || s.y + vy * 2 >= height) vy = -vy;
  for (let i = 1; i <= 2; i++) {
    const x = s.x + hx * i;
    if (x >= 0 && x < width) safe[s.y * width + x] = 1;
    const y = s.y + vy * i;
    if (y >= 0 && y < height) safe[y * width + s.x] = 1;
  }
}

export function generateMap(rng: SeedHolder, width: number, height: number, spawnCount: number): GeneratedMap {
  const n = width * height;
  const tiles = new Uint8Array(n);
  const hidden = new Int8Array(n).fill(-1);
  const safe = new Uint8Array(n);
  const spawns = spawnPoints(width, height, spawnCount);
  for (const s of spawns) markSafeZone(width, height, safe, s);

  const bricks: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isPillar(x, y)) tiles[i] = Tile.Wall;
      else if (!safe[i] && randInt(rng, 1 << 20) < BRICK_FILL * (1 << 20)) {
        tiles[i] = Tile.Brick;
        bricks.push(i);
      }
    }
  }
  shuffle(rng, bricks);
  const withPickup = Math.round(bricks.length * PICKUP_FILL);
  for (let k = 0; k < withPickup; k++) hidden[bricks[k]!] = rollPickup(rng, false);
  return { width, height, tiles, hidden, spawns };
}

/** All tile indices in a clockwise spiral from the outer ring inwards. */
export function spiralOrder(width: number, height: number): Int32Array {
  const out = new Int32Array(width * height);
  let k = 0;
  let x0 = 0;
  let y0 = 0;
  let x1 = width - 1;
  let y1 = height - 1;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out[k++] = y0 * width + x;
    for (let y = y0 + 1; y <= y1; y++) out[k++] = y * width + x1;
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out[k++] = y1 * width + x;
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out[k++] = y * width + x0;
    x0++;
    y0++;
    x1--;
    y1--;
  }
  return out;
}

/** Build tiles from ASCII rows (dev / tests): '#' wall, 'B' brick, anything else floor. */
export function parseMap(rows: string[]): { width: number; height: number; tiles: Uint8Array } {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const tiles = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = rows[y]![x];
      tiles[y * width + x] = c === '#' ? Tile.Wall : c === 'B' ? Tile.Brick : Tile.Floor;
    }
  }
  return { width, height, tiles };
}
