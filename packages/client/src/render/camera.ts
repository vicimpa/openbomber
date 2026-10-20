// Camera: a frame-rate independent port of new-openbomber core/Viewport.ts.
//  - `center` is followed with exponential smoothing (prototype: += delta * 0.05 per 60 Hz frame)
//  - zoom comes from a `radius` (world px visible on the short side): needScale = min(side) / radius,
//    smoothed the same way (0.04 per frame); death / spectating sets a big radius (zoom out to the
//    arena), spawning sets a small one (zoom in)
//  - shake: amplitude falls off with the squared distance to the centre, parabolic envelope,
//    averaged over the last 3 frames (vec2filter(3))
// Additions for v2: the view is clamped to the arena, the resting zoom snaps to pixel-friendly
// values, and an "attract" mode drifts between interesting points for the main menu.
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
  /** smoothed state (world px / device px per world px) */
  x = 0; y = 0; zoom = 1;
  /** targets */
  private cx = 0; private cy = 0;
  private shakes = new Set<{ time: number; amp: number }>();
  private filter: [number, number][] = [];
  private snap = true;
  sx = 0; sy = 0; // shake offset, device px
  private attract = { x: 0, y: 0, t: 0, phase: Math.random() * 10 };

  reset() { this.snap = true; }

  /** Tiles visible on the short side while following (new-openbomber: radius 256 px = 8 tiles). */
  static tilesFor(shortCss: number) {
    return Math.max(8, Math.min(10, 8 + (shortCss - 420) / 250));
  }

  update(dt: number, v: CameraView, inp: CameraInput) {
    const W = v.cssW * v.res, H = v.cssH * v.res;
    if (W <= 0 || H <= 0) return;
    const { aw, ah } = inp;
    const arenaX = ((aw - 1) / 2) * T, arenaY = ((ah - 1) / 2) * T;
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
        a.x = p.x * T; a.y = p.y * T; a.t = 4 + Math.random() * 3;
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
      this.cx = inp.focus.x * T; this.cy = inp.focus.y * T;
      needScale = Math.min(W, H) / followRadius;
    } else if (inp.action) {
      // spectating like the old game: keep every live hero (and fresh deaths) in frame,
      // zoomed between "the whole arena" and a 10-tile close-up
      const a = inp.action;
      this.cx = ((a.x0 + a.x1) / 2) * T; this.cy = ((a.y0 + a.y1) / 2) * T;
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
    const minX = -1.8 * T + halfW, maxX = (aw + 0.8) * T - halfW;
    const minY = -1.8 * T + halfH, maxY = (ah + 0.8) * T - halfH;
    if (!follow) {
      this.cx = minX > maxX ? arenaX : Math.min(maxX, Math.max(minX, this.cx));
      this.cy = minY > maxY ? arenaY : Math.min(maxY, Math.max(minY, this.cy));
    }

    if (this.snap) {
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
    let ox = 0, oy = 0;
    for (const s of this.shakes) {
      s.time += dt * 60 * 0.3 * 0.5;
      if (s.time > 1) { this.shakes.delete(s); continue; }
      const env = 1 - ((s.time - 0.5) * 2) ** 2;
      const a = Math.random() * Math.PI * 2;
      ox += Math.cos(a) * s.amp * env; oy += Math.sin(a) * s.amp * env;
    }
    this.filter.push([ox, oy]);
    while (this.filter.length > 3) this.filter.shift();
    let fx = 0, fy = 0;
    for (const [a, b] of this.filter) { fx += a; fy += b; }
    this.sx = (fx / this.filter.length) * this.zoom;
    this.sy = (fy / this.filter.length) * this.zoom;
  }

  /** Prototype shake: amp = 256 / max(dist, 24)^2 * 128 (world px), scaled by `power`. */
  shakeAt(x: number, y: number, power = 1) {
    const d = Math.hypot(x * T - this.x, y * T - this.y);
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
    const px = Math.round(W / 2 - this.x * z + this.sx);
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
