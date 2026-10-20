import type { Curse, Dir, DropKind, FlameShape, PickupType } from './types';

// ---------------------------------------------------------------- input

export enum Button {
  None = 0,
  Bomb = 1 << 0,
  Action = 1 << 1,   // grab / throw (Glove), punch (Punch), detonate (Remote) — context sensitive
}

/**
 * One input sample. `buttons` is the HELD state; the simulation does edge detection
 * itself (it remembers the previous buttons per player), so dropped/duplicated frames
 * never cause double bombs.
 */
export interface InputFrame {
  seq: number;       // monotonically increasing per client
  dx: number;        // -1..1 (already normalised; length <= 1)
  dy: number;
  buttons: number;   // Button bitmask
}

/** Quantise an axis for the wire (int8). */
export const packAxis = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 127)));
export const unpackAxis = (v: number) => v / 127;

// ---------------------------------------------------------------- events
// Emitted by Simulation.step(); the server broadcasts them, the client turns them into
// sound, particles, screen shake and haptics. They are cosmetic: state is authoritative.

/** What killed a player: a bomb's flame, a burning player's touch (Fire), a falling zone block. */
export type DeathCause = 'blast' | 'fire' | 'crushed';

export type GameEvent =
  | { type: 'bombPlaced'; bomb: number; x: number; y: number; owner: string }
  | { type: 'bombKicked'; bomb: number; by: string; dir: Dir }
  | { type: 'bombGrabbed'; bomb: number; by: string }
  | { type: 'bombThrown'; bomb: number; by: string; toX: number; toY: number }
  | { type: 'bombPunched'; bomb: number; by: string; toX: number; toY: number }
  | { type: 'bombBounced'; bomb: number; x: number; y: number }
  | { type: 'bombLanded'; bomb: number; x: number; y: number }
  | { type: 'bombStopped'; bomb: number; x: number; y: number }
  | { type: 'explosion'; bomb: number; owner: string; x: number; y: number; cells: { x: number; y: number; shape: FlameShape }[]; power: number }
  | { type: 'bombFizzled'; bomb: number; x: number; y: number }
  | { type: 'bombVanished'; bomb: number; x: number; y: number }   // thrown / punched off the map: evaporates
  | { type: 'brickDestroyed'; x: number; y: number }
  | { type: 'pickupSpawned'; pickup: number; x: number; y: number; kind: PickupType }
  | { type: 'pickupCollected'; pickup: number; by: string; kind: PickupType }
  | { type: 'pickupBurned'; pickup: number; x: number; y: number }
  | { type: 'shieldBlocked'; player: string }
  | { type: 'playerStunned'; player: string }
  | { type: 'playerDied'; player: string; killer: string; x: number; y: number; cause: DeathCause }
  | { type: 'playerRespawned'; player: string; x: number; y: number }
  | { type: 'curseApplied'; player: string; curse: Curse; from: string }
  | { type: 'effectEnded'; player: string; effect: EffectName }
  | { type: 'countdown'; seconds: number }
  | { type: 'roundStart'; round: number }
  | { type: 'suddenDeath' }                         // first ring of the zone closes
  | { type: 'zoneWarning'; seconds: number }       // "the map shrinks in N s"
  | { type: 'zoneCancel' }                         // fewer than 2 players: shrink cancelled
  | { type: 'zoneShrink'; ring: number }           // ring closes now (its blocks fall over FALL_TIME)
  | { type: 'blockFell'; x: number; y: number }
  | { type: 'skyRain'; kind: 'pickups' | 'bombs'; count: number }   // overtime: things start falling
  | { type: 'dropLanded'; drop: number; x: number; y: number; kind: DropKind }
  | { type: 'roundOver'; winner: string };

/** Timed effects that announce their end. */
export type EffectName =
  | 'shield' | 'ghost' | 'crazy' | 'fire' | 'curse' | 'speed'
  | 'kick' | 'glove' | 'punch' | 'remote' | 'pierce' | 'lineBomb' | 'bombPass';

export type GameEventType = GameEvent['type'];

// ---------------------------------------------------------------- client <-> server messages

export const MSG = {
  /** client -> server: InputFrame[] (batched, newest last); server applies in seq order */
  input: 'i',
  /** client -> server: { name?: string; skin?: number } */
  profile: 'p',
  /** client -> server: string ; server -> client: ChatMessage */
  chat: 'c',
  /** client -> server: number (client time) ; server -> client: { t: number } echo for RTT */
  ping: 'ping',
  /** server -> client: GameEvent[] emitted during the last patch interval */
  events: 'e',
  /** client -> server: boolean. true = «Подключиться» (enter the arena as a player),
   *  false = «Отключиться» (back to spectators). Room clients start as spectators. */
  play: 'play',
  /** client -> server: Partial<RoomSettings> (own rooms, creator only). Settings live in the state. */
  settings: 'settings',
} as const;

export type BotDifficultyName = 'easy' | 'normal' | 'hard';
export const BOT_DIFFICULTIES: readonly BotDifficultyName[] = ['easy', 'normal', 'hard'];

/** What the creator of an own room can tune. */
export interface RoomSettings {
  bots: number;                     // bots in the arena (exact count, capped by the free slots)
  botDifficulty: BotDifficultyName;
  maxPlayers: number;               // arena capacity, humans + bots
  zone: boolean;                    // the arena shrinks during long rounds
  events: boolean;                  // overtime rain of pickups and bombs in long rounds
}

export interface ChatMessage {
  from: string;      // player id, '' = system
  name: string;
  text: string;
  at: number;        // epoch ms
}

export interface JoinOptions {
  name: string;
  skin: number;
}

export const ROOM_NAME = 'battle';

/** Options for creating a room (private rooms are joined by code, i.e. roomId). */
export interface RoomOptions {
  private?: boolean;
  bots?: number;          // own rooms: initial RoomSettings.bots
  botDifficulty?: BotDifficultyName;
  maxPlayers?: number;
}
