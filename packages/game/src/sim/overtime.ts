// Overtime: once most of the round's bricks are gone (or the round runs long), things start
// falling from the sky every OVERTIME_EVERY: a rain of pickups, then a rain of bombs, and so
// on, a little heavier each time. Every drop casts a growing shadow for DROP_FALL_TIME first.

import {
  DROP_FALL_TIME, OVERTIME_DESTROYED, OVERTIME_EVERY, OVERTIME_MAX_TIME, OVERTIME_MIN_TIME, SKY_BOMB_FUSE,
  SKY_BOMB_RADIUS, TICK_RATE,
} from '../contract/constants';
import { DropKind, Tile } from '../contract/types';
import { createSkyBomb } from './bombs';
import { emit, type SimCtx } from './context';
import { rollPickup, spawnPickup } from './pickups';
import { randInt } from './rng';
import { bombAtTile } from './world';

/** New map: count its bricks, nothing in the air, overtime not started. */
export function resetOvertime(ctx: SimCtx) {
  const t = ctx.world.tiles;
  let n = 0;
  for (let i = 0; i < t.length; i++) if (t[i] === Tile.Brick) n++;
  ctx.bricksAtStart = n;
  ctx.overtimeIn = 0;
  ctx.overtimeWave = 0;
  ctx.world.drops.length = 0;
}

function destroyedShare(ctx: SimCtx): number {
  if (ctx.bricksAtStart === 0) return 1;
  const t = ctx.world.tiles;
  let n = 0;
  for (let i = 0; i < t.length; i++) if (t[i] === Tile.Brick) n++;
  return 1 - n / ctx.bricksAtStart;
}

/** Free floor tiles a drop may target: no bomb, pickup, flame, drop or falling block there. */
function freeTiles(ctx: SimCtx, avoidPlayers: boolean): number[] {
  const w = ctx.world;
  const busy = new Uint8Array(w.width * w.height);
  for (const d of w.drops) busy[d.y * w.width + d.x] = 1;
  for (const f of w.falling) busy[f.y * w.width + f.x] = 1;
  for (const p of w.pickups.values()) busy[p.y * w.width + p.x] = 1;
  if (avoidPlayers) {
    for (const p of w.players.values()) {
      if (p.alive && p.inRound) busy[Math.round(p.y) * w.width + Math.round(p.x)] = 1;
    }
  }
  const out: number[] = [];
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== Tile.Floor || busy[i] || ctx.flameGrid[i]) continue;
    if (bombAtTile(w, i % w.width, (i / w.width) | 0)) continue;
    out.push(i);
  }
  return out;
}

function rain(ctx: SimCtx) {
  const w = ctx.world;
  const wave = ++ctx.overtimeWave;
  const bombs = wave % 2 === 0;
  const scale = Math.max(1, Math.round(Math.sqrt(w.width * w.height) / 13)); // bigger maps, more drops
  const want = bombs ? Math.min(12, (1 + wave) * scale) : Math.min(14, (3 + wave) * scale);
  const free = freeTiles(ctx, bombs);
  const count = Math.min(want, free.length);
  for (let k = 0; k < count; k++) {
    const i = free.splice(randInt(w, free.length), 1)[0]!;
    w.drops.push({
      id: w.nextId++,
      x: i % w.width,
      y: (i / w.width) | 0,
      kind: bombs ? DropKind.Bomb : DropKind.Pickup,
      pickup: bombs ? 0 : rollPickup(ctx.secret, false),
      // a ragged rain: drops land over half a second, not all at once
      ttl: DROP_FALL_TIME + randInt(w, Math.ceil(TICK_RATE / 2)),
    });
  }
  if (count) emit(ctx, { type: 'skyRain', kind: bombs ? 'bombs' : 'pickups', count });
}

/** Called every tick of a live round (not while the round is held). */
export function updateOvertime(ctx: SimCtx) {
  const w = ctx.world;
  if (ctx.config.overtime === false || w.players.size < 2) return;
  if (ctx.overtimeIn === 0) {
    // not started: check once a second
    const t = w.phaseTicks;
    if (t < OVERTIME_MIN_TIME || t % TICK_RATE !== 0) return;
    if (t < OVERTIME_MAX_TIME && destroyedShare(ctx) < OVERTIME_DESTROYED) return;
    ctx.overtimeIn = 1;
  }
  if (--ctx.overtimeIn <= 0) {
    rain(ctx);
    ctx.overtimeIn = OVERTIME_EVERY;
  }
}

/** Drops fall and land (also while a round is held, so nothing hangs in the air). */
export function updateDrops(ctx: SimCtx) {
  const w = ctx.world;
  if (w.drops.length === 0) return;
  let k = 0;
  for (let i = 0; i < w.drops.length; i++) {
    const d = w.drops[i]!;
    if (--d.ttl > 0) { w.drops[k++] = d; continue; }
    const idx = d.y * w.width + d.x;
    // the zone may have walled the tile in, or someone dropped a bomb there meanwhile
    if (w.tiles[idx] !== Tile.Floor || bombAtTile(w, d.x, d.y)) continue;
    if (d.kind === DropKind.Bomb) createSkyBomb(ctx, d.x, d.y, SKY_BOMB_RADIUS, SKY_BOMB_FUSE);
    else if (!ctx.pickupGrid[idx] || !w.pickups.has(ctx.pickupGrid[idx]!)) spawnPickup(ctx, d.x, d.y, d.pickup);
    emit(ctx, { type: 'dropLanded', drop: d.id, x: d.x, y: d.y, kind: d.kind });
  }
  w.drops.length = k;
}
