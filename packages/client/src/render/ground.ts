// Endless world outside the arena (canon: legacy Background.ts + new-openbomber Ground.ts, made
// bigger): noise-driven biomes (grass, meadow, dark grass, forest floor, dry grass, dirt, sandy
// shores), lakes with the autotiled water of terrain.png, a trampled dirt apron around every arena,
// and scattered pixel decorations (trees, bushes, rocks, stumps, flowers, reeds, old crates...).
//
// Everything is a pure function of the world tile position (plus the arena clearings), so there is
// no tiling period. The view is covered by 16x16-tile chunk textures generated lazily around the
// camera (a time budget per frame), LRU-evicted, at a lower resolution when zoomed far out. Purely
// visual: nothing out here is gameplay.
//
// A chunk is composed entirely in a JS pixel buffer (ground, water, decorations, theme colours) and
// uploaded from it as is: no 2D canvas, so nothing waits on a GPU readback (getImageData, a canvas
// turned into a texture), which on iOS (GPU-backed canvases) cost more than the drawing itself.
import { BufferImageSource, Container, Sprite, Texture } from 'pixi.js';
import { ArenaShape, Theme, shapeMask } from '@ob/game';

import type { GameAssets } from './assets';
import { makeDecor, type Decor, type DecorSet } from './decor';
import { themePixel } from './theme';

const T = 32;
const CT = 16;             // chunk size, tiles
const CP = CT * T;         // chunk size, world px
const M = 3;               // field margin around a chunk (tiles)
const FN = CT + 2 * M;     // field grid side
const BS = 4;              // biome block size (px): organic pixel edges between biomes
const BN = CP / BS;        // blocks per chunk side
const RR = 14 * Math.SQRT2; // farthest block centre from its tile's centre (world px)
const GR = 64 * Math.SQRT2; // farthest point of a 4x4 tile group from its centre (world px)
const LUT_SHIFT = 18, LUT_SIZE = 1 << (32 - LUT_SHIFT), LUT_MAX = LUT_SIZE * 0.7; // theme colour cache
const WATER = 0.655;
const SEED = 1987;
const MAX_BYTES = 40 * 1024 * 1024;
const POOL_BYTES = 6 * 1024 * 1024; // spare chunk textures kept per level of detail
/** An arena's theme covers the countryside up to THEME_FULL tiles out, then dithers away by THEME_FADE. */
const THEME_FULL = 8;
const THEME_FADE = 17;

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
  /** Shaped arena: the distance is to its border wall cells (boxes, world px: x0, y0, x1, y1, ...)
   *  instead of to the rect, and 0 on a tile `inside` its shape. */
  boxes?: number[];
  inside?: (x: number, y: number) => boolean;
  /** The arena's theme, spread over the countryside around it. */
  theme?: Theme;
  key?: string;
}

/** Clearing that follows a shaped arena's border wall (the cells just outside its shape). */
export function shapeClearing(r: Rect, shape: ArenaShape, ox: number, oy: number, w: number, h: number): Rect {
  const mask = shapeMask(shape, w, h);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const boxes: number[] = []; // border wall cells, world px boxes
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (inside(x, y)) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = inside(x + dx, y + dy);
    if (near) boxes.push((ox + x) * T - T / 2, (oy + y) * T - T / 2, (ox + x) * T + T / 2, (oy + y) * T + T / 2);
  }
  return { ...r, boxes, inside: (px, py) => inside(Math.round(px / T - ox), Math.round(py / T - oy)), key: `${shape}:${ox},${oy}` };
}

/** Pixel art for the chunk compositor: premultiplied ABGR words (ImageData byte order). */
interface Blit { w: number; h: number; px: Uint32Array }
/** A decoration's pixels, anchored like the Decor, with its downscaled copies made on demand. */
interface Pix extends Blit { ax: number; ay: number; scaled: Map<number, Blit> }

