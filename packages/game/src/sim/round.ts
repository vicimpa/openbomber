// Round flow, canon style (legacy server Game.ts): continuous rounds, no lobby.
//   Waiting (nobody here) -> Countdown (short freeze) -> Playing -> [SuddenDeath = zone shrinking]
//   -> RoundOver (decided, restart timer) -> Countdown on a freshly sized map -> ...

import {
  COUNTDOWN_TIME,
  FALL_TIME,
  ROUND_OVER_TIME,
  SOLO_RESTART_TIME,
  TICK_RATE,
  WAIT_FOR_LIMIT,
  ZONE_LIMIT_TIMEOUT,
  sec,
  ZONE_FINAL_QUIET,
  ZONE_FINAL_TIMEOUT,
  ZONE_FINAL_WIDTH,
} from '../contract/constants';
import { Phase, Tile, type PlayerState } from '../contract/types';
import { emit, type SimCtx } from './context';
import { calcMap, generateMap, ringTiles, type Point } from './map';
import { killPlayer, resetStats, spawnPlayerAt } from './players';
import { resetOvertime, updateDrops, updateOvertime } from './overtime';
import { shuffle } from './rng';
import { bombIsGrounded } from './world';

/** @deprecated alias of FALL_TIME (falling-block shadow time). */
export const FALL_WARNING = FALL_TIME;
/** A closing ring's blocks land in a sweep spread over this long (after FALL_TIME). */
const RING_SWEEP = sec(0.5);

/** Replace the arena: new tiles + hidden pickups, everything on it cleared. */
export function newMap(ctx: SimCtx, players: number) {
  const w = ctx.world;
  const m = calcMap(players);
  let width = m.width;
  let height = m.height;
  let spawns: Point[] = m.spawns;
  const cw = ctx.config.width;
  const ch = ctx.config.height;
  if (cw && ch) {
    // custom size: keep the grid spawns that fit, fall back to the corners
    width = cw;
    height = ch;
    spawns = m.spawns.filter((s) => s.x < width && s.y < height);
    if (spawns.length < players) {
      spawns = [
        { x: 0, y: 0 },
        { x: (width - 1) & ~1, y: (height - 1) & ~1 },
        { x: (width - 1) & ~1, y: 0 },
        { x: 0, y: (height - 1) & ~1 },
      ];
    }
  }
  const fresh = ctx.config.entropy;
  if (fresh) {
    w.seed = (w.seed ^ fresh()) >>> 0;
    ctx.secret.seed = (ctx.secret.seed ^ fresh()) >>> 0;
  }
  const g = generateMap(w, width, height, spawns, ctx.secret);
  w.width = width;
  w.height = height;
  w.tiles = g.tiles;
  ctx.hidden = g.hidden;
  ctx.spawns = g.spawns;
  ctx.flameGrid = new Int32Array(width * height);
  ctx.pickupGrid = new Int32Array(width * height);
  ctx.bombGrid = new Int32Array(width * height);
  ctx.brickBurn = new Uint8Array(width * height);
  ctx.brickBurnCount = 0;
  w.bombs.clear();
  ctx.bombs.clear();
  w.flames.clear();
  w.pickups.clear();
  w.falling.length = 0;
  w.zoneRing = 0;
  w.zoneIn = 0;
}

/** Everyone joins the round at a random free spawn (legacy getFreePosition). */
function placeAll(ctx: SimCtx) {
  const w = ctx.world;
  const spots = shuffle(w, ctx.spawns.slice());
  let i = 0;
  for (const p of w.players.values()) {
    const s = spots[i++ % spots.length]!;
    const pi = ctx.players.get(p.id)!;
    pi.spawnX = s.x;
    pi.spawnY = s.y;
    resetStats(ctx, p);
    p.inRound = true;
    spawnPlayerAt(p, s.x, s.y, 0);
  }
}

