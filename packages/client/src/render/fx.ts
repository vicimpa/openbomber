// Pooled particles and short-lived one-shot effects. Units: world pixels, seconds.
import { BitmapText, Container, Rectangle, Sprite, Texture } from 'pixi.js';

import type { GameAssets } from './assets';
import type { ProcTextures } from './textures';
import { FONT_TAG } from './text';
import { LETHAL } from './explosions';

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

/** Simple timed one-shot animation attached to a display object. */
interface OneShot { obj: Container; t: number; dur: number; step: (k: number, dt: number) => void }

export class Effects {
  readonly particles = new Particles();
  readonly under = new Container();     // ground-level one-shots (scorch flashes, landing rings)
  readonly over = new Container();      // above entities (labels, ghosts, beams)
  readonly light = new Container();     // additive glows
  private shots: OneShot[] = [];
  /** Brick textures (each crate variant) cut into n x n fragments (4x4 on high, 2x2 on low quality). */
  private brickBits = new Map<Texture, Map<number, { tex: Texture; ox: number; oy: number }[]>>();
  private labelPool: BitmapText[] = [];
  lowQuality = false;

  constructor(private a: GameAssets, private tx: ProcTextures) {
    this.light.blendMode = 'add';
  }

  private q(n: number) { return this.lowQuality ? Math.max(1, Math.round(n * 0.35)) : n; }

  private shot(obj: Container, parent: Container, dur: number, step: OneShot['step']) {
    parent.addChild(obj);
    this.shots.push({ obj, t: 0, dur, step });
    step(0, 0);
  }

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
        else s.obj.destroy({ children: true });
        shots[i] = shots[shots.length - 1];
        shots.pop();
      }
    }
  }

  clear() {
    this.particles.clear();
    for (const s of this.shots) s.obj.destroy({ children: true });
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

  label(x: number, y: number, text: string, color: number, dur = 1.1) {
    const t = this.labelPool.pop() ?? new BitmapText({ text: '', style: { fontFamily: FONT_TAG, fontSize: 8 }, anchor: 0.5 });
    t.label = 'pooled';
    t.text = text;
    t.tint = color;
    t.x = x; t.y = y;
    this.shot(t, this.over, dur, k => {
      const pop = k < 0.12 ? k / 0.12 : 1;
      t.scale.set(0.6 + 0.4 * bounce(Math.min(1, pop)) + (k < 0.12 ? 0.2 : 0));
      t.y = y - 6 - 22 * (1 - (1 - k) ** 2);
      t.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    });
  }

  // ---------------------------------------------------------------- composite effects
  /** Light, sparks, embers and a short smoke tail; snappy, so it ends with the lethal window (LETHAL). */
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
      this.particles.spawn({
        tex: this.tx.puff, x: px + rand(-8, 8), y: py + rand(-6, 8), z: rand(0, 6), vx: rand(-8, 8), vy: rand(-4, 4), vz: rand(16, 30),
        life: rand(0.3, 0.5), delay: LETHAL * rand(0.85, 1), scale: rand(0.8, 1.2), scaleEnd: rand(1.6, 2.2),
        alpha: 0.45, alphaEnd: 0, tint: 0xb8b2c4, spin: rand(-1, 1), rot: rand(0, 6),
      });
    }
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

  /** Pickup collected: icon flips up and away (new-openbomber Give) + sparkle ring + label. */
  collect(x: number, y: number, icon: Texture, text: string, color: number, good = true) {
    const px = x * T, py = y * T;
    const s = new Sprite({ texture: icon, anchor: 0.5, x: px, y: py });
    this.shot(s, this.over, 0.8, k => {
      const t = k * 4;
      const rot = clamp(t - 1, 0, 2) / 2;
      const fly = clamp(t, 0, 1) ** 3 + clamp(t - 3, 0, 1) ** 3;
      let sc = 1 - clamp(t - 3, 0, 1);
      sc *= 1 - clamp(t, 0, 0.3);
      s.alpha = 0.2 + sc;
      s.scale.set(Math.cos(rot * Math.PI * 3) * sc, sc);
      s.y = py - fly * 32;
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
    this.label(px, py - 14, text, color);
  }

  private whites = new Map<Texture, Texture>();
  /** White silhouette of a texture (made once). */
  private whiteOf(tex: Texture) {
    let w = this.whites.get(tex);
    if (w) return w;
    const f = tex.frame;
    const c = document.createElement('canvas');
    c.width = f.width; c.height = f.height;
    const g = c.getContext('2d')!;
    g.drawImage(tex.source.resource as CanvasImageSource, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, f.width, f.height);
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
