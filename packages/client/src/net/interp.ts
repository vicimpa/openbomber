// Snapshot interpolation for remote players, timed by the server tick.
//
// Timing, in three parts:
//  - ServerClock: the server tick "now", from the LEAST delayed snapshots of the last couple of
//    seconds (a late or bursty packet never drags it), plus how late each snapshot came.
//  - JitterBuffer: how far behind "now" remote things are drawn: enough to cover the recent
//    lateness of most snapshots (a jitter buffer), small on a steady connection, larger behind
//    a jittery proxy (Discord), within bounds.
//  - Playout: the render tick itself. It runs with the wall clock and is gently sped up or
//    slowed down (a few %) to follow the target delay, so a change of delay never shows as a
//    jump or a freeze.

import { TICK_RATE, type PlayerState } from '@ob/game';

/** Max extrapolation past the newest snapshot before holding still (~200 ms). */
export const MAX_EXTRAPOLATE_TICKS = 12;
/** A jump larger than this between snapshots is a teleport (respawn / new round): no lerp. */
export const TELEPORT_DIST = 1.5;
const CAP = 32;

/** Bounds of the remote render delay, in ticks behind the estimated server tick. */
export const MIN_DELAY_TICKS = 4;
export const MAX_DELAY_TICKS = 24;
/** Snapshots arrive every 2 ticks (PATCH_RATE 30), sometimes 3 apart: the next one must be in. */
const PATCH_GAP_TICKS = 3;
/** Share of snapshots that should arrive in time (the rest is bridged by extrapolation). */
const JITTER_QUANTILE = 0.9;
const JITTER_WINDOW = 150;        // snapshots (~5 s)
const CLOCK_WINDOW_MS = 2500;
/** Playout speed may deviate from real time by at most this much to follow the target delay. */
const MAX_STRETCH = 0.1;
/** Stretch per tick of delay error (so ~1 s to settle a 3-tick change). */
const STRETCH_GAIN = 0.035;
/** Farther than this from the target (ticks): reset instead of stretching (join, tab sleep). */
const RESYNC_TICKS = 40;
/** Playout speed while past the newest snapshot (packets late): remote things slow down a bit
 *  instead of running far ahead on a guess; the lost time is made up by the stretch later. */
const UNDERRUN_RATE = 0.7;

/** Estimates the current server tick from snapshot arrival times. */
export class ServerClock {
  /** Monotonic deque (decreasing samples) of the window: the front is the window's maximum. */
  private readonly ts: number[] = [];
  private readonly vs: number[] = [];
  private offset = NaN;   // server tick - local tick, from the least delayed recent snapshot

  /** Records a snapshot; returns how late it came in ticks (0 = as fast as the best recent one). */
  onSnapshot(tick: number, nowMs: number): number {
    const sample = tick - (nowMs * TICK_RATE) / 1000;
    const ts = this.ts, vs = this.vs;
    if (!Number.isNaN(this.offset) && Math.abs(sample - this.offset) > TICK_RATE * 2) { ts.length = 0; vs.length = 0; } // server restarted
    while (vs.length && vs[vs.length - 1]! <= sample) { vs.pop(); ts.pop(); }
    vs.push(sample); ts.push(nowMs);
    while (ts.length > 1 && nowMs - ts[0]! > CLOCK_WINDOW_MS) { ts.shift(); vs.shift(); }
    this.offset = vs[0]!;
    return this.offset - sample;
  }

  get ready(): boolean {
    return !Number.isNaN(this.offset);
  }

  /** Estimated current server tick (fractional). */
  now(nowMs: number): number {
    if (Number.isNaN(this.offset)) return 0;
    return (nowMs * TICK_RATE) / 1000 + this.offset;
  }

  reset() {
    this.offset = NaN;
    this.ts.length = 0;
    this.vs.length = 0;
  }
}

/** Recent snapshot lateness -> how far behind the server remote things should be drawn. */
export class JitterBuffer {
  private readonly late = new Float64Array(JITTER_WINDOW);
  private readonly sorted = new Float64Array(JITTER_WINDOW);
  private n = 0;
  private i = 0;
  /** Current target delay, ticks. */
  delay = MIN_DELAY_TICKS + 2;

