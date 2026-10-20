// Pickup table, spawning, collection and effects.

import {
  CURSE_TIME,
  CRAZY_TIME,
  FIRE_TIME,
  FLAME_TIME,
  GHOST_TIME,
  MAX_BOMBS,
  MAX_RADIUS,
  MAX_SPEED_LEVEL,
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  SHIELD_TIME,
  sec,
} from '../contract/constants';
import { Ability, Curse, PickupType, Tile, type PickupState, type PlayerState } from '../contract/types';
import { emit, type SimCtx } from './context';
import { randInt, weightedIndex, type SeedHolder } from './rng';

/** Drop weights indexed by PickupType (from the plan). */
export const PICKUP_WEIGHTS: readonly number[] = (() => {
  const w: number[] = [];
  w[PickupType.BombUp] = 18;
  w[PickupType.FireUp] = 18;
  w[PickupType.SpeedUp] = 12;
  w[PickupType.Kick] = 7;
  w[PickupType.Glove] = 6;
  w[PickupType.Punch] = 5;
  w[PickupType.Shield] = 5;
  w[PickupType.LineBomb] = 4;
  w[PickupType.Skull] = 4;
  w[PickupType.Random] = 4;
  w[PickupType.Remote] = 3;
  w[PickupType.Pierce] = 3;
  w[PickupType.BombPass] = 3;
  w[PickupType.Ghost] = 3;
  w[PickupType.Crazy] = 3;
  w[PickupType.Fire] = 3;
  w[PickupType.Heart] = 2;
  w[PickupType.FullFire] = 1;
  return w;
})();
const TOTAL_WEIGHT = PICKUP_WEIGHTS.reduce((a, b) => a + b, 0);
const WEIGHTS_NO_RANDOM = PICKUP_WEIGHTS.map((v, i) => (i === PickupType.Random ? 0 : v));
const TOTAL_NO_RANDOM = TOTAL_WEIGHT - PICKUP_WEIGHTS[PickupType.Random]!;

/** Fresh pickups can't burn for this long (they pop out of a brick inside the flame). */
export const PICKUP_PROTECT = FLAME_TIME + 2;
export const MAX_LIVES = 3;
export const CURSE_IMMUNITY = sec(1);
export const MAX_SCATTER = 5;

export function rollPickup(rng: SeedHolder, excludeRandom: boolean): PickupType {
  return excludeRandom
    ? (weightedIndex(rng, WEIGHTS_NO_RANDOM, TOTAL_NO_RANDOM) as PickupType)
    : (weightedIndex(rng, PICKUP_WEIGHTS, TOTAL_WEIGHT) as PickupType);
}

const ABILITY_OF: Partial<Record<PickupType, Ability>> = {
  [PickupType.Kick]: Ability.Kick,
  [PickupType.Glove]: Ability.Glove,
  [PickupType.Punch]: Ability.Punch,
  [PickupType.Remote]: Ability.Remote,
  [PickupType.Pierce]: Ability.Pierce,
  [PickupType.LineBomb]: Ability.LineBomb,
  [PickupType.BombPass]: Ability.BombPass,
};

export function pickupAt(ctx: SimCtx, x: number, y: number): PickupState | undefined {
  for (const p of ctx.world.pickups.values()) if (p.x === x && p.y === y) return p;
  return undefined;
}

export function spawnPickup(ctx: SimCtx, x: number, y: number, type: PickupType): PickupState {
  const w = ctx.world;
  const p: PickupState = { id: w.nextId++, x, y, type, protect: PICKUP_PROTECT };
  w.pickups.set(p.id, p);
  emit(ctx, { type: 'pickupSpawned', pickup: p.id, x, y, kind: type });
  return p;
}

export function applyCurse(ctx: SimCtx, p: PlayerState, curse: Curse, from: string) {
  p.curse = curse;
  p.effects.curse = CURSE_TIME;
  const pi = ctx.players.get(p.id);
  if (pi) pi.curseImmune = CURSE_IMMUNITY;
  emit(ctx, { type: 'curseApplied', player: p.id, curse, from });
}

