// Bomb and pickup views (explosions: explosions.ts).
import { Container, Sprite, Texture } from 'pixi.js';
import {
  BOMB_FUSE, BombKind, BombMotion, TICK_RATE,
  type BombState, type PickupState, type PickupType,
} from '@ob/game';

import { Anim } from './anim';
import type { GameAssets } from './assets';
import { bounce, type Effects } from './fx';
import type { ProcTextures } from './textures';

const T = 32;

// ---------------------------------------------------------------- bombs
const KIND_ANIM: Record<BombKind, string> = {
  [BombKind.Normal]: 'normal', [BombKind.Remote]: 'distance', [BombKind.Pierce]: 'normal', [BombKind.Crazy]: 'random',
};

export class BombView {
  readonly root = new Container();
  private shadow: Sprite;
  private body = new Container();
  private sprite: Anim;
  private glow: Sprite;
  private led: Sprite;
  private phase = Math.random() * 6;
  private squash = 0;
  private motion: BombMotion = BombMotion.Idle;
  private segKey = '';
  private trailT = 0;
  private spin = 0;
  private time = 0;
  seen = true;
  x = 0; y = 0; // last ground position (tiles)

  constructor(a: GameAssets, tx: ProcTextures, private fx: Effects, b: BombState) {
    this.shadow = new Sprite({ texture: tx.shadow, anchor: 0.5, y: 9 });
    this.sprite = new Anim(a.bombs[KIND_ANIM[b.kind]] ?? a.bombs.normal, 6, { y: -3 });
    if (b.kind === BombKind.Pierce) this.sprite.tint = 0xffa48a;
    this.glow = new Sprite({ texture: tx.glow, anchor: 0.5, y: -3, blendMode: 'add', alpha: 0 });
    this.glow.tint = b.kind === BombKind.Pierce ? 0xff5a20 : b.kind === BombKind.Crazy ? 0xff40c0 : 0xff6a30;
    this.led = new Sprite({ texture: tx.glow, anchor: 0.5, x: 9, y: -17, blendMode: 'add', scale: 0.22, tint: 0xff2030, visible: b.kind === BombKind.Remote });
    this.body.addChild(this.sprite, this.glow, this.led);
    this.root.addChild(this.shadow, this.body);
    this.motion = b.motion;
    this.squash = 1; // placement pop
  }

