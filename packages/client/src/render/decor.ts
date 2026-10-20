// Pixel-art decorations for the world outside the arena, drawn once into small canvases:
// trees, bushes, rocks, stumps, mushrooms, flowers, tufts, reeds, lily pads, and weathered
// crates / stone blocks cut from the world atlas. 1 art px = 1 world px, like the 32 px tiles.
import type { Texture } from 'pixi.js';

export interface Decor { c: HTMLCanvasElement; ax: number; ay: number } // anchor: the spot that sits on the tile

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g] as const;
};

/** Pixel art from strings; each char maps to a colour, '.' is transparent. */
function pixels(rows: string[], pal: Record<string, string>, ax?: number, ay?: number): Decor {
  const w = Math.max(...rows.map(r => r.length));
  const [c, g] = canvas(w, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (!pal[ch]) return;
    g.fillStyle = pal[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return { c, ax: ax ?? Math.floor(w / 2), ay: ay ?? rows.length - 1 };
}

/** Tiny deterministic RNG for sprite variants. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
}

/**
 * A shaded pixel blob (union of ellipses) lit from the top-left, with a 1 px outline:
 * tones[0] = darkest .. tones[n-1] = highlight.
 */
function blob(w: number, h: number, parts: [number, number, number, number][], tones: string[], outline: string, seed: number, dither = 0.18) {
  const inside = new Uint8Array(w * h);
  const shade = new Float32Array(w * h);
  const r = rng(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = -1e9;
    for (const [cx, cy, rx, ry] of parts) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
      if (d > 1) continue;
      inside[y * w + x] = 1;
      // light from the top-left: brighter on that side of each lobe, darker towards the bottom
      const l = (-dx * 0.55 - dy * 0.85) * Math.sqrt(1 - d * 0.6) + (1 - d) * 0.35;
      best = Math.max(best, l);
    }
    shade[y * w + x] = best;
  }
  const [c, g] = canvas(w, h);
  const n = tones.length;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!inside[i]) continue;
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1
      || !inside[i - 1] || !inside[i + 1] || !inside[i - w] || !inside[i + w];
    if (edge) { g.fillStyle = outline; g.fillRect(x, y, 1, 1); continue; }
    const v = shade[i] + (r() - 0.5) * dither + (y / h) * -0.25;
    const k = Math.max(0, Math.min(n - 1, Math.floor((v + 0.75) / 1.5 * n)));
    g.fillStyle = tones[k];
    g.fillRect(x, y, 1, 1);
  }
  return [c, g] as const;
}

function ellipseShadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a = 0.24) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
    if (d > 1) continue;
    g.fillStyle = `rgba(28,26,44,${d < 0.5 ? a * 1.25 : a})`;
    g.fillRect(x, y, 1, 1);
  }
}

const LEAF = ['#3f5a48', '#4b6a50', '#5a7c58', '#6b8f60', '#82a46c'];
const LEAF_DARK = ['#36503f', '#425f48', '#4f6f50', '#5f815a', '#729664'];
const BUSH = ['#4d6c50', '#5b7e59', '#6b9062', '#80a36d', '#97b67c'];
const STONE = ['#7f7479', '#91848a', '#aba4a8', '#c6c0c3', '#dbd9d6'];
const OUT_LEAF = '#2f4236';
const OUT_STONE = '#5a5356';

