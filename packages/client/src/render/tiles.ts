// Arena tile variants, generated once at load from the atlas tiles: calm grass floors (clover,
// tiny flowers, pebbles, tufts), weathered stone pillars / border walls (cracks, moss, chips) and
// crates (nails, a diagonal brace, horizontal planks, damage, slight tints). Each variant only
// edits pixels inside its own tile's palette, so floor / wall / brick stay readable at a glance.
// Picked deterministically per cell; everything ends up in the cached arena chunks.
import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { Theme } from '@ob/game';
import { themePixel } from './theme';

const T = 32;

const hex = (s: string) => parseInt(s.slice(1), 16);
/** '#rrggbb' → ImageData uint32 (little endian ABGR). */
const px32 = (s: string) => { const v = hex(s); return (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | (v >> 16)) >>> 0; };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
}

export const cellHash = (x: number, y: number, s: number) => {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** A 32x32 pixel buffer with small drawing helpers. */
class Tile {
  constructor(readonly p: Uint32Array) {}
  static of(src: Uint32Array) { return new Tile(src.slice()); }
  get(x: number, y: number) { return this.p[y * T + x]; }
  set(x: number, y: number, c: number) { if (x >= 0 && y >= 0 && x < T && y < T) this.p[y * T + x] = c; }
  /** Set only where the pixel currently is one of `on`. */
  over(x: number, y: number, c: number, on: number[]) { if (x >= 0 && y >= 0 && x < T && y < T && on.includes(this.p[y * T + x])) this.p[y * T + x] = c; }
  map(f: (c: number, x: number, y: number) => number) { for (let i = 0; i < this.p.length; i++) this.p[i] = f(this.p[i], i % T, (i / T) | 0); }
  flip() { const o = this.p.slice(); this.map((_, x, y) => o[y * T + (T - 1 - x)]); return this; }
  shift(dx: number, dy: number) { const o = this.p.slice(); this.map((_, x, y) => o[((y + dy) & 31) * T + ((x + dx) & 31)]); return this; }
  /** Multiply RGB by (r, g, b) — subtle tints. */
  tint(r: number, g: number, b: number) {
    this.map(c => {
      if (!(c >>> 24)) return c;
      const cr = Math.min(255, Math.round((c & 255) * r)), cg = Math.min(255, Math.round(((c >> 8) & 255) * g)), cb = Math.min(255, Math.round(((c >> 16) & 255) * b));
      return ((c & 0xff000000) | (cb << 16) | (cg << 8) | cr) >>> 0;
    });
    return this;
  }
}

// ---------------------------------------------------------------- palettes (from world.png)
const G = { base: px32('#839f7c'), tuft: px32('#a7ab85'), dark: px32('#76936f'), darker: px32('#6c8a66'), light: px32('#93ab84') };
const W = { out: px32('#5a5356'), shade: px32('#aba4a8'), hi: px32('#dbd9d6'), dark: px32('#91848a'), face: px32('#c6c0c3'), worn: px32('#bdb6ba'), deep: px32('#7f7479') };
const B = { out: px32('#523d49'), rim: px32('#be6c63'), side: px32('#915158'), deep: px32('#5e3643'), groove: px32('#7a444a'), band: px32('#a05b53'), plank: px32('#e39069'), plankLo: px32('#d4835f'), nail: px32('#3e2c38'), nailHi: px32('#f2b48e') };
const MOSS = [px32('#6b8f60'), px32('#82a46c'), px32('#5a7c58')];

// ---------------------------------------------------------------- floor
function floorVariants(src: Uint32Array): Tile[] {
  const plain = [Tile.of(src), Tile.of(src).flip(), Tile.of(src).shift(16, 8), Tile.of(src).flip().shift(8, 16)];
  const out = plain.slice();
  const free = (t: Tile, x: number, y: number) => t.get(x, y) === G.base;
  // clover: three-leaf sprigs in a slightly darker green
  {
    const t = Tile.of(src).shift(8, 0), r = rng(11);
    for (let n = 0; n < 3; n++) {
      const x = 4 + Math.floor(r() * 22), y = 4 + Math.floor(r() * 22);
      if (!free(t, x, y)) continue;
      t.set(x, y, G.darker); t.set(x - 1, y - 1, G.dark); t.set(x + 1, y - 1, G.dark); t.set(x, y + 1, G.dark);
      t.set(x - 1, y, G.dark); t.set(x + 1, y, G.dark);
    }
    out.push(t);
  }
  // tiny muted flowers
  for (const [petal, eye, seed] of [['#e6e2d6', '#e8cf7a', 21], ['#e9d98f', '#c99d6a', 29]] as const) {
    const t = Tile.of(src).flip(), r = rng(seed);
    for (let n = 0; n < 2; n++) {
      const x = 5 + Math.floor(r() * 21), y = 5 + Math.floor(r() * 21);
      t.set(x, y, px32(eye)); t.set(x - 1, y, px32(petal)); t.set(x + 1, y, px32(petal)); t.set(x, y - 1, px32(petal)); t.set(x, y + 1, G.darker);
    }
    out.push(t);
  }
  // pebbles
  {
    const t = Tile.of(src).shift(0, 16), r = rng(37);
    for (let n = 0; n < 3; n++) {
      const x = 3 + Math.floor(r() * 25), y = 3 + Math.floor(r() * 25);
      t.set(x, y, px32('#b2ad9f')); t.set(x + 1, y, px32('#9a958c')); if (n === 0) { t.set(x, y + 1, px32('#8a857e')); t.set(x + 1, y + 1, px32('#8a857e')); }
    }
    out.push(t);
  }
  // a denser tuft
  {
    const t = Tile.of(src).flip().shift(16, 16), r = rng(43);
    const x = 8 + Math.floor(r() * 14), y = 10 + Math.floor(r() * 12);
    for (const [dx, dy] of [[0, 0], [0, -1], [2, 0], [2, -1], [2, -2], [4, 0], [4, -1], [-2, 0], [1, 1], [3, 1], [-1, 1]]) t.set(x + dx, y + dy, G.dark);
    t.set(x + 2, y - 3, G.tuft); t.set(x, y - 2, G.tuft);
    out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------- stone blocks
function wallVariants(src: Uint32Array): Tile[] {
  const face = [W.face, W.hi];
  const out = [Tile.of(src)];
  const crack = (t: Tile, seed: number, x0: number, y0: number, len: number) => {
    const r = rng(seed);
    let x = x0, y = y0;
    for (let i = 0; i < len; i++) {
      t.over(x, y, W.dark, [W.face, W.hi, W.shade, W.worn]);
      t.over(x + 1, y, W.hi, [W.face]);
      y++;
      if (r() < 0.45) x += r() < 0.5 ? -1 : 1;
    }
  };
  const moss = (t: Tile, seed: number) => {
    const r = rng(seed);
    for (let x = 2; x < 28; x++) if (r() < 0.55) t.over(x, 1 + Math.floor(r() * 2), MOSS[Math.floor(r() * 3)], [W.shade, W.hi]);
    for (let y = 3; y < 20; y++) if (r() < 0.4) t.over(1 + Math.floor(r() * 2), y, MOSS[Math.floor(r() * 3)], [W.shade, W.hi]);
    for (let n = 0; n < 4; n++) t.over(5 + Math.floor(r() * 8), 5 + Math.floor(r() * 2), MOSS[1], face);
  };
  const chips = (t: Tile, seed: number) => {
    const r = rng(seed);
    // notch out of the top-right of the face
    for (const [x, y, c] of [[24, 5, W.shade], [25, 5, W.shade], [26, 5, W.shade], [25, 6, W.shade], [26, 6, W.dark], [26, 7, W.dark], [24, 4, W.dark]] as const) t.set(x, y, c);
    for (let n = 0; n < 4; n++) {
      const x = 7 + Math.floor(r() * 18), y = 7 + Math.floor(r() * 18);
      t.over(x, y, W.dark, face); t.over(x, y + 1, W.hi, face);
    }
  };
  const worn = (t: Tile, seed: number) => {
    const r = rng(seed);
    for (let n = 0; n < 34; n++) t.over(5 + Math.floor(r() * 22), 5 + Math.floor(r() * 22), r() < 0.7 ? W.worn : W.shade, [W.face]);
  };
  { const t = Tile.of(src); crack(t, 3, 13, 5, 14); out.push(t); }
  { const t = Tile.of(src); crack(t, 21, 8, 12, 12); crack(t, 22, 21, 6, 6); out.push(t); }
  { const t = Tile.of(src); crack(t, 31, 18, 16, 11); worn(t, 33); out.push(t); }
  { const t = Tile.of(src); moss(t, 5); out.push(t); }
  { const t = Tile.of(src); chips(t, 7); out.push(t); }
  { const t = Tile.of(src); worn(t, 9); crack(t, 13, 20, 14, 9); out.push(t); }
  { const t = Tile.of(src); worn(t, 15); moss(t, 17); out.push(t); }
  return out;
}

// ---------------------------------------------------------------- crates
function boxVariants(src: Uint32Array): Tile[] {
  const out = [Tile.of(src)];
  const nails = (t: Tile) => {
    for (const x of [6, 15, 24]) for (const y of [5, 20]) { t.set(x, y, B.nail); t.set(x + 1, y, B.nailHi); }
  };
  // diagonal brace from bottom-left to top-right across the planks
  const brace = (t: Tile) => {
    for (let i = 0; i < 22; i++) {
      const x = 5 + i, y = 19 - Math.round(i * 13 / 21);
      t.set(x, y, B.band); t.set(x, y - 1, B.plankLo); t.set(x, y + 1, B.groove);
    }
  };
  // horizontal planks instead of vertical ones
  const horizontal = (t: Tile) => {
    for (let y = 6; y < 20; y++) for (let x = 5; x < 27; x++) t.set(x, y, y === 10 || y === 15 ? B.band : y === 11 || y === 16 ? B.groove : B.plank);
  };
  // re-lay the mortar joints of the brick strip
  const mortar = (t: Tile, a: number, b: number, c: number) => {
    for (let x = 1; x < 31; x++) for (const y of [26, 27, 29, 30]) if (t.get(x, y) === B.out) t.set(x, y, B.rim);
    for (const y of [26, 27]) { t.set(a, y, B.out); t.set(b, y, B.out); }
    for (const y of [29, 30]) t.set(c, y, B.out);
  };
  const damage = (t: Tile, seed: number) => {
    const r = rng(seed);
    let x = 14, y = 6;
    for (let i = 0; i < 9; i++) { t.over(x, y, B.groove, [B.plank]); y++; if (r() < 0.5) x++; }
    x = 23; y = 12;
    for (let i = 0; i < 6; i++) { t.over(x, y, B.groove, [B.plank]); y++; if (r() < 0.5) x--; }
    // chipped corner of the brick strip
    for (const [cx, cy] of [[29, 26], [30, 26], [30, 27], [29, 27]]) t.set(cx, cy, B.side);
    t.set(30, 25, B.side);
  };
  { const t = Tile.of(src); nails(t); mortar(t, 7, 20, 13); out.push(t); }
  { const t = Tile.of(src); brace(t); out.push(t); }
  { const t = Tile.of(src); horizontal(t); nails(t); mortar(t, 11, 24, 5); out.push(t); }
  { const t = Tile.of(src); damage(t, 3); t.tint(0.95, 0.94, 0.96); out.push(t); }
  { const t = Tile.of(src); t.tint(1.03, 0.97, 0.94); mortar(t, 9, 19, 25); out.push(t); }
  { const t = Tile.of(src); brace(t); t.tint(0.96, 0.95, 0.97); out.push(t); }
  return out;
}

// ---------------------------------------------------------------- winter
const SNOW = { top: px32('#f6f9fc'), body: px32('#e2e9f2'), shade: px32('#c3cede'), edge: px32('#a9b6c9') };

/** A snow cap on the top of a block (keeps its outline), a ragged lower edge and a drip or two. */
function snowCap(t: Tile, seed: number, outline: number) {
  const r = rng(seed);
  let depth = 3 + Math.floor(r() * 2);
  for (let x = 1; x < T - 1; x++) {
    if (r() < 0.35) depth = Math.max(2, Math.min(6, depth + (r() < 0.5 ? -1 : 1)));
    for (let y = 1; y <= depth; y++) {
      if (t.get(x, y) === outline) continue;
      t.set(x, y, y === 1 ? SNOW.top : y === depth ? SNOW.shade : SNOW.body);
    }
    if (t.get(x, depth + 1) !== outline) t.set(x, depth + 1, SNOW.edge);
    if (r() < 0.06 && x > 3 && x < T - 4) { t.set(x, depth + 2, SNOW.shade); t.set(x, depth + 3, SNOW.edge); }
  }
}

function themed(set: Tile[], theme: Theme): Tile[] {
  if (theme === Theme.Meadow) return set;
  return set.map(t => { const o = Tile.of(t.p); o.map(c => themePixel(theme, c)); return o; });
}

function pixelsOf(t: Texture) {
  const c = document.createElement('canvas');
  c.width = c.height = T;
  const g = c.getContext('2d')!;
  const f = t.frame;
  g.drawImage(t.source.resource as CanvasImageSource, f.x, f.y, f.width, f.height, 0, 0, T, T);
  return new Uint32Array(g.getImageData(0, 0, T, T).data.buffer.slice(0));
}

export function makeTileVariants(world: Record<'grass' | 'box' | 'wall', Texture>, theme = Theme.Meadow) {
  const sets = [floorVariants(pixelsOf(world.grass)), wallVariants(pixelsOf(world.wall)), boxVariants(pixelsOf(world.box))]
    .map(set => themed(set, theme));
  if (theme === Theme.Winter) {
    sets[1].forEach((t, i) => snowCap(t, 101 + i, W.out));
    sets[2].forEach((t, i) => snowCap(t, 201 + i, B.out));
  }
  // one atlas canvas for all of them
  const cols = Math.max(...sets.map(s => s.length));
  const c = document.createElement('canvas');
  c.width = cols * T; c.height = sets.length * T;
  const g = c.getContext('2d')!;
  sets.forEach((set, row) => set.forEach((t, col) => {
    const id = new ImageData(new Uint8ClampedArray(t.p.buffer.slice(0) as ArrayBuffer), T, T);
    g.putImageData(id, col * T, row * T);
  }));
  const source = new CanvasSource({ resource: c, scaleMode: 'nearest', resolution: 1 });
  const tex = sets.map((set, row) => set.map((_, col) => new Texture({ source, frame: new Rectangle(col * T, row * T, T, T) })));
  const [floor, wall, box] = tex;
  return {
    floor, wall, box,
    /** Floor: mostly the plain grass (4 orientations), a calm sprinkle of details. */
    floorAt(x: number, y: number, seed: number) {
      const r = cellHash(x, y, seed + 1);
      return r < 0.66 ? floor[Math.floor(r / 0.66 * 4)] : floor[4 + Math.floor((r - 0.66) / 0.34 * (floor.length - 4))];
    },
    wallAt(x: number, y: number, seed: number) {
      const r = cellHash(x, y, seed + 2);
      return r < 0.45 ? wall[0] : wall[1 + Math.floor((r - 0.45) / 0.55 * (wall.length - 1))];
    },
    boxAt(x: number, y: number, seed: number) {
      const r = cellHash(x, y, seed + 3);
      return r < 0.35 ? box[0] : box[1 + Math.floor((r - 0.35) / 0.65 * (box.length - 1))];
    },
  };
}

export type TileVariants = ReturnType<typeof makeTileVariants>;
