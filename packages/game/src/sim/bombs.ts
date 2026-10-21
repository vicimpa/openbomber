// Bomb lifecycle: placing (incl. LineBomb), kicking/sliding, Glove grab/throw, Punch,
// flights with bounce (off the map: the bomb evaporates), Remote detonation, fuses and explosions.

import {
  BOMB_FUSE,
  BOMB_RADIUS,
  BOMB_RELEASE_DISTANCE,
  BOUNCE_TIME,
  CRAZY_DUD_CHANCE,
  CRAZY_FUSE_MAX,
  CRAZY_FUSE_MIN,
  CRAZY_RADIUS_MULT,
  KICK_SPEED,
  MAX_RADIUS,
  PLAYER_RADIUS,
  PUNCH_DISTANCE,
  REMOTE_BOMB_MAX_FUSE,
  STUN_TIME,
  THROW_DISTANCE,
  THROW_TIME,
  TICK_RATE,
} from '../contract/constants';
import { Ability, BombKind, BombMotion, Curse, DIR_VEC, Tile, type BombState, type PlayerState } from '../contract/types';
import { emit, type BombInternal, type SimCtx } from './context';
import { chainBomb, explode } from './flames';
import { pickupAt } from './pickups';
import { nextFloat, randInt } from './rng';
import { bombAtTile, bombIsGrounded } from './world';
import { insideShape } from './shapes';

/** Punch flight duration. */
export const PUNCH_FLIGHT = THROW_TIME;
/** Give up on a bomb that keeps bouncing (e.g. a fully blocked row). */
const MAX_HOPS = 64;
const TOUCH = PLAYER_RADIUS + BOMB_RADIUS;


export function ownedBombs(ctx: SimCtx, id: string): number {
  let n = 0;
  for (const b of ctx.world.bombs.values()) if (b.owner === id) n++;
  return n;
}

/** Floor tile, inside the map, without a grounded bomb. */
export function canPlaceAt(ctx: SimCtx, x: number, y: number): boolean {
  const w = ctx.world;
  if (x < 0 || y < 0 || x >= w.width || y >= w.height) return false;
  if (w.tiles[y * w.width + x] !== Tile.Floor) return false;
  return bombAtTile(w, x, y) === undefined && pickupAt(ctx, x, y) === undefined;
}

/** Everyone overlapping the bomb may walk off it. */
function addOverlappingPassers(ctx: SimCtx, b: BombState) {
  for (const q of ctx.world.players.values()) {
    if (!q.alive) continue;
    const dx = q.x - b.x;
    const dy = q.y - b.y;
    if (dx * dx + dy * dy < TOUCH * TOUCH && !b.passers.includes(q.id)) b.passers.push(q.id);
  }
}

/** A bomb nobody owns (overtime sky rain): plain, fixed radius and fuse, no kill credit. */
export function createSkyBomb(ctx: SimCtx, x: number, y: number, radius: number, fuse: number): BombState {
  const w = ctx.world;
  const b: BombState = {
    id: w.nextId++, owner: '', kind: BombKind.Normal, x, y, radius, fuse, motion: BombMotion.Idle,
    vx: 0, vy: 0, fromX: x, fromY: y, toX: x, toY: y, progress: 0, passers: [], dud: false,
  };
  addOverlappingPassers(ctx, b);
  w.bombs.set(b.id, b);
  ctx.bombs.set(b.id, { pierce: false, credit: '', flightTotal: 0, flightElapsed: 0, flightDx: 0, flightDy: 0, hops: 0 });
  return b;
}

export function createBomb(ctx: SimCtx, p: PlayerState, x: number, y: number): BombState {
  const w = ctx.world;
  const crazy = p.effects.crazy > 0;
  const remote = !crazy && (p.abilities & Ability.Remote) !== 0;
  const pierce = (p.abilities & Ability.Pierce) !== 0;
  let radius = p.curse === Curse.TinyFlame ? 1 : p.radius;
  let fuse = remote ? -REMOTE_BOMB_MAX_FUSE : BOMB_FUSE;
  let dud = false;
  if (crazy) {
    // hidden information: secret generator (the real fuse / radius are not sent to clients)
    const s = ctx.secret;
    fuse = CRAZY_FUSE_MIN + randInt(s, CRAZY_FUSE_MAX - CRAZY_FUSE_MIN + 1);
    const maxR = Math.min(MAX_RADIUS, radius * CRAZY_RADIUS_MULT);
    radius += randInt(s, maxR - radius + 1);
    dud = nextFloat(s) < CRAZY_DUD_CHANCE;
  }
  const b: BombState = {
    id: w.nextId++,
    owner: p.id,
    kind: crazy ? BombKind.Crazy : remote ? BombKind.Remote : pierce ? BombKind.Pierce : BombKind.Normal,
    x,
    y,
    radius,
    fuse,
    motion: BombMotion.Idle,
    vx: 0,
    vy: 0,
    fromX: x,
    fromY: y,
    toX: x,
    toY: y,
    progress: 0,
    passers: [],
    dud,
  };
  addOverlappingPassers(ctx, b);
  w.bombs.set(b.id, b);
  const bi: BombInternal = { pierce, credit: p.id, flightTotal: 0, flightElapsed: 0, flightDx: 0, flightDy: 0, hops: 0 };
  ctx.bombs.set(b.id, bi);
  emit(ctx, { type: 'bombPlaced', bomb: b.id, x, y, owner: p.id });
  return b;
}