function tree(seed: number, size: number, dark: boolean): Decor {
  const r = rng(seed);
  const W = 26 + size * 7, CH = 21 + size * 5;      // canopy box
  const trunkH = 8 + size;
  const H = CH + trunkH - 2;
  const pad = 6;                                     // room for the shadow on the right
  const [c, g] = canvas(W + pad, H + 3);
  // shadow cast to the bottom-right
  ellipseShadow(g, W / 2 + 4, H - 1, W * 0.42, 4 + size, 0.26);
  // trunk
  const tx = Math.floor(W / 2) - 3, ty = CH - 5;
  g.fillStyle = '#4a3038'; g.fillRect(tx, ty, 6, trunkH + 2);
  g.fillStyle = '#7a5a48'; g.fillRect(tx + 1, ty, 4, trunkH + 1);
  g.fillStyle = '#5e4038'; g.fillRect(tx + 3, ty, 2, trunkH + 1);
  g.fillStyle = '#8f6c54'; g.fillRect(tx + 1, ty + 2, 1, trunkH - 2);
  // roots
  g.fillStyle = '#4a3038'; g.fillRect(tx - 1, ty + trunkH, 2, 1); g.fillRect(tx + 5, ty + trunkH, 2, 1);
  // canopy lobes
  const parts: [number, number, number, number][] = [[W / 2, CH * 0.52, W * 0.42, CH * 0.42]];
  const lobes = 3 + Math.floor(r() * 3);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + r();
    parts.push([W / 2 + Math.cos(a) * W * 0.22, CH * 0.5 + Math.sin(a) * CH * 0.2, W * (0.2 + r() * 0.08), CH * (0.2 + r() * 0.08)]);
  }
  const [lc] = blob(W, CH, parts, dark ? LEAF_DARK : LEAF, OUT_LEAF, seed * 7 + 1);
  g.drawImage(lc, 0, 0);
  return { c, ax: Math.floor(W / 2), ay: H - 1 };
}

function bush(seed: number, berries: boolean): Decor {
  const r = rng(seed);
  const W = 14 + Math.floor(r() * 5), H = 10 + Math.floor(r() * 3);
  const [c, g] = canvas(W + 3, H + 2);
  ellipseShadow(g, W / 2 + 2, H - 0.5, W * 0.48, 2.5, 0.24);
  const parts: [number, number, number, number][] = [
    [W * 0.32, H * 0.6, W * 0.3, H * 0.38], [W * 0.66, H * 0.58, W * 0.32, H * 0.4], [W * 0.5, H * 0.4, W * 0.3, H * 0.38],
  ];
  const [bc, bg] = blob(W, H, parts, BUSH, OUT_LEAF, seed * 3 + 5);
  if (berries) {
    for (let i = 0; i < 4; i++) {
      const x = 3 + Math.floor(r() * (W - 6)), y = 3 + Math.floor(r() * (H - 6));
      bg.fillStyle = '#c4504a'; bg.fillRect(x, y, 1, 1);
      bg.fillStyle = '#ffb0a0'; bg.fillRect(x, y - 1, 1, 1);
    }
  }
  g.drawImage(bc, 0, 0);
  return { c, ax: Math.floor(W / 2), ay: H - 1 };
}

function rock(seed: number, size: number, moss: boolean): Decor {
  const r = rng(seed);
  const W = 6 + size * 4 + Math.floor(r() * 3), H = 4 + size * 3;
  const [c, g] = canvas(W + 2, H + 2);
  ellipseShadow(g, W / 2 + 1, H, W * 0.5, 1.8, 0.24);
  const parts: [number, number, number, number][] = [[W / 2, H * 0.55, W / 2, H * 0.5]];
  if (size > 0) parts.push([W * (0.3 + r() * 0.4), H * 0.4, W * 0.3, H * 0.4]);
  const [rc, rg] = blob(W, H, parts, STONE, OUT_STONE, seed * 5 + 3, 0.1);
  if (moss) for (let i = 0; i < W; i++) {
    if (r() < 0.45) continue;
    const y = 1 + Math.floor(r() * 2);
    const d = rg.getImageData(i, y, 1, 1).data;
    if (!d[3]) continue;
    rg.fillStyle = r() < 0.5 ? '#6b8f60' : '#82a46c'; rg.fillRect(i, y, 1, 1);
  }
  g.drawImage(rc, 0, 0);
  return { c, ax: Math.floor(W / 2), ay: H - 1 };
}

const PAL_TREE = { O: '#4a3038', b: '#7a5a48', d: '#5e4038', r: '#b8946c', R: '#9c7858', l: '#d4b48a' };

