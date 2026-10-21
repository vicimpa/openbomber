// Pooled particles and short-lived one-shot effects. Units: world pixels, seconds.
import { BitmapText, Container, Rectangle, Sprite, Texture } from 'pixi.js';

import type { GameAssets } from './assets';
import type { ProcTextures } from './textures';
import { FONT_TAG } from './text';
import { LETHAL } from './explosions';
import type { SmokeWeather } from './weather';

export const T = 32;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;

/** Bounce easing from new-openbomber (library/math.ts). */
export function bounce(v: number) {
  const n1 = 7.5625, d1 = 2.75;
  v *= d1 / 2; v += -1 / d1;
  if (v < 1 / d1) return n1 * v * v;
  if (v < 2 / d1) return n1 * (v -= 1.5 / d1) * v + 0.75;
  if (v < 2.5 / d1) return n1 * (v -= 2.25 / d1) * v + 0.9375;
  return n1 * (v -= 2.625 / d1) * v + 0.984375;
}

export interface ParticleOpts {
  tex: Texture;
  x: number; y: number; z?: number;
  vx?: number; vy?: number; vz?: number;
  gravity?: number;          // px/s^2 pulling z down
  drag?: number;             // velocity damping per second (0..)
  life: number;              // seconds
  scale?: number; scaleEnd?: number;
  alpha?: number; alphaEnd?: number;
  rot?: number; spin?: number;
  tint?: number;
  add?: boolean;             // additive layer
  bounce?: number;           // restitution when hitting z=0 (0 = stop)
  delay?: number;
  scaleY?: number;           // y/x ratio
  bounces?: number;          // how many times it may bounce before it stays on the ground (default: unlimited)
  hold?: number;             // alpha stays at `alpha` until this share of the life, then fades to alphaEnd
  pix?: boolean;             // pixel mode: integer position and scale, alpha in 3 hard steps
}

interface P extends Required<Omit<ParticleOpts, 'tex' | 'tint' | 'add'>> { s: Sprite; age: number; add: boolean }

export class Particles {
  readonly normal = new Container();
  readonly additive = new Container();
  private pool: Sprite[] = [];
  private live: P[] = [];
  max = 1400;

  constructor() {
    this.additive.blendMode = 'add';
  }

  get count() { return this.live.length; }

  spawn(o: ParticleOpts) {
    if (this.live.length >= this.max) return;
    const s = this.pool.pop() ?? new Sprite({ anchor: 0.5 });
    s.texture = o.tex;
    s.tint = o.tint ?? 0xffffff;
    s.visible = false;
    (o.add ? this.additive : this.normal).addChild(s);
    this.live.push({
      s, age: 0, add: !!o.add,
      x: o.x, y: o.y, z: o.z ?? 0, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0,
      gravity: o.gravity ?? 0, drag: o.drag ?? 0, life: o.life,
      scale: o.scale ?? 1, scaleEnd: o.scaleEnd ?? o.scale ?? 1,
      alpha: o.alpha ?? 1, alphaEnd: o.alphaEnd ?? 0,
      rot: o.rot ?? 0, spin: o.spin ?? 0, bounce: o.bounce ?? -1, delay: o.delay ?? 0,
      scaleY: o.scaleY ?? 1, bounces: o.bounces ?? 1e9, hold: o.hold ?? 0, pix: o.pix ?? false,
    });
  }

  update(dt: number) {
    const live = this.live;
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (p.age >= p.life) {
        p.s.removeFromParent();
        this.pool.push(p.s);
        live[i] = live[live.length - 1];
        live.pop();
        continue;
      }
      const k = p.age / p.life;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.gravity || p.vz) {
        p.vz -= p.gravity * dt; p.z += p.vz * dt;
        if (p.z < 0 && p.bounce >= 0) {
          p.z = 0;
          if (p.bounces-- > 0) { p.vz = -p.vz * p.bounce; p.vx *= 0.6; p.vy *= 0.6; } else { p.vz = 0; p.gravity = 0; p.vx *= 0.3; p.vy *= 0.3; p.drag = Math.max(p.drag, 8); }
        }
      }
      p.rot += p.spin * dt;
      const s = p.s;
      s.visible = true;
      s.x = p.x; s.y = p.y - p.z;
      const sc = p.scale + (p.scaleEnd - p.scale) * k;
      s.scale.set(sc, sc * p.scaleY);
      s.rotation = p.rot;
      const ka = p.hold > 0 ? Math.max(0, (k - p.hold) / (1 - p.hold)) : k;
      s.alpha = p.alpha + (p.alphaEnd - p.alpha) * ka;
      if (p.pix) {
        s.x = Math.round(s.x); s.y = Math.round(s.y);
        const si = Math.max(1, Math.round(sc));
        s.scale.set(si, si);
        s.alpha = Math.ceil(s.alpha * 3 - 0.01) / 3;
        s.visible = s.alpha > 0;
      }
    }
  }

  clear() {
    for (const p of this.live) { p.s.removeFromParent(); this.pool.push(p.s); }
    this.live.length = 0;
  }
}

/** Live position (world px) of whatever an effect sticks to; null once it's gone. */
export type Follow = () => { x: number; y: number } | null;

/** Simple timed one-shot animation attached to a display object. */
interface OneShot { obj: Container; t: number; dur: number; step: (k: number, dt: number) => void }

export class Effects {
  readonly particles = new Particles();
  readonly under = new Container();     // ground-level one-shots (scorch flashes, landing rings)
  readonly over = new Container();      // above entities (labels, ghosts, beams)
  readonly light = new Container();     // additive glows
  readonly labels = new Container();    // floating texts, above the name tags
  private shots: OneShot[] = [];
  /** Brick textures (each crate variant) cut into n x n fragments (4x4 on high, 2x2 on low quality). */
  private brickBits = new Map<Texture, Map<number, { tex: Texture; ox: number; oy: number }[]>>();
  private labelPool: BitmapText[] = [];
  lowQuality = false;
  /** The round's weather as it treats smoke: wind (px/s), life and alpha factors, colour. */
  weather: SmokeWeather = { wx: 10, wy: 0, life: 1, alpha: 1, tint: 0xb8b2c4 };
  /** Sound hook for render-timed moments (teleports); set by the renderer. */
  sound?: (kind: 'beamOut' | 'dropIn', x: number, y: number, who: string, crowd?: number) => void;

