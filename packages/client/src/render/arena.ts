// Static arena: floor grass, scorch trails left by explosions (autotiled like new-openbomber's
// Ruines), walls and bricks,
// the grey border wall ring (along the outline of a shaped arena; the cells beyond it stay empty,
// so the countryside shows through). Split into 16x16-tile chunks, each cached as a texture and redrawn
// only when one of its tiles changes; chunks outside the view are culled. Handles 75x75 maps.
import { Container, Sprite } from 'pixi.js';
import { ArenaShape, Tile, shapeMask, zoneDepth, type FallingBlock, type WorldState } from '@ob/game';

import type { GameAssets } from './assets';
import type { Effects } from './fx';
import type { ProcTextures } from './textures';
import { cellHash, makeTileVariants, type TileVariants } from './tiles';

const T = 32;
const CH = 16; // chunk size in tiles

// Scorch autotile (new-openbomber library/terrain.ts + terrains/ruines): neighbour bits of a
// scorched cell → frames of the 5x4 ruines sheet. Several frames for one mask are variants.
const C = 1, U = 2, L = 4, R = 8, D = 16;
const RUINE_MASKS = [
  0, C | D, U | C | D, C | R, L | C | R,
  L | C | R, L | C, U | C | D, U | C, C,
  U | L | R | D | C, U | L | D | C, U | R | D | C, U | L | C, U | R | C,
  L | D | C, R | D | C, U | L | R | C, L | R | D | C,
];

interface Chunk { c: Container; x0: number; y0: number; x1: number; y1: number; dirty: boolean }

export class Arena {
  readonly root = new Container();
  /** Danger tint on the ring that is about to turn into walls (zone warning). */
  readonly zoneLayer = new Container();
  /** The previous map, left standing where it was while the camera travels to the new one
   *  (a frozen snapshot, filled by the renderer). */
  readonly ghostRoot = new Container();

  private w = 0;
  private h = 0;
  private gw = 0; // grid incl. border ring: (w + 2) x (h + 2), cell (x, y) ↔ grid (x + 1, y + 1)
  private gh = 0;
  private tiles = new Uint8Array(0);
  private shape = ArenaShape.Rect;
  private mask: Uint8Array = new Uint8Array(0);
  private round = -1;
  private floor: Sprite[] = [];
  private blocks: (Sprite | null)[] = [];
  private scorched = new Uint8Array(0);
  private ruins: (Sprite | null)[] = [];
  private ruinLayers: Container[] = [];
  private ruinFrames = new Map<number, number[]>(); // mask → frame indices
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

  private vars: TileVariants;
  /** Per-map seed for the tile variants. */
  private seed = 1;

  constructor(private a: GameAssets, private tx: ProcTextures, private fx: Effects) {
    this.vars = makeTileVariants(a.world);
  }

  /** Stone block shown for cell (x, y) of the current map (falling / impact blocks match it). */
  private wallTex(x: number, y: number) { return this.vars.wallAt(x, y, this.seed); }

  /** Calm per-tile shading of the grass: big soft, barely visible patches. */
  private floorTint(x: number, y: number) {
    const S = 5, gx = x / S, gy = y / S, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const h = (a: number, b: number) => cellHash(a, b, this.seed + 9);
    const n = h(ix, iy) * (1 - fx) * (1 - fy) + h(ix + 1, iy) * fx * (1 - fy) + h(ix, iy + 1) * (1 - fx) * fy + h(ix + 1, iy + 1) * fx * fy;
    const v = 0.955 + 0.045 * n + (cellHash(x, y, this.seed + 10) - 0.5) * 0.012;
    const c = Math.min(255, Math.round(255 * v));
    return (c << 16) | (c << 8) | Math.round(c * 0.99);
  }

  get width() { return this.w; }
  get height() { return this.h; }

  /** Returns true when a brand new map was built (new round / new size). */
  /** Whether sync() would build a brand new map for this world. */
  willRebuild(world: WorldState, force = false) {
    const { width: w, height: h, tiles } = world;
    if (force || w !== this.w || h !== this.h || world.round !== this.round || world.shape !== this.shape) return true;
    let changed = 0;
    for (let i = 0; i < tiles.length; i++) if (this.tiles[i] !== tiles[i] && tiles[i] !== Tile.Wall) changed++;
    return changed > Math.max(40, tiles.length * 0.15);
  }