/**
 * Bomb button (or Diarrhea). With LineBomb, pressing while standing on your own bomb
 * lays a line of bombs in the facing direction.
 */
export function tryPlaceBomb(ctx: SimCtx, p: PlayerState, pressed: boolean) {
  if (p.carrying >= 0 || p.curse === Curse.Constipation) return;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  let have = ownedBombs(ctx, p.id);
  if (pressed && p.abilities & Ability.LineBomb) {
    const own = bombAtTile(ctx.world, cx, cy);
    if (own && own.owner === p.id) {
      const [dx, dy] = DIR_VEC[p.dir];
      for (let i = 1; have < p.bombs; i++) {
        const x = cx + dx * i;
        const y = cy + dy * i;
        if (!canPlaceAt(ctx, x, y) || pickupAt(ctx, x, y)) break;
        createBomb(ctx, p, x, y);
        have++;
      }
      return;
    }
  }
  if (have < p.bombs && canPlaceAt(ctx, cx, cy)) createBomb(ctx, p, cx, cy);
}

/** Drop players from `passers` once they've walked clear of the bomb. */
export function releasePassers(ctx: SimCtx, p: PlayerState) {
  for (const b of ctx.world.bombs.values()) {
    const i = b.passers.indexOf(p.id);
    if (i < 0) continue;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    if (!p.alive || dx * dx + dy * dy > BOMB_RELEASE_DISTANCE * BOMB_RELEASE_DISTANCE) b.passers.splice(i, 1);
  }
}

// ---------------------------------------------------------------- sliding (Kick)

/** Things a sliding (or line-placed) bomb can't enter. */
function slideBlocked(ctx: SimCtx, self: BombState, x: number, y: number): boolean {
  const w = ctx.world;
  if (x < 0 || y < 0 || x >= w.width || y >= w.height) return true;
  if (w.tiles[y * w.width + x] !== Tile.Floor) return true;
  const other = bombAtTile(w, x, y);
  if (other && other !== self) return true;
  if (pickupAt(ctx, x, y)) return true;
  for (const q of w.players.values()) {
    if (!q.alive || !q.inRound) continue;
    if (Math.round(q.x) === x && Math.round(q.y) === y) return true;
    const dx = q.x - x;
    const dy = q.y - y;
    if (dx * dx + dy * dy < 0.36 && !self.passers.includes(q.id)) return true;
  }
  return false;
}

export function tryKick(ctx: SimCtx, p: PlayerState, b: BombState) {
  if (b.motion !== BombMotion.Idle) return;
  const [dx, dy] = DIR_VEC[p.dir];
  // the bomb must actually be in front of the kicker
  if ((b.x - p.x) * dx + (b.y - p.y) * dy <= 0) return;
  if (slideBlocked(ctx, b, Math.round(b.x) + dx, Math.round(b.y) + dy)) return;
  b.motion = BombMotion.Sliding;
  b.vx = (dx * KICK_SPEED) / TICK_RATE;
  b.vy = (dy * KICK_SPEED) / TICK_RATE;
  ctx.bombs.get(b.id)!.credit = p.id;
  emit(ctx, { type: 'bombKicked', bomb: b.id, by: p.id, dir: p.dir });
}

function stopSliding(ctx: SimCtx, b: BombState, x: number, y: number) {
  b.x = x;
  b.y = y;
  b.vx = 0;
  b.vy = 0;
  b.motion = BombMotion.Idle;
  addOverlappingPassers(ctx, b);
  emit(ctx, { type: 'bombStopped', bomb: b.id, x, y });
}