function stump(): Decor {
  return pixels([
    '...OOOOOO...',
    '..OllrrllO..',
    '.OlrRRRRrlO.',
    '.OlrRllRrlO.',
    '.OllrrrrllO.',
    '.ObllllllbO.',
    '.ObbdbbbdbO.',
    '.ObbdbbbdbO.',
    'OObbdbbbdbOO',
    'OdOOOOOOOOdO',
  ], PAL_TREE);
}

function log(): Decor {
  return pixels([
    '..OOOOOOOOOOOOO..',
    '.ObbbbbbbbbbbbOO.',
    'OObbdbbbbbdbbOlrO',
    'OddbbbbdbbbbbOrRO',
    '.OdddddddddddOlrO',
    '..OOOOOOOOOOOOOO.',
  ], PAL_TREE, 8, 5);
}

function mushroom(red: boolean): Decor {
  return red
    ? pixels([
      '..OOOO...',
      '.ORWRRO..',
      'ORRRRWRO.',
      'OOOOOOOO.',
      '..OsO.OO.',
      '..OsOObbO',
      '..OOO.OO.',
    ], { O: '#4a3040', R: '#c4504a', W: '#f1ecff', s: '#efe4d0', b: '#b07850' }, 3, 6)
    : pixels([
      '.OOO..OOO.',
      'ObbbO.OlbO',
      'OOOOO.OOOO',
      '.OsO...Os.',
      '.OOO...OO.',
    ], { O: '#4a3040', b: '#a8784e', l: '#d4a878', s: '#efe4d0' }, 4, 4);
}

function flower(petal: string, eye: string): Decor {
  return pixels([
    '.p.',
    'pep',
    '.p.',
    '.g.',
  ], { p: petal, e: eye, g: '#5a7c58' }, 1, 3);
}

function tuft(dark: string, light: string, k: number): Decor {
  const rows = [
    ['..l...l.', 'l.d..dl.', '.ddl.d.d', '..dddd..'],
    ['.l.l..', '.d.dl.', 'd.dd.d', '.ddd..'],
    ['...l...', '.l.d.l.', '.d.d.d.', '..ddd..'],
  ][k % 3];
  return pixels(rows, { d: dark, l: light });
}

function reeds(): Decor {
  return pixels([
    '.b.....',
    '.b..b..',
    '.g..b.b',
    'g.g.g.b',
    '.gg.g.g',
    '..ggg.g',
    '..gggg.',
  ], { b: '#7a5040', g: '#5a7c58' }, 3, 6);
}

function lily(flowerOn: boolean): Decor {
  return pixels([
    '..gggg..',
    '.gglggg.',
    'ggglgg..',
    'gggg..gg',
    '.gggggg.',
    '..gddg..',
  ].map((r, y) => flowerOn && y === 1 ? '.ggPpgg.' : r), { g: '#6b8f60', l: '#82a46c', d: '#4f6f50', P: '#f0a8c0', p: '#ffe0ea' }, 4, 4);
}

function pebbles(k: number): Decor {
  return pixels([
    ['.gG..', 'gGG.g', '.G..G'],
    ['g..', 'GgG', '.G.'],
    ['..g.g', '.gGGG', 'g.G..'],
  ][k % 3], { g: '#b9b3a8', G: '#85818c' });
}

function chips(): Decor {
  return pixels(['bb..k', 'bk.bb', '...k.'], { b: '#c86a48', k: '#8a3f34' });
}

