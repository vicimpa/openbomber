// Player movement + collision. This is THE code path for movement: the authoritative
// sim calls `applyMovement`, and the client predicts with `predictMovement`, which is
// the same function minus the side effects the sim applies afterwards (passer release,
// kicks). Keep it free of allocations and of anything that mutates the world.

import type { PredictMovement } from '../contract/api';
import {
  BASE_SPEED,
  BOMB_RADIUS,
  FIRE_SPEED_MULT,
  INPUT_DEADZONE,
  PLAYER_RADIUS,
  SPEED_MULT,
  TICK_RATE,
} from '../contract/constants';
import type { InputFrame } from '../contract/protocol';
import { Ability, BombMotion, Curse, Dir, Phase, Tile, type BombState, type PlayerState, type WorldState } from '../contract/types';
import { cir2cir, cir2sqr, type Vec } from './collision';

export const SLOW_CURSE_MULT = 0.5;
export const FAST_CURSE_MULT = 1.6;
/** How far off a lane centre (in tiles) you must be for corner assist to steer you into the next lane. */
export const CORNER_ASSIST_MIN = 0.1;

const tmp: Vec = { x: 0, y: 0 };
// Tiles around the player in resolution order: own tile, edge neighbours, then
// diagonals. Resolving sequentially (instead of summing) avoids a double push at the
// seam between two wall tiles, which would make sliding along a wall bumpy.
const NX = [0, 0, -1, 1, 0, -1, 1, -1, 1];
const NY = [0, -1, 0, 0, 1, -1, -1, 1, 1];

/** Movement speed in tiles per tick. */
export function playerSpeed(p: PlayerState): number {
  let s = BASE_SPEED;
  if (p.effects.speed > 0) s *= SPEED_MULT;
  if (p.effects.fire > 0) s *= FIRE_SPEED_MULT;
  if (p.curse === Curse.Slow) s *= SLOW_CURSE_MULT;
  else if (p.curse === Curse.Fast) s *= FAST_CURSE_MULT;
  return s / TICK_RATE;
}

/** Wall / brick (unless Ghost) / outside the map. */
export function tileSolidFor(w: WorldState, p: PlayerState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= w.width || y >= w.height) return true;
  const t = w.tiles[y * w.width + x];
  return t === Tile.Wall || (t === Tile.Brick && p.effects.ghost <= 0);
}

/** Whether bomb `b` collides with player `p`. */
export function bombBlocksPlayer(b: BombState, p: PlayerState): boolean {
  if (b.motion !== BombMotion.Idle && b.motion !== BombMotion.Sliding) return false;
  if (p.abilities & Ability.BombPass) return false;
  return !b.passers.includes(p.id);
}

/** A colliding bomb whose rounded position is (x, y), or undefined. */
function blockingBombAt(w: WorldState, p: PlayerState, x: number, y: number): BombState | undefined {
  for (const b of w.bombs.values()) {
    if (Math.round(b.x) === x && Math.round(b.y) === y && bombBlocksPlayer(b, p)) return b;
  }
  return undefined;
}

/** Tile (x, y) blocks `p` (solid tile or a colliding bomb). */
export function blockedFor(w: WorldState, p: PlayerState, x: number, y: number): boolean {
  return tileSolidFor(w, p, x, y) || blockingBombAt(w, p, x, y) !== undefined;
}

// Same as blockedFor, but takes (along, perp) coordinates for an axis.
function blockedAxis(w: WorldState, p: PlayerState, alongX: boolean, a: number, b: number): boolean {
  return alongX ? blockedFor(w, p, a, b) : blockedFor(w, p, b, a);
}

/**
 * Corner assist for movement along one axis. Returns the correction on the
 * perpendicular axis (at most `step`). No full alignment: a free lane never pulls the hero
 * to its centre, like the new-openbomber prototype.
 *  - Lane ahead is open, but our circle pokes past its edge into a blocked tile: nudge
 *    only until it clears that corner (offset 0.5 - PLAYER_RADIUS), never further.
 *  - Lane ahead is blocked but the neighbouring lane we lean into is open both ahead and
 *    beside us: slide into it, so early turns "just work".
 */
function cornerAssist(w: WorldState, p: PlayerState, alongX: boolean, s: number, step: number): number {
  const along = alongX ? p.x : p.y;
  const perp = alongX ? p.y : p.x;
  const ca = Math.round(along);
  const cp = Math.round(perp);
  const off = perp - cp;
  const aoff = off < 0 ? -off : off;
  if (aoff < 1e-6) return 0;
  const sign = off > 0 ? 1 : -1;
  const n = cp + sign;
  const fa = ca + s;
  if (!blockedAxis(w, p, alongX, fa, cp)) {
    const clear = 0.5 - PLAYER_RADIUS;
    if (aoff > clear && blockedAxis(w, p, alongX, fa, n)) return -sign * Math.min(aoff - clear, step);
    return 0;
  }
  if (aoff >= CORNER_ASSIST_MIN && !blockedAxis(w, p, alongX, fa, n) && !blockedAxis(w, p, alongX, ca, n)) {
    return sign * Math.min(1 - aoff, step);
  }
  return 0;
}