/** Premultiplied copy of straight-alpha ImageData words. */
function premultiply(src: Uint32Array) {
  const out = new Uint32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const c = src[i], a = c >>> 24;
    if (a === 255 || a === 0) { out[i] = a ? c : 0; continue; }
    const r = Math.round((c & 255) * a / 255), g = Math.round(((c >>> 8) & 255) * a / 255), b = Math.round(((c >>> 16) & 255) * a / 255);
    out[i] = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return out;
}

/**
 * `p` shrunk by `s` (2 or 4) with an area (box) filter, placed `fx`, `fy` source px into the first
 * destination pixel: what drawing it scaled by 1/s at a fractional destination offset gives.
 */
function shrink(p: Blit, s: number, fx: number, fy: number): Blit {
  const w = Math.ceil((p.w + fx) / s), h = Math.ceil((p.h + fy) / s);
  const px = new Uint32Array(w * h), n = s * s;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let y = j * s - fy; y < j * s - fy + s; y++) {
      if (y < 0 || y >= p.h) continue;
      for (let x = i * s - fx; x < i * s - fx + s; x++) {
        if (x < 0 || x >= p.w) continue;
        const c = p.px[y * p.w + x];
        r += c & 255; g += (c >>> 8) & 255; b += (c >>> 16) & 255; a += c >>> 24;
      }
    }
    if (a) px[j * w + i] = ((Math.round(a / n) << 24) | (Math.round(b / n) << 16) | (Math.round(g / n) << 8) | Math.round(r / n)) >>> 0;
  }
  return { w, h, px };
}

// The ground under everything: each 4 px block's biome tile (one of 4 variants per tile), full
// resolution or point-sampled at 1/s. (Own functions: hot loops that stay optimized whatever the
// rest of the chunk maker does.)
function basePixels(out: Uint32Array, flat: Uint32Array, bbi: Uint8Array, tvar: Uint8Array) {
  for (let py = 0; py < CP; py++) {
    const brow = (py >> 2) * BN, trow = (py >> 5) * CT, prow = (py & 31) * 32;
    let o = py * CP;
    for (let bx = 0; bx < BN; bx++) {
      const base = (((bbi[brow + bx] << 2) + tvar[trow + (bx >> 3)]) << 10) + prow + ((bx & 7) << 2);
      out[o++] = flat[base]; out[o++] = flat[base + 1]; out[o++] = flat[base + 2]; out[o++] = flat[base + 3];
    }
  }
}

function basePixelsScaled(out: Uint32Array, size: number, s: number, flat: Uint32Array, bbi: Uint8Array, tvar: Uint8Array) {
  for (let oy = 0; oy < size; oy++) {
    const py = Math.floor((oy + 0.5) * s);
    const brow = (py >> 2) * BN, trow = (py >> 5) * CT, prow = (py & 31) * 32;
    let o = oy * size;
    for (let ox = 0; ox < size; ox++) {
      const px = Math.floor((ox + 0.5) * s);
      out[o++] = flat[(((bbi[brow + (px >> 2)] << 2) + tvar[trow + (px >> 5)]) << 10) + prow + (px & 31)];
    }
  }
}

