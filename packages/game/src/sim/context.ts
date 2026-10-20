// Internal (non-networked) simulation state. Everything here is deterministic and is
// rebuilt on every new map; nothing in it is visible to clients.

import type { MatchConfig } from '../contract/api';
import type { GameEvent, InputFrame } from '../contract/protocol';
import type { PickupType, WorldState } from '../contract/types';

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
  remote: boolean;
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
  events: GameEvent[];
  /** Per tile: hidden PickupType inside a brick, or -1. */
  hidden: Int8Array;
  /** Per tile: id of the flame burning there, 0 = none. */
  flameGrid: Int32Array;
  /** Per tile: ticks a just-destroyed brick still stops (non-pierce) flames. */
  brickBurn: Uint8Array;
  brickBurnCount: number;
  players: Map<string, PlayerInternal>;
  bombs: Map<number, BombInternal>;
  spawns: { x: number; y: number }[];
  /** Sudden death spiral (tile indices) and progress. */
  spiral: Int32Array;
  spiralPos: number;
  suddenTimer: number;
  /** Players that started the current round (decides when it is over). */
  roundPlayers: number;
}

export function emit(ctx: SimCtx, ev: GameEvent) {
  ctx.events.push(ev);
}

export const EMPTY_INPUT: InputFrame = Object.freeze({ seq: 0, dx: 0, dy: 0, buttons: 0 });