function resolveTiles(w: WorldState, p: PlayerState) {
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  for (let k = 0; k < 9; k++) {
    const tx = cx + NX[k]!;
    const ty = cy + NY[k]!;
    if (!tileSolidFor(w, p, tx, ty)) continue;
    if (cir2sqr(p.x, p.y, PLAYER_RADIUS, tx, ty, 1, tmp)) {
      p.x += tmp.x;
      p.y += tmp.y;
    }
  }
}

function resolveBombs(w: WorldState, p: PlayerState) {
  if (p.abilities & Ability.BombPass) return;
  for (const b of w.bombs.values()) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    if (dx > 1 || dx < -1 || dy > 1 || dy < -1) continue;
    if (!bombBlocksPlayer(b, p)) continue;
    if (cir2cir(p.x, p.y, PLAYER_RADIUS, b.x, b.y, BOMB_RADIUS, tmp)) {
      p.x += tmp.x;
      p.y += tmp.y;
    }
  }
}

/** Update `p.dir` from a normalised input direction. */
function updateFacing(p: PlayerState, nx: number, ny: number) {
  const ax = nx < 0 ? -nx : nx;
  const ay = ny < 0 ? -ny : ny;
  if (ax > ay + 1e-6) p.dir = nx > 0 ? Dir.Right : Dir.Left;
  else if (ay > ax + 1e-6) p.dir = ny > 0 ? Dir.Down : Dir.Up;
  else {
    // exact diagonal: keep facing if it is one of the two pressed directions
    const h = nx > 0 ? Dir.Right : Dir.Left;
    const v = ny > 0 ? Dir.Down : Dir.Up;
    if (p.dir !== h && p.dir !== v) p.dir = v;
  }
}

/**
 * Advance one player's movement by one tick. Mutates only `p` (position, dir, moving,
 * stun timer). Returns the id of an Idle bomb the player is walking straight into
 * (kick candidate), or -1.
 */
export function applyMovement(w: WorldState, p: PlayerState, input: InputFrame): number {
  if (!p.alive || !p.inRound || w.phase === Phase.Countdown) {
    p.moving = false;
    return -1;
  }
  if (p.effects.stun > 0) {
    p.effects.stun--;
    p.moving = false;
    return -1;
  }
  let ix = Number.isFinite(input.dx) ? input.dx : 0;
  let iy = Number.isFinite(input.dy) ? input.dy : 0;
  if (p.curse === Curse.Reverse) {
    ix = -ix;
    iy = -iy;
  }
  const len = Math.sqrt(ix * ix + iy * iy);
  if (len < INPUT_DEADZONE) {
    p.moving = false;
    return -1;
  }
  ix /= len;
  iy /= len;
  updateFacing(p, ix, iy);

  const step = playerSpeed(p);
  let mx = ix * step;
  let my = iy * step;
  const ax = ix < 0 ? -ix : ix;
  const ay = iy < 0 ? -iy : iy;
  // corner assist only for (mostly) axis-aligned input; true diagonals slide naturally
  let axis = 0; // 1 = along X, 2 = along Y
  if (ax >= 2 * ay) {
    axis = 1;
    my += cornerAssist(w, p, true, ix > 0 ? 1 : -1, step);
  } else if (ay >= 2 * ax) {
    axis = 2;
    mx += cornerAssist(w, p, false, iy > 0 ? 1 : -1, step);
  }

  const ox = p.x;
  const oy = p.y;
  p.x += mx;
  p.y += my;
  // tiles, then bombs, then tiles again so walls stay a hard constraint
  resolveTiles(w, p);
  resolveBombs(w, p);
  resolveTiles(w, p);

  const ddx = p.x - ox;
  const ddy = p.y - oy;
  p.moving = ddx * ddx + ddy * ddy > 1e-8;

  if (axis === 0) return -1;
  // kick candidate: an Idle bomb right in front on the movement axis that we touch
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  const fx = axis === 1 ? cx + (ix > 0 ? 1 : -1) : cx;
  const fy = axis === 2 ? cy + (iy > 0 ? 1 : -1) : cy;
  const b = blockingBombAt(w, p, fx, fy);
  if (!b || b.motion !== BombMotion.Idle) return -1;
  const bdx = b.x - p.x;
  const bdy = b.y - p.y;
  const reach = PLAYER_RADIUS + BOMB_RADIUS + 0.02;
  if (bdx * bdx + bdy * bdy > reach * reach) return -1;
  const perpOff = axis === 1 ? bdy : bdx;
  return perpOff > -0.3 && perpOff < 0.3 ? b.id : -1;
}

/** Client prediction: identical movement code path, no world mutation. */
export const predictMovement: PredictMovement = (world, player, input) => {
  applyMovement(world, player, input);
};
