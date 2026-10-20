// Explosion visuals. Every `explosion` event becomes its own independent object built from the 5x5
// explode atlas: centre slice, inner "mid" slices for every arm cell, END slices on the last cell of
// each arm. Explosions never merge: crossings and chain reactions simply overlap, each on its own
// timeline. world.flames stays the authoritative hit area but is not drawn.
//
// Timeline (seconds from the moment the event is handled), LETHAL = FLAME_TIME:
//   0 .. LETHAL           fire: full-fire frame 5 right away, then fire+smoke frame 6;
//   0 .. FLASH            impact flash on top: frames 0-4 (flash, star, ring) played fast;
//   LETHAL .. +SMOKE      non-lethal grey smoke tail (frames 7-8) fading out; frame 9 is empty.
import { Container, Sprite, Texture } from 'pixi.js';
import { FLAME_TIME, FlameShape, TICK_RATE, type GameEvent } from '@ob/game';

import type { GameAssets } from './assets';
import type { ProcTextures } from './textures';

const T = 32;
export const LETHAL = FLAME_TIME / TICK_RATE;
const FLASH = Math.min(0.1, LETHAL * 0.3);
const FLASH_FRAMES = [0, 1, 2, 3, 4];
const FIRE_SPLIT = 0.6; // share of LETHAL showing full fire (frame 5) before fire+smoke (frame 6)
const SMOKE = 0.12;
const SMOKE_FRAMES = [7, 8];

type Ev = Extract<GameEvent, { type: 'explosion' }>;

interface Cell { fire: Sprite; flash: Sprite; sx: number; sy: number }
interface Boom { t: number; cells: Cell[]; glows: Sprite[]; glowA: number[] }

/** Atlas cell [col, row] inside the 5x5 frame for an explosion cell. */
function slice(cx: number, cy: number, ex: number, ey: number, shape: FlameShape): [number, number] {
  const dx = Math.sign(cx - ex), dy = Math.sign(cy - ey);
  if (dx === 0 && dy === 0) return [2, 2];
  const end = shape === FlameShape.EndUp || shape === FlameShape.EndDown || shape === FlameShape.EndLeft || shape === FlameShape.EndRight;
  const k = end ? 2 : 1;
  return [2 + dx * k, 2 + dy * k];
}

export class Explosions {
  /** Fire/smoke sprites (normal blend). */
  readonly root = new Container();
  /** Per-explosion light (additive). */
  readonly glow = new Container();
  private pool: Sprite[] = [];
  private glowPool: Sprite[] = [];
  private live: Boom[] = [];

  constructor(private a: GameAssets, private tx: ProcTextures) {
    this.glow.blendMode = 'add';
  }

  get count() { return this.live.length; }

  private sprite(parent: Container, pool: Sprite[], tex: Texture): Sprite {
    const s = pool.pop() ?? new Sprite({ anchor: 0.5 });
    s.texture = tex;
    s.alpha = 1; s.visible = true; s.tint = 0xffffff;
    s.scale.set(1);
    parent.addChild(s);
    return s;
  }

  add(e: Ev) {
    const boom: Boom = { t: 0, cells: [], glows: [], glowA: [] };
    let x0 = e.x, x1 = e.x, y0 = e.y, y1 = e.y;
    const flashLayer: Sprite[] = [];
    for (const c of e.cells) {
      const [sx, sy] = slice(c.x, c.y, e.x, e.y, c.shape);
      const fire = this.sprite(this.root, this.pool, this.a.explode[5][sy][sx]);
      fire.position.set(c.x * T, c.y * T);
      const flash = this.sprite(this.root, this.pool, Texture.EMPTY);
      flash.position.set(c.x * T, c.y * T);
      flashLayer.push(flash);
      boom.cells.push({ fire, flash, sx, sy });
      if (c.y === e.y) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); }
      if (c.x === e.x) { y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
    }
    // the flash of this explosion sits above all of its fire slices
    for (const f of flashLayer) this.root.addChild(f);

    // light: a bright core plus one stretched glow along each axis of the cross
    const g = (x: number, y: number, w: number, h: number, a: number, tint: number) => {
      const s = this.sprite(this.glow, this.glowPool, this.tx.glow);
      s.position.set(x, y);
      s.width = w; s.height = h;
      s.tint = tint;
      boom.glows.push(s); boom.glowA.push(a);
    };
    g(e.x * T, e.y * T, 3 * T, 3 * T, 0.5, 0xff9a40);
    if (x1 > x0) g(((x0 + x1) / 2) * T, e.y * T, (x1 - x0 + 1.2) * T, 1.4 * T, 0.28, 0xff7a20);
    if (y1 > y0) g(e.x * T, ((y0 + y1) / 2) * T, 1.4 * T, (y1 - y0 + 1.2) * T, 0.28, 0xff7a20);

    this.live.push(boom);
    this.step(boom, 0);
  }

  update(dt: number) {
    const live = this.live;
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i];
      if (!this.step(b, dt)) {
        this.release(b);
        live[i] = live[live.length - 1];
        live.pop();
      }
    }
  }

  /** Advance one explosion; false once it is over. */
  private step(b: Boom, dt: number): boolean {
    b.t += dt;
    const t = b.t;
    if (t >= LETHAL + SMOKE) return false;
    const ex = this.a.explode;
    let fireFrame: number, fireAlpha = 1;
    if (t < LETHAL) fireFrame = t < LETHAL * FIRE_SPLIT ? 5 : 6;
    else {
      const k = (t - LETHAL) / SMOKE;
      fireFrame = SMOKE_FRAMES[Math.min(SMOKE_FRAMES.length - 1, Math.floor(k * SMOKE_FRAMES.length))];
      fireAlpha = 0.85 * (1 - k);
    }
    const flashFrame = t < FLASH ? FLASH_FRAMES[Math.min(FLASH_FRAMES.length - 1, Math.floor((t / FLASH) * FLASH_FRAMES.length))] : -1;
    for (const c of b.cells) {
      c.fire.texture = ex[fireFrame][c.sy][c.sx];
      c.fire.alpha = fireAlpha;
      if (flashFrame >= 0) c.flash.texture = ex[flashFrame][c.sy][c.sx];
      c.flash.visible = flashFrame >= 0;
    }
    // light follows the lethal window and is gone with the fire
    const k = Math.min(1, t / LETHAL);
    const ga = t < LETHAL ? (1 - k * k) : 0;
    for (let i = 0; i < b.glows.length; i++) b.glows[i].alpha = b.glowA[i] * ga * (t < 0.05 ? 1.3 : 1);
    return true;
  }

  private release(b: Boom) {
    for (const c of b.cells) {
      c.fire.removeFromParent(); this.pool.push(c.fire);
      c.flash.removeFromParent(); this.pool.push(c.flash);
    }
    for (const g of b.glows) { g.removeFromParent(); this.glowPool.push(g); }
  }

  clear() {
    for (const b of this.live) this.release(b);
    this.live.length = 0;
  }
}