/** Weathered, cracked crate from the atlas with a broken corner and a loose plank beside it. */
function brokenCrate(box: Texture): Decor {
  const [c, g] = canvas(44, 34);
  ellipseShadow(g, 19, 31, 17, 3, 0.26);
  const f = box.frame, src = box.source.resource as CanvasImageSource;
  g.drawImage(src, f.x, f.y, f.width, f.height, 2, 0, 32, 32);
  // knock a jagged chunk out of the top-right corner
  const cut = [9, 8, 8, 6, 6, 5, 3, 3, 2, 1];
  g.globalCompositeOperation = 'destination-out';
  cut.forEach((n, y) => g.fillRect(34 - n, y, n, 1));
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#523d49';
  cut.forEach((n, y) => g.fillRect(34 - n - 1, y, 1, 1));
  // cracks + weathering
  g.fillStyle = '#7a444a';
  [[14, 6], [15, 7], [15, 8], [16, 9], [16, 10], [17, 11], [11, 18], [12, 19], [12, 20], [13, 21]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(70,64,84,0.22)'; g.fillRect(0, 0, 44, 34);
  g.globalCompositeOperation = 'source-over';
  // loose plank
  g.fillStyle = '#523d49'; g.fillRect(33, 26, 10, 4);
  g.fillStyle = '#e39069'; g.fillRect(34, 27, 8, 1);
  g.fillStyle = '#be6c63'; g.fillRect(34, 28, 8, 1);
  return { c, ax: 18, ay: 31 };
}

/** Old stone block from the atlas, half sunk into the ground, mossy and cracked. */
function oldStone(wall: Texture, seed: number): Decor {
  const r = rng(seed);
  const [c, g] = canvas(36, 30);
  ellipseShadow(g, 19, 26, 16, 3, 0.26);
  const f = wall.frame, src = wall.source.resource as CanvasImageSource;
  g.drawImage(src, f.x, f.y, f.width, 26, 2, 0, 32, 26);
  g.fillStyle = '#5a5356'; g.fillRect(2, 25, 32, 1);
  // crack
  g.fillStyle = '#7f7479';
  let x = 10 + Math.floor(r() * 12);
  for (let y = 3; y < 20; y++) { g.fillRect(x, y, 1, 1); if (r() < 0.4) x += r() < 0.5 ? -1 : 1; }
  // moss on the top and down one side
  for (let i = 3; i < 33; i++) {
    if (r() < 0.35) continue;
    g.fillStyle = r() < 0.5 ? '#6b8f60' : '#82a46c';
    g.fillRect(i, 1 + Math.floor(r() * 2), 1, 1);
  }
  for (let y = 4; y < 24; y++) if (r() < 0.5) { g.fillStyle = '#6b8f60'; g.fillRect(3 + Math.floor(r() * 2), y, 1, 1); }
  // grass tufts in front of the sunk base
  g.fillStyle = '#6a8a64';
  for (let i = 0; i < 6; i++) { const tx = 4 + Math.floor(r() * 28); g.fillRect(tx, 23, 1, 3); g.fillRect(tx + 1, 24, 1, 2); }
  return { c, ax: 18, ay: 25 };
}

export function makeDecor(box: Texture, wall: Texture) {
  const FLOWERS: [string, string][] = [
    ['#f1ecff', '#ffd84a'], ['#ffe08a', '#e09040'], ['#f0a0c0', '#fff0c0'], ['#a8c4f4', '#f1ecff'], ['#d0a8f0', '#ffe08a'],
  ];
  return {
    trees: [tree(11, 0, false), tree(23, 1, false), tree(37, 2, false), tree(41, 1, true), tree(53, 2, true), tree(67, 0, true)],
    bushes: [bush(3, false), bush(5, true), bush(9, false), bush(13, false)],
    rocks: [rock(1, 0, false), rock(2, 0, false), rock(3, 1, false), rock(4, 1, true), rock(5, 2, true), rock(6, 2, false)],
    stump: stump(),
    log: log(),
    mushrooms: [mushroom(true), mushroom(false)],
    flowers: FLOWERS.map(([p, e]) => flower(p, e)),
    tufts: (dark: string, light: string) => [0, 1, 2].map(k => tuft(dark, light, k)),
    reeds: reeds(),
    lily: [lily(false), lily(true)],
    pebbles: [0, 1, 2].map(pebbles),
    chips: chips(),
    crate: brokenCrate(box),
    stones: [oldStone(wall, 3), oldStone(wall, 8)],
  };
}

export type DecorSet = ReturnType<typeof makeDecor>;