/** Apply a pickup's effect. Returns the kind actually applied (Random resolves). */
export function applyPickup(ctx: SimCtx, p: PlayerState, type: PickupType): PickupType {
  if (type === PickupType.Random) type = rollPickup(ctx.world, true);
  const e = p.effects;
  switch (type) {
    case PickupType.BombUp:
      p.bombs = Math.min(MAX_BOMBS, p.bombs + 1);
      break;
    case PickupType.FireUp:
      p.radius = Math.min(MAX_RADIUS, p.radius + 1);
      break;
    case PickupType.SpeedUp:
      p.speedLevel = Math.min(MAX_SPEED_LEVEL, p.speedLevel + 1);
      break;
    case PickupType.FullFire:
      p.radius = MAX_RADIUS;
      break;
    case PickupType.Shield:
      e.shield = SHIELD_TIME;
      break;
    case PickupType.Ghost:
      e.ghost = GHOST_TIME;
      break;
    case PickupType.Crazy:
      e.crazy = CRAZY_TIME;
      break;
    case PickupType.Fire:
      e.fire = FIRE_TIME;
      break;
    case PickupType.Heart:
      p.lives = Math.min(MAX_LIVES, p.lives + 1);
      break;
    case PickupType.Skull:
      applyCurse(ctx, p, (1 + randInt(ctx.world, 6)) as Curse, '');
      break;
    default: {
      const a = ABILITY_OF[type];
      if (a) p.abilities |= a;
    }
  }
  if (type !== PickupType.Skull && type !== PickupType.Heart) ctx.players.get(p.id)?.collected.push(type);
  return type;
}

const COLLECT_DIST = PLAYER_RADIUS + PICKUP_RADIUS * 0.5;

/** Alive players pick up whatever they touch. */
export function collectPickups(ctx: SimCtx) {
  const w = ctx.world;
  if (w.pickups.size === 0) return;
  for (const p of w.players.values()) {
    if (!p.alive || !p.inRound) continue;
    for (const k of w.pickups.values()) {
      const dx = k.x - p.x;
      const dy = k.y - p.y;
      if (dx * dx + dy * dy >= COLLECT_DIST * COLLECT_DIST) continue;
      w.pickups.delete(k.id);
      const kind = applyPickup(ctx, p, k.type);
      emit(ctx, { type: 'pickupCollected', pickup: k.id, by: p.id, kind });
    }
  }
}

export function tickPickups(ctx: SimCtx) {
  for (const k of ctx.world.pickups.values()) if (k.protect > 0) k.protect--;
}

/** Floor tiles with nothing on them (no bomb, pickup, flame, falling block or player). */
export function freeTiles(ctx: SimCtx): number[] {
  const w = ctx.world;
  const busy = new Uint8Array(w.width * w.height);
  for (const b of w.bombs.values()) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (x >= 0 && y >= 0 && x < w.width && y < w.height) busy[y * w.width + x] = 1;
  }
  for (const k of w.pickups.values()) busy[k.y * w.width + k.x] = 1;
  for (const f of w.falling) busy[f.y * w.width + f.x] = 1;
  for (const p of w.players.values()) {
    if (p.alive) busy[Math.round(p.y) * w.width + Math.round(p.x)] = 1;
  }
  const out: number[] = [];
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] === Tile.Floor && !busy[i] && !ctx.flameGrid[i]) out.push(i);
  }
  return out;
}

/** An eliminated player's collected pickups (up to MAX_SCATTER) fly to random free tiles. */
export function scatterPickups(ctx: SimCtx, p: PlayerState) {
  const pi = ctx.players.get(p.id);
  if (!pi || pi.collected.length === 0) return;
  const w = ctx.world;
  const pool = pi.collected.slice();
  pi.collected.length = 0;
  const free = freeTiles(ctx);
  for (let n = 0; n < MAX_SCATTER && pool.length > 0 && free.length > 0; n++) {
    const kind = pool.splice(randInt(w, pool.length), 1)[0]!;
    const idx = free.splice(randInt(w, free.length), 1)[0]!;
    spawnPickup(ctx, idx % w.width, (idx / w.width) | 0, kind);
  }
}