function slide(ctx: SimCtx, b: BombState) {
  const alongX = b.vx !== 0;
  const v = alongX ? b.vx : b.vy;
  const d = v > 0 ? 1 : -1;
  const s = alongX ? b.x : b.y;
  const lane = Math.round(alongX ? b.y : b.x);
  // the tile centre we're heading to
  const head = d > 0 ? Math.floor(s + 1e-9) + 1 : Math.ceil(s - 1e-9) - 1;
  const hx = alongX ? head : lane;
  const hy = alongX ? lane : head;
  if (slideBlocked(ctx, b, hx, hy)) {
    // something stepped into the way: settle on the tile we're leaving
    stopSliding(ctx, b, alongX ? head - d : lane, alongX ? lane : head - d);
    return;
  }
  const ns = s + v;
  if ((ns - head) * d >= 0 && slideBlocked(ctx, b, alongX ? head + d : lane, alongX ? lane : head + d)) {
    stopSliding(ctx, b, hx, hy);
    return;
  }
  if (alongX) b.x = ns;
  else b.y = ns;
}

// ---------------------------------------------------------------- flights (Glove / Punch)

function startFlight(ctx: SimCtx, b: BombState, fx: number, fy: number, dx: number, dy: number, dist: number, total: number) {
  const bi = ctx.bombs.get(b.id)!;
  b.motion = BombMotion.Flying;
  b.vx = 0;
  b.vy = 0;
  b.x = fx;
  b.y = fy;
  b.fromX = fx;
  b.fromY = fy;
  b.toX = fx + dx * dist;
  b.toY = fy + dy * dist;
  b.progress = 0;
  b.passers.length = 0;
  bi.flightTotal = total;
  bi.flightElapsed = 0;
  bi.flightDx = dx;
  bi.flightDy = dy;
  bi.hops = 0;
}

export function tryGrab(ctx: SimCtx, p: PlayerState): boolean {
  const w = ctx.world;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  let b = bombAtTile(w, cx, cy);
  if (!b || b.motion !== BombMotion.Idle) {
    const [dx, dy] = DIR_VEC[p.dir];
    b = bombAtTile(w, cx + dx, cy + dy);
    if (!b || b.motion !== BombMotion.Idle) return false;
    const ddx = b.x - p.x;
    const ddy = b.y - p.y;
    if (ddx * ddx + ddy * ddy > 1.05 * 1.05) return false;
  }
  b.motion = BombMotion.Carried;
  b.passers.length = 0;
  b.x = p.x;
  b.y = p.y;
  p.carrying = b.id;
  emit(ctx, { type: 'bombGrabbed', bomb: b.id, by: p.id });
  return true;
}

export function throwBomb(ctx: SimCtx, p: PlayerState) {
  const b = ctx.world.bombs.get(p.carrying);
  p.carrying = -1;
  if (!b) return;
  const [dx, dy] = DIR_VEC[p.dir];
  const fx = Math.round(p.x);
  const fy = Math.round(p.y);
  startFlight(ctx, b, fx, fy, dx, dy, THROW_DISTANCE, THROW_TIME);
  ctx.bombs.get(b.id)!.credit = p.id;
  emit(ctx, { type: 'bombThrown', bomb: b.id, by: p.id, toX: b.toX, toY: b.toY });
}

/** Release a carried bomb on the carrier's tile (death, stun, leaving). */
export function dropCarried(ctx: SimCtx, p: PlayerState) {
  const b = ctx.world.bombs.get(p.carrying);
  p.carrying = -1;
  if (!b) return;
  b.motion = BombMotion.Idle;
  b.x = Math.min(ctx.world.width - 1, Math.max(0, Math.round(p.x)));
  b.y = Math.min(ctx.world.height - 1, Math.max(0, Math.round(p.y)));
  b.passers.length = 0;
  addOverlappingPassers(ctx, b);
  emit(ctx, { type: 'bombLanded', bomb: b.id, x: b.x, y: b.y });
}

export function tryPunch(ctx: SimCtx, p: PlayerState): boolean {
  const [dx, dy] = DIR_VEC[p.dir];
  const b = bombAtTile(ctx.world, Math.round(p.x) + dx, Math.round(p.y) + dy);
  if (!b || b.motion !== BombMotion.Idle) return false;
  const ddx = b.x - p.x;
  const ddy = b.y - p.y;
  if (ddx * ddx + ddy * ddy > 1.05 * 1.05) return false;
  startFlight(ctx, b, b.x, b.y, dx, dy, PUNCH_DISTANCE, PUNCH_FLIGHT);
  ctx.bombs.get(b.id)!.credit = p.id;
  emit(ctx, { type: 'bombPunched', bomb: b.id, by: p.id, toX: b.toX, toY: b.toY });
  return true;
}

/** Remote: the oldest own waiting bomb goes off this tick. */
export function detonateRemote(ctx: SimCtx, p: PlayerState): boolean {
  for (const b of ctx.world.bombs.values()) {
    if (b.owner !== p.id || b.fuse >= 0 || !bombIsGrounded(b)) continue;
    b.fuse = 1;
    return true;
  }
  return false;
}