  update(b: BombState, dt: number, holder: { x: number; y: number } | null) {
    this.time += dt;
    let gx = b.x, gy = b.y, z = 0;
    const prev = this.motion;

    if (b.motion === BombMotion.Flying) {
      const p = Math.min(1, Math.max(0, b.progress));
      gx = b.fromX + (b.toX - b.fromX) * p;
      gy = b.fromY + (b.toY - b.fromY) * p;
      const dist = Math.hypot(b.toX - b.fromX, b.toY - b.fromY);
      const hmax = (0.45 + 0.32 * dist) * T;
      z = 4 * hmax * p * (1 - p);
      const key = `${b.fromX},${b.fromY},${b.toX},${b.toY}`;
      if (prev === BombMotion.Flying && key !== this.segKey && this.segKey) { // bounced: new hop
        this.squash = 0.8;
        this.fx.landingDust(gx * T, gy * T);
      }
      this.segKey = key;
      this.spin += dt * (b.toX >= b.fromX ? 9 : -9);
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = 0.02; this.fx.trail(gx * T, gy * T - 3, z); }
      this.shadow.visible = true;
      this.shadow.scale.set(1 - 0.55 * (z / (hmax + 1)));
      this.shadow.alpha = 1 - 0.5 * (z / (hmax + 1));
    } else {
      this.segKey = '';
      this.spin *= Math.exp(-dt * 20);
      if (prev === BombMotion.Flying) { this.squash = 1; this.fx.landingDust(b.x * T, b.y * T); }
      this.shadow.visible = b.motion !== BombMotion.Carried;
      this.shadow.scale.set(1); this.shadow.alpha = 1;
    }
    if (b.motion === BombMotion.Carried && holder) { gx = holder.x; gy = holder.y; z = 27; }
    if (b.motion === BombMotion.Sliding) {
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = 0.04; this.fx.footDust(gx * T, gy * T + 9); }
      this.spin = Math.sin(this.time * 30) * 0.12;
    }
    this.motion = b.motion;
    this.x = gx; this.y = gy;

    this.root.position.set(gx * T, gy * T);
    this.root.zIndex = gy * T + (b.motion === BombMotion.Carried ? 2 : b.motion === BombMotion.Flying ? 20 + z : -4);
    this.body.y = -z;
    this.body.rotation = b.motion === BombMotion.Flying ? Math.sin(this.spin) * 0.4 : this.spin;

    // fuse pulse: faster and stronger as the fuse runs out (paused while carried)
    const fuseK = b.fuse >= 0 ? 1 - Math.min(1, b.fuse / BOMB_FUSE) : 0.15;
    if (b.motion !== BombMotion.Carried) this.phase += dt * (5 + fuseK * fuseK * 26);
    const amp = 0.05 + fuseK * 0.07;
    let sx = 1 + Math.sin(this.phase) * amp, sy = 1 - Math.sin(this.phase) * amp;
    if (this.squash > 0) {
      const s = Math.sin(this.squash * Math.PI * 1.5) * this.squash * 0.35;
      sx += s; sy -= s;
      this.squash = Math.max(0, this.squash - dt * 4.5);
    }
    this.body.scale.set(sx, sy);
    this.sprite.tick(dt);

    const lastSecond = b.fuse >= 0 && b.fuse < TICK_RATE * 0.6;
    const flick = lastSecond && Math.sin(this.phase * 2) > 0;
    this.sprite.tint = flick ? 0xff8080 : (b.kind === BombKind.Pierce ? 0xffa48a : 0xffffff);
    this.glow.alpha = (0.15 + 0.45 * fuseK * fuseK) * (0.6 + 0.4 * Math.sin(this.phase)) * (this.fx.lowQuality ? 0.6 : 1);
    this.glow.scale.set(0.8 + fuseK * 0.4);
    if (this.led.visible) this.led.alpha = Math.sin(this.time * 9) > 0 ? 1 : 0.15;
  }

  destroy() { this.root.destroy({ children: true }); }
}

// ---------------------------------------------------------------- pickups
export class PickupView {
  readonly root = new Container();
  private body = new Container();
  private icon: Sprite;
  private blink: Anim;
  private shadow: Sprite;
  private t = 0;
  private speed = 3 + Math.random() * 12;
  seen = true;
  type: PickupType;
  x: number; y: number;

  constructor(a: GameAssets, tx: ProcTextures, p: PickupState) {
    this.type = p.type;
    this.x = p.x; this.y = p.y;
    this.icon = new Sprite({ texture: a.pickupIcon[p.type] ?? Texture.EMPTY, anchor: 0.5 });
    this.blink = new Anim(a.blink, 3 + Math.random() * 12);
    this.blink.gap = 5;
    this.shadow = new Sprite({ texture: tx.shadow, anchor: 0.5, y: 12, scale: { x: 1.1, y: 0.8 } });
    this.body.addChild(this.icon, this.blink);
    this.root.addChild(this.shadow, this.body);
    this.root.position.set(p.x * T, p.y * T);
  }

  get texture() { return this.icon.texture; }

  update(p: PickupState, dt: number) {
    this.x = p.x; this.y = p.y;
    this.root.position.set(p.x * T, p.y * T);
    this.t += dt;
    // new-openbomber Bonus: pop out with a bounce, then gentle bob
    const ft = this.t * 60;
    const bt = ft * 0.03, st = ft * 0.12;
    const bo = bt < 1 ? bounce(bt) : 1;
    this.body.scale.set(st < 1 ? st : 1);
    this.body.y = Math.round(Math.sin(this.t * this.speed * 0.25) * bo - (1 - bo) * 24) - 1;
    this.shadow.alpha = 0.5 + 0.5 * bo;
    this.blink.tick(dt);
  }

  destroy() { this.root.destroy({ children: true }); }
}