  constructor(private a: GameAssets, private tx: ProcTextures) {
    this.light.blendMode = 'add';
  }

  private q(n: number) { return this.lowQuality ? Math.max(1, Math.round(n * 0.35)) : n; }

  private shot(obj: Container, parent: Container, dur: number, step: OneShot['step']) {
    parent.addChild(obj);
    this.shots.push({ obj, t: 0, dur, step });
    step(0, 0);
  }

  /** Keep `obj` in `parent` for `dur` seconds, then destroy it (or on clear()). */
  hold(obj: Container, parent: Container, dur: number) { this.shot(obj, parent, dur, () => {}); }

  /** Pixel-art flipbook: frame i is shown until ends[i] (s); then the sprite is gone. */
  private frames(frames: Texture[], ends: number[], parent: Container, x: number, y: number, anchor: { x: number; y: number } | number = 0.5, delay = 0) {
    const s = new Sprite({ texture: frames[0], anchor, x: Math.round(x), y: Math.round(y), visible: false });
    const total = delay + ends[ends.length - 1];
    this.shot(s, parent, total, k => {
      const t = k * total - delay;
      let i = 0;
      while (i < ends.length - 1 && t >= ends[i]) i++;
      s.visible = t >= 0 && k < 1;
      s.texture = frames[i];
    });
    return s;
  }

