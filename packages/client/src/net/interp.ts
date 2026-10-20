// Snapshot interpolation for remote players, timed by the server tick.

import { TICK_RATE, type PlayerState } from '@ob/game';

/** Remote players are drawn this many ticks behind the estimated server time (~100 ms). */
export const INTERP_DELAY_TICKS = 6;
/** Max extrapolation past the newest snapshot before freezing (~100 ms). */
export const MAX_EXTRAPOLATE_TICKS = 6;
/** A jump larger than this between snapshots is a teleport (respawn / new round): no lerp. */
const TELEPORT_DIST = 1.5;
const CAP = 32;

/** Estimates the current server tick from snapshot arrival times. */
export class ServerClock {
  private offset = NaN;   // server tick - local tick
  private shown = 0;

  onSnapshot(tick: number, nowMs: number) {
    const sample = tick - (nowMs * TICK_RATE) / 1000;
    if (Number.isNaN(this.offset) || Math.abs(sample - this.offset) > TICK_RATE / 2) {
      this.offset = sample;
    } else if (sample > this.offset) {
      this.offset += (sample - this.offset) * 0.25;   // early packet: latency dropped, follow fast
    } else {
      this.offset += (sample - this.offset) * 0.02;   // late packet: probably jitter, follow slowly
    }
  }

  /** Estimated current server tick (fractional, monotonic). */
  now(nowMs: number): number {
    if (Number.isNaN(this.offset)) return 0;
    const t = (nowMs * TICK_RATE) / 1000 + this.offset;
    if (t > this.shown) this.shown = t;
    return this.shown;
  }

  reset() {
    this.offset = NaN;
    this.shown = 0;
  }
}

/** Ring buffer of one remote player's recent authoritative positions. */
export class Track {
  private readonly ticks = new Float64Array(CAP);
  private readonly xs = new Float64Array(CAP);
  private readonly ys = new Float64Array(CAP);
  private readonly dirs = new Uint8Array(CAP);
  private readonly moving = new Uint8Array(CAP);
  private n = 0;
  private head = 0; // index of the newest sample

  push(tick: number, x: number, y: number, dir: number, moving: boolean) {
    if (this.n > 0) {
      const last = this.ticks[this.head]!;
      if (tick < last) { this.n = 0; }            // server restarted the clock: reset
      else if (tick === last) { this.write(this.head, tick, x, y, dir, moving); return; }
    }
    this.head = (this.head + 1) % CAP;
    this.write(this.head, tick, x, y, dir, moving);
    if (this.n < CAP) this.n++;
  }

  private write(i: number, tick: number, x: number, y: number, dir: number, moving: boolean) {
    this.ticks[i] = tick; this.xs[i] = x; this.ys[i] = y; this.dirs[i] = dir; this.moving[i] = moving ? 1 : 0;
  }

  private idx(k: number) { // k = 0 newest, 1 previous, ...
    return (this.head - k + CAP) % CAP;
  }

  /** Writes the interpolated x/y/dir/moving at `renderTick` into `out`. */
  sample(renderTick: number, out: PlayerState) {
    if (this.n === 0) return;
    const newest = this.idx(0);
    const tNew = this.ticks[newest]!;

    if (renderTick >= tNew) {
      // Ahead of the newest snapshot: extrapolate briefly along the last velocity.
      out.x = this.xs[newest]!; out.y = this.ys[newest]!;
      out.dir = this.dirs[newest]!; out.moving = this.moving[newest] === 1;
      if (this.n >= 2 && out.moving) {
        const prev = this.idx(1);
        const dt = tNew - this.ticks[prev]!;
        const dx = this.xs[newest]! - this.xs[prev]!, dy = this.ys[newest]! - this.ys[prev]!;
        if (dt > 0 && Math.hypot(dx, dy) < TELEPORT_DIST) {
          const e = Math.min(renderTick - tNew, MAX_EXTRAPOLATE_TICKS) / dt;
          out.x += dx * e; out.y += dy * e;
        }
      }
      return;
    }

    for (let k = 1; k < this.n; k++) {
      const a = this.idx(k);
      const ta = this.ticks[a]!;
      if (ta > renderTick) continue;
      const b = this.idx(k - 1);
      const tb = this.ticks[b]!;
      const ax = this.xs[a]!, ay = this.ys[a]!, bx = this.xs[b]!, by = this.ys[b]!;
      if (Math.hypot(bx - ax, by - ay) > TELEPORT_DIST) {
        out.x = ax; out.y = ay; out.dir = this.dirs[a]!; out.moving = this.moving[a] === 1;
        return;
      }
      const f = tb > ta ? (renderTick - ta) / (tb - ta) : 1;
      out.x = ax + (bx - ax) * f;
      out.y = ay + (by - ay) * f;
      const near = f < 0.5 ? a : b;
      out.dir = this.dirs[near]!; out.moving = this.moving[near] === 1;
      return;
    }
    // Older than everything buffered: hold the oldest sample.
    const oldest = this.idx(this.n - 1);
    out.x = this.xs[oldest]!; out.y = this.ys[oldest]!;
    out.dir = this.dirs[oldest]!; out.moving = this.moving[oldest] === 1;
  }
}
