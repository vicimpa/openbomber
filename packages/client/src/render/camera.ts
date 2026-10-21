// Camera: a frame-rate independent port of new-openbomber core/Viewport.ts.
//  - `center` is followed with exponential smoothing (prototype: += delta * 0.05 per 60 Hz frame)
//  - zoom comes from a `radius` (world px visible on the short side): needScale = min(side) / radius,
//    smoothed the same way (0.04 per frame); death / spectating sets a big radius (zoom out to the
//    arena), spawning sets a small one (zoom in)
//  - shake: amplitude falls off with the squared distance to the centre, parabolic envelope,
//    averaged over the last 3 frames (vec2filter(3))
// Additions for v2: the view is clamped to the arena, the resting zoom snaps to pixel-friendly
// values, and an "attract" mode drifts between interesting points for the main menu.
// Every map sits at its own world origin (`ox`, `oy`, world px); inputs stay in map tiles. A new
// map can be reached with `travel()`: a smooth zoom-out / pan / zoom-in (van Wijk & Nuij) over the
// world between the old view and the new target.
import type { Container } from 'pixi.js';

const T = 32;

export type CameraMode = 'follow' | 'overview' | 'attract';
export interface CameraView { cssW: number; cssH: number; res: number }
export interface CameraInput {
  aw: number; ah: number;                 // arena size in tiles
  focus: { x: number; y: number } | null; // local player (tiles) when it should be followed
  tight: boolean;                         // countdown / just spawned: zoom in a bit more
  interest: { x: number; y: number }[];   // attract mode candidates (tiles)
  /** Overview: bounding box (tiles) of the action — live heroes + fresh death spots; null = whole arena. */
  action: { x0: number; y0: number; x1: number; y1: number } | null;
}

/** Legacy FocusCamera: action box padding and the closest overview zoom (tiles on the short side). */
const ACTION_PAD = 8;
const ACTION_MIN_TILES = 10;

/** Per-60Hz-frame lerp factor `f` turned into a frame-rate independent one for `dt` seconds. */
const lerpK = (f: number, dt: number) => 1 - Math.pow(1 - f, dt * 60);

export class Camera {
  mode: CameraMode = 'follow';
  /** smoothed state (world px incl. the map origin / device px per world px) */
  x = 0; y = 0; zoom = 1;
  /** World px of the current map's (0, 0) tile centre. */
  ox = 0; oy = 0;
  private trip: { t: number; dur: number; x: number; y: number; w: number; flat: boolean } | null = null;
  /** targets */
  private cx = 0; private cy = 0;
  private shakes = new Set<{ time: number; amp: number }>();
  private filter: [number, number][] = [];
  private snap = true;
  sx = 0; sy = 0; // shake offset, device px
  private attract = { x: 0, y: 0, t: 0, phase: Math.random() * 10 };

  /** Screen space (css px) covered by UI on the left, e.g. the main menu panel: framing
   *  happens in the free part of the screen. */
  insetLeft = 0;
  private inset = 0; // smoothed, device px

  reset() { this.snap = true; this.trip = null; }

  /** Glide from the current view to the next target over `dur` seconds instead of snapping. */
  travel(dur: number, flat = false) {
    this.snap = false;
    this.trip = { t: 0, dur, x: this.x, y: this.y, w: 0, flat };
    this.attract.t = 0;
  }

  get travelling() { return this.trip !== null; }
  /** Seconds until the current travel ends (0 when not travelling). */
  get travelLeft() { return this.trip ? Math.max(0, this.trip.dur - this.trip.t) : 0; }

  /** Tiles visible on the short side while following (new-openbomber: radius 256 px = 8 tiles). */
  static tilesFor(shortCss: number) {
    return Math.max(8, Math.min(10, 8 + (shortCss - 420) / 250));
  }

