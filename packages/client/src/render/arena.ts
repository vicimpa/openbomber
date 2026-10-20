// Static arena: ground, scorch marks (ruines autotile), walls and bricks with soft shadows.
// Everything lives in one container cached as a texture and is redrawn only when tiles change.
import { Container, Sprite, Texture } from 'pixi.js';
import { Tile, type FallingBlock, type WorldState } from '@ob/game';

import type { GameAssets } from './assets';
import type { Effects } from './fx';
import type { ProcTextures } from './textures';

const T = 32;
export const OUTSIDE = 7; // tiles of decorative ground drawn beyond the border walls

const hash = (x: number, y: number, s: number) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ruines.png frame index for each 4-neighbour mask (T=1, L=2, R=4, B=8), from new-openbomber's terrain table
const RUIN_FRAMES: Record<number, number[]> = {
  0: [9], 8: [1], 9: [2, 7], 4: [3], 6: [4, 5], 2: [6], 1: [8], 15: [10],
  11: [11], 13: [12], 3: [13], 5: [14], 10: [15], 12: [16], 7: [17], 14: [18],
};

export class Arena {
  readonly root = new Container();
  private ground = new Container();
  private scorchLayer = new Container();
  private shadowLayer = new Container();
  private blockLayer = new Container();

  private w = 0;
  private h = 0;
  private tiles = new Uint8Array(0);
  private round = -1;
  private blocks: (Sprite | null)[] = [];
  private shadows: Sprite[] = [];
  private scorch = new Map<number, Sprite>();
  private dirty = false;

  /** Live falling blocks (dynamic, drawn by the caller in the entity layer). */
  readonly fallingRoot = new Container();
  readonly fallingShadows = new Container();
  private falling = new Map<number, { block: Sprite; shadow: Sprite; warn: Sprite; ttl0: number; seen: boolean }>();
  private impacts: { s: Sprite; t: number }[] = [];
  private time = 0;

  constructor(private a: GameAssets, private tx: ProcTextures, private fx: Effects) {
    this.root.addChild(this.ground, this.scorchLayer, this.shadowLayer, this.blockLayer);
    this.root.cacheAsTexture(true);
  }

  get width() { return this.w; }
  get height() { return this.h; }

  /** Returns true when a brand new map was built (new round / new size). */
  sync(world: WorldState, dt: number): boolean {
    this.time += dt;
    const { width: w, height: h, tiles } = world;
    let fresh = false;
    let changed = 0;
    if (w === this.w && h === this.h) for (let i = 0; i < tiles.length; i++) if (this.tiles[i] !== tiles[i]) changed++;
    // a new round / regenerated map (many cells at once) is rebuilt silently, without debris
    if (w !== this.w || h !== this.h || world.round !== this.round || changed > tiles.length * 0.15) {
      this.build(world);
      fresh = true;
    } else if (changed) {
      for (let i = 0; i < tiles.length; i++) {
        const was = this.tiles[i], now = tiles[i];
        if (was === now) continue;
        const x = i % w, y = (i / w) | 0;
        if (was === Tile.Brick && now === Tile.Floor) this.fx.brickBreak(x, y);
        if (now === Tile.Wall) this.impact(x, y);
        this.tiles[i] = now;
        this.setBlock(i, now);
      }
    }
    this.syncFalling(world.falling, dt);
    this.updateImpacts(dt);
    if (this.dirty) {
      this.dirty = false;
      this.root.updateCacheTexture();
    }
    return fresh;
  }

  isSolid(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    return this.tiles[y * this.w + x] !== Tile.Floor;
  }

