// Small procedural textures (glows, shadows, icons) drawn into canvases once at load.
import { Texture } from 'pixi.js';

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
};

const fromCanvas = (c: HTMLCanvasElement, smooth = false) => {
  const t = Texture.from(c);
  t.source.scaleMode = smooth ? 'linear' : 'nearest';
  return t;
};

/** Pixel art from strings; each char maps to a colour, '.' is transparent. */
const pixels = (rows: string[], pal: Record<string, string>) => {
  const w = Math.max(...rows.map(r => r.length));
  const [c, g] = canvas(w, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.' || !pal[ch]) return;
    g.fillStyle = pal[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return fromCanvas(c);
};

export function makeTextures() {
  // soft radial glow (additive light)
  const glow = (() => {
    const [c, g] = canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return fromCanvas(c, true);
  })();

  // pixel ellipse shadow
  const shadow = (() => {
    const w = 22, h = 9;
    const [c, g] = canvas(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      g.fillStyle = `rgba(20,16,30,${d < 0.45 ? 0.42 : 0.26})`;
      g.fillRect(x, y, 1, 1);
    }
    return fromCanvas(c);
  })();

  // square-ish drop shadow for falling blocks
  const blockShadow = (() => {
    const [c, g] = canvas(32, 32);
    g.fillStyle = 'rgba(15,10,25,0.55)';
    g.beginPath(); g.roundRect(2, 2, 28, 28, 6); g.fill();
    g.fillStyle = 'rgba(15,10,25,0.35)';
    g.beginPath(); g.roundRect(0, 0, 32, 32, 8); g.fill();
    return fromCanvas(c, true);
  })();

  // ring for shockwaves / pickup sparkle
  const ring = (() => {
    const [c, g] = canvas(64, 64);
    g.strokeStyle = '#fff'; g.lineWidth = 4;
    g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke();
    return fromCanvas(c, true);
  })();

  // full-screen vignette (white, tinted at runtime)
  const vignette = (() => {
    const [c, g] = canvas(256, 256);
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 182);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return fromCanvas(c, true);
  })();

  const star = pixels([
    '...Y...',
    '...Y...',
    '.YYWYY.',
    'YYWWWYY',
    '.YYWYY.',
    '..Y.Y..',
    '.Y...Y.',
  ], { Y: '#ffd84a', W: '#fff8d0' });

  const sparkle = pixels([
    '...W...',
    '...W...',
    '..WWW..',
    'WWWWWWW',
    '..WWW..',
    '...W...',
    '...W...',
  ], { W: '#ffffff' });

  const marker = pixels([
    'KKKKKKKKK',
    'KYYYYYYYK',
    '.KYYYYYK.',
    '..KYYYK..',
    '...KYK...',
    '....K....',
  ], { K: '#2a2140', Y: '#ffe14d' });

  const skull = pixels([
    '.KKKKKKK.',
    'KWWWWWWWK',
    'KWWWWWWWK',
    'KWKKWKKWK',
    'KWKRWKRWK',
    'KWWWKWWWK',
    '.KWWWWWK.',
    '.KWKWKWK.',
    '..KKKKK..',
  ], { K: '#2a2140', W: '#f1ecff', R: '#ff3355' });

  // soft pixel smoke puff (white, tinted at runtime)
  const puff = (() => {
    const n = 12;
    const [c, g] = canvas(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - n / 2, dy = y + 0.5 - n / 2, d = Math.hypot(dx, dy) / (n / 2);
      if (d > 1) continue;
      const light = dx + dy < -2 ? 1 : dx + dy > 3 ? 0.78 : 0.9;
      const v = Math.round(255 * light);
      g.fillStyle = `rgba(${v},${v},${v},${d > 0.8 ? 0.55 : 0.9})`;
      g.fillRect(x, y, 1, 1);
    }
    return fromCanvas(c);
  })();

  const chip = pixels(['bb', 'bk'], { b: '#c86a48', k: '#8a3f34' });
  const pebble = pixels(['.g.', 'ggG', '.G.'], { g: '#b9b3a8', G: '#7d776e' });

  return { puff, glow, shadow, blockShadow, ring, vignette, star, sparkle, marker, skull, chip, pebble, white: Texture.WHITE };
}

export type ProcTextures = ReturnType<typeof makeTextures>;
