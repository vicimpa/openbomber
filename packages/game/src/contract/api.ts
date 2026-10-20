import type { GameEvent, InputFrame } from './protocol';
import type { PlayerState, WorldState } from './types';

/** Implemented by `Simulation` in ../sim. This is the surface server and client rely on. */
export interface MatchConfig {
  /** Arena size; when omitted the sim picks one from the player count at round start. */
  width?: number;
  height?: number;
  /** Minimum players (humans + bots) for a real round; below it the phase stays Waiting. */
  minPlayers: number;
  seed?: number;
}

export interface NewPlayer {
  id: string;
  name: string;
  skin: number;
  isBot?: boolean;
}

export interface ISimulation {
  readonly state: WorldState;
  addPlayer(p: NewPlayer): PlayerState;
  removePlayer(id: string): void;
  updateProfile(id: string, p: { name?: string; skin?: number }): void;
  /** Queue input for a player; frames with seq <= last applied are ignored. */
  pushInput(id: string, frame: InputFrame): void;
  /** Advance one fixed tick (1 / TICK_RATE s). Returns the events of that tick. */
  step(): GameEvent[];
}

/**
 * Client-side prediction entry point: advance ONLY the movement of one player by one tick
 * against the given world (tiles + bombs), mutating `player` in place. Must be the exact
 * same code path the authoritative sim uses for movement.
 */
export type PredictMovement = (world: WorldState, player: PlayerState, input: InputFrame) => void;

/** Bot brain: decides the next input for `id` from the current world. */
export interface IBot {
  readonly id: string;
  think(world: WorldState): InputFrame;
}
