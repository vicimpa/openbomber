// Arena generation (canon: legacy core/calcMap.ts + server GameMap.ts) and zone rings.

import { BRICK_FILL, MAP_MARGIN, MAP_PADDING, PICKUP_FILL } from '../contract/constants';
import { Tile } from '../contract/types';
import { shuffle, type SeedHolder } from './rng';
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

/**
 * Arena size and spawn points by player count, exactly as legacy core/calcMap.ts: a grid of
 * cells (MAP_PADDING + MAP_MARGIN = 14 tiles apart) just big enough for everyone.
 * 1 -> 13x13, 2 -> 19x13, 4 -> 19x19, 9 -> 33x33, 32 -> 75x75. There may be more spawns than players.
 */
export function calcMap(players: number): { width: number; height: number; spawns: Point[] } {
  players = Math.max(1, players);
  let gw = 0;
  let gh = 0;
  let internal = 0;
  do {
    internal += 0.5;
    gw = Math.ceil(internal);
    gh = Math.floor(internal);
  } while (gw * gh < players);
  const px = players > 1 ? 2 : MAP_PADDING;
  const py = players > 2 ? 2 : MAP_PADDING;
  const m = MAP_MARGIN + MAP_PADDING;
  const spawns: Point[] = [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) spawns.push({ x: px + m * x, y: py + m * y });
  return { width: 2 * px + m * (gw - 1) + 1, height: 2 * py + m * (gh - 1) + 1, spawns };
}

export function mapSizeFor(players: number): [number, number] {
  const m = calcMap(players);
  return [m.width, m.height];
}

export function spawnPoints(players: number): Point[] {
  return calcMap(players).spawns;
}

export const isPillar = (x: number, y: number) => (x & 1) === 1 && (y & 1) === 1;

/**
 * Legacy GameMap.generate: pillars on odd/odd tiles, a free plus of radius 2 around every
 * spawn, bricks on BRICK_FILL of the remaining tiles, pickups hidden in PICKUP_FILL of the bricks.
 */
export function generateMap(rng: SeedHolder, width: number, height: number, spawns: Point[], secret: SeedHolder = rng): GeneratedMap {
  const n = width * height;
  const tiles = new Uint8Array(n);
  const hidden = new Int8Array(n).fill(-1);
  const safe = new Uint8Array(n);
  for (const s of spawns) {
    for (let i = -2; i <= 2; i++) {
      if (s.x + i >= 0 && s.x + i < width) safe[s.y * width + s.x + i] = 1;
      if (s.y + i >= 0 && s.y + i < height) safe[(s.y + i) * width + s.x] = 1;
    }
  }
  const free: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isPillar(x, y)) tiles[i] = Tile.Wall;
      else if (!safe[i]) free.push(i);
    }
  }
  shuffle(rng, free);
  const bricks = free.slice(0, Math.ceil(free.length * BRICK_FILL));
  for (const i of bricks) tiles[i] = Tile.Brick;
  // which bricks hide a pickup (and which one) comes from the secret generator, so it can't be
  // reconstructed from the visible brick layout
  const withPickup = Math.round(bricks.length * PICKUP_FILL);
  const loot = shuffle(secret, bricks.slice());
  for (let k = 0; k < withPickup; k++) hidden[loot[k]!] = rollPickup(secret, false);
  return { width, height, tiles, hidden, spawns };
}

/** Tile indices of zone ring `ring` (0 = the outer edge), clockwise from the top-left corner. */
export function ringTiles(width: number, height: number, ring: number): number[] {
  const out: number[] = [];
  const x0 = ring;
  const y0 = ring;
  const x1 = width - 1 - ring;
  const y1 = height - 1 - ring;
  if (x0 > x1 || y0 > y1) return out;
  for (let x = x0; x <= x1; x++) out.push(y0 * width + x);
  for (let y = y0 + 1; y <= y1; y++) out.push(y * width + x1);
  if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(y1 * width + x);
  if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(y * width + x0);
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
