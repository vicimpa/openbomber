// Shared numeric tuning. Units: 1.0 = one tile, time in simulation ticks unless noted.
// Tile (x, y) has its CENTER at integer coordinates (x, y); the playfield spans
// tiles 0..width-1 / 0..height-1 and is surrounded by implicit indestructible walls.

export const TICK_RATE = 60;                 // fixed simulation steps per second
export const TICK_MS = 1000 / TICK_RATE;
export const PATCH_RATE = 30;                // server -> client state patches per second

export const sec = (s: number) => Math.round(s * TICK_RATE);

// --- collision (ported from new-openbomber: circle hero vs square tiles / circle bombs)
export const PLAYER_RADIUS = 0.25;
export const BOMB_RADIUS = 0.375;
export const PICKUP_RADIUS = 0.375;
/** A bomb stays walk-through for a player until they are farther than this from its center. */
export const BOMB_RELEASE_DISTANCE = 0.625;

// --- movement
export const BASE_SPEED = 2.8;               // tiles / second
export const SPEED_STEP = 0.35;              // + per SpeedUp level
export const MAX_SPEED_LEVEL = 5;
export const INPUT_DEADZONE = 0.3;

// --- bombs & flames
export const BOMB_FUSE = sec(2.2);
export const REMOTE_BOMB_MAX_FUSE = sec(12);  // remote bombs auto-explode eventually
export const FLAME_TIME = sec(0.5);
export const CHAIN_DELAY = 3;                 // ticks between chained explosions (visual ripple)
export const START_BOMBS = 1;
export const START_RADIUS = 1;
export const MAX_BOMBS = 8;
export const MAX_RADIUS = 10;
export const KICK_SPEED = 9;                  // tiles / second
export const THROW_DISTANCE = 3;              // tiles
export const THROW_TIME = sec(0.45);
export const BOUNCE_TIME = sec(0.2);          // each extra hop when landing tile is blocked
export const PUNCH_DISTANCE = 3;
export const STUN_TIME = sec(1.2);            // a bomb landing on a head
export const CRAZY_FUSE_MIN = sec(0.6);
export const CRAZY_FUSE_MAX = sec(5);
export const CRAZY_RADIUS_MULT = 3;
export const CRAZY_DUD_CHANCE = 0.1;

// --- timed effects
export const SHIELD_TIME = sec(30);
export const CRAZY_TIME = sec(25);
export const FIRE_TIME = sec(15);
export const GHOST_TIME = sec(15);
export const CURSE_TIME = sec(15);
export const SPAWN_INVULNERABLE = sec(2);
export const RESPAWN_DELAY = sec(1.5);        // when the player has an extra life

// --- round flow
export const COUNTDOWN_TIME = sec(3);
export const ROUND_TIME = sec(150);           // sudden death starts after this
export const SUDDEN_DEATH_INTERVAL = sec(0.25); // one falling block per interval
export const ROUND_OVER_TIME = sec(4);
export const MAX_PLAYERS = 16;

// --- map generation
export const BRICK_FILL = 0.65;
export const PICKUP_FILL = 0.3;
