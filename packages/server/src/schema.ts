// Colyseus state schema mirroring `WorldState` (see @ob/game contract/types.ts).
//
// This file imports ONLY `@colyseus/schema` so the browser client can `import type` it
// (packages/client/src/net) without pulling server code into the bundle. The client
// decodes via Colyseus reflection, so the runtime classes are never needed there.
//
// Wire conventions:
// - Countdown fields are sent as ABSOLUTE ticks (`*At`) instead of "ticks remaining", so
//   they only change when an effect starts/stops instead of every tick:
//     remaining = at > 0 ? max(0, at - state.tick) : 0
//   Player `effects` is a map { <TimedEffects key>: endTick } using the same rule.
//   Bomb `fuseAt` is the same, except that a negative value is the raw (remote) fuse.
// - Hidden data is never synced: pickups inside bricks live only inside the simulation,
//   `BombState.dud` (crazy bomb that will fizzle) is not sent, nor are `seed` / `nextId`.
// - Map keys for bombs / flames / pickups are `String(id)`; players are keyed by id.

import { schema, t, type SchemaType } from '@colyseus/schema';

export const PlayerSchema = schema({
  id: t.string().default(''),
  name: t.string().default(''),
  skin: t.uint8().default(0),
  isBot: t.boolean().default(false),
  x: t.float32().default(0),
  y: t.float32().default(0),
  dir: t.uint8().default(0),
  moving: t.boolean().default(false),
  alive: t.boolean().default(false),
  inRound: t.boolean().default(false),
  lives: t.uint8().default(0),
  teleports: t.uint8().default(0),
  bombs: t.uint8().default(0),
  radius: t.uint8().default(0),
  speedLevel: t.uint8().default(0),
  abilities: t.uint16().default(0),
  curse: t.uint8().default(0),
  /** TimedEffects as absolute end ticks, keyed by field name (generic: new effect fields
   *  in the contract are mirrored without schema changes). */
  effects: t.map('uint32'),
  carrying: t.int32().default(-1),
  respawnAt: t.uint32().default(0),
  wins: t.uint16().default(0),
  kills: t.uint16().default(0),
  deaths: t.uint16().default(0),
  ackSeq: t.uint32().default(0),
}, 'Player');
export type PlayerSchema = SchemaType<typeof PlayerSchema>;

export const BombSchema = schema({
  id: t.uint32().default(0),
  owner: t.string().default(''),
  kind: t.uint8().default(0),
  x: t.float32().default(0),
  y: t.float32().default(0),
  radius: t.uint8().default(0),
  fuseAt: t.int32().default(0),
  motion: t.uint8().default(0),
  vx: t.float32().default(0),
  vy: t.float32().default(0),
  fromX: t.float32().default(0),
  fromY: t.float32().default(0),
  toX: t.float32().default(0),
  toY: t.float32().default(0),
  progress: t.float32().default(0),
  passers: t.array('string'),
}, 'Bomb');
export type BombSchema = SchemaType<typeof BombSchema>;

export const FlameSchema = schema({
  id: t.uint32().default(0),
  x: t.uint8().default(0),
  y: t.uint8().default(0),
  shape: t.uint8().default(0),
  owner: t.string().default(''),
  ttlAt: t.uint32().default(0),
}, 'Flame');
export type FlameSchema = SchemaType<typeof FlameSchema>;

export const PickupSchema = schema({
  id: t.uint32().default(0),
  x: t.float32().default(0),
  y: t.float32().default(0),
  type: t.uint8().default(0),
  protectAt: t.uint32().default(0),
}, 'Pickup');
export type PickupSchema = SchemaType<typeof PickupSchema>;

export const FallingSchema = schema({
  x: t.uint8().default(0),
  y: t.uint8().default(0),
  ttlAt: t.uint32().default(0),
}, 'Falling');
export type FallingSchema = SchemaType<typeof FallingSchema>;

/** Overtime sky drop (bomb or pickup falling from the sky). */
export const DropSchema = schema({
  id: t.uint32().default(0),
  x: t.uint8().default(0),
  y: t.uint8().default(0),
  kind: t.uint8().default(0),
  pickup: t.uint8().default(0),
  ttlAt: t.uint32().default(0),
}, 'Drop');
export type DropSchema = SchemaType<typeof DropSchema>;

export const BattleState = schema({
  tick: t.uint32().default(0),
  phase: t.uint8().default(0),
  phaseTicks: t.uint32().default(0),
  round: t.uint16().default(0),
  width: t.uint8().default(0),
  height: t.uint8().default(0),
  winner: t.string().default(''),
  /** Zone shrink: rings already closed. */
  zoneRing: t.uint8().default(0),
  /** Tick at which the next ring closes (0 = nothing pending), see `*At` rule. */
  zoneAt: t.uint32().default(0),
  /** Connected clients that are not in the arena. */
  spectators: t.uint16().default(0),
  /** Arena capacity (sim players incl. bots). */
  maxPlayers: t.uint8().default(0),
  /** Own rooms: the session that may change the settings ('' in the shared arena). */
  ownerId: t.string().default(''),
  /** Room settings (RoomSettings): bot count, BOT_DIFFICULTIES index, zone shrink on/off. */
  bots: t.uint8().default(0),
  botDifficulty: t.uint8().default(1),
  zone: t.boolean().default(true),
  events: t.boolean().default(true),
  /** width * height Tile values, index = y * width + x; patched per index. */
  tiles: t.array('uint8'),
  players: t.map(PlayerSchema),
  bombs: t.map(BombSchema),
  flames: t.map(FlameSchema),
  pickups: t.map(PickupSchema),
  falling: t.array(FallingSchema),
  drops: t.array(DropSchema),
}, 'BattleState');
export type BattleState = SchemaType<typeof BattleState>;

/** Room listing metadata (also returned by GET /rooms). */
export interface RoomMeta {
  /** Human players in the arena. */
  humans: number;
  bots: number;
  spectators: number;
  phase: number;
  round: number;
  maxPlayers: number;
  main: boolean;
}

/** server -> client reply to MSG.play. */
export interface PlayReply {
  playing: boolean;
  reason?: 'full' | 'rate';
}

/** One entry of GET /rooms (public rooms only). */
export interface RoomListing {
  roomId: string;
  clients: number;
  maxClients: number;
  metadata?: RoomMeta;
}

/** Wire format of one input frame: [seq, packAxis(dx), packAxis(dy), buttons]. */
export type WireInput = [number, number, number, number];
