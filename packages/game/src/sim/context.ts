// Internal (non-networked) simulation state. Everything here is deterministic and is
// rebuilt on every new map; nothing in it is visible to clients.

import type { MatchConfig } from '../contract/api';
import type { GameEvent, InputFrame } from '../contract/protocol';
import type { PickupType, WorldState } from '../contract/types';
import type { SeedHolder } from './rng';

export interface PlayerInternal {
  queue: InputFrame[];
  last: InputFrame;
  /** Highest seq accepted into the queue. */
  lastSeq: number;
  prevButtons: number;
  /** Pickups collected this round (scattered on elimination). */
  collected: PickupType[];
  /** Ticks during which the player can't catch a curse by touch. */
  curseImmune: number;
  spawnX: number;
  spawnY: number;
}

export interface BombInternal {
  pierce: boolean;
  /** Who gets the kill: the owner, or whoever kicked / threw / chained it last (legacy). */
  credit: string;
  /** Current flight leg (Flying only). */
  flightTotal: number;
  flightElapsed: number;
  flightDx: number;
  flightDy: number;
  hops: number;
}

export interface SimCtx {
  world: WorldState;
  config: MatchConfig;
  /** Generator for hidden information, never derived from anything clients can see. */
  secret: SeedHolder;
  events: GameEvent[];
  /** Per tile: hidden PickupType inside a brick, or -1. */
  hidden: Int8Array;
  /** Per tile: id of the flame burning there, 0 = none. */
  flameGrid: Int32Array;
  /** Per tile: id of the last pickup spawned there (stale ids resolve to nothing; ids never repeat). */
  pickupGrid: Int32Array;
  /** Per tile: grounded bomb id, rebuilt before each batch of explosions. */
  bombGrid: Int32Array;
  /** Per tile: ticks a just-destroyed brick still stops (non-pierce) flames. */
  brickBurn: Uint8Array;
  brickBurnCount: number;
  players: Map<string, PlayerInternal>;
  bombs: Map<number, BombInternal>;
  spawns: { x: number; y: number }[];
  /** Ticks before the next zone warning may be issued (WAIT_FOR_LIMIT after start / a shrink). */
  zoneQuiet: number;
  /** Ticks until the next overtime rain, and how many rains this round had. */
  overtimeIn: number;      // 0 = not started yet (waiting for OVERTIME_DESTROYED / MAX_TIME)
  overtimeWave: number;
  /** Bricks on the map when the round started (for the destroyed share). */
  bricksAtStart: number;
  /** The round can produce a winner (started with >= 2 players; legacy isHaveWin). */
  hasWin: boolean;
  /** Deaths so far this round (a leaver can't cancel a win once someone died). */
  roundDeaths: number;
  /** Bomb placement allowed this step (legacy: not once a multiplayer round is decided). */
  bombsAllowed: boolean;
  /** Tests / tools: suspend round end, restarts and zone shrink. */
  hold: boolean;
}

export function emit(ctx: SimCtx, ev: GameEvent) {
  ctx.events.push(ev);
}

export const EMPTY_INPUT: InputFrame = Object.freeze({ seq: 0, dx: 0, dy: 0, buttons: 0 });
