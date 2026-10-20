// Endless ground outside the arena (canon: legacy Background.ts + new-openbomber Ground.ts):
// a seamless pattern of grass, cracked-ground clusters and autotiled water ponds, drawn once into a
// canvas and shown through a TilingSprite that always covers the camera view.
import { Texture, TilingSprite } from 'pixi.js';

const T = 32;
const N = 32; // pattern size in tiles (1024 px)

type Src = CanvasImageSource;
const srcOf = (t: Texture) => t.source.resource as Src;

/** Periodic smooth noise in [0,1]: a few integer-frequency waves over the pattern size. */
function periodicNoise(seed: number, waves: number, maxFreq: number) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
  const list: [number, number, number, number][] = [];
  for (let i = 0; i < waves; i++) {
    const k = Math.floor(rnd() * (maxFreq * 2 + 1)) - maxFreq;
    const l = 1 + Math.floor(rnd() * maxFreq);
    list.push([k, rnd() < 0.5 ? l : -l, rnd() * Math.PI * 2, 0.5 + rnd()]);
  }
  const amp = list.reduce((a, w) => a + w[3], 0);
  return (x: number, y: number) => {
    let v = 0;
    for (const [k, l, p, a] of list) v += a * Math.sin(((k * x + l * y) / N) * Math.PI * 2 + p);
    return (v / amp + 1) / 2;
  };
}

/**
 * Builds the pattern texture. `terrain` is legacy Map/Tile.png (water pond + blob tiles);
 * water uses a quarter-tile (16 px) autotile assembled from its 2x2 pond and the blob's inner corners.
 */
export function makeGroundPattern(grass: Texture, cracked: Texture, terrain: Texture, seed = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = N * T;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const wn = periodicNoise(seed * 31 + 1, 7, 3);
  const cn = periodicNoise(seed * 17 + 5, 9, 5);
  // thresholds by percentile: ~9% water ponds, ~30% cracked ground (clustered)
  const pct = (f: (x: number, y: number) => number, p: number) => {
    const v: number[] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) v.push(f(x, y));
    return v.sort((a, b) => a - b)[Math.floor(p * v.length)];
  };
  const wT = pct(wn, 0.09), cT = pct(cn, 0.68);
  const water = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) water[y * N + x] = wn(x, y) < wT ? 1 : 0;
  // drop lone water cells (they read as noise)
  const wAt = (x: number, y: number) => water[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!wAt(x, y)) continue;
    if (!wAt(x - 1, y) && !wAt(x + 1, y) && !wAt(x, y - 1) && !wAt(x, y + 1)) water[y * N + x] = 0;
  }
  const draw = (t: Texture, dx: number, dy: number, flip = false) => {
    const f = t.frame;
    if (flip) {
      g.save(); g.translate(dx + T, dy); g.scale(-1, 1);
      g.drawImage(srcOf(t), f.x, f.y, f.width, f.height, 0, 0, T, T);
      g.restore();
    } else g.drawImage(srcOf(t), f.x, f.y, f.width, f.height, dx, dy, T, T);
  };
  let h = seed;
  const rnd = () => ((h = (Math.imul(h ^ (h >>> 13), 1274126177) + 0x6d2b79f5) | 0) >>> 0) / 4294967296;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const crack = cn(x, y) > cT && rnd() < 0.85;
    draw(crack ? cracked : grass, x * T, y * T, rnd() < 0.5);
  }
  // water quarters: pond 2x2 at tiles (2..3, 3..4) of terrain.png; inner corners from the blob centre
  const tf = terrain.frame, tsrc = srcOf(terrain);
  const PX = tf.x + 2 * T, PY = tf.y + 3 * T;     // pond origin (64x64 → 4x4 quarters)
  const BX = tf.x + 4 * T, BY = tf.y + 1 * T;     // blob centre 2x2 (inner concave corners on its outside)
  const q = (sx: number, sy: number, dx: number, dy: number) => g.drawImage(tsrc, sx, sy, 16, 16, dx, dy, 16, 16);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!wAt(x, y)) continue;
    for (const ddy of [-1, 1]) for (const ddx of [-1, 1]) {
      const hN = wAt(x + ddx, y), vN = wAt(x, y + ddy), dN = wAt(x + ddx, y + ddy);
      const ox = x * T + (ddx > 0 ? 16 : 0), oy = y * T + (ddy > 0 ? 16 : 0);
      const cx = ddx < 0 ? 0 : 3, cy = ddy < 0 ? 0 : 3;   // pond corner quarter
      const ix = ddx < 0 ? 1 : 2, iy = ddy < 0 ? 1 : 2;   // pond inner quarter
      if (!hN && !vN) q(PX + cx * 16, PY + cy * 16, ox, oy);
      else if (hN && !vN) q(PX + ix * 16, PY + cy * 16, ox, oy);
      else if (!hN && vN) q(PX + cx * 16, PY + iy * 16, ox, oy);
      else if (!dN) q(BX + (ddx < 0 ? 0 : 3) * 16, BY + (ddy < 0 ? 0 : 3) * 16, ox, oy);
      else q(PX + 16, PY + 16, ox, oy);
    }
  }
  const tex = Texture.from(c);
  tex.source.scaleMode = 'nearest';
  tex.source.addressMode = 'repeat';
  return tex;
}

export class Ground {
  readonly sprite: TilingSprite;

  constructor(pattern: Texture) {
    this.sprite = new TilingSprite({ texture: pattern, width: 64, height: 64 });
  }

  /** Cover the visible world rect (world px); the pattern stays anchored to world tile edges. */
  cover(x0: number, y0: number, x1: number, y1: number) {
    const s = this.sprite;
    const ax = Math.floor(x0 / T) * T - T, ay = Math.floor(y0 / T) * T - T;
    s.x = ax - T / 2; s.y = ay - T / 2;
    s.width = Math.ceil((x1 - ax) / T + 2) * T;
    s.height = Math.ceil((y1 - ay) / T + 2) * T;
    s.tilePosition.set(-ax, -ay);
  }
}
