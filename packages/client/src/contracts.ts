// Interfaces between client modules; the session layer (src/session) wires them together.
// Other modules are written against these signatures, so change them together.

import type { GameEvent, InputFrame, WorldState } from '@ob/game';

// ---------------------------------------------------------------- game source
/** Where the world comes from: a local Simulation (offline vs bots) or the Colyseus room. */
export interface GameSource {
  /** Latest world to draw. Online: interpolated remotes + predicted local player. */
  readonly world: WorldState | null;
  /** Id of the player controlled on this device ('' = spectator / not joined). */
  readonly localId: string;
  /** Call once per animation frame with the current input sample. */
  update(dtMs: number, input: Omit<InputFrame, 'seq'>): void;
  /** Events produced since the previous call (sound / fx / haptics). */
  drainEvents(): GameEvent[];
  readonly ping: number;          // ms, 0 offline
  dispose(): void;
}

// ---------------------------------------------------------------- renderer (src/render)
export interface RendererOptions {
  parent: HTMLElement;            // canvas is appended here and resized to it
  quality?: 'low' | 'high';       // particles / filters
}

export interface GameRenderer {
  /** Draw this world on the next frame (called every animation frame). */
  render(world: WorldState | null, localId: string, dtMs: number): void;
  /** Cosmetic reactions: particles, shake, flashes. */
  handleEvents(events: GameEvent[], localId: string): void;
  setQuality(q: 'low' | 'high'): void;
  destroy(): void;
}
export type CreateRenderer = (opts: RendererOptions) => Promise<GameRenderer>;

// ---------------------------------------------------------------- audio (src/audio)
export type MusicMode = 'off' | 'menu' | 'waiting' | 'battle' | 'sudden' | 'victory' | 'defeat';
export type UiSound = 'hover' | 'click' | 'back' | 'join' | 'chat' | 'error' | 'tick';

export interface AudioEngine {
  /** Must be called from a user gesture (AudioContext unlock). Safe to call repeatedly. */
  unlock(): void;
  handleEvents(events: GameEvent[], world: WorldState | null, localId: string): void;
  setMusic(mode: MusicMode): void;
  ui(sound: UiSound): void;
  setVolume(v: { master?: number; sfx?: number; music?: number }): void; // 0..1
  dispose(): void;
}
export type CreateAudio = () => AudioEngine;

// ---------------------------------------------------------------- input (src/input)
export interface InputSample {
  dx: number;                     // normalised, length <= 1, deadzone applied
  dy: number;
  buttons: number;                // Button bitmask (held state)
}

export type InputDevice = 'keyboard' | 'gamepad' | 'touch';

export interface InputManager {
  sample(): InputSample;
  /** Device that produced the last meaningful input (UI hints / which overlay to show). */
  readonly lastDevice: InputDevice;
  /** Haptics: phone vibration + gamepad rumble. Respects the user setting. */
  vibrate(pattern: number | number[], strength?: number): void;
  /** Enable/disable gameplay capture (e.g. while typing in chat). */
  setEnabled(enabled: boolean): void;
  dispose(): void;
}
export type CreateInput = () => InputManager;
