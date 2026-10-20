# SIM: contract changes

## v2 canon realignment (see "## КАНОН" in REWRITE_PLAN.md)

All existing field names are kept. The additions below are required fields, so any code that builds
`TimedEffects` / `WorldState` literals needs the new keys. As of this change that is only
`packages/client/src/audio/dev.ts`; the sim's `emptyEffects()` helper builds a complete effects object.

**types.ts**
- `TimedEffects` gains `speed`, `kick`, `glove`, `punch`, `remote`, `pierce`, `lineBomb` and `bombPass` (ticks left).
  `PlayerState.abilities` is derived from these timers every tick, so a bit is set exactly while its timer runs.
- `PlayerState.speedLevel` is now 1 while SpeedUp runs, otherwise 0. Speed no longer stacks in levels.
- `WorldState` gains `zoneRing` (rings already closed) and `zoneIn` (ticks until the next ring closes; 0 means
  nothing is pending).
- Phase meanings changed (the values did not):
  - `Waiting`: there are no players at all.
  - `Countdown`: a short 1.5 s freeze at round start.
  - `SuddenDeath`: the first ring of the zone has closed.
  - `RoundOver`: the round is decided; it restarts when `phaseTicks` reaches 0.

**protocol.ts**
- New events:
  - `{ type: 'zoneWarning'; seconds }`: "the map shrinks in N s".
  - `{ type: 'zoneCancel' }`: fewer than 2 players are left.
  - `{ type: 'zoneShrink'; ring }`: a ring closes now; its blocks fall as `FallingBlock`s over `FALL_TIME`.
- `suddenDeath` is now emitted once, when the first ring closes.
- `effectEnded.effect` is now the new type `EffectName`. It adds `speed`, `kick`, `glove`, `punch`, `remote`,
  `pierce`, `lineBomb` and `bombPass` to the old values.

**api.ts**
- `MatchConfig.minPlayers` is now optional and ignored, because rounds are continuous.

**constants.ts** (canon values)
- Changed values:
  - `MAX_PLAYERS` 32, `BASE_SPEED` 3
  - `BOMB_FUSE` 2 s, `CRAZY_FUSE_MIN` 0.5 s, `CRAZY_RADIUS_MULT` 5
  - `SHIELD_TIME` 50 s, `CRAZY_TIME` 30 s, `FIRE_TIME` 25 s, `GHOST_TIME` 30 s
  - `COUNTDOWN_TIME` 1.5 s, `ROUND_OVER_TIME` 5 s
  - `BRICK_FILL` 0.5, `PICKUP_FILL` 0.12
- New constants:
  - Speed: `SPEED_MULT` 1.5, `FIRE_SPEED_MULT` 0.7, `SPEED_TIME` 25 s.
  - Ability timers: `KICK_TIME` 35 s, `GLOVE_TIME` 35 s, `PUNCH_TIME` 35 s, `LINE_BOMB_TIME` 35 s, `REMOTE_TIME` 30 s,
    `PIERCE_TIME` 30 s, `BOMB_PASS_TIME` 30 s.
  - Rounds and zone: `SOLO_RESTART_TIME` 1 s, `WAIT_FOR_LIMIT` 15 s, `ZONE_LIMIT_TIMEOUT` 15 s, `FALL_TIME` 1 s.
  - Map: `MAP_PADDING` 6, `MAP_MARGIN` 8.
- Deprecated but kept so existing imports compile: `ROUND_TIME`, `SUDDEN_DEATH_INTERVAL`, `SPEED_STEP` and
  `MAX_SPEED_LEVEL` (now 1).

## How the sim fills the fields (for NET / RENDER / AUDIO / UI)

**Rounds** (legacy server Game.ts)
- A round runs whenever at least one player exists.
- Players added mid-round are spectators (`inRound = false`, `alive = false`) until the next restart.
- The round is decided once no bombs or flames are left and either:
  - at most one player is alive (zero when the player is alone), or
  - a contest that started with 2+ players is down to one survivor.
- With 2+ players the survivor gets `wins++` and appears in `roundOver.winner`. A practice round has no winner.
- Practice (1 player) also ends when no bricks and no pickups are left.
- Restart happens after `ROUND_OVER_TIME`, or `SOLO_RESTART_TIME` in practice. The map is regenerated for the
  current player count.
- New bombs can't be placed once a multiplayer round is down to fewer than 2 alive players.
- Deaths count only when 2+ players are present. Kills always count.

**Map** (legacy calcMap): 1 → 13×13, 2 → 19×13, 3–4 → 19×19, 9 → 33×33, 16 → 47×47, 32 → 75×75.
Spawns sit on the 14-tile grid, so there may be more spawns than players. Each spawn has a free plus shape of
radius 2 around it.

**Zone** (legacy limitMap)
- With 2+ players, `zoneWarning` fires `WAIT_FOR_LIMIT` after round start or after the last shrink.
- `ZONE_LIMIT_TIMEOUT` later the next outer ring closes: `zoneShrink` fires, the ring's blocks fall within
  `FALL_TIME` + 0.5 s as a sweep, and each landing block kills players, bombs and pickups on its tile.
- Rings keep closing while `zoneRing + 1 < min(w, h) / 2`.

**Pickups** (canon)
- BombUp and FireUp last the whole round.
- SpeedUp and Fire cancel each other's time (legacy SpeedEffect).
- Every other timed effect stacks its time.
- When Remote runs out, that player's waiting bombs get a normal fuse.

**Kill credit** (legacy): whoever last kicked, threw or punched a bomb, or set it off in a chain, gets its kills.
The `explosion.owner` field and `FlameState.owner` carry that player.

**Unchanged from before**
- Remote bomb `fuse` is negative and counts up toward 0.
- Flights may leave the map before they wrap.
- Overlapping flames merge their shape (crossing flames become `Center`).
- `predictMovement` never mutates the world.