  update(dt: number) {
    this.particles.update(dt);
    const shots = this.shots;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      s.step(k, dt);
      if (k >= 1) {
        if (s.obj instanceof BitmapText && s.obj.label === 'pooled') { s.obj.removeFromParent(); this.labelPool.push(s.obj); }
        else if (!s.obj.destroyed) s.obj.destroy({ children: true });
        shots[i] = shots[shots.length - 1];
        shots.pop();
      }
    }
  }

  clear() {
    this.particles.clear();
    for (const s of this.shots) if (!s.obj.destroyed) s.obj.destroy({ children: true });
    this.shots.length = 0;
  }

  // ---------------------------------------------------------------- building blocks
  flash(x: number, y: number, size: number, color: number, dur = 0.25, alpha = 0.9) {
    if (this.lowQuality && size > 2) alpha *= 0.7;
    const s = new Sprite({ texture: this.tx.glow, anchor: 0.5, x, y, tint: color });
    const base = size * T / 32;
    this.shot(s, this.light, dur, k => {
      s.alpha = alpha * (1 - k) * (1 - k);
      s.scale.set(base * (0.7 + 0.5 * k));
    });
  }

  shockwave(x: number, y: number, radius: number, color = 0xffffff, dur = 0.35, alpha = 0.7) {
    const s = new Sprite({ texture: this.tx.ring, anchor: 0.5, x, y, tint: color });
    this.shot(s, this.under, dur, k => {
      const e = 1 - (1 - k) ** 3;
      s.scale.set((radius * T / 28) * (0.2 + e * 0.8), (radius * T / 28) * (0.2 + e * 0.8) * 0.75);
      s.alpha = alpha * (1 - k);
    });
  }

  /** Floating text; with `follow` (world px of whoever it belongs to) it rides along with them. */
  label(x: number, y: number, text: string, color: number, dur = 1.1, follow?: Follow) {
    if (!text) return;
    const t = this.labelPool.pop() ?? new BitmapText({ text: '', style: { fontFamily: FONT_TAG, fontSize: 8 }, anchor: 0.5 });
    t.label = 'pooled';
    t.text = text;
    t.tint = color;
    t.x = x; t.y = y;
    this.shot(t, this.labels, dur, k => {
      const f = follow?.();
      if (f) { x = f.x; y = f.y - 14; }
      t.x = x;
      const pop = k < 0.12 ? k / 0.12 : 1;
      t.scale.set(0.6 + 0.4 * bounce(Math.min(1, pop)) + (k < 0.12 ? 0.2 : 0));
      t.y = y - 6 - 22 * (1 - (1 - k) ** 2);
      t.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    });
  }

  /** Is a floating text playing over this spot (world px)? Name tags there step back. */
  labelNear(x: number, y: number) {
    for (const t of this.labels.children) if (t.visible && t.alpha > 0.05 && Math.abs(t.x - x) < 46 && Math.abs(t.y - y) < 26) return true;
    return false;
  }

  // ---------------------------------------------------------------- composite effects
  /**
   * Light, sparks and embers, snappy, so they end with the lethal window (LETHAL); then smoke that
   * hangs over the blast and drifts off with the wind (rain beats it down, fog keeps it around).
   */
  explosion(x: number, y: number, cells: { x: number; y: number }[], power: number) {
    const cx = x * T, cy = y * T;
    this.flash(cx, cy, 2.6 + power * 0.3, 0xffb050, LETHAL * 0.7, 0.7);
    this.flash(cx, cy, 1.6, 0xffffff, 0.08, 1);
    this.shockwave(cx, cy, 1.4 + power * 0.25, 0xfff0c0, 0.22, 0.55);
    const n = this.q(12 + power * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = rand(110, 280);
      this.particles.spawn({
        tex: this.tx.white, x: cx, y: cy, z: rand(0, 8), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8,
        vz: rand(60, 180), gravity: 700, drag: 4, life: rand(0.2, 0.42), scale: rand(1.5, 3), scaleEnd: 0.5,
        tint: Math.random() < 0.5 ? 0xffe27a : 0xff8a3a, add: true, alpha: 1, alphaEnd: 0.1,
      });
    }
    // embers along the arms while the fire burns, then a quick smoke puff once it is out
    const step = this.lowQuality ? 3 : 1;
    for (let i = 0; i < cells.length; i += step) {
      const c = cells[i];
      const px = c.x * T, py = c.y * T;
      if (!this.lowQuality && Math.random() < 0.5) this.particles.spawn({
        tex: this.tx.white, x: px + rand(-10, 10), y: py + rand(-10, 10), vx: rand(-25, 25), vy: rand(-25, 25),
        vz: rand(40, 110), gravity: 260, life: rand(0.2, LETHAL), scale: rand(1, 2), tint: 0xffb347, add: true, alphaEnd: 0,
      });
      this.smoke(px + rand(-8, 8), py + rand(-6, 8), rand(0.8, 1.2), rand(1.9, 2.6), rand(0.9, 1.6), 0.5);
    }
    // a thicker plume over the centre
    for (let i = 0; i < this.q(4 + power); i++) {
      this.smoke(cx + rand(-10, 10), cy + rand(-8, 8), rand(1.2, 1.6), rand(2.8, 3.8), rand(1.4, 2.4), 0.55, 0.7);
    }
  }

  /** One smoke puff of an explosion, carried by the weather's wind. */
  private smoke(x: number, y: number, scale: number, scaleEnd: number, life: number, alpha: number, shade = 1) {
    const w = this.weather, carry = rand(0.6, 1.05);
    const tint = shade === 1 ? w.tint : ((((w.tint >> 16) & 255) * shade) << 16) | ((((w.tint >> 8) & 255) * shade) << 8) | ((w.tint & 255) * shade);
    this.particles.spawn({
      tex: this.tx.puff, x, y, z: rand(0, 6), vx: rand(-10, 10) + w.wx * carry, vy: rand(-5, 5) + w.wy * carry, vz: rand(10, 22),
      drag: 0.25, life: life * w.life, delay: LETHAL * rand(0.8, 1), scale, scaleEnd,
      alpha: alpha * w.alpha, alphaEnd: 0, hold: 0.25, tint: Math.round(tint), spin: rand(-0.8, 0.8), rot: rand(0, 6),
    });
  }

  /** `tex` cut into n x n fragments (cached per texture). */
  private bits(tex: Texture, n: number) {
    let per = this.brickBits.get(tex);
    if (!per) this.brickBits.set(tex, per = new Map());
    let bits = per.get(n);
    if (bits) return bits;
    const fw = tex.frame.width / n, fh = tex.frame.height / n;
    bits = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const t = new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x + x * fw, tex.frame.y + y * fh, fw, fh) });
      bits.push({ tex: t, ox: (x + 0.5) * fw - tex.frame.width / 2, oy: (y + 0.5) * fh - tex.frame.height / 2 });
    }
    per.set(n, bits);
    return bits;
  }

  /** Brick crumble: the brick sprite breaks into its own pixel fragments that pop out, fall, bounce once and fade. */
  brickBreak(x: number, y: number, dirX = 0, dirY = 0, tex: Texture = this.a.world.box) {
    const px = x * T, py = y * T;
    const floor = py + 11; // where the fragments land
    const bits = this.bits(tex, this.lowQuality ? 2 : 4);
    for (const b of bits) {
      // start exactly where the piece was on the brick: ground position + height above it
      const sx = px + b.ox, sy = py + b.oy;
      const out = rand(35, 75);
      const nx = b.ox / 16 + dirX * 0.5 + rand(-0.25, 0.25), ny = b.oy / 16 + dirY * 0.5;
      this.particles.spawn({
        tex: b.tex, x: sx, y: floor + rand(-3, 3) + ny * 3, z: floor - sy,
        vx: nx * out, vy: ny * out * 0.6, vz: rand(60, 120) - b.oy * 1.5, gravity: 700,
        bounce: 0.35, bounces: 1, drag: 0.8,
        life: rand(0.5, 0.7), scale: 1, alpha: 1, alphaEnd: 0, hold: 0.55,
      });
    }
    // a little dust
    for (let i = 0; i < this.q(4); i++) this.particles.spawn({
      tex: this.tx.puff, x: px + rand(-10, 10), y: floor - rand(0, 6), z: rand(0, 8), vz: rand(8, 20), vx: rand(-20, 20), drag: 3,
      life: rand(0.35, 0.6), scale: 0.6, scaleEnd: 1.4, alpha: 0.45, alphaEnd: 0, tint: 0xb59a86,
    });
  }

  dustRing(x: number, y: number, n: number, speed = 70, tint = 0xd8cdb8, size = 1) {
    n = this.q(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      this.particles.spawn({
        tex: this.tx.puff, x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 5, z: 2,
        vx: Math.cos(a) * speed * rand(0.7, 1.2), vy: Math.sin(a) * speed * 0.6, vz: rand(4, 18), drag: 4,
        life: rand(0.4, 0.75), scale: 0.6 * size, scaleEnd: 1.4 * size, alpha: 0.75, alphaEnd: 0, tint, spin: rand(-2, 2),
      });
    }
  }

  blockImpact(x: number, y: number) {
    const px = x * T, py = y * T + 10;
    this.dustRing(px, py, 14, 110, 0xcfc4b0, 1.3);
    this.shockwave(px, py - 6, 1.6, 0xffffff, 0.3, 0.4);
    for (let i = 0; i < this.q(10); i++) this.particles.spawn({
      tex: this.tx.pebble, x: px + rand(-14, 14), y: py + rand(-6, 4), z: 4, vx: rand(-90, 90), vy: rand(-40, 40),
      vz: rand(60, 150), gravity: 600, bounce: 0.3, life: rand(0.5, 0.9), scale: 1, alphaEnd: 0.3,
    });
  }

  landingDust(x: number, y: number) {
    this.dustRing(x, y + 8, 8, 55, 0xd8cdb8, 0.8);
  }

  /** A bomb thrown off the map: it flashes, shrinks and melts into a wisp of steam with sparks. */
  vanish(x: number, y: number) {
    const px = x * T, py = y * T;
    const s = new Sprite({ texture: this.a.bombs.normal[0], anchor: 0.5, x: px, y: py - 3 });
    this.shot(s, this.over, 0.45, k => {
      const e = 1 - (1 - k) ** 2;
      s.tint = k < 0.15 ? 0xffffff : 0xdcd8ff;
      s.alpha = 1 - e;
      s.scale.set(1 + 0.25 * Math.sin(k * Math.PI) - 0.9 * e, 1 - 0.9 * e + 0.2 * Math.sin(k * Math.PI));
      s.y = py - 3 - 10 * e;
    });
    for (let i = 0; i < this.q(10); i++) this.particles.spawn({
      tex: this.tx.puff, x: px + rand(-5, 5), y: py + rand(-4, 4), vz: rand(25, 55), vx: rand(-10, 10),
      delay: rand(0, 0.15), life: rand(0.7, 1.2), scale: 0.5, scaleEnd: 2, alpha: 0.6, alphaEnd: 0, tint: 0xe4e2f0, spin: rand(-1, 1),
    });
    for (let i = 0; i < this.q(14); i++) {
      const a = rand(0, Math.PI * 2), v = rand(30, 90);
      this.particles.spawn({
        tex: this.tx.white, x: px, y: py - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: rand(20, 70), drag: 3,
        life: rand(0.3, 0.6), scale: rand(1, 2), alphaEnd: 0, tint: i % 3 ? 0xbfe6ff : 0xffffff, add: true,
      });
    }
  }

  fizzle(x: number, y: number) {
    const px = x * T, py = y * T;
    for (let i = 0; i < this.q(8); i++) this.particles.spawn({
      tex: this.tx.puff, x: px + rand(-6, 6), y: py + rand(-6, 4), vz: rand(15, 35), vx: rand(-12, 12),
      life: rand(0.8, 1.4), scale: 0.7, scaleEnd: 2.2, alpha: 0.7, alphaEnd: 0, tint: 0x9c98a8, spin: rand(-1, 1),
    });
    for (let i = 0; i < this.q(6); i++) this.particles.spawn({
      tex: this.tx.white, x: px + 6, y: py - 12, vx: rand(-40, 40), vz: rand(30, 80), gravity: 300,
      life: rand(0.2, 0.45), scale: 1.5, tint: 0xffd060, add: true,
    });
    this.label(px, py - 10, 'pfff', 0xc8c4d8, 0.9);
  }

  /**
   * Pickup collected: icon flips up and away (new-openbomber Give) + sparkle ring + label. With
   * `follow` (world px of the hero who took it) the icon and the label ride along with that hero.
   */
  collect(x: number, y: number, icon: Texture, text: string, color: number, good = true, follow?: Follow) {
    const px = x * T, py = y * T;
    const s = new Sprite({ texture: icon, anchor: 0.5, x: px, y: py });
    this.shot(s, this.over, 0.8, k => {
      const f = follow?.();
      // slide from the pickup's tile onto the hero in the first moment, then stay on them
      const glue = Math.min(1, k * 8);
      const bx = f ? px + (f.x - px) * glue : px, by = f ? py + (f.y - py) * glue : py;
      s.x = bx;
      const t = k * 4;
      const rot = clamp(t - 1, 0, 2) / 2;
      const fly = clamp(t, 0, 1) ** 3 + clamp(t - 3, 0, 1) ** 3;
      let sc = 1 - clamp(t - 3, 0, 1);
      sc *= 1 - clamp(t, 0, 0.3);
      s.alpha = 0.2 + sc;
      s.scale.set(Math.cos(rot * Math.PI * 3) * sc, sc);
      s.y = by - fly * 32;
    });
    this.flash(px, py, 1.5, good ? 0xfff2a0 : 0xb070ff, 0.3, 0.7);
    this.shockwave(px, py, 0.9, good ? 0xffffff : 0xc080ff, 0.3, 0.8);
    const n = this.q(10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.particles.spawn({
        tex: this.tx.sparkle, x: px, y: py, vx: Math.cos(a) * 70, vy: Math.sin(a) * 50, drag: 3, vz: 20,
        life: rand(0.35, 0.6), scale: rand(0.5, 1), scaleEnd: 0, tint: good ? 0xfff6c0 : 0xd0a0ff, add: true, alphaEnd: 1,
      });
    }
    this.label(px, py - 14, text, color, 1.1, follow);
  }

  private whites = new Map<Texture, Texture>();
  /** White silhouette of a texture (made once). */
  private whiteOf(tex: Texture) {
    let w = this.whites.get(tex);
    if (w) return w;
    // full (untrimmed) size, so it lines up with the original under the same anchor
    const f = tex.frame, W = tex.orig.width, H = tex.orig.height, ox = tex.trim?.x ?? 0, oy = tex.trim?.y ?? 0;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.drawImage(tex.source.resource as CanvasImageSource, f.x, f.y, f.width, f.height, ox, oy, f.width, f.height);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    w = Texture.from(c);
    w.source.scaleMode = 'nearest';
    this.whites.set(tex, w);
    return w;
  }

  /** Pickup burned by a flame: flashes white, chars dark under licking pixel fire, pops into embers and smoke. */
  burn(x: number, y: number, icon: Texture) {
    const px = Math.round(x * T), py = Math.round(y * T);
    const white = this.whiteOf(icon);
    const s = new Sprite({ texture: white, anchor: 0.5, x: px, y: py });
    const POP = 0.32;
    this.shot(s, this.over, POP, (k, dt) => {
      const t = k * POP;
      void dt;
      if (t < 0.07) { s.texture = white; s.tint = 0xffffff; }
      else { s.texture = icon; s.tint = t < 0.17 ? 0x8a4a40 : t < 0.25 ? 0x4a3038 : 0x2a1e28; }
      s.x = px + (t > 0.07 ? (Math.floor(t * 50) % 2 ? 1 : -1) : 0);
      s.y = py - (t > 0.2 ? 1 : 0);
      s.visible = k < 1;
    });
    // flames licking it (the fire tile's own frames, at 1:1)
    const fr = this.a.fire.base;
    const n = Math.min(fr.length, 4);
    this.frames(fr.slice(0, n), Array.from({ length: n }, (_, i) => 0.06 + (i + 1) * ((POP - 0.02) / n)), this.over, px, py + 10, { x: 0.5, y: 1 });
    // pop: embers, a puff of smoke, a quiet 'пф'
    for (let i = 0; i < this.q(10); i++) {
      const a = rand(-Math.PI, 0), v = rand(25, 70);
      this.particles.spawn({
        tex: this.tx.white, x: px + Math.round(rand(-4, 4)), y: py + Math.round(rand(-3, 3)), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.4,
        vz: rand(50, 120), gravity: 260, drag: 1.5, delay: POP, life: rand(0.3, 0.55),
        scale: Math.random() < 0.3 ? 2 : 1, tint: [0xffd060, 0xff8a3a, 0xd04a2a][i % 3], alpha: 1, alphaEnd: 0.3, pix: true,
      });
    }
    for (let i = 0; i < this.q(3); i++) this.particles.spawn({
      tex: this.tx.puff, x: px + Math.round(rand(-4, 4)), y: py + Math.round(rand(-2, 2)), vz: rand(18, 30), vx: rand(-8, 8), delay: POP + i * 0.04,
      life: rand(0.4, 0.6), scale: 1, alpha: 0.8, alphaEnd: 0.2, tint: 0x6a6070, pix: true,
    });
    const lbl = () => this.label(px, py - 10, 'пф', 0xb8b0c4, 0.6);
    this.shot(new Container(), this.over, POP, k => { if (k >= 1) lbl(); });
  }

  shieldBreak(x: number, y: number) {
    const px = x * T, py = y * T - 8;
    this.flash(px, py, 2, 0x80d8ff, 0.3, 0.9);
    this.shockwave(px, py, 1.3, 0xa0e8ff, 0.35, 0.9);
    const n = this.q(16);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.particles.spawn({
        tex: this.tx.white, x: px + Math.cos(a) * 12, y: py + Math.sin(a) * 12, vx: Math.cos(a) * rand(80, 150), vy: Math.sin(a) * rand(80, 150),
        drag: 3, vz: rand(0, 60), gravity: 200, life: rand(0.4, 0.7), scale: rand(2, 3), scaleEnd: 0.5, tint: 0xbff0ff, add: true, rot: a, spin: rand(-10, 10),
      });
    }
    this.label(px, py - 16, 'BLOCK!', 0x9fe6ff);
  }

  whoosh(x: number, y: number, dx: number, dy: number) {
    const px = x * T, py = y * T;
    for (let i = 0; i < this.q(5); i++) {
      const off = rand(-9, 9);
      const ox = dy !== 0 ? off : 0, oy = dx !== 0 ? off : 0;
      this.particles.spawn({
        tex: this.tx.white, x: px - dx * 10 + ox, y: py - dy * 10 + oy - 4, vx: -dx * rand(60, 120), vy: -dy * rand(60, 120),
        life: rand(0.2, 0.35), scale: dx !== 0 ? 9 : 1, scaleY: dx !== 0 ? 1 / 9 : 9, scaleEnd: dx !== 0 ? 4 : 1,
        alpha: 0.9, alphaEnd: 0, tint: 0xffffff,
      });
    }
    this.dustRing(px - dx * 6, py + 8, 5, 40, 0xd8cdb8, 0.6);
  }

  trail(x: number, y: number, z: number, tint = 0xfff0c0) {
    if (this.lowQuality && Math.random() < 0.6) return;
    this.particles.spawn({
      tex: this.tx.white, x: x + rand(-2, 2), y: y + rand(-2, 2), z, life: 0.3, scale: rand(2, 3.5), scaleEnd: 0,
      alpha: 0.8, alphaEnd: 0, tint, add: true,
    });
  }

  punch(x: number, y: number) {
    const px = x * T, py = y * T - 4;
    this.flash(px, py, 1.2, 0xffffff, 0.15, 0.9);
    for (let i = 0; i < this.q(6); i++) this.particles.spawn({
      tex: this.tx.star, x: px, y: py, vx: rand(-90, 90), vy: rand(-90, 40), drag: 3, life: 0.35, scale: 1, scaleEnd: 0.3, add: true,
    });
  }

  /** Charred silhouette of a hero frame with glowing pixel cracks, plus its crumbling frames and pixel spots. */
  private chars = new Map<Texture, { char: Texture[]; crumble: Texture[]; pts: [number, number][]; w: number; h: number }>();
  private charOf(tex: Texture) {
    let c = this.chars.get(tex);
    if (c) return c;
    const f = tex.frame, w = tex.orig.width, h = tex.orig.height;
    const base = document.createElement('canvas');
    base.width = w; base.height = h;
    const bg = base.getContext('2d')!;
    bg.drawImage(tex.source.resource as CanvasImageSource, f.x, f.y, f.width, f.height, tex.trim?.x ?? 0, tex.trim?.y ?? 0, f.width, f.height);
    const src = bg.getImageData(0, 0, w, h).data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
    const pts: [number, number][] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) pts.push([x, y]);
    let st = 1234;
    const rnd = () => ((st = (Math.imul(st ^ (st >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
    // crack lines: short random walks over the body
    const cracks: [number, number][] = [];
    for (let n = 0; n < 7 && pts.length; n++) {
      let [x, y] = pts[Math.floor(rnd() * pts.length)];
      for (let i = 0; i < 5; i++) {
        if (solid(x, y)) cracks.push([x, y]);
        y += 1; x += rnd() < 0.5 ? (rnd() < 0.5 ? -1 : 1) : 0;
      }
    }
    const make = (glow: string, cut: number) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d')!;
      for (const [x, y] of pts) {
        if (y < cut) continue;
        if (y < cut + 2 && (x + y) % 2) continue; // ragged crumbling edge
        const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
        g.fillStyle = edge ? '#16101a' : '#2c2230';
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = glow;
      for (const [x, y] of cracks) if (y >= cut + 2) g.fillRect(x, y, 1, 1);
      const t = Texture.from(cv);
      t.source.scaleMode = 'nearest';
      return t;
    };
    const top = pts.length ? pts[0][1] : 0;
    const span = h - top;
    c = {
      char: [make('#ff8a3a', -1), make('#ffd060', -1)],
      crumble: [0.25, 0.5, 0.75].map(k => make('#ff8a3a', Math.round(top + span * k))),
      pts, w, h,
    };
    this.chars.set(tex, c);
    return c;
  }

  /** Little ash heap with a few dying embers, left beside the grave. */
  private ashTex: Texture | null = null;
  private ash() {
    if (this.ashTex) return this.ashTex;
    const rows = [
      '....aAAa....',
      '..aAAbAAAa..',
      '.aAbAAeAAbA.',
      'aAAAAbAAAAAa',
    ];
    const pal: Record<string, string> = { a: '#4a4450', A: '#3a3440', b: '#6a6470', e: '#ff8a3a' };
    const cv = document.createElement('canvas');
    cv.width = 12; cv.height = 4;
    const g = cv.getContext('2d')!;
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
    this.ashTex = Texture.from(cv);
    this.ashTex.source.scaleMode = 'nearest';
    return this.ashTex;
  }

  /**
   * Burned alive by a burning player's touch: a white flash, pixel flames climb from the feet,
   * the body chars black with glowing cracks, crumbles into ash and embers; then the usual ghost
   * and grave. `body` is the frame the hero was showing, `flip` its facing (-1 = mirrored).
   */
  burnDeath(x: number, y: number, body: Texture, flip: number, ghostTex: Texture, knock = 0) {
    const px = Math.round(x * T), py = Math.round(y * T);
    // ---- the touch: a hot pixel starburst on the body and a ring of sparks
    this.frames(this.tx.burst, [0.04, 0.08, 0.13, 0.18], this.over, px - knock * 6, py - 10).tint = 0xffb040;
    this.frames(this.tx.ringOut, [0.04, 0.09, 0.15, 0.22], this.under, px, py + 7).tint = 0xff8a3a;
    for (let i = 0; i < this.q(12); i++) {
      const a = (i / 12) * Math.PI * 2 + rand(-0.2, 0.2), v = rand(60, 100);
      this.particles.spawn({
        tex: this.tx.white, x: px + Math.cos(a) * 5, y: py - 4 + Math.sin(a) * 4, z: rand(2, 10), vx: Math.cos(a) * v + knock * 20, vy: Math.sin(a) * v * 0.55,
        vz: rand(30, 70), gravity: 260, drag: 2.5, life: rand(0.25, 0.45), scale: i % 3 ? 1 : 2,
        tint: [0xfff4b0, 0xffc23a, 0xff7a1e][i % 3], alpha: 1, alphaEnd: 0.3, pix: true,
      });
    }
    const white = this.whiteOf(body);
    const ch = this.charOf(body);
    const s = new Sprite({ texture: white, anchor: 0.5, x: px, y: py - 8 });
    s.scale.x = flip < 0 ? -1 : 1;
    const FLASH = 0.07, CLIMB = 0.5, CHAR = 0.78, GONE = 1.0;
    this.shot(s, this.over, GONE, k => {
      const t = k * GONE;
      if (t < FLASH) { s.texture = white; s.tint = 0xffffff; }
      else if (t < CLIMB) { s.texture = body; s.tint = t < 0.2 ? 0xffc8a0 : t < 0.32 ? 0xd07a5a : t < 0.42 ? 0x8a4a40 : 0x5a3038; }
      else if (t < CHAR) { s.texture = ch.char[Math.floor(t * 16) % 2]; s.tint = 0xffffff; }
      else { s.texture = ch.crumble[Math.min(2, Math.floor((t - CHAR) / (GONE - CHAR) * 3))]; }
      // knocked a few px away from the touch, then shaking while it burns
      const kb = t < 0.12 ? Math.round(knock * 4 * Math.sin((t / 0.12) * Math.PI * 0.5)) : knock * 3;
      s.x = px + kb + (t > FLASH && t < CHAR ? (Math.floor(t * 40) % 2 ? 1 : 0) : 0);
      s.visible = k < 1;
    });
    // flames climbing up the body, then licking on until it chars
    const fl = this.tx.flames.climb;
    this.frames([fl[0], fl[1], fl[2], fl[3], fl[4], fl[5], fl[4], fl[6], fl[3], fl[1]],
      [0.11, 0.16, 0.22, 0.29, 0.37, 0.45, 0.53, 0.62, 0.7, 0.78], this.over, px + knock * 3, py + 9, { x: 0.5, y: 1 }, 0.04);
    // embers flying off while it burns
    for (let i = 0; i < this.q(10); i++) this.particles.spawn({
      tex: this.tx.white, x: px + Math.round(rand(-8, 8)), y: py + Math.round(rand(-4, 6)), z: rand(4, 26), vx: rand(-20, 20), vz: rand(30, 70),
      delay: rand(0.1, 0.7), life: rand(0.3, 0.5), scale: Math.random() < 0.3 ? 2 : 1, tint: [0xffd060, 0xff8a3a, 0xd04a2a][i % 3], alpha: 1, alphaEnd: 0.3, pix: true,
    });
    // crumble: the silhouette's own pixels fall away as ash and embers
    const pts = ch.pts;
    const n = Math.min(pts.length, this.q(34));
    const x0 = px - ch.w / 2, y0 = py - 8 - ch.h / 2;
    for (let i = 0; i < n; i++) {
      const [sx, sy] = pts[Math.floor((i / n) * pts.length)];
      const lx = flip < 0 ? ch.w - 1 - sx : sx;
      const ember = i % 5 === 0;
      this.particles.spawn({
        tex: this.tx.white, x: x0 + lx + knock * 3, y: py + 8 + rand(-1, 2), z: py + 8 - (y0 + sy),
        vx: (lx - ch.w / 2) * rand(2, 4) + knock * rand(10, 30), vy: rand(-14, 14), vz: ember ? rand(30, 70) : rand(-10, 20), gravity: ember ? 60 : 300, bounce: 0, drag: 2,
        delay: CHAR + ((sy / ch.h) * 0.6 + rand(0, 0.25)) * (GONE - CHAR), life: rand(0.35, 0.6),
        scale: Math.random() < 0.25 ? 2 : 1, tint: ember ? 0xff8a3a : Math.random() < 0.5 ? 0x3a3440 : 0x6a6470, alpha: 1, alphaEnd: 0.3, pix: true,
      });
    }
    for (let i = 0; i < this.q(4); i++) this.particles.spawn({
      tex: this.tx.puff, x: px + Math.round(rand(-6, 6)), y: py + Math.round(rand(-4, 4)), vz: rand(18, 34), vx: rand(-8, 8),
      delay: CHAR + i * 0.05, life: rand(0.5, 0.7), scale: 1, alpha: 0.8, alphaEnd: 0.2, tint: 0x5a5262, pix: true,
    });
    // the ash heap stays a while, then the canon ghost + grave
    const ash = new Sprite({ texture: this.ash(), anchor: { x: 0.5, y: 1 }, x: px + (knock < 0 ? -9 : 9), y: py + 11, visible: false });
    this.shot(ash, this.under, 5 + GONE, k => {
      const t = k * (5 + GONE);
      ash.visible = t > CHAR + 0.1;
      ash.alpha = t < 4 + GONE ? 1 : Math.ceil((5 + GONE - t) * 3) / 3;
    });
    this.shot(new Container(), this.over, GONE, k => { if (k >= 1) this.death(x, y, ghostTex); });
  }

  /**
   * A frozen hero of the old arena beams away: a pixel column of light, a white flash, the body
   * stretches up out of sight, a few pixel sparks. Runs inside `parent` (the frozen arena).
   */
  teleportOut(parent: Container, hero: Container, delay: number, crowd = 1, at?: { x: number; y: number }) {
    const body = hero.children.find(c => c.label === 'body') as Sprite | undefined;
    if (!body) return;
    const x = hero.x, y = hero.y;
    const b = this.tx.beam;
    const beam = new Sprite({ texture: b[0], anchor: { x: 0.5, y: 1 }, x: Math.round(x), y: Math.round(y) + 9, visible: false });
    parent.addChildAt(beam, Math.max(0, parent.getChildIndex(hero)));
    const white = new Sprite({ texture: this.whiteOf(body.texture), anchor: 0.5, y: body.y, visible: false });
    white.scale.copyFrom(body.scale);
    hero.addChild(white);
    const sparks = Array.from({ length: this.q(6) }, (_, i) => {
      const sp = new Sprite({ texture: this.tx.white, x: Math.round(x + rand(-7, 7)), y: Math.round(y + rand(-20, 4)), tint: i % 2 ? 0xffffff : 0x9fe8ff, visible: false });
      sp.scale.set(i % 3 ? 1 : 2);
      parent.addChild(sp);
      return { sp, y0: sp.y, v: rand(90, 160) };
    });
    const by = body.y, sx = body.scale.x, sy = body.scale.y;
    const D = 0.4;
    let zapped = false;
    this.shot(new Container(), parent, delay + D, k => {
      const t = k * (delay + D) - delay;
      if (t < 0) return;
      if (!zapped) { zapped = true; this.sound?.('beamOut', at?.x ?? 0, at?.y ?? 0, '', crowd); }
      const f = [1, 2, 1, 3, 4];
      const fi = Math.min(f.length - 1, Math.floor(t / 0.08));
      beam.visible = t < D;
      beam.texture = b[f[fi]];
      white.visible = t < 0.12;
      white.tint = t < 0.06 ? 0xffffff : 0xbff4ff;
      const e = Math.max(0, (t - 0.06) / 0.22);
      const up = Math.min(1, e);
      body.visible = up < 1;
      body.scale.set(sx * (1 - 0.55 * up), sy * (1 + 1.1 * up));
      body.y = Math.round(by - 70 * up * up);
      white.scale.copyFrom(body.scale); white.y = body.y;
      hero.children[0].visible = up < 0.6; // shadow
      for (const s of sparks) {
        s.sp.visible = t > 0.05 && t < D;
        s.sp.y = Math.round(s.y0 - s.v * Math.max(0, t - 0.05));
      }
      if (k >= 1) { beam.visible = false; for (const s of sparks) s.sp.visible = false; }
    });
  }

  /** Death: no body swap or flash, only a ghost of the player's own skin floating up, plus a grave decal. */
  death(x: number, y: number, tex: Texture) {
    const px = Math.round(x * T), py = Math.round(y * T);
    const ghost = new Sprite({ texture: tex, anchor: 0.5, x: px, y: py - 8, tint: 0xdce8ff });
    this.shot(ghost, this.over, 1.5, k => {
      ghost.y = Math.round(py - 8 - k * 44);
      ghost.x = Math.round(px + Math.sin(k * 8) * 4);
      ghost.alpha = 0.6 * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9);
    });
    const grave = new Sprite({ texture: this.tx.grave, anchor: { x: 0.5, y: 1 }, x: px, y: py + 10 });
    this.shot(grave, this.under, 5, k => {
      const t = k * 5;
      grave.scale.set(1, t < 0.12 ? 0.4 + 0.6 * bounce(t / 0.12) : 1);
      grave.alpha = t < 4 ? 1 : 1 - (t - 4);
    });
  }

  /** Spawn, part 1: a pixel column of light comes down onto the spot, a ring closes in on it. */
  spawnBeam(x: number, y: number) {
    const px = Math.round(x * T), py = Math.round(y * T) + 9;
    const b = this.tx.beam;
    this.frames([b[0], b[1], b[2], b[1], b[3], b[4]], [0.05, 0.13, 0.2, 0.27, 0.34, 0.42], this.under, px, py, { x: 0.5, y: 1 });
    const r = this.tx.ringIn;
    this.frames(r, [0.05, 0.1, 0.15, 0.2], this.under, px, py - 2);
    for (let i = 0; i < this.q(6); i++) this.particles.spawn({
      tex: this.tx.white, x: px + Math.round(rand(-6, 6)), y: py - 2, z: rand(30, 90), vz: rand(-200, -120),
      life: rand(0.2, 0.35), scale: Math.random() < 0.4 ? 2 : 1, tint: Math.random() < 0.5 ? 0xffffff : 0x9fe8ff, alpha: 1, alphaEnd: 0.4, pix: true,
    });
  }

  /** Spawn, part 2: touchdown: a pixel starburst, a ring rolling out and a puff of dust. */
  spawnLand(x: number, y: number) {
    const px = Math.round(x * T), py = Math.round(y * T);
    this.frames(this.tx.burst, [0.04, 0.09, 0.14, 0.19], this.over, px, py - 4);
    this.frames(this.tx.ringOut, [0.05, 0.1, 0.16, 0.24], this.under, px, py + 7);
    const n = this.q(6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      this.particles.spawn({
        tex: this.tx.puff, x: px + Math.cos(a) * 8, y: py + 8 + Math.sin(a) * 4, z: 1,
        vx: Math.cos(a) * rand(45, 70), vy: Math.sin(a) * rand(22, 35), vz: rand(4, 14), drag: 5,
        life: rand(0.25, 0.4), scale: 1, alpha: 0.67, alphaEnd: 0.2, tint: 0xd8cdb8, pix: true,
      });
    }
    for (let i = 0; i < this.q(8); i++) {
      const a = rand(0, Math.PI * 2), v = rand(30, 70);
      this.particles.spawn({
        tex: this.tx.white, x: px, y: py + 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, vz: rand(40, 110), gravity: 320,
        life: rand(0.25, 0.45), scale: Math.random() < 0.3 ? 2 : 1, tint: Math.random() < 0.5 ? 0xffffff : 0xbff4ff, alpha: 1, alphaEnd: 0.3, pix: true,
      });
    }
  }

  /** Overtime drop hits the ground: pixel dust ring; bombs thud harder, pickups sparkle. */
  dropLand(x: number, y: number, bomb: boolean) {
    const px = Math.round(x * T), py = Math.round(y * T);
    this.frames(this.tx.ringOut, [0.04, 0.09, 0.15, 0.22], this.under, px, py + 8);
    const n = this.q(bomb ? 10 : 7);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2), v = bomb ? rand(55, 85) : rand(40, 60);
      this.particles.spawn({
        tex: this.tx.puff, x: px + Math.cos(a) * 7, y: py + 9 + Math.sin(a) * 3, z: 1,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.45, vz: rand(4, 14), drag: 5,
        life: rand(0.25, 0.4), scale: 1, alpha: 0.67, alphaEnd: 0.2, tint: 0xd8cdb8, pix: true,
      });
    }
    if (bomb) {
      for (let i = 0; i < this.q(6); i++) this.particles.spawn({
        tex: this.tx.white, x: px + Math.round(rand(-8, 8)), y: py + 8, vx: rand(-60, 60), vy: rand(-20, 20), vz: rand(60, 120), gravity: 500,
        bounce: 0.3, bounces: 1, life: rand(0.35, 0.55), scale: Math.random() < 0.4 ? 2 : 1, tint: Math.random() < 0.5 ? 0x85818c : 0xb9b3a8, alpha: 1, alphaEnd: 0.4, pix: true,
      });
    } else {
      this.frames(this.tx.burst, [0.04, 0.09, 0.14, 0.19], this.over, px, py - 2).tint = 0xfff0a0;
      for (let i = 0; i < this.q(8); i++) {
        const a = (i / 8) * Math.PI * 2;
        this.particles.spawn({
          tex: this.tx.white, x: px, y: py - 2, vx: Math.cos(a) * rand(50, 80), vy: Math.sin(a) * rand(30, 50), drag: 3, vz: rand(10, 40),
          life: rand(0.3, 0.5), scale: i % 3 ? 1 : 2, tint: i % 2 ? 0xfff6c0 : 0xffffff, alpha: 1, alphaEnd: 0.3, pix: true,
        });
      }
    }
  }

  curse(x: number, y: number) {
    const px = x * T, py = y * T - 8;
    for (let i = 0; i < this.q(10); i++) this.particles.spawn({
      tex: this.tx.puff, x: px + rand(-8, 8), y: py + rand(-6, 6), vz: rand(10, 30), vx: rand(-20, 20),
      life: rand(0.6, 1), scale: 0.6, scaleEnd: 1.6, alpha: 0.7, alphaEnd: 0, tint: Math.random() < 0.5 ? 0x9a5cff : 0x5cff8a,
    });
    this.label(px, py - 18, 'CURSED!', 0xc58cff);
  }

  stunHit(x: number, y: number) {
    const px = x * T, py = y * T - 22;
    this.flash(px, py, 1.4, 0xffffff, 0.15, 0.8);
    for (let i = 0; i < this.q(6); i++) this.particles.spawn({
      tex: this.tx.star, x: px, y: py, vx: rand(-80, 80), vy: rand(-80, 20), drag: 2.5, life: 0.45, scale: 1, scaleEnd: 0.2,
    });
  }

  confetti(x: number, y: number) {
    const colors = [0xff5a5a, 0xffd34d, 0x5affa0, 0x5ab8ff, 0xd07aff, 0xffffff];
    for (let i = 0; i < this.q(60); i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const sp = rand(80, 220);
      this.particles.spawn({
        tex: this.tx.white, x: x * T, y: y * T - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, z: 10, vz: rand(120, 260),
        gravity: 260, drag: 1.2, life: rand(1.4, 2.4), scale: rand(2, 3), scaleY: 0.6, scaleEnd: 2, alpha: 1, alphaEnd: 0.6,
        tint: colors[i % colors.length], spin: rand(-12, 12), delay: rand(0, 0.3),
      });
    }
  }

  footDust(x: number, y: number) {
    this.particles.spawn({
      tex: this.tx.puff, x: x + rand(-3, 3), y: y + rand(-1, 2), vz: rand(4, 10), vx: rand(-6, 6),
      life: 0.4, scale: 0.35, scaleEnd: 0.8, alpha: 0.45, alphaEnd: 0, tint: 0xd8cdb8,
    });
  }
}
