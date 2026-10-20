// Generates assets/pickups/pickups.{png,json}: one 30x30 icon per PickupType (in enum order),
// in the style of the hand-drawn bonuses atlas. Existing icons are copied verbatim; the missing
// ones are composed from the same tile backgrounds, badges and a hand-authored pixel palette.
// The 8-frame shine is the shared `blink` animation, copied from bonuses.png.
//
//   bun packages/client/src/assets/tools/gen-pickups.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng, encodePng, type Img } from './png';

const ROOT = new URL('..', import.meta.url).pathname;
const src = decodePng(new Uint8Array(readFileSync(ROOT + 'bonuses/bonuses.png')));
const srcJson = JSON.parse(readFileSync(ROOT + 'bonuses/bonuses.json', 'utf8'));

const S = 30; // tile size
type RGBA = [number, number, number, number];
const hex = (h: string): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const eq = (a: RGBA, b: RGBA) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

class Tile {
  data = new Uint8Array(S * S * 4);
  get(x: number, y: number): RGBA { const i = (y * S + x) * 4; return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]; }
  set(x: number, y: number, c: RGBA) { if (x < 0 || y < 0 || x >= S || y >= S) return; this.data.set(c, (y * S + x) * 4); }
  clone() { const t = new Tile(); t.data.set(this.data); return t; }
}

const frameOf = (name: string) => srcJson.frames[name + ':0'].frame as { x: number; y: number };
const cut = (name: string) => {
  const { x, y } = frameOf(name); const t = new Tile();
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const k = ((y + j) * src.w + x + i) * 4; t.data.set(src.data.subarray(k, k + 4), (j * S + i) * 4); }
  return t;
};

// ---------------------------------------------------------------- backgrounds
interface Pal { a: string; b: string; c: string; d: string; e: string; }
const PAL = {
  orange: { a: '#52414c', b: '#e5c1b2', c: '#bd7455', d: '#e7af75', e: '#e1a76b' },
  red: { a: '#4d3d52', b: '#e5a7b7', c: '#bd4061', d: '#ea6971', e: '#e1535c' },
  blue: { a: '#5a4c4a', b: '#8ccef4', c: '#396883', d: '#58b3e7', e: '#44a7e1' },
  purple: { a: '#3b2d4a', b: '#d2b4f0', c: '#5c3a86', d: '#9a72cc', e: '#8c63bf' },
} satisfies Record<string, Pal>;

/** Clean background: the '?' tile with the glyph painted over by the fill (diagonal shade at x+y>=29). */
const blankOrange = (() => {
  const t = cut('random'); const p = PAL.orange; const bg = Object.values(p).map(hex);
  for (let y = 3; y < 27; y++) for (let x = 3; x < 27; x++) {
    const c = t.get(x, y);
    if (!bg.some(b => eq(b, c))) t.set(x, y, hex(x + y >= 29 ? p.e : p.d));
  }
  return t;
})();
const recolor = (t: Tile, from: Pal, to: Pal) => {
  const out = t.clone(); const keys = Object.keys(from) as (keyof Pal)[];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = out.get(x, y); const k = keys.find(k => eq(hex(from[k]), c));
    if (k) out.set(x, y, hex(to[k]));
  }
  return out;
};
const blank = (p: keyof typeof PAL) => recolor(blankOrange, PAL.orange, PAL[p]);

/** Copy pixels of `name` within a rect whose colours are in `colors` (a badge / sub-icon). */
const piece = (name: string, x0: number, y0: number, x1: number, y1: number, colors: string[]) => {
  const t = cut(name); const cs = colors.map(hex); const px: [number, number, RGBA][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = t.get(x, y); if (cs.some(k => eq(k, c))) px.push([x, y, c]); }
  return (dst: Tile, dx = 0, dy = 0) => px.forEach(([x, y, c]) => dst.set(x + dx, y + dy, c));
};
const plusBadge = piece('append', 12, 14, 26, 25, ['#327348', '#bcffc6', '#7dd087', '#29905a']);
const monitor = piece('shield', 12, 12, 26, 26, ['#4d4d4d', '#bfbfbf', '#2e4a66', '#bcf6ff', '#7db2d0', '#416180', '#737373']);
/** Remove everything that isn't background (to reuse a tile's frame + palette). */
const wipe = (t: Tile, p: Pal, keep?: (x: number, y: number) => boolean) => {
  const bg = Object.values(p).map(hex);
  for (let y = 3; y < 27; y++) for (let x = 3; x < 27; x++) {
    if (keep?.(x, y)) continue;
    const c = t.get(x, y); if (!bg.some(b => eq(b, c))) t.set(x, y, hex(x + y >= 29 ? p.e : p.d));
  }
  return t;
};

