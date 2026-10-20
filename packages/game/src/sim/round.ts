// Round flow: Waiting -> Countdown -> Playing -> SuddenDeath -> RoundOver -> ...

import {
  COUNTDOWN_TIME,
  ROUND_OVER_TIME,
  ROUND_TIME,
  SPAWN_INVULNERABLE,
  SUDDEN_DEATH_INTERVAL,
  TICK_RATE,
  sec,
} from '../contract/constants';
import { Phase, Tile, type PlayerState } from '../contract/types';
import { emit, type SimCtx } from './context';
import { generateMap, mapSizeFor, spiralOrder } from './map';
import { findSafeTile, killPlayer, resetStats, spawnPlayerAt } from './players';
import { shuffle } from './rng';
import { bombIsGrounded } from './world';

/** Warning shadow time before a sudden-death block lands. */
export const FALL_WARNING = sec(1);
/** Spawn safe zones laid out on the free-roam map, so late joiners have room. */
const WAITING_SPAWNS = 8;

/** Replace the arena: new tiles + hidden pickups, everything on it cleared. */
export function newMap(ctx: SimCtx, players: number, spawnCount: number) {
  const w = ctx.world;
  const [dw, dh] = mapSizeFor(players);
  const width = ctx.config.width ?? dw;
  const height = ctx.config.height ?? dh;
  const m = generateMap(w, width, height, spawnCount);
  w.width = width;
  w.height = height;
  w.tiles = m.tiles;
  ctx.hidden = m.hidden;
  ctx.spawns = m.spawns;
  ctx.flameGrid = new Int32Array(width * height);
  ctx.brickBurn = new Uint8Array(width * height);
  ctx.brickBurnCount = 0;
  ctx.spiral = new Int32Array(0);
  ctx.spiralPos = 0;
  ctx.suddenTimer = 0;
  w.bombs.clear();
  ctx.bombs.clear();
  w.flames.clear();
  w.pickups.clear();
  w.falling.length = 0;
}

/** Put every player into the round at shuffled spawn points. */
function placeAll(ctx: SimCtx) {
  const w = ctx.world;
  const list = shuffle(w, [...w.players.values()]);
  list.forEach((p, i) => {
    const s = ctx.spawns[i % ctx.spawns.length]!;
    const pi = ctx.players.get(p.id)!;
    pi.spawnX = s.x;
    pi.spawnY = s.y;
    resetStats(ctx, p);
    p.inRound = true;
    spawnPlayerAt(p, s.x, s.y, 0);
  });
}

export function startWaiting(ctx: SimCtx) {
  const w = ctx.world;
  newMap(ctx, w.players.size, Math.max(WAITING_SPAWNS, w.players.size));
  w.phase = Phase.Waiting;
  w.phaseTicks = 0;
  w.winner = '';
  placeAll(ctx);
}

/** A player joining while Waiting gets in right away. */
export function joinWaiting(ctx: SimCtx, p: PlayerState) {
  const w = ctx.world;
  const s = ctx.spawns[(w.players.size - 1) % ctx.spawns.length]!;
  const t = findSafeTile(ctx, p, s.x, s.y);
  const pi = ctx.players.get(p.id)!;
  pi.spawnX = t.x;
  pi.spawnY = t.y;
  resetStats(ctx, p);
  p.inRound = true;
  spawnPlayerAt(p, t.x, t.y, SPAWN_INVULNERABLE);
}

export function startCountdown(ctx: SimCtx) {
  const w = ctx.world;
  w.round++;
  newMap(ctx, w.players.size, w.players.size);
  w.phase = Phase.Countdown;
  w.phaseTicks = COUNTDOWN_TIME;
  w.winner = '';
  placeAll(ctx);
  ctx.roundPlayers = w.players.size;
  emit(ctx, { type: 'countdown', seconds: Math.ceil(COUNTDOWN_TIME / TICK_RATE) });
}

function minPlayers(ctx: SimCtx) {
  return Math.max(1, ctx.config.minPlayers | 0);
}

function endRound(ctx: SimCtx, winner: PlayerState | undefined) {
  const w = ctx.world;
  w.phase = Phase.RoundOver;
  w.phaseTicks = ROUND_OVER_TIME;
  w.winner = winner?.id ?? '';
  w.falling.length = 0;
  if (winner) winner.wins++;
  emit(ctx, { type: 'roundOver', winner: w.winner });
}

function checkRoundEnd(ctx: SimCtx) {
  const w = ctx.world;
  let inRound = 0;
  let alive = 0;
  let pending = 0;
  let last: PlayerState | undefined;
  for (const p of w.players.values()) {
    if (!p.inRound) continue;
    inRound++;
    if (p.alive) {
      alive++;
      last = p;
    } else if (p.respawnIn > 0) pending++;
  }
  if (pending > 0) return;
  // a duel stays a duel even if the opponent leaves; a solo round ends when you die
  if (Math.max(inRound, ctx.roundPlayers) >= 2 ? alive <= 1 : alive === 0) endRound(ctx, alive === 1 ? last : undefined);
}

// ---------------------------------------------------------------- sudden death

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
    if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) killPlayer(ctx, p, '', true);
  }
}

function updateSuddenDeath(ctx: SimCtx) {
  const w = ctx.world;
  if (--ctx.suddenTimer <= 0) {
    ctx.suddenTimer = SUDDEN_DEATH_INTERVAL;
    while (ctx.spiralPos < ctx.spiral.length) {
      const idx = ctx.spiral[ctx.spiralPos++]!;
      if (w.tiles[idx] === Tile.Wall) continue;
      w.falling.push({ x: idx % w.width, y: (idx / w.width) | 0, ttl: FALL_WARNING });
      break;
    }
  }
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
    if (w.phase !== Phase.Waiting) startWaiting(ctx);
    w.phaseTicks++;
    return;
  }
  switch (w.phase) {
    case Phase.Waiting:
      w.phaseTicks++;
      if (w.players.size >= minPlayers(ctx)) startCountdown(ctx);
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
      w.phaseTicks++;
      if (w.phaseTicks >= ROUND_TIME) {
        w.phase = Phase.SuddenDeath;
        ctx.spiral = spiralOrder(w.width, w.height);
        ctx.spiralPos = 0;
        ctx.suddenTimer = 0;
        emit(ctx, { type: 'suddenDeath' });
      }
      checkRoundEnd(ctx);
      break;
    case Phase.SuddenDeath:
      w.phaseTicks++;
      updateSuddenDeath(ctx);
      checkRoundEnd(ctx);
      break;
    case Phase.RoundOver:
      if (--w.phaseTicks <= 0) {
        if (w.players.size >= minPlayers(ctx)) startCountdown(ctx);
        else startWaiting(ctx);
      }
      break;
  }
}
