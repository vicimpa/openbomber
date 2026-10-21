// Endless world outside the arena (canon: legacy Background.ts + new-openbomber Ground.ts, made
// bigger): noise-driven biomes (grass, meadow, dark grass, forest floor, dry grass, dirt, sandy
// shores), lakes with the autotiled water of terrain.png, a trampled dirt apron around every arena,
// and scattered pixel decorations (trees, bushes, rocks, stumps, flowers, reeds, old crates...).
//
// Everything is a pure function of the world tile position (plus the arena clearings), so there is
// no tiling period. The view is covered by 16x16-tile chunk textures generated lazily around the
// camera (a time budget per frame), LRU-evicted, at a lower resolution when zoomed far out. Purely
// visual: nothing out here is gameplay.
import { CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import { shapeMask, type ArenaShape } from '@ob/game';

import type { GameAssets } from './assets';
import { makeDecor, type Decor, type DecorSet } from './decor';

const T = 32;
const CT = 16;             // chunk size, tiles
const CP = CT * T;         // chunk size, world px
const M = 3;               // field margin around a chunk (tiles)
const FN = CT + 2 * M;     // field grid side
const BS = 4;              // biome block size (px): organic pixel edges between biomes
const BN = CP / BS;        // blocks per chunk side
const WATER = 0.655;
const SEED = 1987;
const MAX_BYTES = 40 * 1024 * 1024;

const enum Bi { Grass, Meadow, Dark, Forest, Dry, Dirt, Sand, Apron }
const N_BI = 8;

// ---------------------------------------------------------------- noise
const hash2 = (x: number, y: number, s: number) => {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const sm = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** 3-octave value noise in [0,1] (10%..90% ≈ 0.31..0.68). */
const fbm = (x: number, y: number, s: number) =>
  vnoise(x, y, s) * 0.57 + vnoise(x * 2.03 + 17.1, y * 2.03 - 9.3, s + 1) * 0.29 + vnoise(x * 4.1 + 3.3, y * 4.1 + 5.7, s + 2) * 0.14;

// ---------------------------------------------------------------- colours
const hex = (s: string) => parseInt(s.slice(1), 16);
/** '#rrggbb' → canvas ImageData uint32 (little endian ABGR). */
const px32 = (s: string) => { const v = hex(s); return (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | (v >> 16)) >>> 0; };

const GRASS = '#839f7c', TUFT = '#a7ab85';
/** Grass-family biomes recolour the atlas grass tile: [base, tuft, tuft decor dark, tuft decor light]. */
const GRASSY: Record<number, [string, string, string, string]> = {
  [Bi.Grass]: [GRASS, TUFT, '#6c8a66', '#a7ab85'],
  [Bi.Meadow]: ['#8ca67e', '#b2b38a', '#718f66', '#b8b98e'],
  [Bi.Dark]: ['#76936f', '#8ea37f', '#5f7d5c', '#8ea37f'],
  [Bi.Forest]: ['#6b8868', '#7f9773', '#55724f', '#839c76'],
  [Bi.Dry]: ['#96a079', '#b3ab84', '#7f8a66', '#c0b68c'],
};
/** Speckled ground: base + [colour, count, length] specks. */
const SPECKLED: Record<number, [string, [string, number, number][]]> = {
  [Bi.Dirt]: ['#9b8a6e', [['#8a7a62', 12, 2], ['#ae9d80', 9, 2], ['#85818c', 3, 1], ['#b9b3a8', 2, 1]]],
  [Bi.Sand]: ['#cbbb8e', [['#baa97f', 12, 2], ['#dccca1', 10, 1], ['#e8dcbc', 2, 1]]],
  [Bi.Apron]: ['#a6957a', [['#93836a', 14, 2], ['#b6a68a', 9, 2], ['#85818c', 2, 1]]],
};
const BASE_OF = (b: number) => (GRASSY[b] ?? SPECKLED[b])[0];

export interface Rect {
  x0: number; y0: number; x1: number; y1: number; // world px
  /** Shaped arena: distance (tiles) from a world px point to its border wall, instead of to the rect. */
  dist?: (x: number, y: number) => number;
  key?: string;
}

/** Clearing that follows a shaped arena's border wall (the cells just outside its shape). */
export function shapeClearing(r: Rect, shape: ArenaShape, ox: number, oy: number, w: number, h: number): Rect {
  const mask = shapeMask(shape, w, h);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const edge: number[] = []; // border wall cells, map coords packed as x, y pairs
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (inside(x, y)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = inside(x + dx, y + dy);
    if (near) edge.push(x, y);
  }
  const dist = (px: number, py: number) => {
    const tx = px / T - ox, ty = py / T - oy;
    const cx = Math.round(tx), cy = Math.round(ty);
    if (inside(cx, cy)) return 0;
    let best = 99 * 99;
    for (let i = 0; i < edge.length; i += 2) {
      const dx = Math.max(Math.abs(tx - edge[i]!) - 0.5, 0), dy = Math.max(Math.abs(ty - edge[i + 1]!) - 0.5, 0);
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
  return { ...r, dist, key: `${shape}:${ox},${oy}` };
}

interface ChunkTex { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: Texture; size: number }
interface Chunk { cx: number; cy: number; lod: number; ct: ChunkTex; sprite: Sprite; used: number }

const rngOf = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
};

export class Ground {
  readonly root = new Container();
  private base: Sprite;
  private layer = new Container();
  private tiles: Uint32Array[][] = [];       // [biome][variant] → 32x32 pixels
  private flat = new Uint32Array(0);         // the same, flat: ((biome * 4 + variant) << 10) | (y * 32 + x)
  private water: HTMLCanvasElement[] = [];   // terrain.png with its grass rim recoloured per biome
  private cracks: Decor;
  private decor: DecorSet;
  private tufts: Decor[][] = [];
  private cache = [new Map<string, Chunk>(), new Map<string, Chunk>(), new Map<string, Chunk>()]; // lod 1, 1/2, 1/4
  private pool = new Map<number, ChunkTex[]>();
  private sprites: Sprite[] = [];
  private shown: Chunk[] = [];
  private bytes = 0;
  private frame = 0;
  private smooth = false;
  private clearings: Rect[] = [];
  private covers: Rect[] = [];
  private img: ImageData | null = null;
  /** Chunks to make ahead of time (full resolution), e.g. around a travel's destination. */
  private wanted: [number, number][] = [];
  /** Last generation cost (ms), for the perf readout. */
  genMs = 0;
  generated = 0;

  // per-chunk scratch fields (tile centres incl. margin)
  private fm = new Float32Array(FN * FN);
  private fv = new Float32Array(FN * FN);
  private fs = new Float32Array(FN * FN);
  private ff = new Float32Array(FN * FN);
  private fe = new Float32Array(FN * FN);
  private fw = new Float32Array(FN * FN);   // slow wobble of the apron outline
  private fc = new Float32Array(FN * FN);   // clearing distance (tiles)
  private wraw = new Uint8Array(FN * FN);
  private wat = new Uint8Array(FN * FN);
  private tbi = new Uint8Array(FN * FN);    // biome at tile centre
  private bbi = new Uint8Array(BN * BN);    // biome per block

  constructor(a: GameAssets) {
    this.base = new Sprite({ texture: Texture.WHITE, tint: hex(GRASS) });
    this.root.addChild(this.base, this.layer);
    this.decor = makeDecor(a.world.box, a.world.wall);
    this.buildTiles(a.world.grass);
    this.flat = new Uint32Array(N_BI * 4 * 1024);
    this.tiles.forEach((vs, b) => vs.forEach((t, v) => this.flat.set(t, (b * 4 + v) << 10)));
    this.buildWater(a.terrain);
    this.cracks = this.crackDecal(a.world.grass, a.world.grass2);
    for (let b = 0; b < N_BI; b++) {
      const g = GRASSY[b] ?? GRASSY[Bi.Dry];
      this.tufts[b] = this.decor.tufts(g[2], g[3]);
    }
  }

  // ---------------------------------------------------------------- setup
  private pixelsOf(t: Texture) {
    const [, g] = canvas(t.frame.width, t.frame.height);
    const f = t.frame;
    g.drawImage(t.source.resource as CanvasImageSource, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
    return new Uint32Array(g.getImageData(0, 0, f.width, f.height).data.buffer.slice(0));
  }

  private buildTiles(grass: Texture) {
    const src = this.pixelsOf(grass);
    const G = px32(GRASS), TU = px32(TUFT);
    const xf = (p: Uint32Array, flip: boolean, sx: number, sy: number) => {
      const o = new Uint32Array(1024);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const fx = flip ? 31 - x : x;
        o[y * 32 + x] = p[((y + sy) & 31) * 32 + ((fx + sx) & 31)];
      }
      return o;
    };
    for (let b = 0; b < N_BI; b++) {
      const gr = GRASSY[b];
      if (gr) {
        const B0 = px32(gr[0]), B1 = px32(gr[1]);
        const re = src.map(v => v === G ? B0 : v === TU ? B1 : v);
        this.tiles[b] = [re, xf(re, true, 0, 0), xf(re, false, 16, 8), xf(re, true, 8, 16)];
        continue;
      }
      const [base, specks] = SPECKLED[b];
      const out: Uint32Array[] = [];
      for (let v = 0; v < 4; v++) {
        const r = rngOf(b * 97 + v * 13 + 5);
        const o = new Uint32Array(1024).fill(px32(base));
        for (const [col, n, len] of specks) {
          const c = px32(col);
          for (let i = 0; i < n; i++) {
            const x = Math.floor(r() * 32), y = Math.floor(r() * 32);
            for (let k = 0; k < len; k++) o[y * 32 + ((x + k) & 31)] = c;
          }
        }
        out.push(o);
      }
      this.tiles[b] = out;
    }
  }

  private buildWater(terrain: Texture) {
    const [c, g] = canvas(terrain.frame.width, terrain.frame.height);
    const f = terrain.frame;
    g.drawImage(terrain.source.resource as CanvasImageSource, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
    const src = g.getImageData(0, 0, c.width, c.height);
    const G = px32(GRASS);
    for (let b = 0; b < N_BI; b++) {
      const [wc, wg] = canvas(c.width, c.height);
      const id = new ImageData(new Uint8ClampedArray(src.data), c.width, c.height);
      const u = new Uint32Array(id.data.buffer);
      const B0 = px32(BASE_OF(b));
      for (let i = 0; i < u.length; i++) if (u[i] === G) u[i] = B0;
      wg.putImageData(id, 0, 0);
      this.water[b] = wc;
    }
  }

  /** The cracks of the atlas' cracked-grass tile as a transparent decal. */
  private crackDecal(grass: Texture, cracked: Texture): Decor {
    const a = this.pixelsOf(grass), b = this.pixelsOf(cracked);
    const [c, g] = canvas(32, 32);
    const id = g.createImageData(32, 32);
    const u = new Uint32Array(id.data.buffer);
    const G = px32(GRASS), TU = px32(TUFT);
    for (let i = 0; i < 1024; i++) if (b[i] !== a[i] && b[i] !== G && b[i] !== TU && b[i] >>> 24) u[i] = b[i];
    g.putImageData(id, 0, 0);
    return { c, ax: 16, ay: 16 };
  }

  // ---------------------------------------------------------------- arenas
  /** Arena rects (outer edge of the border wall, world px): trampled dirt apron around them, no water/trees close by. */
  setClearings(list: Rect[]) {
    const same = (a: Rect, b: Rect) => a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1 && a.key === b.key;
    const fresh = list.filter(r => !this.clearings.some(o => same(o, r)))
      .concat(this.clearings.filter(o => !list.some(r => same(o, r))));
    this.clearings = list.slice();
    if (!fresh.length) return;
    const reach = 9 * T;
    for (const map of this.cache) for (const [k, ch] of map) {
      const x0 = ch.cx * CP - T / 2, y0 = ch.cy * CP - T / 2;
      if (fresh.some(r => r.x0 - reach < x0 + CP && r.x1 + reach > x0 && r.y0 - reach < y0 + CP && r.y1 + reach > y0)) this.drop(map, k, ch);
    }
  }

  /** Queue the chunks covering a world rect (px) for generation in spare frame time. */
  want(x0: number, y0: number, x1: number, y1: number) {
    const cx0 = Math.floor((x0 + T / 2) / CP), cx1 = Math.floor((x1 + T / 2) / CP);
    const cy0 = Math.floor((y0 + T / 2) / CP), cy1 = Math.floor((y1 + T / 2) / CP);
    this.wanted = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.wanted.push([cx, cy]);
  }

  /** Rects that fully hide the ground (arena floors): chunks under them are not drawn at all. */
  setCovers(list: Rect[]) { this.covers = list.slice(); }

  private drop(map: Map<string, Chunk>, k: string, ch: Chunk) {
    map.delete(k);
    ch.sprite.visible = false;
    this.sprites.push(ch.sprite);
    (this.pool.get(ch.ct.size) ?? this.pool.set(ch.ct.size, []).get(ch.ct.size)!).push(ch.ct);
    this.bytes -= ch.ct.size * ch.ct.size * 4;
  }

  // ---------------------------------------------------------------- per frame
  /** Cover the visible world rect (world px) at `zoom` device px per world px. */
  cover(x0: number, y0: number, x1: number, y1: number, zoom: number, budgetMs = 2) {
    this.frame++;
    this.base.position.set(x0 - 2, y0 - 2);
    this.base.width = x1 - x0 + 4; this.base.height = y1 - y0 + 4;
    const smooth = zoom < 0.8;
    if (smooth !== this.smooth) {
      this.smooth = smooth;
      for (const map of this.cache) for (const ch of map.values()) ch.ct.tex.source.scaleMode = smooth ? 'linear' : 'nearest';
    }
    const li = zoom >= 0.75 ? 0 : zoom >= 0.375 ? 1 : 2;
    const cx0 = Math.floor((x0 + T / 2) / CP), cx1 = Math.floor((x1 + T / 2) / CP);
    const cy0 = Math.floor((y0 + T / 2) / CP), cy1 = Math.floor((y1 + T / 2) / CP);
    for (const ch of this.shown) ch.sprite.visible = false;
    this.shown.length = 0;
    const missing: [number, number, number][] = [];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (this.hidden(cx, cy)) continue;
      const k = cx + ',' + cy;
      let ch = this.cache[li].get(k);
      if (!ch) {
        missing.push([cx, cy, (cx * CP + CP / 2 - mx) ** 2 + (cy * CP + CP / 2 - my) ** 2]);
        ch = this.cache[(li + 1) % 3].get(k) ?? this.cache[(li + 2) % 3].get(k);
      }
      if (ch) this.show(ch);
    }
    // generate under a time budget; everything at once when nothing at all is on screen yet
    const t0 = performance.now();
    const budget = this.shown.length === 0 ? 1e9 : budgetMs;
    missing.sort((a, b) => a[2] - b[2]);
    let made = 0;
    for (const [cx, cy] of missing) {
      if (made > 0 && performance.now() - t0 > budget) break;
      this.show(this.make(cx, cy, li));
      made++;
    }
    // spare time: chunks queued ahead (travel destination), then one ring around the view
    while (this.wanted.length && performance.now() - t0 < budget) {
      const [cx, cy] = this.wanted.shift()!;
      if (this.hidden(cx, cy) || this.cache[0].has(cx + ',' + cy)) continue;
      this.make(cx, cy, 0).used = this.frame;
      made++;
    }
    if (!missing.length && !this.wanted.length) {
      outer: for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
        if (cy >= cy0 && cy <= cy1 && cx >= cx0 && cx <= cx1) continue;
        if (this.hidden(cx, cy) || this.cache[li].has(cx + ',' + cy)) continue;
        this.make(cx, cy, li).used = this.frame;
        made++;
        break outer;
      }
    }
    if (made) { this.genMs = (performance.now() - t0) / made; this.generated += made; }
    this.evict();
  }

  private hidden(cx: number, cy: number) {
    const x0 = cx * CP - T / 2, y0 = cy * CP - T / 2;
    return this.covers.some(r => r.x0 <= x0 && r.y0 <= y0 && r.x1 >= x0 + CP && r.y1 >= y0 + CP);
  }

  private show(ch: Chunk) {
    ch.used = this.frame;
    ch.sprite.visible = true;
    this.shown.push(ch);
  }

  private evict() {
    if (this.bytes <= MAX_BYTES) return;
    const all: [Map<string, Chunk>, string, Chunk][] = [];
    for (const map of this.cache) for (const [k, ch] of map) if (ch.used < this.frame) all.push([map, k, ch]);
    all.sort((a, b) => a[2].used - b[2].used);
    for (const [map, k, ch] of all) {
      if (this.bytes <= MAX_BYTES) break;
      this.drop(map, k, ch);
    }
    // keep the pools small: free what is not needed any more
    for (const list of this.pool.values()) while (list.length > 2) list.pop()!.tex.destroy(true);
  }

  private make(cx: number, cy: number, li: number): Chunk {
    const lod = 1 / (1 << li);
    const size = CP * lod;
    let ct = this.pool.get(size)?.pop();
    if (!ct) {
      const [c, g] = canvas(size, size);
      const source = new CanvasSource({ resource: c, scaleMode: this.smooth ? 'linear' : 'nearest', resolution: 1 });
      ct = { canvas: c, g, tex: new Texture({ source }), size };
    } else ct.tex.source.scaleMode = this.smooth ? 'linear' : 'nearest';
    this.bytes += size * size * 4;
    this.draw(ct, cx, cy, lod);
    ct.tex.source.update();
    const sprite = this.sprites.pop() ?? new Sprite();
    sprite.texture = ct.tex;
    sprite.position.set(cx * CP - T / 2, cy * CP - T / 2);
    sprite.scale.set(1 / lod);
    if (!sprite.parent) this.layer.addChild(sprite);
    const ch: Chunk = { cx, cy, lod, ct, sprite, used: this.frame };
    this.cache[li].set(cx + ',' + cy, ch);
    return ch;
  }

  // ---------------------------------------------------------------- generation
  private classify(m: number, v: number, s: number, f: number, e: number, wob: number, c: number, j: number): Bi {
    const wo = (wob - 0.5) * 4.5;
    if (c < 0.7 + Math.max(0, e * 1.9 + wo) + j * 6) return Bi.Apron;
    j += (e - 0.5) * 0.07; // wobbly, but clean, biome outlines
    const near = c < 8 ? Math.min(1, (8 - c) / 6) : 0;
    if (m - near * 0.3 + j > WATER - 0.05 && s + j > 0.47) return Bi.Sand;
    if (c < 1.9 + e * 1.6 + Math.max(-1, wo)) return Bi.Dry;            // trampled grass right outside the apron
    const vv = v + j;
    if (vv > 0.69) return Bi.Forest;
    if (vv > 0.61) return Bi.Dark;
    if (vv < 0.31) return Bi.Dirt;
    if (vv < 0.37) return Bi.Dry;
    if (f + j > 0.6) return Bi.Meadow;
    return Bi.Grass;
  }

  private clearingDist(x: number, y: number, list: Rect[]) {
    let best = 99;
    for (const r of list) {
      if (r.dist) { best = Math.min(best, r.dist(x, y)); continue; }
      const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
      const d = Math.sqrt(dx * dx + dy * dy) / T;
      if (d < best) best = d;
    }
    return best;
  }

  private draw(ct: ChunkTex, cx: number, cy: number, lod: number) {
    const gx0 = cx * CT, gy0 = cy * CT;
    const px0 = cx * CP - T / 2, py0 = cy * CP - T / 2; // chunk origin, world px
    const reach = 12 * T;
    const clear = this.clearings.filter(r => r.x0 - reach < px0 + CP && r.x1 + reach > px0 && r.y0 - reach < py0 + CP && r.y1 + reach > py0);
    const { fm, fv, fs, ff, fe, fw, fc, wraw, wat, tbi, bbi } = this;

    // ---- fields at tile centres (with margin)
    for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
      const gx = gx0 + i - M, gy = gy0 + j - M, k = j * FN + i;
      fm[k] = fbm(gx / 24, gy / 24, SEED + 11);
      fv[k] = fbm(gx / 17, gy / 17, SEED + 23);
      fs[k] = fbm(gx / 31, gy / 31, SEED + 37);
      ff[k] = fbm(gx / 8, gy / 8, SEED + 41);
      fe[k] = vnoise(gx / 3.3, gy / 3.3, SEED + 53);
      fw[k] = fbm(gx / 9, gy / 9, SEED + 61);
      const c = clear.length ? this.clearingDist(gx * T, gy * T, clear) : 99;
      fc[k] = c;
      const near = c < 8 ? Math.min(1, (8 - c) / 6) : 0;
      wraw[k] = fm[k] - near * 0.3 > WATER ? 1 : 0;
      tbi[k] = this.classify(fm[k], fv[k], fs[k], ff[k], fe[k], fw[k], c, (hash2(gx, gy, SEED + 7) - 0.5) * 0.012);
    }
    // drop lone water cells (they read as noise)
    wat.fill(0);
    for (let j = 1; j < FN - 1; j++) for (let i = 1; i < FN - 1; i++) {
      const k = j * FN + i;
      wat[k] = wraw[k] && (wraw[k - 1] || wraw[k + 1] || wraw[k - FN] || wraw[k + FN]) ? 1 : 0;
    }

    // ---- biome per 4 px block (fields interpolated between tile centres + jitter)
    for (let by = 0; by < BN; by++) {
      const u = by / 8 - 0.4375, j0 = Math.floor(u), fy = u - j0, r0 = (j0 + M) * FN;
      const wy = py0 + by * BS + BS / 2;
      for (let bx = 0; bx < BN; bx++) {
        const w = bx / 8 - 0.4375, i0 = Math.floor(w), fx = w - i0, k = r0 + i0 + M;
        const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
        const lerp = (f: Float32Array) => f[k] * a + f[k + 1] * b + f[k + FN] * c + f[k + FN + 1] * d;
        const wx = px0 + bx * BS + BS / 2;
        const dist = clear.length ? this.clearingDist(wx, wy, clear) : 99;
        const jit = (hash2(gx0 * 8 + bx, gy0 * 8 + by, SEED + 3) - 0.5) * 0.012;
        bbi[by * BN + bx] = this.classify(lerp(fm), lerp(fv), lerp(fs), lerp(ff), lerp(fe), lerp(fw), dist, jit);
      }
    }

    // ---- base pixels
    const size = ct.size;
    if (!this.img || this.img.width !== CP) this.img = new ImageData(CP, CP);
    const out = new Uint32Array(this.img.data.buffer);
    const step = 1 / lod;
    const tvar = new Uint8Array(CT * CT);
    for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) tvar[j * CT + i] = Math.floor(hash2(gx0 + i, gy0 + j, SEED + 5) * 4);
    const flat = this.flat;
    for (let oy = 0; oy < size; oy++) {
      const py = lod === 1 ? oy : Math.floor((oy + 0.5) * step);
      const brow = (py >> 2) * BN, trow = (py >> 5) * CT, prow = (py & 31) * 32;
      let o = oy * CP;
      if (lod === 1) {
        for (let bx = 0; bx < BN; bx++) {
          const base = (((bbi[brow + bx] << 2) + tvar[trow + (bx >> 3)]) << 10) + prow + ((bx & 7) << 2);
          out[o++] = flat[base]; out[o++] = flat[base + 1]; out[o++] = flat[base + 2]; out[o++] = flat[base + 3];
        }
      } else for (let ox = 0; ox < size; ox++) {
        const px = Math.floor((ox + 0.5) * step);
        out[o++] = flat[(((bbi[brow + (px >> 2)] << 2) + tvar[trow + (px >> 5)]) << 10) + prow + (px & 31)];
      }
    }
    const g = ct.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.putImageData(this.img, 0, 0, 0, 0, size, size);
    g.setTransform(lod, 0, 0, lod, 0, 0);
    g.imageSmoothingEnabled = lod < 1;

    // ---- water: quarter-tile autotile (pond 2x2 at tiles (2..3, 3..4) of terrain.png, inner corners from the blob)
    const W = (i: number, j: number) => wat[(j + M) * FN + i + M] === 1;
    for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) {
      if (!W(i, j)) continue;
      const src = this.water[tbi[(j + M) * FN + i + M]];
      const PX = 2 * T, PY = 3 * T, BX = 4 * T, BY = T;
      for (const ddy of [-1, 1]) for (const ddx of [-1, 1]) {
        const hN = W(i + ddx, j), vN = W(i, j + ddy), dN = W(i + ddx, j + ddy);
        const ox = i * T + (ddx > 0 ? 16 : 0), oy = j * T + (ddy > 0 ? 16 : 0);
        const cx_ = ddx < 0 ? 0 : 3, cy_ = ddy < 0 ? 0 : 3;
        const ix = ddx < 0 ? 1 : 2, iy = ddy < 0 ? 1 : 2;
        let sx: number, sy: number;
        if (!hN && !vN) { sx = PX + cx_ * 16; sy = PY + cy_ * 16; }
        else if (hN && !vN) { sx = PX + ix * 16; sy = PY + cy_ * 16; }
        else if (!hN && vN) { sx = PX + cx_ * 16; sy = PY + iy * 16; }
        else if (!dN) { sx = BX + (ddx < 0 ? 0 : 3) * 16; sy = BY + (ddy < 0 ? 0 : 3) * 16; }
        else { sx = PX + 16; sy = PY + 16; }
        g.drawImage(src, sx, sy, 16, 16, ox, oy, 16, 16);
      }
    }

    // ---- decorations, row by row (tiles around the chunk too: big sprites cross chunk edges)
    const D = this.decor;
    const tiny = lod < 0.5;
    const put = (d: Decor, x: number, y: number) => g.drawImage(d.c, Math.round(x - d.ax), Math.round(y - d.ay));
    for (let j = -1; j < CT + 2; j++) for (let i = -2; i < CT + 2; i++) {
      const gx = gx0 + i, gy = gy0 + j, k = (j + M) * FN + i + M;
      const c = fc[k];
      if (c < 0.6) continue;
      const r = hash2(gx, gy, SEED + 101), r2 = hash2(gx, gy, SEED + 202), r3 = hash2(gx, gy, SEED + 303);
      const x = i * T + 16 + Math.floor(r2 * 18) - 9, y = j * T + 16 + Math.floor(r3 * 14) - 5;
      const w4 = (wat[k - 1] | wat[k + 1] | wat[k - FN] | wat[k + FN]) === 1;
      if (wat[k]) {
        if (!w4 || r >= 0.07 || tiny) continue;
        if (wat[k - 1] && wat[k + 1] && wat[k - FN] && wat[k + FN]) put(D.lily[r2 < 0.3 ? 1 : 0], i * T + 16 + Math.floor(r3 * 10) - 5, j * T + 18);
        continue;
      }
      const bi = tbi[k];
      if (w4 && bi !== Bi.Sand) { if (r < 0.4 && !tiny) put(D.reeds, x, y); continue; }
      // trees on a jittered 2x2 grid: at most one per cell
      const cellPick = Math.floor(hash2(gx >> 1, gy >> 1, SEED + 404) * 4);
      const treeSpot = c > 4.5 && ((gx & 1) | ((gy & 1) << 1)) === cellPick;
      const p = hash2(gx >> 1, gy >> 1, SEED + 505);
      const tufts = this.tufts[bi];
      switch (bi) {
        case Bi.Apron:
          if (tiny) break;
          if (r < 0.1) put(D.pebbles[Math.floor(r2 * 3)], x, y);
          else if (r < 0.14) put(D.chips, x, y);
          else if (r < 0.155 && c > 1.4) put(r2 < 0.5 ? D.crate : D.stones[Math.floor(r3 * 2)], i * T + 16, j * T + 20);
          break;
        case Bi.Forest:
          if (treeSpot && p < 0.85) put(D.trees[3 + Math.floor(r2 * 3)], i * T + 16 + Math.floor(r3 * 8) - 4, j * T + 26);
          else if (r < 0.12) put(D.bushes[Math.floor(r2 * 4)], x, y);
          else if (r < 0.18 && !tiny) put(D.mushrooms[r2 < 0.5 ? 0 : 1], x, y);
          else if (r < 0.2) put(r2 < 0.5 ? D.stump : D.log, x, y);
          else if (r < 0.42 && !tiny) put(tufts[Math.floor(r2 * 3)], x, y);
          break;
        case Bi.Dark:
          if (treeSpot && p < 0.4) put(D.trees[Math.floor(r2 * 6)], i * T + 16 + Math.floor(r3 * 8) - 4, j * T + 26);
          else if (r < 0.1) put(D.bushes[Math.floor(r2 * 4)], x, y);
          else if (r < 0.14 && !tiny) put(D.mushrooms[r2 < 0.5 ? 0 : 1], x, y);
          else if (r < 0.16) put(D.rocks[Math.floor(r2 * 4)], x, y);
          else if (r < 0.4 && !tiny) put(tufts[Math.floor(r2 * 3)], x, y);
          break;
        case Bi.Meadow:
          if (treeSpot && p < 0.05) put(D.trees[Math.floor(r2 * 3)], i * T + 16, j * T + 26);
          else if (r < 0.36) {
            if (tiny) break;
            const fl = D.flowers[Math.floor(hash2(gx >> 2, gy >> 2, SEED + 606) * D.flowers.length)];
            const n = 2 + Math.floor(r2 * 3);
            for (let q = 0; q < n; q++) put(fl, i * T + 6 + Math.floor(hash2(gx, gy, q + 1) * 22), j * T + 8 + Math.floor(hash2(gx, gy, q + 9) * 20));
          } else if (r < 0.5 && !tiny) put(tufts[Math.floor(r2 * 3)], x, y);
          else if (r < 0.52) put(D.bushes[Math.floor(r2 * 4)], x, y);
          else if (r < 0.535) put(D.rocks[Math.floor(r2 * 3)], x, y);
          break;
        case Bi.Grass:
          if (treeSpot && p < 0.07) put(D.trees[Math.floor(r2 * 3)], i * T + 16, j * T + 26);
          else if (r < 0.13) { if (!tiny) put(tufts[Math.floor(r2 * 3)], x, y); }
          else if (r < 0.19) { if (!tiny) put(D.flowers[Math.floor(r2 * D.flowers.length)], x, y); }
          else if (r < 0.21) put(D.rocks[Math.floor(r2 * 6)], x, y);
          else if (r < 0.215) put(D.stump, x, y);
          else if (r < 0.22 && c > 3) put(r2 < 0.5 ? D.crate : D.stones[Math.floor(r3 * 2)], i * T + 16, j * T + 20);
          else if (r < 0.235) put(D.bushes[Math.floor(r2 * 4)], x, y);
          break;
        case Bi.Dry:
          if (r < 0.2) { if (!tiny) put(tufts[Math.floor(r2 * 3)], x, y); }
          else if (r < 0.25 && c > 4) { if (i >= 0 && j >= 0 && i < CT && j < CT) put(this.cracks, i * T + 16, j * T + 16); }
          else if (r < 0.3) put(D.rocks[Math.floor(r2 * 4)], x, y);
          else if (r < 0.31) put(D.log, x, y);
          break;
        case Bi.Dirt:
          if (r < 0.18) { if (!tiny) put(D.pebbles[Math.floor(r2 * 3)], x, y); }
          else if (r < 0.28) { if (i >= 0 && j >= 0 && i < CT && j < CT) put(this.cracks, i * T + 16, j * T + 16); }
          else if (r < 0.33) put(D.rocks[Math.floor(r2 * 6)], x, y);
          else if (r < 0.336) put(D.stones[Math.floor(r3 * 2)], i * T + 16, j * T + 20);
          break;
        case Bi.Sand:
          if (tiny) break;
          if (r < 0.07) put(D.pebbles[Math.floor(r2 * 3)], x, y);
          else if (r < 0.09) put(D.rocks[Math.floor(r2 * 2)], x, y);
          break;
      }
    }
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: false })!;
  g.imageSmoothingEnabled = false;
  return [c, g] as const;
}