// ---------------------------------------------------------------- pixel art
const OUTLINE = hex('#322d58');
const INK: Record<string, string> = {
  K: '#322d58',                                 // outline ink
  W: '#f6f4ff', l: '#c9c6e6', L: '#9893c4',     // white / cool shade
  g: '#6b717c', G: '#4a4c6e', w: '#cad5e2', v: '#9aa3b3', // bomb steel
  c: '#444444', f: '#a0703f', y: '#fff3a0', o: '#ff9a3c', O: '#e8552f', // cap, fuse, sparks
  r: '#e8404f', R: '#a8243a', p: '#ff8fa0', // red
  n: '#57c96f', N: '#2f8a4a', m: '#bcffc6',  // green
  Y: '#ffd24d', A: '#d98a1c', Z: '#fff2b8',  // gold
  k: '#e8925e', b: '#c86a48', B: '#8a3f34', M: '#5a3a3a', // brick
  s: '#8b93a7', S: '#565d73', e: '#2a2440', // grey device
  C: '#8ff4ff', D: '#34b4e4', V: '#c79bff', X: '#6a44c4', // teleport swirl
};
/** Draws a string-art sprite with an automatic 1px outline (4-neighbourhood). */
const stamp = (t: Tile, art: string[], x0: number, y0: number, outline = true) => {
  const h = art.length, w = Math.max(...art.map(r => r.length));
  const solid = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && art[y][x] !== undefined && art[y][x] !== '.' && art[y][x] !== ' ';
  if (outline) for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) t.set(x0 + x, y0 + y, OUTLINE);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) t.set(x0 + x, y0 + y, hex(INK[art[y][x]] ?? '#ff00ff'));
};
/** Procedural round bomb: centre (cx, cy), radius r. Returns string art anchored at its bbox. */
const bombArt = (r: number, fuse = true) => {
  const size = Math.ceil(r * 2) + 1, top = fuse ? 3 : 0;
  const rows: string[][] = Array.from({ length: size + top }, () => Array(size + 2).fill('.'));
  const c = r;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - c, dy = y - c, d2 = dx * dx + dy * dy;
    if (d2 > r * r + r * 0.6) continue;
    let ch = 'g';
    if (dx + dy > r * 0.9) ch = 'G';
    const hx = dx + r * 0.45, hy = dy + r * 0.45;
    if (hx * hx + hy * hy < (r * 0.32) ** 2 + 0.5) ch = 'w';
    else if (hx * hx + hy * hy < (r * 0.55) ** 2 + 0.5 && dx + dy < 0) ch = 'v';
    rows[y + top][x] = ch;
  }
  if (fuse) {
    const cx = Math.round(c + r * 0.6), cy = Math.round(c - r * 0.75) + top;
    rows[cy][cx] = 'c'; rows[cy][cx - 1] = 'c'; rows[cy - 1]?.splice(cx, 1, 'c');
    rows[cy - 2][cx + 1] = 'f'; rows[cy - 3]?.splice(cx + 2, 1, 'o');
    rows[cy - 3]?.splice(cx + 1, 1, 'y');
  }
  return rows.map(r => r.join(''));
};

// ---------------------------------------------------------------- icons
const icons = new Map<string, Tile>();
const fromAtlas: Record<string, string> = {
  BombUp: 'append', FireUp: 'radius', SpeedUp: 'speed', Kick: 'kick', Shield: 'shield',
  Crazy: 'ebomb', Fire: 'fire', Random: 'random',
};
for (const [k, v] of Object.entries(fromAtlas)) icons.set(k, cut(v));

