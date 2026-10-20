# SIM: contract changes

None. `packages/game/src/contract/*` is untouched.

## How the sim fills the existing fields (for NET / RENDER / AUDIO)

- `BombState.fuse` for Remote bombs is negative and counts up toward 0. `-fuse` is the number of ticks left before the
  `REMOTE_BOMB_MAX_FUSE` safety detonation.
- Flying bombs (`motion = Flying`) move linearly from `from` to `to`, and `progress` goes 0..1. The renderer adds the
  hop arc. On a throw past the edge, `toX`/`toY` lie outside the map during the flight, and the bomb wraps when it
  lands. `bombThrown`/`bombPunched` report the wrapped landing tile. Each bounce is a fresh 1-tile leg
  (`BOUNCE_TIME`) that starts with a `bombBounced` event.
- `phaseTicks`: Waiting counts up. Countdown and RoundOver count down. Playing counts up and keeps counting up
  through SuddenDeath, so SuddenDeath starts at `ROUND_TIME`.
- The `countdown` event fires with 3, 2 and 1. The new map is generated when Countdown starts, and `roundStart`
  fires when Playing begins.
- Sudden death adds one `FallingBlock` per `SUDDEN_DEATH_INTERVAL` with `ttl = FALL_WARNING` (1 s, exported).
- `FlameState.shape` keeps the merged shape when flames overlap: crossing flames become `Center`. The per-explosion
  `cells` in the `explosion` event carry that explosion's own shapes.
- Spectators (players who join mid-round) have `alive = false`, `inRound = false` and sit at (0, 0).
- While Waiting, death respawns after 0.5 s. Kills and deaths are only counted in Playing and SuddenDeath.
- `predictMovement` never mutates the world, so it does not release `passers`; the sim does that after movement.
  Kicks are server-only. Walking into a bomb is a plain circle push in both the sim and the prediction, so it does
  not jitter.
