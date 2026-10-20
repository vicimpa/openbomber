// Plain-data world model shared by the simulation, the server (which mirrors it into
// Colyseus schema) and the client renderer (which only ever reads it).
// Enums are numeric so they map 1:1 onto uint8 schema fields.

export enum Tile {
  Floor = 0,
  Wall = 1,     // indestructible
  Brick = 2,    // destructible, may hide a pickup
}

export enum Dir { Up = 0, Left = 1, Right = 2, Down = 3 }

export const DIR_VEC: Record<Dir, readonly [number, number]> = {
  [Dir.Up]: [0, -1],
  [Dir.Left]: [-1, 0],
  [Dir.Right]: [1, 0],
  [Dir.Down]: [0, 1],
};

export enum Phase {
  Waiting = 0,      // no players at all (idle arena)
  Countdown = 1,    // short "get ready" freeze at round start
  Playing = 2,
  SuddenDeath = 3,  // the zone has started shrinking
  RoundOver = 4,    // decided; restart after phaseTicks
}

export enum PickupType {
  // stackable stats (whole round)
  BombUp = 0,
  FireUp = 1,
  SpeedUp = 2,     // timed (SPEED_TIME)
  FullFire = 3,
  // abilities (timed, see *_TIME constants)
  Kick = 4,
  Glove = 5,       // grab a bomb (Action) and throw it over walls/bricks
  Punch = 6,       // Action facing an adjacent bomb punches it 3 tiles
  Remote = 7,      // own bombs wait for Action to detonate
  Pierce = 8,      // flames go through bricks
  LineBomb = 9,    // Bomb while standing on own bomb drops a line of bombs
  BombPass = 10,   // walk through bombs
  // timed / one-shot
  Shield = 11,
  Ghost = 12,      // walk through bricks for GHOST_TIME
  Crazy = 13,      // random fuse / radius bombs
  Fire = 14,       // slower, but touching other players kills them
  Heart = 15,      // +1 life
  Skull = 16,      // random curse, contagious on touch
  Random = 17,     // turns into a random other pickup on collect
}

export enum Ability {
  None = 0,
  Kick = 1 << 0,
  Glove = 1 << 1,
  Punch = 1 << 2,
  Remote = 1 << 3,
  Pierce = 1 << 4,
  LineBomb = 1 << 5,
  BombPass = 1 << 6,
}

export enum Curse {
  None = 0,
  Reverse = 1,      // inverted controls
  Diarrhea = 2,     // drops bombs constantly
  Constipation = 3, // cannot drop bombs
  Slow = 4,
  Fast = 5,
  TinyFlame = 6,    // radius forced to 1
}

export enum BombKind { Normal = 0, Remote = 1, Pierce = 2, Crazy = 3 }

export enum BombMotion {
  Idle = 0,
  Sliding = 1,  // kicked
  Flying = 2,   // thrown / punched, ignores collisions until it lands
  Carried = 3,  // held by a player with Glove
}

export enum FlameShape {
  Center = 0,
  Horizontal = 1,
  Vertical = 2,
  EndUp = 3,
  EndLeft = 4,
  EndRight = 5,
  EndDown = 6,
}

export interface TimedEffects {
  shield: number;   // ticks remaining, 0 = inactive
  ghost: number;
  crazy: number;
  fire: number;
  curse: number;
  invulnerable: number;
  stun: number;
  speed: number;    // SpeedUp
  // timed abilities: the matching Ability bit is set exactly while the timer runs
  kick: number;
  glove: number;
  punch: number;
  remote: number;
  pierce: number;
  lineBomb: number;
  bombPass: number;
}

export interface PlayerState {
  id: string;            // Colyseus sessionId online, any unique string offline
  name: string;
  skin: number;
  isBot: boolean;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  alive: boolean;
  inRound: boolean;      // false = spectator (joined mid round)
  lives: number;         // extra lives left (Heart)
  bombs: number;         // max simultaneous bombs
  radius: number;
  speedLevel: number;    // 1 while SpeedUp runs (effects.speed > 0), else 0
  abilities: number;     // Ability bitmask
  curse: Curse;
  effects: TimedEffects;
  carrying: number;      // bomb id or -1
  respawnIn: number;     // ticks until respawn, 0 = not pending
  wins: number;
  kills: number;
  deaths: number;
  /** Last input seq applied by the authoritative sim (for client reconciliation). */
  ackSeq: number;
}

export interface BombState {
  id: number;
  owner: string;
  kind: BombKind;
  x: number;             // continuous position (sliding / flying)
  y: number;
  radius: number;
  fuse: number;          // ticks until explosion; <0 = waiting for remote
  motion: BombMotion;
  vx: number;            // tiles per tick while Sliding
  vy: number;
  /** Flight arc while Flying: from -> to, progress 0..1, used by the renderer for the hop. */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  /** Players currently allowed to overlap this bomb (just placed it / standing on it). */
  passers: string[];
  dud: boolean;          // crazy bomb that will fizzle
}

export interface FlameState {
  id: number;
  x: number;
  y: number;
  shape: FlameShape;
  owner: string;
  ttl: number;           // ticks remaining
}

export interface PickupState {
  id: number;
  x: number;
  y: number;
  type: PickupType;
  /** Ticks during which a fresh pickup can't be burned (it just popped out of a brick). */
  protect: number;
}

export interface FallingBlock {
  x: number;
  y: number;
  ttl: number;           // ticks until it lands and becomes a Wall
}

export interface WorldState {
  tick: number;
  seed: number;          // RNG state, advanced deterministically
  phase: Phase;
  phaseTicks: number;    // ticks left in the current phase (Countdown / RoundOver), or elapsed Playing time
  round: number;
  width: number;
  height: number;
  tiles: Uint8Array;     // width * height, index = y * width + x, values = Tile
  players: Map<string, PlayerState>;
  bombs: Map<number, BombState>;
  flames: Map<number, FlameState>;
  pickups: Map<number, PickupState>;
  falling: FallingBlock[];
  winner: string;        // '' = none / draw (valid in RoundOver)
  nextId: number;
  /** Zone shrink: rings already closed (0 = full map). */
  zoneRing: number;
  /** Ticks until the next ring closes (warning running), 0 = nothing pending. */
  zoneIn: number;
}