/** Draw premultiplied `p` over the opaque `dst` (side `size`) at (x, y), clipped. */
function blit(dst: Uint32Array, size: number, p: Blit, x: number, y: number) {
  const i0 = Math.max(0, -x), i1 = Math.min(p.w, size - x);
  const j0 = Math.max(0, -y), j1 = Math.min(p.h, size - y);
  const src = p.px, w = p.w;
  for (let j = j0; j < j1; j++) {
    let o = (y + j) * size + x + i0, q = j * w + i0;
    for (let i = i0; i < i1; i++, o++, q++) {
      const c = src[q], a = c >>> 24;
      if (a === 0) continue;
      if (a === 255) { dst[o] = c; continue; }
      const d = dst[o], k = 255 - a;
      const r = (c & 255) + (((d & 255) * k + 127) / 255 | 0);
      const g = ((c >>> 8) & 255) + ((((d >>> 8) & 255) * k + 127) / 255 | 0);
      const b = ((c >>> 16) & 255) + ((((d >>> 16) & 255) * k + 127) / 255 | 0);
      dst[o] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
}

interface ChunkTex { px: Uint32Array; tex: Texture; size: number }
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
  private water: Blit[] = [];                // terrain.png with its grass rim recoloured per biome
  private quarters = new Map<number, Blit>(); // water quarter tiles cut from it, per biome / spot / lod
  private pix = new Map<HTMLCanvasElement, Pix>();
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
  /** Chunks to make ahead of time (full resolution), e.g. around a travel's destination. */
  private wanted: [number, number][] = [];
  /** Chunks a coming view needs (plan() / prepare()), and those made for it: not evicted until release(). */
  private ahead: [number, number, number][] = [];
  private aheadKeys = new Set<number>();
  private kept = new Set<Chunk>();
  /** Called with the texture of every chunk prepare() makes, e.g. to put it on the GPU right away. */
  onPrepared?: (tex: Texture) => void;
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
  private bth = new Uint8Array(BN * BN);    // theme per block (255: plain meadow)
  private bd = new Float64Array(BN * BN);   // clearing distance per block (tiles)
  private bn = new Int8Array(BN * BN);      // nearest clearing per block (-1: none)
  private tvar = new Uint8Array(CT * CT);
  // the nearby clearings' boxes (world px x0, y0, x1, y1), whose clearing, distance² from a point
  private cb = new Float64Array(256);
  private co = new Int32Array(64);
  private cd = new Float64Array(64);
  private gc = new Int32Array(64);
  private cand = new Int32Array(64);

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
    // every decoration's pixels, read back once now rather than in the middle of a trip
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object' && 'c' in v) this.pixOf(v as Decor);
    };
    Object.values(this.decor).forEach(walk);
    this.tufts.forEach(walk);
    this.pixOf(this.cracks);
  }

  private pixOf(d: Decor): Pix {
    let p = this.pix.get(d.c);
    if (!p) {
      const g = d.c.getContext('2d')!;
      const px = premultiply(new Uint32Array(g.getImageData(0, 0, d.c.width, d.c.height).data.buffer));
      this.pix.set(d.c, (p = { w: d.c.width, h: d.c.height, ax: d.ax, ay: d.ay, px, scaled: new Map() }));
    }
    return p;
  }

  /** Water quarter tile (16x16 at source sx, sy of biome b's sheet), shrunk by s (1, 2, 4). */
  private quarter(b: number, sx: number, sy: number, s: number): Blit {
    const k = ((b * 64 + sx / 16) * 64 + sy / 16) * 8 + s;
    let q = this.quarters.get(k);
    if (!q) {
      if (s === 1) {
        const w = this.water[b], px = new Uint32Array(256);
        for (let y = 0; y < 16; y++) px.set(w.px.subarray((sy + y) * w.w + sx, (sy + y) * w.w + sx + 16), y * 16);
        q = { w: 16, h: 16, px };
      } else q = shrink(this.quarter(b, sx, sy, 1), s, 0, 0);
      this.quarters.set(k, q);
    }
    return q;
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
    const src = new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer);
    const G = px32(GRASS);
    for (let b = 0; b < N_BI; b++) {
      const B0 = px32(BASE_OF(b));
      this.water[b] = { w: c.width, h: c.height, px: premultiply(src.map(v => v === G ? B0 : v)) };
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
    const reach = (THEME_FADE + 1) * T;
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

  /** Queue the chunks a coming view will show: a world rect (px) at `zoom` device px per world px;
   *  none that an arena placed within `avoid` would change. Those made already are kept as well. */
  plan(x0: number, y0: number, x1: number, y1: number, zoom: number, avoid?: Rect) {
    const li = lodLevel(zoom);
    const cx0 = Math.floor((x0 + T / 2) / CP), cx1 = Math.floor((x1 + T / 2) / CP);
    const cy0 = Math.floor((y0 + T / 2) / CP), cy1 = Math.floor((y1 + T / 2) / CP);
    const reach = (THEME_FADE + 1) * T;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const k = li * 2 ** 42 + (cx + 2 ** 20) * 2 ** 21 + cy + 2 ** 20;
      if (this.aheadKeys.has(k)) continue;
      this.aheadKeys.add(k);
      const px = cx * CP - T / 2, py = cy * CP - T / 2;
      if (avoid && avoid.x0 - reach < px + CP && avoid.x1 + reach > px && avoid.y0 - reach < py + CP && avoid.y1 + reach > py) continue;
      if (this.hidden(cx, cy)) continue;
      const ch = this.cache[li].get(cx + ',' + cy);
      if (ch) this.kept.add(ch);
      else this.ahead.push([cx, cy, li]);
    }
  }

  /** Planned chunks not made yet. */
  get pending() { return this.ahead.length; }

  /** Make planned chunks for up to `budgetMs`; true once none are left. */
  prepare(budgetMs: number) {
    const t0 = performance.now();
    while (this.ahead.length && performance.now() - t0 < budgetMs) {
      const [cx, cy, li] = this.ahead.shift()!;
      const had = this.cache[li].get(cx + ',' + cy);
      if (had) { this.kept.add(had); continue; }
      const ch = this.make(cx, cy, li);
      ch.used = this.frame;
      this.kept.add(ch);
      this.generated++;
      this.onPrepared?.(ch.ct.tex);
    }
    return this.ahead.length === 0;
  }

  /** The prepared view has been reached: the trip's zoomed-out chunks go now, the rest age out
   *  like any others. */
  release() {
    for (const map of this.cache.slice(1)) for (const [k, ch] of map) if (this.kept.has(ch) && ch.used < this.frame) this.drop(map, k, ch);
    this.kept.clear();
    this.ahead.length = 0;
    this.aheadKeys.clear();
  }

  /**
   * Make (and throw away) a few chunks by themed arenas of either kind, far from anything shown, so
   * that neither the JIT nor the theme colour caches are cold when the first trip needs them (the
   * first themed chunk took several times as long), and the pool holds a texture of each size.
   */
  warmUp() {
    const keep = this.clearings, n = 21, oy = 1 << 16;
    [Theme.Autumn, Theme.Winter, Theme.Desert].forEach((theme, i) => {
      const ox = oy + i * 96;
      const r: Rect = { x0: (ox - 1.5) * T, y0: (oy - 1.5) * T, x1: (ox + n + 0.5) * T, y1: (oy + n + 0.5) * T, theme, key: 'warm' };
      this.clearings = [i === 1 ? { ...shapeClearing(r, ArenaShape.Circle, ox, oy, n, n), theme } : r];
      for (let li = 0; li < 3; li++) {
        const cx = Math.floor(r.x0 / CP), cy = Math.floor(r.y0 / CP), map = this.cache[li];
        const ch = this.make(cx, cy, li);
        this.drop(map, cx + ',' + cy, ch);
      }
    });
    this.clearings = keep;
  }

  /** Rects that fully hide the ground (arena floors): chunks under them are not drawn at all. */
  setCovers(list: Rect[]) { this.covers = list.slice(); }

  private drop(map: Map<string, Chunk>, k: string, ch: Chunk) {
    map.delete(k);
    this.kept.delete(ch);
    ch.sprite.visible = false;
    this.sprites.push(ch.sprite);
    (this.pool.get(ch.ct.size) ?? this.pool.set(ch.ct.size, []).get(ch.ct.size)!).push(ch.ct);
    this.bytes -= ch.ct.size * ch.ct.size * 4;
  }

  // ---------------------------------------------------------------- per frame
  /** Cover the visible world rect (world px) at `zoom` device px per world px, making missing chunks
   *  for about `budgetMs` (at least one a frame; with no budget left only one that would leave a
   *  hole: the others show another level of detail meanwhile). */
  cover(x0: number, y0: number, x1: number, y1: number, zoom: number, budgetMs = 2) {
    this.frame++;
    this.base.position.set(x0 - 2, y0 - 2);
    this.base.width = x1 - x0 + 4; this.base.height = y1 - y0 + 4;
    const smooth = zoom < 0.8;
    if (smooth !== this.smooth) {
      this.smooth = smooth;
      for (const map of this.cache) for (const ch of map.values()) ch.ct.tex.source.scaleMode = smooth ? 'linear' : 'nearest';
    }
    const li = lodLevel(zoom);
    const cx0 = Math.floor((x0 + T / 2) / CP), cx1 = Math.floor((x1 + T / 2) / CP);
    const cy0 = Math.floor((y0 + T / 2) / CP), cy1 = Math.floor((y1 + T / 2) / CP);
    for (const ch of this.shown) ch.sprite.visible = false;
    this.shown.length = 0;
    const missing: [number, number, number, boolean][] = [];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (this.hidden(cx, cy)) continue;
      const k = cx + ',' + cy;
      let ch = this.cache[li].get(k);
      if (!ch) {
        ch = this.cache[(li + 1) % 3].get(k) ?? this.cache[(li + 2) % 3].get(k);
        missing.push([cx, cy, (cx * CP + CP / 2 - mx) ** 2 + (cy * CP + CP / 2 - my) ** 2, !!ch]);
      }
      if (ch) this.show(ch);
    }
    // generate under a time budget; everything at once when nothing at all is on screen yet
    const t0 = performance.now();
    const budget = this.shown.length === 0 ? 1e9 : budgetMs;
    missing.sort((a, b) => a[2] - b[2]);
    let made = 0;
    for (const [cx, cy, , fallback] of missing) {
      if (made > 0 && performance.now() - t0 > budget) break;
      if (fallback && budget <= 0) continue;
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
    if (!missing.length && !this.wanted.length && budget > 0) {
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
    // a few MB of spare textures are reused rather than allocated anew in the middle of a trip
    for (const [size, list] of this.pool) while (list.length > POOL_BYTES / (size * size * 4)) list.pop()!.tex.destroy(true);
    // chunks kept for a coming view don't count against the others' budget
    let limit = MAX_BYTES;
    for (const ch of this.kept) limit += ch.ct.size * ch.ct.size * 4;
    if (this.bytes <= limit) return;
    const all: [Map<string, Chunk>, string, Chunk][] = [];
    for (const map of this.cache) for (const [k, ch] of map) if (ch.used < this.frame && !this.kept.has(ch)) all.push([map, k, ch]);
    all.sort((a, b) => a[2].used - b[2].used);
    for (const [map, k, ch] of all) {
      if (this.bytes <= limit) break;
      this.drop(map, k, ch);
    }
  }

  private make(cx: number, cy: number, li: number): Chunk {
    const lod = 1 / (1 << li);
    const size = CP * lod;
    let ct = this.pool.get(size)?.pop();
    if (!ct) {
      const buf = new Uint8Array(size * size * 4);
      const source = new BufferImageSource({
        resource: buf, width: size, height: size, format: 'rgba8unorm', alphaMode: 'premultiplied-alpha',
        scaleMode: this.smooth ? 'linear' : 'nearest', resolution: 1,
      });
      ct = { px: new Uint32Array(buf.buffer), tex: new Texture({ source }), size };
    } else ct.tex.source.scaleMode = this.smooth ? 'linear' : 'nearest';
    this.bytes += size * size * 4;
    this.draw(ct, cx, cy, lod);
    ct.tex.source.update();
    const sprite = this.sprites.pop() ?? new Sprite();
    sprite.visible = false; // until cover() shows it
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

  /**
   * Distance (tiles) to the nearest clearing, and which one that is, at the field's tile centres
   * (fc) and at every 4 px block (bd, bn): exactly what testing every box of every clearing at
   * every point gives, without doing that. The distance changes no faster than the point moves, so
   * for points within r of a centre only the boxes within (the centre's nearest + 2r) can be the
   * nearest: boxes are picked that way for groups of 4x4 tiles, then from those for each tile, whose
   * blocks then test only a handful. (A tile inside a shaped arena is at 0 from it.)
   */
  private clearingField(clear: Rect[], gx0: number, gy0: number, px0: number, py0: number) {
    const { fc, bd, bn } = this;
    if (!clear.length) { fc.fill(99); bd.fill(99); bn.fill(-1); return; }
    let n = 0;
    for (const r of clear) n += r.boxes ? r.boxes.length / 4 : 1;
    if (this.co.length < n) {
      this.cb = new Float64Array(n * 8); this.co = new Int32Array(n * 2); this.cd = new Float64Array(n * 2);
      this.gc = new Int32Array(n * 2); this.cand = new Int32Array(n * 2);
    }
    const { cb, co, cd, gc, cand } = this;
    n = 0;
    clear.forEach((r, ci) => {
      const b = r.boxes ?? [r.x0, r.y0, r.x1, r.y1];
      for (let i = 0; i < b.length; i += 4, n++) {
        cb[n * 4] = b[i]; cb[n * 4 + 1] = b[i + 1]; cb[n * 4 + 2] = b[i + 2]; cb[n * 4 + 3] = b[i + 3];
        co[n] = ci;
      }
    });
    const nc = clear.length, inside = new Uint8Array(nc);
    const d2 = (q: number, x: number, y: number) => {
      const dx = Math.max(cb[q * 4] - x, 0, x - cb[q * 4 + 2]), dy = Math.max(cb[q * 4 + 1] - y, 0, y - cb[q * 4 + 3]);
      return dx * dx + dy * dy;
    };
    // nearest clearing among candidates `list[0..m)` (in clearing order) at (x, y): distance, and
    // which one in `this.near`; every candidate's distance² goes to cd[k]
    let near = -1;
    const nearest = (list: Int32Array, m: number, x: number, y: number) => {
      let best = 99, k = 0;
      near = -1;
      for (let c = 0; c < nc; c++) {
        let min = Infinity;
        for (; k < m && co[list[k]] === c; k++) {
          const d = d2(list[k], x, y);
          cd[k] = d;
          if (d < min) min = d;
        }
        const d = inside[c] ? 0 : Math.sqrt(min) / T;
        if (d < best) { best = d; near = c; }
      }
      return best;
    };
    for (let gj = 0; gj < FN; gj += 4) for (let gi = 0; gi < FN; gi += 4) {
      // a group of (up to) 4x4 field tiles: every point of theirs is within GR of its centre
      const x = (gx0 + gi - M + 1.5) * T, y = (gy0 + gj - M + 1.5) * T;
      let raw = Infinity;
      for (let q = 0; q < n; q++) { const d = d2(q, x, y); cd[q] = d; if (d < raw) raw = d; }
      let lim = Math.sqrt(raw) + 2 * GR, gm = 0;
      lim *= lim;
      for (let q = 0; q < n; q++) if (cd[q] <= lim) gc[gm++] = q;
      for (let j = gj; j < gj + 4 && j < FN; j++) for (let i = gi; i < gi + 4 && i < FN; i++) {
        const tx = (gx0 + i - M) * T, ty = (gy0 + j - M) * T;
        for (let c = 0; c < nc; c++) inside[c] = clear[c].inside?.(tx, ty) ? 1 : 0;
        fc[j * FN + i] = nearest(gc, gm, tx, ty);
        const ti = i - M, tj = j - M;
        if (ti < 0 || tj < 0 || ti >= CT || tj >= CT) continue;
        // this tile's blocks: within RR of its centre
        let raw = Infinity;
        for (let k = 0; k < gm; k++) if (cd[k] < raw) raw = cd[k];
        let lim = Math.sqrt(raw) + 2 * RR, m = 0;
        lim *= lim;
        for (let k = 0; k < gm; k++) if (cd[k] <= lim) cand[m++] = gc[k];
        for (let by = tj * 8; by < tj * 8 + 8; by++) {
          const wy = py0 + by * BS + BS / 2;
          for (let bx = ti * 8; bx < ti * 8 + 8; bx++) {
            bd[by * BN + bx] = nearest(cand, m, px0 + bx * BS + BS / 2, wy);
            bn[by * BN + bx] = near;
          }
        }
      }
    }
  }

  /** Biome (and theme) per 4 px block: the fields interpolated between tile centres, plus jitter. */
  private blocks(gx0: number, gy0: number, themes: Uint8Array) {
    const { fm, fv, fs, ff, fe, fw, bbi, bth, bd, bn } = this;
    for (let by = 0; by < BN; by++) {
      const u = by / 8 - 0.4375, j0 = Math.floor(u), fy = u - j0, r0 = (j0 + M) * FN;
      for (let bx = 0; bx < BN; bx++) {
        const w = bx / 8 - 0.4375, i0 = Math.floor(w), fx = w - i0, k = r0 + i0 + M;
        const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
        const k1 = k + 1, k2 = k + FN, k3 = k + FN + 1;
        const bi = by * BN + bx;
        const dist = bd[bi];
        if (bn[bi] >= 0) {
          const th = themes[bn[bi]];
          const tw = Math.min(1, Math.max(0, (THEME_FADE - dist) / (THEME_FADE - THEME_FULL)));
          bth[bi] = th !== Theme.Meadow && hash2(gx0 * 8 + bx, gy0 * 8 + by, SEED + 7) < tw ? th : 255;
        }
        const jit = (hash2(gx0 * 8 + bx, gy0 * 8 + by, SEED + 3) - 0.5) * 0.012;
        bbi[bi] = this.classify(
          fm[k] * a + fm[k1] * b + fm[k2] * c + fm[k3] * d, fv[k] * a + fv[k1] * b + fv[k2] * c + fv[k3] * d,
          fs[k] * a + fs[k1] * b + fs[k2] * c + fs[k3] * d, ff[k] * a + ff[k1] * b + ff[k2] * c + ff[k3] * d,
          fe[k] * a + fe[k1] * b + fe[k2] * c + fe[k3] * d, fw[k] * a + fw[k1] * b + fw[k2] * c + fw[k3] * d, dist, jit);
      }
    }
  }

  private draw(ct: ChunkTex, cx: number, cy: number, lod: number) {
    const gx0 = cx * CT, gy0 = cy * CT;
    const px0 = cx * CP - T / 2, py0 = cy * CP - T / 2; // chunk origin, world px
    const reach = Math.max(12, THEME_FADE + 1) * T;
    const clear = this.clearings.filter(r => r.x0 - reach < px0 + CP && r.x1 + reach > px0 && r.y0 - reach < py0 + CP && r.y1 + reach > py0);
    const { fm, fv, fs, ff, fe, fw, fc, wraw, wat, tbi, bbi, bth } = this;
    bth.fill(255);
    this.clearingField(clear, gx0, gy0, px0, py0);

    // ---- fields at tile centres (with margin)
    for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
      const gx = gx0 + i - M, gy = gy0 + j - M, k = j * FN + i;
      fm[k] = fbm(gx / 24, gy / 24, SEED + 11);
      fv[k] = fbm(gx / 17, gy / 17, SEED + 23);
      fs[k] = fbm(gx / 31, gy / 31, SEED + 37);
      ff[k] = fbm(gx / 8, gy / 8, SEED + 41);
      fe[k] = vnoise(gx / 3.3, gy / 3.3, SEED + 53);
      fw[k] = fbm(gx / 9, gy / 9, SEED + 61);
      const c = fc[k];
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

    // ---- biome per 4 px block
    const themes = new Uint8Array(clear.length);
    clear.forEach((r, i) => { themes[i] = r.theme ?? Theme.Meadow; });
    this.blocks(gx0, gy0, themes);

    // ---- base pixels (straight into the texture's buffer)
    const size = ct.size, out = ct.px;
    const s = 1 / lod; // world px per chunk px
    const tvar = this.tvar;
    for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) tvar[j * CT + i] = Math.floor(hash2(gx0 + i, gy0 + j, SEED + 5) * 4);
    if (lod === 1) basePixels(out, this.flat, bbi, tvar);
    else basePixelsScaled(out, size, s, this.flat, bbi, tvar);

    // ---- water: quarter-tile autotile (pond 2x2 at tiles (2..3, 3..4) of terrain.png, inner corners from the blob)
    const W = (i: number, j: number) => wat[(j + M) * FN + i + M] === 1;
    for (let j = 0; j < CT; j++) for (let i = 0; i < CT; i++) {
      if (!W(i, j)) continue;
      const b = tbi[(j + M) * FN + i + M];
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
        blit(out, size, this.quarter(b, sx, sy, s), ox / s, oy / s);
      }
    }

    // ---- decorations, row by row (tiles around the chunk too: big sprites cross chunk edges);
    // at a lower resolution each one is shrunk with an area filter for where it falls in the pixel
    const D = this.decor;
    const tiny = lod < 0.5;
    const put = (d: Decor, x: number, y: number) => {
      const p = this.pixOf(d), X = Math.round(x - p.ax), Y = Math.round(y - p.ay);
      if (s === 1) { blit(out, size, p, X, Y); return; }
      const u = Math.floor(X / s), v = Math.floor(Y / s), fx = X - u * s, fy = Y - v * s, k = s * 16 + fy * 4 + fx;
      let q = p.scaled.get(k);
      if (!q) p.scaled.set(k, (q = shrink(p, s, fx, fy)));
      blit(out, size, q, u, v);
    };
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
    this.applyTheme(ct, lod);
  }

  /** Recolour the blocks near a themed arena (ground, water and decorations alike). */
  private applyTheme(ct: ChunkTex, lod: number) {
    const { bth } = this;
    let any = false;
    for (let i = 0; i < bth.length && !any; i++) any = bth[i] !== 255;
    if (!any) return;
    const size = ct.size, u = ct.px;
    const per = BS * lod; // chunk px per block
    for (let oy = 0; oy < size; oy++) {
      const row = ((oy / per) | 0) * BN;
      for (let bx = 0; bx < BN; bx++) {
        const th = bth[row + bx];
        if (th === 255) continue;
        const lut = this.lut(th);
        const { keys, vals } = lut;
        for (let i = oy * size + bx * per, e = i + per; i < e; i++) {
          const c = u[i];
          let h = Math.imul(c, 0x9e3779b1) >>> LUT_SHIFT;
          for (;;) {
            const k = keys[h];
            if (k === c) { u[i] = vals[h]; break; }
            if (k === 0) {
              if (lut.n < LUT_MAX) { keys[h] = c; vals[h] = themePixel(th as Theme, c); lut.n++; u[i] = vals[h]; }
              else u[i] = themePixel(th as Theme, c);
              break;
            }
            h = (h + 1) & (LUT_SIZE - 1);
          }
        }
      }
    }
  }

  /** Theme colour cache (open addressing; the composed pixels are opaque, so 0 marks a free slot). */
  private luts = new Map<number, { keys: Uint32Array; vals: Uint32Array; n: number }>();
  private lut(th: number) {
    let l = this.luts.get(th);
    if (!l) this.luts.set(th, (l = { keys: new Uint32Array(LUT_SIZE), vals: new Uint32Array(LUT_SIZE), n: 0 }));
    return l;
  }
}

/** Chunk level of detail for a zoom (device px per world px): full, half or quarter resolution. */
const lodLevel = (zoom: number) => (zoom >= 0.75 ? 0 : zoom >= 0.375 ? 1 : 2);

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: false })!;
  g.imageSmoothingEnabled = false;
  return [c, g] as const;
}