  sync(world: WorldState, dt: number, force = false): boolean {
    this.time += dt;
    const { width: w, height: h, tiles } = world;
    let changed = 0, walls = 0;
    if (w === this.w && h === this.h) for (let i = 0; i < tiles.length; i++) {
      if (this.tiles[i] === tiles[i]) continue;
      if (tiles[i] === Tile.Wall) walls++; else changed++;
    }
    let fresh = false;
    // a new round / regenerated map is rebuilt silently, without debris (zone shrink only adds walls)
    if (this.willRebuild(world, force)) {
      this.build(world);
      fresh = true;
    } else if (changed || walls) {
      const every = Math.max(1, Math.ceil(walls / 10)); // a whole ring closing at once: thin out the FX
      let wi = 0;
      for (let i = 0; i < tiles.length; i++) {
        const was = this.tiles[i], now = tiles[i];
        if (was === now) continue;
        const x = i % w, y = (i / w) | 0;
        this.tiles[i] = now;
        if (!this.mask[i]) continue;
        if (was === Tile.Brick && now === Tile.Floor) this.fx.brickBreak(x, y, 0, 0, this.blocks[(y + 1) * this.gw + x + 1]?.texture);
        if (now === Tile.Wall) this.impact(x, y, wi++ % every === 0, walls < 4);
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
    this.shape = world.shape ?? ArenaShape.Rect;
    this.mask = shapeMask(this.shape, w, h);
    this.seed = (Math.random() * 0x7fffffff) | 0;
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
    this.scorched = new Uint8Array(n);
    this.ruins = new Array(n).fill(null);
    // floor layer first in every chunk, then scorch trails, blocks above
    const floorLayers = this.chunks.map(ch => ch.c.addChild(new Container()));
    this.ruinLayers = this.chunks.map(ch => ch.c.addChild(new Container()));
    const blockLayers = this.chunks.map(ch => ch.c.addChild(new Container()));
    this.blockLayers = blockLayers;
    for (let gy = 0; gy < this.gh; gy++) for (let gx = 0; gx < this.gw; gx++) {
      const gi = gy * this.gw + gx;
      const k = this.chunkIndex(gx, gy);
      const x = gx - 1, y = gy - 1;
      if (!this.inside(x, y)) {
        // the border wall runs along the outline; further out it's open countryside
        if (!this.borderWall(x, y)) continue;
        const s = new Sprite({ texture: this.wallTex(x, y), anchor: 0.5, x: x * T, y: y * T });
        blockLayers[k].addChild(s);
        this.blocks[gi] = s;
        continue;
      }
      const f = new Sprite({ texture: this.vars.floorAt(x, y, this.seed), anchor: 0.5, x: x * T, y: y * T, tint: this.floorTint(x, y) });
      floorLayers[k].addChild(f);
      this.floor[gi] = f;
      this.setBlock(x, y, tiles[y * w + x]);
    }
    for (const ch of this.chunks) { this.cache(ch); ch.dirty = true; }
    this.clearFalling();
    this.setZone(-1);
  }

  clearGhost() {
    for (const c of this.ghostRoot.removeChildren()) {
      // the snapshot sprite owns its render texture
      if (c instanceof Sprite && c.label === 'snapshot') c.texture.destroy(true);
      c.destroy({ children: true });
    }
  }

  /** Make every chunk visible and up to date (for a full snapshot of the map). */
  showAll(zoom: number) { this.cull(-1e9, -1e9, 1e9, 1e9, zoom); }

  private blockLayers: Container[] = [];
  private chunkIndex(gx: number, gy: number) { return Math.floor(gy / CH) * this.chunkCols + Math.floor(gx / CH); }
  private touch(gx: number, gy: number) { const ch = this.chunks[this.chunkIndex(gx, gy)]; if (ch) ch.dirty = true; }

  private setBlock(x: number, y: number, tile: number) {
    const gx = x + 1, gy = y + 1, gi = gy * this.gw + gx;
    let s = this.blocks[gi];
    if (tile === Tile.Floor) {
      if (s) { s.destroy(); this.blocks[gi] = null; }
    } else {
      const tex = tile === Tile.Wall ? this.wallTex(x, y) : this.vars.boxAt(x, y, this.seed);
      if (!s) {
        s = new Sprite({ texture: tex, anchor: 0.5, x: x * T, y: y * T });
        this.blockLayers[this.chunkIndex(gx, gy)].addChild(s);
        this.blocks[gi] = s;
      }
      s.texture = tex;
    }
    this.touch(gx, gy);
  }

  // ---------------------------------------------------------------- scorch trails
  /** Burn the cells an explosion went through; trails join up with their neighbours. */
  scorch(cells: readonly { x: number; y: number }[]) {
    for (const { x, y } of cells) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
      const gi = (y + 1) * this.gw + x + 1;
      if (this.scorched[gi]) continue;
      this.scorched[gi] = 1;
      this.refreshRuin(x, y);
      this.refreshRuin(x, y - 1);
      this.refreshRuin(x - 1, y);
      this.refreshRuin(x + 1, y);
      this.refreshRuin(x, y + 1);
    }
  }

  private isScorched(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.scorched[(y + 1) * this.gw + x + 1] === 1;
  }

  private refreshRuin(x: number, y: number) {
    if (!this.isScorched(x, y)) return;
    const mask = C
      | (this.isScorched(x, y - 1) ? U : 0) | (this.isScorched(x - 1, y) ? L : 0)
      | (this.isScorched(x + 1, y) ? R : 0) | (this.isScorched(x, y + 1) ? D : 0);
    const frames = this.framesFor(mask);
    if (!frames.length) return;
    const tex = this.a.ruines[frames[(x * 7 + y * 13) % frames.length]];
    const gx = x + 1, gy = y + 1, gi = gy * this.gw + gx;
    let s = this.ruins[gi];
    if (!s) {
      s = new Sprite({ texture: tex, anchor: 0.5, x: x * T, y: y * T });
      this.ruinLayers[this.chunkIndex(gx, gy)].addChild(s);
      this.ruins[gi] = s;
    } else if (s.texture === tex) return;
    s.texture = tex;
    this.touch(gx, gy);
  }

  private framesFor(mask: number) {
    let f = this.ruinFrames.get(mask);
    if (!f) {
      f = [];
      for (let i = 0; i < RUINE_MASKS.length && i < this.a.ruines.length; i++) if (RUINE_MASKS[i] === mask) f.push(i);
      this.ruinFrames.set(mask, f);
    }
    return f;
  }

  /** A playable cell of the current map (inside its shape). */
  private inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.mask[y * this.w + x] === 1;
  }