  add(lateTicks: number) {
    this.late[this.i] = Math.max(0, lateTicks);
    this.i = (this.i + 1) % JITTER_WINDOW;
    if (this.n < JITTER_WINDOW) this.n++;
    const s = this.sorted.subarray(0, this.n);
    s.set(this.late.subarray(0, this.n));
    s.sort();
    const q = s[Math.min(this.n - 1, Math.floor(this.n * JITTER_QUANTILE))]!;
    this.delay = Math.min(MAX_DELAY_TICKS, Math.max(MIN_DELAY_TICKS, PATCH_GAP_TICKS + q));
  }

  reset() {
    this.n = 0;
    this.i = 0;
    this.delay = MIN_DELAY_TICKS + 2;
  }
}

/** The render tick for remote things: real time, stretched a little to follow the target delay. */
export class Playout {
  tick = NaN;

  /** `newest`: tick of the newest snapshot received. */
  advance(serverNow: number, delay: number, dtMs: number, newest: number): number {
    const want = serverNow - delay;
    if (Number.isNaN(this.tick) || Math.abs(want - this.tick) > RESYNC_TICKS) {
      this.tick = want;
      return this.tick;
    }
    const err = want - this.tick;   // > 0: drawn too far behind, play a bit faster
    let rate = 1 + Math.max(-MAX_STRETCH, Math.min(MAX_STRETCH, err * STRETCH_GAIN));
    if (this.tick > newest) rate = Math.min(rate, UNDERRUN_RATE);
    this.tick += (Math.max(0, dtMs) * TICK_RATE / 1000) * rate;
    return this.tick;
  }

  reset() {
    this.tick = NaN;
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

  /** Tick of the newest snapshot (-Infinity when empty). */
  get newestTick(): number {
    return this.n === 0 ? -Infinity : this.ticks[this.head]!;
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

/** Ring buffer of one bomb's recent positions (x, y, flight progress), same timing as Track. */
export class BombTrack {
  private readonly ticks = new Float64Array(CAP);
  private readonly xs = new Float64Array(CAP);
  private readonly ys = new Float64Array(CAP);
  private readonly ps = new Float64Array(CAP);
  private n = 0;
  private head = 0;

  push(tick: number, x: number, y: number, progress: number) {
    if (this.n > 0) {
      const last = this.ticks[this.head]!;
      if (tick < last) this.n = 0;
      else if (tick === last) { this.xs[this.head] = x; this.ys[this.head] = y; this.ps[this.head] = progress; return; }
    }
    this.head = (this.head + 1) % CAP;
    this.ticks[this.head] = tick; this.xs[this.head] = x; this.ys[this.head] = y; this.ps[this.head] = progress;
    if (this.n < CAP) this.n++;
  }

  /** Interpolated position at `renderTick` (holds the ends, no extrapolation; wraps snap). */
  sample(renderTick: number, out: { x: number; y: number; progress: number }) {
    if (this.n === 0) return;
    let b = this.head;
    if (renderTick >= this.ticks[b]!) { out.x = this.xs[b]!; out.y = this.ys[b]!; out.progress = this.ps[b]!; return; }
    for (let k = 1; k < this.n; k++) {
      const a = (this.head - k + CAP) % CAP;
      const ta = this.ticks[a]!;
      if (ta > renderTick) { b = a; continue; }
      const tb = this.ticks[b]!;
      const f = tb > ta ? (renderTick - ta) / (tb - ta) : 1;
      const ax = this.xs[a]!, ay = this.ys[a]!, bx = this.xs[b]!, by = this.ys[b]!;
      if (Math.hypot(bx - ax, by - ay) > TELEPORT_DIST || this.ps[b]! < this.ps[a]!) {
        out.x = ax; out.y = ay; out.progress = this.ps[a]!;   // wrap-around throw / new flight
      } else {
        out.x = ax + (bx - ax) * f; out.y = ay + (by - ay) * f;
        out.progress = this.ps[a]! + (this.ps[b]! - this.ps[a]!) * f;
      }
      return;
    }
    out.x = this.xs[b]!; out.y = this.ys[b]!; out.progress = this.ps[b]!;
  }
}
