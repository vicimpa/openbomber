// Small helpers over the plain WorldState shared by the sim, prediction and bots.

import { BombMotion, Phase, Tile, type BombState, type PlayerState, type WorldState } from '../contract/types';

export const inBounds = (w: WorldState, x: number, y: number) => x >= 0 && y >= 0 && x < w.width && y < w.height;

/** Tile at integer coords; everything outside the playfield is an implicit wall. */
export function tileAt(w: WorldState, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= w.width || y >= w.height) return Tile.Wall;
  return w.tiles[y * w.width + x] as Tile;
}

/** A bomb that physically occupies a tile (not flying or carried). */
export const bombIsGrounded = (b: BombState) => b.motion === BombMotion.Idle || b.motion === BombMotion.Sliding;

/** Grounded bomb whose rounded position is (x, y). Linear scan: bomb counts are small. */
export function bombAtTile(w: WorldState, x: number, y: number): BombState | undefined {
  for (const b of w.bombs.values()) {
    if (bombIsGrounded(b) && Math.round(b.x) === x && Math.round(b.y) === y) return b;
  }
  return undefined;
}

export function createWorld(width: number, height: number, seed: number): WorldState {
  return {
    tick: 0,
    seed: seed >>> 0,
    phase: Phase.Waiting,
    phaseTicks: 0,
    round: 0,
    width,
    height,
    tiles: new Uint8Array(width * height),
    players: new Map(),
    bombs: new Map(),
    flames: new Map(),
    pickups: new Map(),
    falling: [],
    winner: '',
    nextId: 1,
    zoneRing: 0,
    zoneIn: 0,
  };
}

export function clonePlayer(p: PlayerState): PlayerState {
  return { ...p, effects: { ...p.effects } };
}

/** Deep copy of a world (handy for prediction, tests and offline replays). */
export function cloneWorld(w: WorldState): WorldState {
  const players = new Map<string, PlayerState>();
  for (const [k, p] of w.players) players.set(k, clonePlayer(p));
  const bombs = new Map<number, BombState>();
  for (const [k, b] of w.bombs) bombs.set(k, { ...b, passers: b.passers.slice() });
  const flames = new Map();
  for (const [k, f] of w.flames) flames.set(k, { ...f });
  const pickups = new Map();
  for (const [k, p] of w.pickups) pickups.set(k, { ...p });
  return {
    ...w,
    tiles: w.tiles.slice(),
    players,
    bombs,
    flames,
    pickups,
    falling: w.falling.map((f) => ({ ...f })),
  };
}