/** Restart: map sized for the current player count, everyone in, short freeze. */
export function startRound(ctx: SimCtx) {
  const w = ctx.world;
  w.round++;
  newMap(ctx, w.players.size);
  placeAll(ctx);
  w.phase = Phase.Countdown;
  w.phaseTicks = COUNTDOWN_TIME;
  w.winner = '';
  ctx.hasWin = w.players.size > 1;
  ctx.roundDeaths = 0;
  ctx.zoneQuiet = WAIT_FOR_LIMIT;
  resetOvertime(ctx);
  emit(ctx, { type: 'countdown', seconds: Math.ceil(COUNTDOWN_TIME / TICK_RATE) });
}

/** Nobody left: idle arena. */
export function goIdle(ctx: SimCtx) {
  const w = ctx.world;
  w.phase = Phase.Waiting;
  w.phaseTicks = 0;
  w.zoneIn = 0;
  w.falling.length = 0;
  w.drops.length = 0;
}

function endRound(ctx: SimCtx, winner: PlayerState | undefined, delay: number) {
  const w = ctx.world;
  w.phase = Phase.RoundOver;
  w.phaseTicks = delay;
  w.winner = winner?.id ?? '';
  if (w.zoneIn > 0) {
    w.zoneIn = 0;
    emit(ctx, { type: 'zoneCancel' });
  }
  w.falling.length = 0;
  w.drops.length = 0;
  if (winner) winner.wins++;
  emit(ctx, { type: 'roundOver', winner: w.winner });
}

function hasBricks(ctx: SimCtx): boolean {
  const t = ctx.world.tiles;
  for (let i = 0; i < t.length; i++) if (t[i] === Tile.Brick) return true;
  return false;
}

/**
 * Legacy rules: the round is decided once at most one player is alive (none when solo) and no
 * bombs or flames are left. Solo (practice) also ends when bricks and pickups run out.
 */
function checkRoundEnd(ctx: SimCtx) {
  const w = ctx.world;
  let inRound = 0;
  let alive = 0;
  let last: PlayerState | undefined;
  for (const p of w.players.values()) {
    if (!p.inRound) continue;
    inRound++;
    if (p.respawnIn > 0) return; // a Heart respawn is pending
    if (p.alive) {
      alive++;
      last = p;
    }
  }
  // someone left before anybody died: no contest any more
  if (ctx.hasWin && inRound < 2 && ctx.roundDeaths === 0) ctx.hasWin = false;
  const solo = w.players.size === 1;
  const settled = w.bombs.size === 0 && w.flames.size === 0;
  if (!settled) return;
  const decided = ctx.hasWin && alive <= 1; // a contest with one survivor left (even if the loser left)
  const delay = solo && !decided ? SOLO_RESTART_TIME : ROUND_OVER_TIME;
  if (decided || alive <= (solo ? 0 : 1)) endRound(ctx, decided && alive === 1 ? last : undefined, delay);
  else if (solo && w.pickups.size === 0 && !hasBricks(ctx)) endRound(ctx, undefined, delay);
}

// ---------------------------------------------------------------- zone shrink

/**
 * A ring is left to close. Unlike legacy (which stopped at min(w, h) / 2) the zone closes all
 * the way, so a round can't stall with survivors walled off from each other between pillars;
 * the last ring's blocks fall in a sweep, so whoever is buried last wins.
 */
const canShrink = (ctx: SimCtx) =>
  ctx.config.zone !== false
  && ctx.world.players.size >= 2 && ctx.world.zoneRing * 2 < Math.min(ctx.world.width, ctx.world.height);

/** The open middle is narrow: rings come quickly (ZONE_FINAL_*). */
const endgame = (ctx: SimCtx) =>
  Math.min(ctx.world.width, ctx.world.height) - 2 * ctx.world.zoneRing <= ZONE_FINAL_WIDTH;

