// Overtime sky drops (world.drops): a pixel shadow grows on the target tile while the bomb or
// pickup falls from far above the camera. Bomb drops cast a reddish shadow with a blinking danger
// ring, so players learn to dodge them. Landing FX come from the 'dropLanded' event (fx.dropLand).
import { Container, Sprite, Texture } from 'pixi.js';
import { DropKind, TICK_RATE, type SkyDrop } from '@ob/game';

import { Anim } from './anim';
import type { GameAssets } from './assets';

const T = 32;
const HEIGHT = 460;      // px above the tile at the start: well beyond the top of a follow view
const SIZES = 6;         // shadow / ring growth steps

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}
const tex = (c: HTMLCanvasElement) => { const t = Texture.from(c); t.source.scaleMode = 'nearest'; return t; };

/** Filled pixel ellipse in white (tinted at runtime); `dither` thins it out for a lighter look. */
function ellipse(rx: number, ry: number, dither: 0 | 1 | 2, ring: boolean) {
  const W = rx * 2 + 1, H = ry * 2 + 1;
  const [c, g] = canvas(W, H);
  const inside = (x: number, y: number) => ((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2 <= 1;
  g.fillStyle = '#fff';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (ring ? !edge : false) continue;
    if (!ring && dither === 1 && (x + y) % 2) continue;
    if (!ring && dither === 2 && ((x + y) % 2 || y % 2)) continue;
    g.fillRect(x, y, 1, 1);
  }
  return tex(c);
}

interface View { root: Container; obj: Container; shadow: Sprite; ring: Sprite; anim: Anim | null; rem: number; total: number; t: number; seen: boolean; kind: DropKind }

export class Drops {
  /** Ground level (under pickups / bombs / heroes). */
  readonly shadows = new Container();
  /** In the air, above everything on the ground. */
  readonly air = new Container();
  private shadowTex: Texture[] = [];
  private ringTex: Texture[] = [];
  private views = new Map<number, View>();

  constructor(private a: GameAssets) {
    for (let i = 0; i < SIZES; i++) {
      const rx = 4 + i * 2, ry = Math.max(2, Math.round(rx * 0.42));
      this.shadowTex.push(ellipse(rx, ry, i < 2 ? 2 : i < 4 ? 1 : 0, false));
      this.ringTex.push(ellipse(rx + 2, ry + 1, 0, true));
    }
  }

  sync(drops: readonly SkyDrop[], dt: number) {
    for (const v of this.views.values()) v.seen = false;
    for (const d of drops) {
      let v = this.views.get(d.id);
      if (!v) v = this.make(d);
      v.seen = true;
      // smooth local clock, kept in step with the (tick-rate) ttl
      const rem = Math.max(0, d.ttl / TICK_RATE);
      v.rem = Math.abs(v.rem - dt - rem) > 2 / TICK_RATE ? rem : Math.max(0, v.rem - dt);
      v.total = Math.max(v.total, rem, 0.05);
      v.t += dt;
      this.place(v, d, dt);
    }
    for (const [id, v] of this.views) if (!v.seen) { v.root.destroy({ children: true }); v.obj.destroy({ children: true }); this.views.delete(id); }
  }

  clear() {
    for (const v of this.views.values()) { v.root.destroy({ children: true }); v.obj.destroy({ children: true }); }
    this.views.clear();
  }

  private make(d: SkyDrop): View {
    const bomb = d.kind === DropKind.Bomb;
    const root = new Container();
    const shadow = new Sprite({ texture: this.shadowTex[0], anchor: 0.5, tint: bomb ? 0x5c1420 : 0x1c1628 });
    const ring = new Sprite({ texture: this.ringTex[0], anchor: 0.5, tint: 0xff3a4a, visible: bomb });
    root.addChild(shadow, ring);
    this.shadows.addChild(root);
    const obj = new Container();
    let anim: Anim | null = null;
    if (bomb) {
      anim = new Anim(this.a.bombs.normal, 8, { y: -3 }); // fuse already sparking
      obj.addChild(anim);
    } else obj.addChild(new Sprite({ texture: this.a.pickupIcon[d.pickup] ?? Texture.EMPTY, anchor: 0.5 }));
    this.air.addChild(obj);
    const v: View = { root, obj, shadow, ring, anim, rem: d.ttl / TICK_RATE, total: d.ttl / TICK_RATE, t: Math.random() * 3, seen: true, kind: d.kind };
    this.views.set(d.id, v);
    return v;
  }

  private place(v: View, d: SkyDrop, dt: number) {
    const k = 1 - v.rem / v.total;               // 0 → 1 as it comes down
    const px = d.x * T, py = d.y * T;
    v.root.position.set(px, py + 9);
    const i = Math.min(SIZES - 1, Math.floor(k * SIZES));
    v.shadow.texture = this.shadowTex[i];
    v.shadow.alpha = k < 0.5 ? 0.5 : 0.75;
    if (v.ring.visible) {
      v.ring.texture = this.ringTex[i];
      // blinks faster as it gets close
      v.ring.alpha = Math.sin(v.t * (8 + k * 22)) > 0 ? 1 : k > 0.6 ? 0.34 : 0;
    }
    // fall: accelerating from far above, a little wobble / spin on the way
    const fall = v.rem / v.total;
    const z = Math.round(HEIGHT * fall * fall);
    const wob = Math.round(Math.sin(v.t * 7) * 2 * fall);
    v.obj.position.set(px + wob, py - z);
    if (v.anim) {
      v.anim.tick(dt);
      v.obj.rotation = Math.sin(v.t * 9) * 0.3 * fall;
      v.obj.scale.set(1 - 0.08 * fall, 1 + 0.12 * fall); // stretched by the speed
    } else {
      // pickups tumble like a coin
      const c = Math.cos(v.t * 9);
      v.obj.scale.set(Math.abs(c) < 0.25 ? 0.25 * Math.sign(c || 1) : c, 1);
    }
  }
}