  private build(world: WorldState) {
    const { width: w, height: h, tiles } = world;
    this.w = w; this.h = h; this.round = world.round;
    this.tiles = new Uint8Array(tiles);
    for (const l of [this.ground, this.scorchLayer, this.shadowLayer, this.blockLayer]) l.removeChildren().forEach(c => c.destroy());
    this.scorch.clear();
    this.blocks = new Array(w * h).fill(null);
    this.shadows = [];
    const seed = world.round * 7 + 13;
    const { grass, grass2, wall } = this.a.world;
    for (let y = -OUTSIDE; y < h + OUTSIDE; y++) for (let x = -OUTSIDE; x < w + OUTSIDE; x++) {
      const inside = x >= 0 && y >= 0 && x < w && y < h;
      const r = hash(x, y, seed);
      const g = new Sprite({ texture: r < 0.07 && inside ? grass2 : grass, anchor: 0.5, x: x * T, y: y * T });
      if (hash(y, x, seed + 1) < 0.5) g.scale.x = -1;
      if (inside) g.tint = (x + y) & 1 ? 0xffffff : 0xeef3ea;
      else {
        const d = Math.max(-x, -y, x - w + 1, y - h + 1);
        const v = Math.max(0.28, 0.62 - d * 0.06);
        const c = Math.round(255 * v);
        g.tint = (c << 16) | (Math.round(c * 1.02) << 8) | Math.round(c * 1.08);
      }
      this.ground.addChild(g);
      const border = !inside && x >= -1 && y >= -1 && x <= w && y <= h;
      if (border) {
        const s = new Sprite({ texture: wall, anchor: 0.5, x: x * T, y: y * T, tint: 0xc9c2d6 });
        this.blockLayer.addChild(s);
      }
    }
    for (let i = 0; i < w * h; i++) {
      const sh = this.shadowSprite(i % w, (i / w) | 0, false);
      this.shadows.push(sh);
      this.shadowLayer.addChild(sh);
    }
    for (let i = 0; i < w * h; i++) this.setBlock(i, tiles[i]);
    this.clearFalling();
    this.dirty = true;
  }

  private shadowSprite(x: number, y: number, visible: boolean) {
    const s = new Sprite({ texture: Texture.WHITE, x: x * T - T / 2, y: y * T - T / 2, tint: 0x14101e, alpha: 0.22 });
    s.width = T; s.height = 6;
    s.visible = visible;
    return s;
  }

  private setBlock(i: number, tile: number) {
    const x = i % this.w, y = (i / this.w) | 0;
    let s = this.blocks[i];
    if (tile === Tile.Floor) {
      if (s) { s.destroy(); this.blocks[i] = null; }
    } else {
      const tex = tile === Tile.Wall ? this.a.world.wall : this.a.world.box;
      if (!s) { s = new Sprite({ texture: tex, anchor: 0.5, x: x * T, y: y * T }); this.blockLayer.addChild(s); this.blocks[i] = s; }
      s.texture = tex;
    }
    this.updateShadow(i);
    if (y + 1 < this.h) this.updateShadow(i + this.w);
    this.dirty = true;
  }

  private updateShadow(i: number) {
    const y = (i / this.w) | 0;
    this.shadows[i].visible = this.tiles[i] === Tile.Floor && (y === 0 || this.tiles[i - this.w] !== Tile.Floor);
  }

  /** Mark exploded cells as scorched ground. */
  addScorch(cells: { x: number; y: number }[]) {
    const changed = new Set<number>();
    for (const c of cells) {
      if (c.x < 0 || c.y < 0 || c.x >= this.w || c.y >= this.h) continue;
      const i = c.y * this.w + c.x;
      if (!this.scorch.has(i)) {
        const s = new Sprite({ anchor: 0.5, x: c.x * T, y: c.y * T, alpha: 0.8 });
        this.scorch.set(i, s);
        this.scorchLayer.addChild(s);
      }
      changed.add(i);
      changed.add(i - 1); changed.add(i + 1); changed.add(i - this.w); changed.add(i + this.w);
    }
    for (const i of changed) {
      const s = this.scorch.get(i);
      if (!s) continue;
      const x = i % this.w;
      const has = (j: number, dx: number) => (dx === 0 || ((j % this.w) - x) === dx) && this.scorch.has(j);
      const m = (has(i - this.w, 0) ? 1 : 0) | (has(i - 1, -1) ? 2 : 0) | (has(i + 1, 1) ? 4 : 0) | (has(i + this.w, 0) ? 8 : 0);
      const opts = RUIN_FRAMES[m];
      s.texture = this.a.ruines[opts[(i * 31) % opts.length]];
    }
    if (changed.size) this.dirty = true;
  }