{ // FullFire: the FireUp flame with a gold "MAX" plate instead of +1
  const t = cut('radius');
  wipe(t, PAL.blue, (x, y) => !(x >= 12 && y >= 14));
  stamp(t, [
    'ZZZZZZZZZZZZZZZ',
    'YAYYYAYYAYYAYAY',
    'YAAYAAYAYAYAYAY',
    'YAYAYAYAAAYYAYY',
    'YAYYYAYAYAYAYAY',
    'YAYYYAYAYAYAYAY',
    'AAAAAAAAAAAAAAA',
  ], 11, 16);
  // re-apply the bright flame tip over the plate edge? no: keep the plate crisp
  icons.set('FullFire', t);
}
{ // Heart: +1 life on the blue "stat" tile
  const t = wipe(cut('append'), PAL.blue);
  stamp(t, [
    '..rrr...rrr..',
    '.rpprr.rrrrr.',
    'rpWprrrrrrrRr',
    'rpprrrrrrrrRr',
    'rprrrrrrrrrRr',
    'rrrrrrrrrrRRr',
    '.rrrrrrrrRRr.',
    '..rrrrrrRRr..',
    '...rrrrRRr...',
    '....rrRRr....',
    '.....rRr.....',
    '......r......',
  ], 4, 5);
  plusBadge(t);
  icons.set('Heart', t);
}
{ // Glove: white glove grabbing a bomb
  const t = blank('orange');
  stamp(t, bombArt(5), 10, 2);
  stamp(t, [
    '.WW..........WW.',
    'WWlW.......WWWlW',
    'WWlW......WWlWlW',
    'WWWlW....WWlWlWW',
    '.WWWlWWWWWlWlWW.',
    '.WWWWWWWWWWWWWl.',
    '..lWWWWWWWWWWl..',
    '...llWWWWWWll...',
    '....rrrrrrrr....',
    '....RRRRRRRR....',
  ], 7, 14);
  icons.set('Glove', t);
}
{ // Punch: red boxing glove with speed lines
  const t = blank('orange');
  stamp(t, [
    '..........rrrrrr...',
    '.......rrrpprrrrrr.',
    'WWW...rrpprrrrrrrrr',
    '......rprrrrrrrrrrr',
    '...WWrrrrrrrrrrrrrR',
    'WW.WWrRRRRRrrrrrrrR',
    '...WWrrrrrrRrrrrrrR',
    '...WWrrrrrrrRrrrrRR',
    'WWW.lrrrrrrrrrrRRR.',
    '......RRRRRRRRRR...',
  ], 5, 9);
  icons.set('Punch', t);
}
{ // Remote: detonator with antenna and signal arcs
  const t = blank('orange');
  stamp(t, [
    '.rr.............',
    'rpRr.....yy.....',
    'rRRr...y...y....',
    '.ss......y......',
    '.ss.....y.......',
    '.ss.............',
    'SsssssssssS.....',
    'SwwwwwwwwsS.....',
    'SseeeeeeesS.....',
    'SsemmemmesS.....',
    'SseeeeeeesS.....',
    'SsssssssssS.....',
    'SssrrrrsssS.....',
    'SsrpprrrssS.....',
    'SsrprrrRssS.....',
    'SsrrrrRRssS.....',
    'SssRRRRsssS.....',
    'SSSSSSSSSSS.....',
  ], 9, 5);
  icons.set('Remote', t);
}
{ // Pierce: a brick with a flaming arrow through it
  const t = blank('orange');
  stamp(t, [
    'kkkkkMkkkkk',
    'bbbbbMbbbbb',
    'MMMMMMMMMMM',
    'kkMkkkkkkMk',
    'bbMbbbbbbMb',
    'MMMMMMMMMMM',
    'kkkkkMkkkkk',
    'bbbbbMbbbbb',
    'BBBBBBBBBBB',
  ], 9, 8);
  stamp(t, [
    '..........................',
    'yo...................ww...',
    'oyyo.................wWw..',
    'OoyyyoooffffffffffffffwWWw',
    'oyyo.................wWw..',
    'yo...................ww...',
  ], 1, 9, false);
  // outline the arrow head / shaft only where it sits on the background
  stamp(t, ['ffffffffff'], 13, 12, false);
  icons.set('Pierce', t);
}
{ // LineBomb: a diagonal row of three bombs
  const t = blank('orange');
  const b = bombArt(3);
  stamp(t, b, 17, 3);
  stamp(t, b, 11, 9);
  stamp(t, b, 5, 15);
  icons.set('LineBomb', t);
}
{ // BombPass: walk through bombs — a bomb with a green arrow passing through it
  const t = blank('orange');
  stamp(t, bombArt(6), 7, 4);
  stamp(t, [
    '..........n....',
    '..........nn...',
    'NN.NN.nnnnmnn..',
    'NN.NN.nmmmmmnn.',
    'NN.NN.nnnnmnn..',
    '..........nn...',
    '..........n....',
  ], 9, 15);
  icons.set('BombPass', t);
}
{ // Ghost: walk through bricks (timed, with the monitor badge like Shield)
  const t = blank('orange');
  stamp(t, [
    '....WWWWWW....',
    '..WWWWWWWWWW..',
    '.WWWWWWWWWWWW.',
    '.WWWWWWWWWWWWl',
    'WWWKKWWWWKKWWl',
    'WWWKKWWWWKKWWl',
    'WWWWWWWWWWWWWl',
    'WWpWWWWWWWWpll',
    'WWWWWWKKWWWWll',
    'WWWWWWKKWWWlll',
    'WWWWWWWWWWWlll',
    'WWWWWWWWWWllll',
    'WWWWWWWWWlllll',
    'WWlWWWlWWllWll',
    '.l..lWl..ll.l.',
  ], 4, 5);
  monitor(t);
  icons.set('Ghost', t);
}
{ // Skull: curse
  const t = blank('purple');
  stamp(t, [
    '....WWWWWWWW....',
    '..WWWWWWWWWWWW..',
    '.WWWWWWWWWWWWWWl',
    'WWWWWWWWWWWWWWWl',
    'WWWWWWWWWWWWWWWl',
    'WWKKKKWWWWKKKKWl',
    'WKKKKKKWWKKKKKKl',
    'WKKrrKKWWKKrrKKl',
    'WWKKKKWWWWKKKKWl',
    'lWWWWWWKKWWWWWll',
    '.lWWWWKKKKWWWll.',
    '..llWWWWWWWWll..',
    '...WKWKWKWKWl...',
    '...WWWWWWWWWl...',
    '....lWlWlWll....',
  ], 7, 6);
  icons.set('Skull', t);
}