  update(dt: number, v: CameraView, inp: CameraInput) {
    const H = v.cssH * v.res;
    const targetInset = this.mode === 'follow' && inp.focus ? 0 : Math.min(this.insetLeft, v.cssW * 0.6) * v.res;
    this.inset += (targetInset - this.inset) * lerpK(0.08, dt);
    const W = v.cssW * v.res - this.inset;
    if (W <= 0 || H <= 0) return;
    const { aw, ah } = inp;
    const ox = this.ox, oy = this.oy;
    const arenaX = ox + ((aw - 1) / 2) * T, arenaY = oy + ((ah - 1) / 2) * T;
    // whole arena incl. border walls + a small margin
    const fitScale = Math.min(W / ((aw + 2.6) * T), H / ((ah + 2.6) * T));
    const followRadius = Camera.tilesFor(Math.min(v.cssW, v.cssH)) * T * (inp.tight ? 0.85 : 1);
    let needScale: number;
    let posK = 0.05, zoomK = 0.04;

    if (this.mode === 'attract') {
      const a = this.attract;
      a.t -= dt; a.phase += dt;
      if (a.t <= 0 || this.snap) {
        const pts = inp.interest;
        const p = pts.length ? pts[Math.floor(Math.random() * pts.length)] : { x: (aw - 1) / 2, y: (ah - 1) / 2 };
        a.x = ox + p.x * T; a.y = oy + p.y * T; a.t = 4 + Math.random() * 3;
      }
      this.cx = a.x + Math.cos(a.phase * 0.35) * T * 1.5;
      this.cy = a.y + Math.sin(a.phase * 0.27) * T;
      // gentle breathing zoom between "close follow" and "most of the arena"
      const close = Math.min(W, H) / (followRadius * 1.15);
      const k = (Math.sin(a.phase * 0.2) + 1) / 2;
      needScale = Math.max(fitScale, close + (fitScale - close) * k * 0.7);
      posK = 0.012; zoomK = 0.01;
    } else if (this.mode === 'follow' && inp.focus) {
      // like the prototype: a tight view around the hero, the world outside the arena included
      this.cx = ox + inp.focus.x * T; this.cy = oy + inp.focus.y * T;
      needScale = Math.min(W, H) / followRadius;
    } else if (inp.action) {
      // spectating like the old game: keep every live hero (and fresh deaths) in frame,
      // zoomed between "the whole arena" and a 10-tile close-up
      const a = inp.action;
      this.cx = ox + ((a.x0 + a.x1) / 2) * T; this.cy = oy + ((a.y0 + a.y1) / 2) * T;
      const fitAction = Math.min(W / ((a.x1 - a.x0 + ACTION_PAD) * T), H / ((a.y1 - a.y0 + ACTION_PAD) * T));
      needScale = Math.min(Math.min(W, H) / (ACTION_MIN_TILES * T), Math.max(fitScale, fitAction));
    } else {
      this.cx = arenaX; this.cy = arenaY;
      needScale = fitScale;
    }
    needScale = quantize(needScale, needScale === fitScale ? Math.floor : Math.round);

    // clamp the centre target so the view never wanders far beyond the arena (overview / attract;
    // following keeps the hero centred like the prototype did)
    const follow = this.mode === 'follow' && !!inp.focus;
    const halfW = W / needScale / 2, halfH = H / needScale / 2;
    const minX = ox - 1.8 * T + halfW, maxX = ox + (aw + 0.8) * T - halfW;
    const minY = oy - 1.8 * T + halfH, maxY = oy + (ah + 0.8) * T - halfH;
    if (!follow) {
      this.cx = minX > maxX ? arenaX : Math.min(maxX, Math.max(minX, this.cx));
      this.cy = minY > maxY ? arenaY : Math.min(maxY, Math.max(minY, this.cy));
    }

    if (this.trip) {
      // travel: optimal zoom-and-pan path from where the view was to the live target
      const tr = this.trip;
      const S = Math.min(W, H);
      if (!tr.w) tr.w = S / this.zoom;
      tr.t += dt;
      const k = Math.min(1, tr.t / tr.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      // flat: a quick eased pan at the same zoom (teleport), otherwise the zoom-out trip between maps
      const [px, py, pw] = tr.flat
        ? [tr.x + (this.cx - tr.x) * e, tr.y + (this.cy - tr.y) * e, tr.w + (S / needScale - tr.w) * e]
        : zoomPath(tr.x, tr.y, tr.w, this.cx, this.cy, S / needScale, e);
      this.x = px; this.y = py; this.zoom = S / pw;
      if (k >= 1) { this.trip = null; this.x = this.cx; this.y = this.cy; this.zoom = needScale; }
    } else if (this.snap) {
      // first frame of a map: start zoomed out over the arena, then ease into the target
      this.snap = false;
      this.x = arenaX; this.y = arenaY; this.zoom = fitScale;
    } else {
      const kp = lerpK(posK, dt), kz = lerpK(zoomK, dt);
      this.x += (this.cx - this.x) * kp;
      this.y += (this.cy - this.y) * kp;
      this.zoom += (needScale - this.zoom) * kz;
      if (Math.abs(needScale - this.zoom) < 0.003) this.zoom = needScale;
    }

    // shake (prototype: time += deltaTime * .3, envelope 1 - ((t - .5) * 2)^2)
    let kx = 0, ky = 0;
    for (const s of this.shakes) {
      s.time += dt * 60 * 0.3 * 0.5;
      if (s.time > 1) { this.shakes.delete(s); continue; }
      const env = 1 - ((s.time - 0.5) * 2) ** 2;
      const a = Math.random() * Math.PI * 2;
      kx += Math.cos(a) * s.amp * env; ky += Math.sin(a) * s.amp * env;
    }
    this.filter.push([kx, ky]);
    while (this.filter.length > 3) this.filter.shift();
    let fx = 0, fy = 0;
    for (const [a, b] of this.filter) { fx += a; fy += b; }
    this.sx = (fx / this.filter.length) * this.zoom;
    this.sy = (fy / this.filter.length) * this.zoom;
  }

  /** Prototype shake: amp = 256 / max(dist, 24)^2 * 128 (world px), scaled by `power`. */
  shakeAt(x: number, y: number, power = 1) {
    const d = Math.hypot(this.ox + x * T - this.x, this.oy + y * T - this.y);
    const amp = (256 / Math.max(d, 24) ** 2) * 128 * 0.3 * power;
    if (amp < 0.25) return;
    this.shakes.add({ time: 0, amp: Math.min(amp, 18) });
  }

  /** Non-positional shake (sudden death start etc.). */
  shake(amp: number) { this.shakes.add({ time: 0, amp }); }

  apply(c: Container, v: CameraView) {
    const W = v.cssW * v.res, H = v.cssH * v.res;
    const z = this.zoom;
    // integer device-pixel translation keeps the pixel grid stable (roundPixels does the rest)
    const px = Math.round(this.inset + (W - this.inset) / 2 - this.x * z + this.sx);
    const py = Math.round(H / 2 - this.y * z + this.sy);
    c.scale.set(z / v.res);
    c.position.set(px / v.res, py / v.res);
  }
}

/** Snap zoom (device px per world px) to values that keep pixel art even. */
function quantize(z: number, round: (v: number) => number) {
  if (z >= 3) return round(z);
  if (z >= 1.5) return round(z * 2) / 2;
  if (z >= 1) return round(z * 4) / 4;
  return z;
}

/**
 * Smooth zoom + pan (van Wijk & Nuij 2003, as d3.interpolateZoom): from centre (x0, y0) seeing w0
 * world px to (x1, y1) seeing w1, at path parameter e in [0, 1]. Zooms out on long trips.
 */
export function zoomPath(x0: number, y0: number, w0: number, x1: number, y1: number, w1: number, e: number): [number, number, number] {
  const rho = 1.3, rho2 = rho * rho, rho4 = rho2 * rho2;
  const dx = x1 - x0, dy = y1 - y0, d2 = dx * dx + dy * dy;
  if (d2 < 1e-6) {
    const S = Math.log(w1 / w0) / rho;
    return [x0 + dx * e, y0 + dy * e, w0 * Math.exp(rho * e * S)];
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  const s = e * S, c0 = Math.cosh(r0);
  const u = (w0 / (rho2 * d1)) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
  return [x0 + u * dx, y0 + u * dy, (w0 * c0) / Math.cosh(rho * s + r0)];
}