function landingBlocked(ctx: SimCtx, b: BombState, x: number, y: number): boolean {
  const w = ctx.world;
  if (w.tiles[y * w.width + x] !== Tile.Floor) return true;
  const other = bombAtTile(w, x, y);
  if (other && other !== b) return true;
  return pickupAt(ctx, x, y) !== undefined;
}

function fly(ctx: SimCtx, b: BombState) {
  const w = ctx.world;
  const bi = ctx.bombs.get(b.id)!;
  bi.flightElapsed++;
  b.progress = Math.min(1, bi.flightElapsed / bi.flightTotal);
  b.x = b.fromX + (b.toX - b.fromX) * b.progress;
  b.y = b.fromY + (b.toY - b.fromY) * b.progress;
  if (bi.flightElapsed < bi.flightTotal) return;

  // landed past the edge of the map (or of its shape): the bomb evaporates (no blast)
  const x = b.toX;
  const y = b.toY;
  if (!insideShape(w.shape, w.width, w.height, x, y)) {
    w.bombs.delete(b.id);
    ctx.bombs.delete(b.id);
    emit(ctx, { type: 'bombVanished', bomb: b.id, x, y });
    return;
  }
  b.x = x;
  b.y = y;
  let hitPlayer = false;
  for (const q of w.players.values()) {
    if (!q.alive || !q.inRound || Math.round(q.x) !== x || Math.round(q.y) !== y) continue;
    hitPlayer = true;
    q.effects.stun = STUN_TIME;
    if (q.carrying >= 0) dropCarried(ctx, q);
    emit(ctx, { type: 'playerStunned', player: q.id });
  }
  if (hitPlayer || landingBlocked(ctx, b, x, y)) {
    if (++bi.hops > MAX_HOPS) {
      w.bombs.delete(b.id);
      ctx.bombs.delete(b.id);
      emit(ctx, { type: 'bombFizzled', bomb: b.id, x, y });
      return;
    }
    emit(ctx, { type: 'bombBounced', bomb: b.id, x, y });
    b.fromX = x;
    b.fromY = y;
    b.toX = x + bi.flightDx;
    b.toY = y + bi.flightDy;
    b.progress = 0;
    bi.flightElapsed = 0;
    bi.flightTotal = BOUNCE_TIME;
    return;
  }
  b.motion = BombMotion.Idle;
  b.fromX = b.toX = x;
  b.fromY = b.toY = y;
  addOverlappingPassers(ctx, b);
  emit(ctx, { type: 'bombLanded', bomb: b.id, x, y });
}

const exploding: BombState[] = [];

/** Tile -> grounded bomb, for the flame scans of this tick's explosions. */
function buildBombGrid(ctx: SimCtx) {
  const w = ctx.world;
  const g = ctx.bombGrid;
  g.fill(0);
  for (const b of w.bombs.values()) {
    if (!bombIsGrounded(b)) continue;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (x >= 0 && y >= 0 && x < w.width && y < w.height) g[y * w.width + x] = b.id;
  }
}

/** Move bombs, burn fuses, detonate. */
export function updateBombs(ctx: SimCtx) {
  const w = ctx.world;
  if (w.bombs.size === 0) return;
  for (const b of w.bombs.values()) {
    if (b.motion === BombMotion.Carried) continue; // fuse paused while held
    if (b.motion === BombMotion.Sliding) slide(ctx, b);
    else if (b.motion === BombMotion.Flying) {
      fly(ctx, b);
      if (b.motion === BombMotion.Flying) {
        if (b.fuse > 1) b.fuse--; // can't go off mid-air
        continue;
      }
      if (!w.bombs.has(b.id)) continue;
    }
    // a bomb sitting in fire (slid / landed / placed into it) chains
    const tx = Math.round(b.x);
    const ty = Math.round(b.y);
    if (tx >= 0 && ty >= 0 && tx < w.width && ty < w.height) {
      const fid = ctx.flameGrid[ty * w.width + tx]!;
      if (fid) chainBomb(ctx, b, w.flames.get(fid)?.owner ?? b.owner);
    }
    if (b.fuse > 0) {
      if (--b.fuse === 0) exploding.push(b);
    } else if (b.fuse < 0) {
      if (++b.fuse === 0) exploding.push(b);
    }
  }
  if (exploding.length > 0) buildBombGrid(ctx);
  for (let i = 0; i < exploding.length; i++) {
    const b = exploding[i]!;
    const bi = ctx.bombs.get(b.id);
    w.bombs.delete(b.id);
    ctx.bombs.delete(b.id);
    explode(ctx, b, bi?.pierce ?? false, bi?.credit ?? b.owner);
  }
  exploding.length = 0;
}
