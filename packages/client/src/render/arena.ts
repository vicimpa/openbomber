// Static arena: floor grass, cracked-ground decals where bricks were destroyed, walls and bricks,
// the grey border wall ring. Split into 16x16-tile chunks, each cached as a texture and redrawn
// only when one of its tiles changes; chunks outside the view are culled. Handles 75x75 maps.
import { Container, Sprite } from 'pixi.js';
import { Tile, type FallingBlock, type WorldState } from '@ob/game';

import type { GameAssets } from './assets';
import type { Effects } from './fx';
import type { ProcTextures } from './textures';

const T = 32;
const CH = 16; // chunk size in tiles

interface Chunk { c: Container; x0: number; y0: number; x1: number; y1: number; dirty: boolean }

export class Arena {
  readonly root = new Container();
  /** Danger tint on the ring that is about to turn into walls (zone warning). */
  readonly zoneLayer = new Container();

  private w = 0;
  private h = 0;
  private gw = 0; // grid incl. border ring: (w + 2) x (h + 2), cell (x, y) ↔ grid (x + 1, y + 1)
  private gh = 0;
  private tiles = new Uint8Array(0);
  private round = -1;
  private floor: Sprite[] = [];
  private blocks: (Sprite | null)[] = [];
  private cracked = new Uint8Array(0);
  private chunks: Chunk[] = [];
  private chunkCols = 0;
  private smooth = false;

  /** Live falling blocks (dynamic). */
  readonly fallingRoot = new Container({ sortableChildren: true });
  readonly fallingShadows = new Container();
  private falling = new Map<number, { block: Sprite; shadow: Sprite; warn: Sprite; ttl0: number; seen: boolean }>();
  private impacts: { s: Sprite; t: number }[] = [];
  private time = 0;
  private zone: { ring: number; t: number; strips: Sprite[] } | null = null;

  onImpact?: (x: number, y: number) => void;

  constructor(private a: GameAssets, private tx: ProcTextures, private fx: Effects) {}

  get width() { return this.w; }
  get height() { return this.h; }

  /** Returns true when a brand new map was built (new round / new size). */
  sync(world: WorldState, dt: number): boolean {
    this.time += dt;
    const { width: w, height: h, tiles } = world;
    let changed = 0, walls = 0;
    if (w === this.w && h === this.h) for (let i = 0; i < tiles.length; i++) {
      if (this.tiles[i] === tiles[i]) continue;
      if (tiles[i] === Tile.Wall) walls++; else changed++;
    }
    let fresh = false;
    // a new round / regenerated map is rebuilt silently, without debris (zone shrink only adds walls)
    if (w !== this.w || h !== this.h || world.round !== this.round || changed > Math.max(40, tiles.length * 0.15)) {
      this.build(world);
      fresh = true;
    } else if (changed || walls) {
      const every = Math.max(1, Math.ceil(walls / 10)); // a whole ring closing at once: thin out the FX
      let wi = 0;
      for (let i = 0; i < tiles.length; i++) {
        const was = this.tiles[i], now = tiles[i];
        if (was === now) continue;
        const x = i % w, y = (i / w) | 0;
        if (was === Tile.Brick && now === Tile.Floor) { this.fx.brickBreak(x, y); this.setCracked(x, y); }
        if (now === Tile.Wall) this.impact(x, y, wi++ % every === 0, walls < 4);
        this.tiles[i] = now;
        this.setBlock(x, y, now);
      }
    }
    this.syncFalling(world.falling);
    this.updateImpacts(dt);
    this.updateZone(dt);
    return fresh;
  }

  /** Cull chunks against the visible world rect (px) and refresh dirty caches. */
  cull(x0: number, y0: number, x1: number, y1: number, zoom: number) {
    const smooth = zoom < 0.8;
    const remode = smooth !== this.smooth;
    this.smooth = smooth;
    for (const ch of this.chunks) {
      const vis = ch.x1 >= x0 && ch.x0 <= x1 && ch.y1 >= y0 && ch.y0 <= y1;
      ch.c.visible = vis;
      if (remode) { ch.c.cacheAsTexture(false); this.cache(ch); ch.dirty = false; continue; }
      if (ch.dirty && vis) { ch.c.updateCacheTexture(); ch.dirty = false; }
    }
  }