  // ---------------------------------------------------------------- sudden death
  private syncFalling(list: FallingBlock[], dt: number) {
    for (const f of this.falling.values()) f.seen = false;
    for (const b of list) {
      const key = b.y * 4096 + b.x;
      let f = this.falling.get(key);
      if (!f) {
        const shadow = new Sprite({ texture: this.tx.blockShadow, anchor: 0.5, x: b.x * T, y: b.y * T });
        const warn = new Sprite({ texture: this.tx.ring, anchor: 0.5, x: b.x * T, y: b.y * T, tint: 0xff3040 });
        const block = new Sprite({ texture: this.a.world.wall, anchor: { x: 0.5, y: 0.5 }, x: b.x * T, y: b.y * T });
        this.fallingShadows.addChild(shadow, warn);
        this.fallingRoot.addChild(block);
        f = { block, shadow, warn, ttl0: Math.max(b.ttl, 1), seen: true };
        this.falling.set(key, f);
      }
      f.seen = true;
      f.ttl0 = Math.max(f.ttl0, b.ttl);
      const k = 1 - b.ttl / f.ttl0; // 0 → 1 as it approaches
      f.shadow.scale.set(0.25 + 0.75 * k);
      f.shadow.alpha = 0.25 + 0.75 * k;
      const blink = Math.sin(this.time * (8 + k * 20)) > 0;
      f.warn.alpha = (0.25 + 0.5 * k) * (blink ? 1 : 0.4);
      f.warn.scale.set(0.55 - 0.1 * k, (0.55 - 0.1 * k) * 0.8);
      // the block itself drops in during the last ~0.45 s (27 ticks)
      const drop = Math.min(1, b.ttl / 27);
      f.block.visible = b.ttl < 27;
      f.block.y = b.y * T - drop * drop * 260;
      f.block.zIndex = b.y * T + 15;
      f.block.alpha = 1 - drop * 0.3;
      f.block.scale.set(1 - drop * 0.1, 1 + drop * 0.25);
    }
    for (const [key, f] of this.falling) if (!f.seen) {
      f.block.destroy(); f.shadow.destroy(); f.warn.destroy();
      this.falling.delete(key);
    }
    void dt;
  }

  private clearFalling() {
    for (const f of this.falling.values()) { f.block.destroy(); f.shadow.destroy(); f.warn.destroy(); }
    this.falling.clear();
    for (const i of this.impacts) i.s.destroy();
    this.impacts = [];
  }

  private impact(x: number, y: number) {
    this.fx.blockImpact(x, y);
    const s = new Sprite({ texture: this.a.world.wall, anchor: { x: 0.5, y: 1 }, x: x * T, y: y * T + T / 2 });
    s.zIndex = y * T + 15;
    this.fallingRoot.addChild(s);
    this.impacts.push({ s, t: 0 });
    this.onImpact?.(x, y);
  }

  onImpact?: (x: number, y: number) => void;

  private updateImpacts(dt: number) {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const im = this.impacts[i];
      im.t += dt;
      const k = Math.min(1, im.t / 0.22);
      const sq = Math.sin(k * Math.PI) * (1 - k * 0.5);
      im.s.scale.set(1 + 0.18 * sq, 1 - 0.22 * sq);
      if (k >= 1) { im.s.destroy(); this.impacts.splice(i, 1); }
    }
  }
}