{ // Teleport: a cyan / violet portal swirl with sparkles, on the blue "stat" tile
  const t = wipe(cut('append'), PAL.blue);
  const rx = 8, ry = 10, rows: string[] = [];
  for (let y = 0; y <= ry * 2; y++) {
    let r = '';
    for (let x = 0; x <= rx * 2; x++) {
      const dx = (x - rx) / (rx + 0.5), dy = (y - ry) / (ry + 0.5), d = Math.hypot(dx, dy);
      if (d > 1) { r += '.'; continue; }
      if (d > 0.84) { r += dx + dy < 0 ? 'D' : 'X'; continue; }
      if (d < 0.2) { r += 'W'; continue; }
      // two spiral arms winding into the centre
      const a = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
      const arm = (a * 2 + d * 1.6) % 1;
      r += arm < 0.28 ? (d < 0.5 ? 'W' : 'C') : arm < 0.5 ? 'D' : arm < 0.78 ? 'V' : 'X';
    }
    rows.push(r);
  }
  stamp(t, rows, 15 - rx, 15 - ry);
  for (const [x, y] of [[4, 5], [25, 8], [5, 23], [24, 24]]) {
    t.set(x, y, hex('#f6f4ff')); t.set(x - 1, y, hex('#8ff4ff')); t.set(x + 1, y, hex('#8ff4ff')); t.set(x, y - 1, hex('#8ff4ff')); t.set(x, y + 1, hex('#8ff4ff'));
  }
  icons.set('Teleport', t);
}

// ---------------------------------------------------------------- pack
const ORDER = ['BombUp', 'FireUp', 'SpeedUp', 'FullFire', 'Kick', 'Glove', 'Punch', 'Remote', 'Pierce',
  'LineBomb', 'BombPass', 'Shield', 'Ghost', 'Crazy', 'Fire', 'Heart', 'Skull', 'Random', 'Teleport'];
const COLS = 6, CELL = S + 1;
const rows = Math.ceil(ORDER.length / COLS) + 1; // + a row for the blink frames
const out: Img = { w: COLS * CELL + 1, h: rows * CELL + 1, data: new Uint8Array((COLS * CELL + 1) * (rows * CELL + 1) * 4) };
const frames: Record<string, unknown> = {};
const put = (t: Tile, ox: number, oy: number) => {
  for (let y = 0; y < S; y++) out.data.set(t.data.subarray(y * S * 4, (y + 1) * S * 4), ((oy + y) * out.w + ox) * 4);
};
ORDER.forEach((name, i) => {
  const t = icons.get(name); if (!t) throw new Error('missing ' + name);
  const x = 1 + (i % COLS) * CELL, y = 1 + Math.floor(i / COLS) * CELL;
  put(t, x, y);
  frames[name] = { frame: { x, y, w: S, h: S }, rotated: false, trimmed: true, spriteSourceSize: { x: 17, y: 17, w: S, h: S }, sourceSize: { w: 64, h: 64 } };
});
// blink (shine) frames: copied with their trim offsets
let bx = 1; const by = 1 + Math.floor((ORDER.length - 1) / COLS + 1) * CELL;
for (let i = 0; i < 8; i++) {
  const f = srcJson.frames[`blink:${i}`];
  const { x, y, w, h } = f.frame;
  for (let j = 0; j < h; j++) out.data.set(src.data.subarray(((y + j) * src.w + x) * 4, ((y + j) * src.w + x + w) * 4), ((by + j) * out.w + bx) * 4);
  frames[`blink:${i}`] = { ...f, frame: { x: bx, y: by, w, h } };
  bx += w + 1;
}
writeFileSync(ROOT + 'pickups/pickups.png', encodePng(out));
writeFileSync(ROOT + 'pickups/pickups.json', JSON.stringify({
  frames, meta: { app: 'gen-pickups.ts', image: 'pickups.png', format: 'RGBA8888', size: { w: out.w, h: out.h }, scale: '1' },
}, null, 1));
console.log('pickups atlas', out.w, 'x', out.h, ORDER.length, 'icons');