  private cache(ch: Chunk) {
    ch.c.cacheAsTexture({ resolution: 1, antialias: false, scaleMode: this.smooth ? 'linear' : 'nearest' });
  }

  private build(world: WorldState) {
    const { width: w, height: h, tiles } = world;
    this.w = w; this.h = h; this.round = world.round;
    this.gw = w + 2; this.gh = h + 2;
    this.tiles = new Uint8Array(tiles);
    for (const ch of this.chunks) ch.c.destroy({ children: true });
    this.root.removeChildren();
    this.chunks = [];
    this.chunkCols = Math.ceil(this.gw / CH);
    const rows = Math.ceil(this.gh / CH);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < this.chunkCols; cx++) {
      const c = new Container();
      const gx0 = cx * CH, gy0 = cy * CH;
      const ch: Chunk = {
        c, dirty: true,
        x0: (gx0 - 1) * T - T / 2, y0: (gy0 - 1) * T - T / 2,
        x1: (Math.min(this.gw, gx0 + CH) - 1) * T - T / 2, y1: (Math.min(this.gh, gy0 + CH) - 1) * T - T / 2,
      };
      this.chunks.push(ch);
      this.root.addChild(c);
    }
    const n = this.gw * this.gh;
    this.floor = new Array(n);
    this.blocks = new Array(n).fill(null);
    this.cracked = new Uint8Array(n);
    const { grass, wall } = this.a.world;
    // floor layer first in every chunk, blocks above
    const floorLayers = this.chunks.map(ch => ch.c.addChild(new Container()));
    const blockLayers = this.chunks.map(ch => ch.c.addChild(new Container()));
    this.blockLayers = blockLayers;
    for (let gy = 0; gy < this.gh; gy++) for (let gx = 0; gx < this.gw; gx++) {
      const gi = gy * this.gw + gx;
      const k = this.chunkIndex(gx, gy);
      const x = gx - 1, y = gy - 1;
      const border = gx === 0 || gy === 0 || gx === this.gw - 1 || gy === this.gh - 1;
      if (border) {
        const s = new Sprite({ texture: wall, anchor: 0.5, x: x * T, y: y * T });
        blockLayers[k].addChild(s);
        this.blocks[gi] = s;
        continue;
      }
      const f = new Sprite({ texture: grass, anchor: 0.5, x: x * T, y: y * T });
      floorLayers[k].addChild(f);
      this.floor[gi] = f;
      this.setBlock(x, y, tiles[y * w + x]);
    }
    for (const ch of this.chunks) { this.cache(ch); ch.dirty = true; }
    this.clearFalling();
    this.setZone(-1);
  }

  private blockLayers: Container[] = [];
  private chunkIndex(gx: number, gy: number) { return Math.floor(gy / CH) * this.chunkCols + Math.floor(gx / CH); }
  private touch(gx: number, gy: number) { const ch = this.chunks[this.chunkIndex(gx, gy)]; if (ch) ch.dirty = true; }

  private setBlock(x: number, y: number, tile: number) {
    const gx = x + 1, gy = y + 1, gi = gy * this.gw + gx;
    let s = this.blocks[gi];
    if (tile === Tile.Floor) {
      if (s) { s.destroy(); this.blocks[gi] = null; }
    } else {
      const tex = tile === Tile.Wall ? this.a.world.wall : this.a.world.box;
      if (!s) {
        s = new Sprite({ texture: tex, anchor: 0.5, x: x * T, y: y * T });
        this.blockLayers[this.chunkIndex(gx, gy)].addChild(s);
        this.blocks[gi] = s;
      }
      s.texture = tex;
    }
    this.touch(gx, gy);
  }

  private setCracked(x: number, y: number) {
    const gi = (y + 1) * this.gw + x + 1;
    if (this.cracked[gi]) return;
    this.cracked[gi] = 1;
    const f = this.floor[gi];
    if (f) { f.texture = this.a.world.grass2; f.scale.x = (x * 7 + y * 3) & 1 ? -1 : 1; }
    this.touch(x + 1, y + 1);
  }

  // ---------------------------------------------------------------- zone shrink warning
  /** Highlight ring `ring` (0 = outermost row of the arena); -1 clears. */
  setZone(ring: number) {
    if (this.zone) { for (const s of this.zone.strips) s.destroy(); this.zone = null; }
    if (ring < 0 || ring * 2 >= Math.min(this.w, this.h)) return;
    const x0 = ring, y0 = ring, x1 = this.w - 1 - ring, y1 = this.h - 1 - ring;
    const rect = (ax: number, ay: number, bx: number, by: number) => {
      const s = new Sprite({ texture: this.tx.white, x: ax * T - T / 2, y: ay * T - T / 2, tint: 0xff2a3a });
      s.width = (bx - ax + 1) * T; s.height = (by - ay + 1) * T;
      this.zoneLayer.addChild(s);
      return s;
    };
    const strips = [rect(x0, y0, x1, y0), rect(x0, y1, x1, y1)];
    if (y1 - 1 >= y0 + 1) strips.push(rect(x0, y0 + 1, x0, y1 - 1), rect(x1, y0 + 1, x1, y1 - 1));
    this.zone = { ring, t: 0, strips };
  }

  /** Outermost ring that still has non-wall cells (the next one to close). */
  nextRing() {
    const { w, h } = this;
    for (let r = 0; r * 2 < Math.min(w, h); r++) {
      for (let x = r; x < w - r; x++) if (this.tiles[r * w + x] !== Tile.Wall || this.tiles[(h - 1 - r) * w + x] !== Tile.Wall) return r;
      for (let y = r; y < h - r; y++) if (this.tiles[y * w + r] !== Tile.Wall || this.tiles[y * w + w - 1 - r] !== Tile.Wall) return r;
    }
    return -1;
  }

  private updateZone(dt: number) {
    if (!this.zone) return;
    this.zone.t += dt;
    const a = 0.16 + 0.1 * Math.sin(this.zone.t * 5);
    for (const s of this.zone.strips) s.alpha = a;
  }

  // ---------------------------------------------------------------- sudden death / zone blocks
  private syncFalling(list: FallingBlock[]) {
    for (const f of this.falling.values()) f.seen = false;
    for (const b of list) {
      const key = b.y * 4096 + b.x;
      let f = this.falling.get(key);
      if (!f) {
        const shadow = new Sprite({ texture: this.tx.blockShadow, anchor: 0.5, x: b.x * T, y: b.y * T });
        const warn = new Sprite({ texture: this.tx.ring, anchor: 0.5, x: b.x * T, y: b.y * T, tint: 0xff3040 });
        const block = new Sprite({ texture: this.a.world.wall, anchor: 0.5, x: b.x * T, y: b.y * T });
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
      f.block.zIndex = b.y * T;
      f.block.alpha = 1 - drop * 0.3;
      f.block.scale.set(1 - drop * 0.1, 1 + drop * 0.25);
    }
    for (const [key, f] of this.falling) if (!f.seen) {
      f.block.destroy(); f.shadow.destroy(); f.warn.destroy();
      this.falling.delete(key);
    }
  }

  private clearFalling() {
    for (const f of this.falling.values()) { f.block.destroy(); f.shadow.destroy(); f.warn.destroy(); }
    this.falling.clear();
    for (const i of this.impacts) i.s.destroy();
    this.impacts = [];
  }

  private impact(x: number, y: number, fx: boolean, shake: boolean) {
    if (fx) this.fx.blockImpact(x, y);
    const s = new Sprite({ texture: this.a.world.wall, anchor: { x: 0.5, y: 1 }, x: x * T, y: y * T + T / 2 });
    s.zIndex = y * T;
    this.fallingRoot.addChild(s);
    this.impacts.push({ s, t: 0 });
    if (shake || fx) this.onImpact?.(x, y);
  }

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
