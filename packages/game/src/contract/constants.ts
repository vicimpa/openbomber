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
export const BASE_SPEED = 3;                 // tiles / second (legacy calcSpeed: 0.003 tiles/ms)
export const SPEED_MULT = 1.5;               // SpeedUp active (legacy SpeedEffect 1.5)
export const FIRE_SPEED_MULT = 0.7;          // Fire / "-speed" active (legacy SpeedEffect 0.7)
/** @deprecated speed is timed now (effects.speed); speedLevel is 1 while it runs. */
export const SPEED_STEP = 0.35;
/** @deprecated see SPEED_STEP */
export const MAX_SPEED_LEVEL = 1;
export const INPUT_DEADZONE = 0.3;

// --- bombs & flames
export const BOMB_FUSE = sec(2);
export const REMOTE_BOMB_MAX_FUSE = sec(12);  // remote bombs auto-explode eventually
export const FLAME_TIME = sec(0.35);            // lethal window == the visible fire (smoke after it is harmless)
export const CHAIN_DELAY = sec(0.15);         // a chained bomb goes off this long after the blast that hit it (a visible ripple)
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
export const CRAZY_FUSE_MIN = sec(0.5);
export const CRAZY_FUSE_MAX = sec(5);
export const CRAZY_RADIUS_MULT = 5;
export const CRAZY_DUD_CHANCE = 0.1;

// --- timed effects (canon: README + legacy/shared/config.ts). Picking the same one again adds its time.
export const SHIELD_TIME = sec(50);
export const SPEED_TIME = sec(25);            // cancels / is cancelled by Fire time
export const CRAZY_TIME = sec(30);
export const FIRE_TIME = sec(25);             // slow + touching you kills
export const KICK_TIME = sec(35);
export const GLOVE_TIME = sec(35);
export const PUNCH_TIME = sec(35);
export const REMOTE_TIME = sec(30);
export const PIERCE_TIME = sec(30);
export const LINE_BOMB_TIME = sec(35);
export const BOMB_PASS_TIME = sec(30);
export const GHOST_TIME = sec(30);
export const CURSE_TIME = sec(15);
export const SPAWN_INVULNERABLE = sec(2);
export const RESPAWN_DELAY = sec(1.5);        // when the player has an extra life

// --- round flow (canon: continuous rounds, no lobby)
export const COUNTDOWN_TIME = sec(1.5);       // short "get ready" freeze at round start
export const ROUND_OVER_TIME = sec(5);        // restart delay once the round is decided
export const SOLO_RESTART_TIME = sec(1);      // practice mode (1 player) restarts quickly
export const WAIT_FOR_LIMIT = sec(15);        // zone: quiet time after round start / last shrink
export const ZONE_LIMIT_TIMEOUT = sec(15);    // zone: warning -> the outer ring closes
export const FALL_TIME = sec(1);              // falling-block shadow before a closing ring lands
// --- overtime: when a round drags on, things start falling from the sky
/** The rain starts once this share of the round's bricks is destroyed... */
export const OVERTIME_DESTROYED = 0.75;
/** ...but not before this far into the round, and at the latest this far in (few bricks broken). */
export const OVERTIME_MIN_TIME = sec(60);
export const OVERTIME_MAX_TIME = sec(150);
export const OVERTIME_EVERY = sec(18);        // then another one this often (pickups and bombs alternate)
export const DROP_FALL_TIME = sec(1.2);       // the shadow grows this long before a drop lands
export const SKY_BOMB_FUSE = sec(1.6);        // a landed sky bomb goes off after this
export const SKY_BOMB_RADIUS = 2;
/** Endgame: once the open middle is this narrow, rings close quickly until nothing is left. */
export const ZONE_FINAL_WIDTH = 5;
export const ZONE_FINAL_QUIET = sec(3);
export const ZONE_FINAL_TIMEOUT = sec(5);
/** @deprecated no timed rounds any more (zone shrink instead). */
export const ROUND_TIME = sec(150);
/** @deprecated see ROUND_TIME */
export const SUDDEN_DEATH_INTERVAL = sec(0.25);
export const MAX_PLAYERS = 32;

// --- map generation (legacy calcMap / GameMap)
export const MAP_PADDING = 6;
export const MAP_MARGIN = 8;
export const BRICK_FILL = 0.5;               // share of free tiles
export const PICKUP_FILL = 0.25;             // share of bricks hiding a pickup (canon 10-15%, v2 drops more)

/** Teleport pickup: charges per pickup and the most a player can hold. */
export const TELEPORT_CHARGES = 2;
export const MAX_TELEPORTS = 5;