  /** Outside cell that touches the arena along a side. */
  private edgeWall(x: number, y: number) {
    return !this.inside(x, y) && (this.inside(x - 1, y) || this.inside(x + 1, y) || this.inside(x, y - 1) || this.inside(x, y + 1));
  }

  /**
   * Cells of the border wall: the ones touching the arena along a side, so a slant is a thin
   * diagonal chain of blocks; an outer corner is filled only where two straight runs of the wall
   * meet (the rectangle's corners, the ends of the cross arms), not on every step of a staircase.
   */
  private borderWall(x: number, y: number) {
    if (this.inside(x, y)) return false;
    if (this.edgeWall(x, y)) return true;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (!this.inside(x + sx, y + sy)) continue;
      let run = true;
      for (let k = 1; k <= 3 && run; k++) run = this.edgeWall(x + sx * k, y) && this.edgeWall(x, y + sy * k);
      if (run) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- zone shrink warning
  /** Highlight ring `ring` (0 = outermost ring of the arena, following its shape); -1 clears. */
  setZone(ring: number) {
    if (this.zone) { for (const s of this.zone.strips) s.destroy(); this.zone = null; }
    if (ring < 0) return;
    const depth = zoneDepth(this.shape, this.w, this.h);
    const strips: Sprite[] = [];
    // one strip per horizontal run of the ring's cells
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (depth[y * this.w + x] !== ring) continue;
      let x1 = x;
      while (x1 + 1 < this.w && depth[y * this.w + x1 + 1] === ring) x1++;
      const s = new Sprite({ texture: this.tx.white, x: x * T - T / 2, y: y * T - T / 2, tint: 0xff2a3a });
      s.width = (x1 - x + 1) * T; s.height = T;
      this.zoneLayer.addChild(s);
      strips.push(s);
      x = x1;
    }
    if (strips.length) this.zone = { ring, t: 0, strips };
  }

  /** Outermost ring that still has non-wall cells (the next one to close). */
  nextRing() {
    const depth = zoneDepth(this.shape, this.w, this.h);
    let best = -1;
    for (let i = 0; i < depth.length; i++) {
      if (depth[i] === 255 || this.tiles[i] === Tile.Wall) continue;
      if (best < 0 || depth[i]! < best) best = depth[i]!;
    }
    return best;
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
        const block = new Sprite({ texture: this.wallTex(b.x, b.y), anchor: 0.5, x: b.x * T, y: b.y * T });
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
    const s = new Sprite({ texture: this.wallTex(x, y), anchor: { x: 0.5, y: 1 }, x: x * T, y: y * T + T / 2 });
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