function closeRing(ctx: SimCtx) {
  const w = ctx.world;
  const ring = ++w.zoneRing;
  const tiles = ringTiles(w.width, w.height, ring - 1);
  for (let k = 0; k < tiles.length; k++) {
    const i = tiles[k]!;
    if (w.tiles[i] === Tile.Wall) continue;
    w.falling.push({ x: i % w.width, y: (i / w.width) | 0, ttl: FALL_TIME + Math.floor((k * RING_SWEEP) / tiles.length) });
  }
  ctx.zoneQuiet = endgame(ctx) ? ZONE_FINAL_QUIET : WAIT_FOR_LIMIT;
  emit(ctx, { type: 'zoneShrink', ring });
  if (w.phase === Phase.Playing) {
    w.phase = Phase.SuddenDeath;
    emit(ctx, { type: 'suddenDeath' });
  }
}

function updateZone(ctx: SimCtx) {
  const w = ctx.world;
  if (w.zoneIn > 0) {
    if (!canShrink(ctx)) {
      w.zoneIn = 0;
      emit(ctx, { type: 'zoneCancel' });
    } else if (--w.zoneIn === 0) closeRing(ctx);
    return;
  }
  if (ctx.zoneQuiet > 0) ctx.zoneQuiet--;
  else if (canShrink(ctx)) {
    w.zoneIn = endgame(ctx) ? ZONE_FINAL_TIMEOUT : ZONE_LIMIT_TIMEOUT;
    emit(ctx, { type: 'zoneWarning', seconds: Math.round(w.zoneIn / TICK_RATE) });
  }
}

function landBlock(ctx: SimCtx, x: number, y: number) {
  const w = ctx.world;
  const idx = y * w.width + x;
  w.tiles[idx] = Tile.Wall;
  ctx.hidden[idx] = -1;
  for (const b of w.bombs.values()) {
    if (bombIsGrounded(b) && Math.round(b.x) === x && Math.round(b.y) === y) {
      w.bombs.delete(b.id);
      ctx.bombs.delete(b.id);
    }
  }
  for (const k of w.pickups.values()) if (k.x === x && k.y === y) w.pickups.delete(k.id);
  const fid = ctx.flameGrid[idx]!;
  if (fid) {
    w.flames.delete(fid);
    ctx.flameGrid[idx] = 0;
  }
  emit(ctx, { type: 'blockFell', x, y });
  for (const p of w.players.values()) {
    if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) killPlayer(ctx, p, '', 'crushed');
  }
}

function updateFalling(ctx: SimCtx) {
  const w = ctx.world;
  let k = 0;
  for (let i = 0; i < w.falling.length; i++) {
    const f = w.falling[i]!;
    if (--f.ttl <= 0) landBlock(ctx, f.x, f.y);
    else w.falling[k++] = f;
  }
  w.falling.length = k;
}

/** Phase timers and transitions; runs at the end of each step. */
export function updatePhase(ctx: SimCtx) {
  const w = ctx.world;
  if (w.players.size === 0) {
    if (w.phase !== Phase.Waiting) goIdle(ctx);
    w.phaseTicks++;
    return;
  }
  switch (w.phase) {
    case Phase.Waiting:
      startRound(ctx);
      break;
    case Phase.Countdown:
      if (--w.phaseTicks <= 0) {
        w.phase = Phase.Playing;
        w.phaseTicks = 0;
        emit(ctx, { type: 'roundStart', round: w.round });
      } else if (w.phaseTicks % TICK_RATE === 0) {
        emit(ctx, { type: 'countdown', seconds: w.phaseTicks / TICK_RATE });
      }
      break;
    case Phase.Playing:
    case Phase.SuddenDeath:
      w.phaseTicks++;
      updateFalling(ctx);
      updateDrops(ctx);
      if (ctx.hold) break;
      updateZone(ctx);
      updateOvertime(ctx);
      checkRoundEnd(ctx);
      break;
    case Phase.RoundOver:
      if (--w.phaseTicks <= 0) startRound(ctx);
      break;
  }
}
