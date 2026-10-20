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

  // grave marker left on the ground where a player died (stone cross on a dirt mound)
  const grave = pixels([
    '.....KKKK.....',
    '.....KWWK.....',
    '.....KWLK.....',
    '..KKKKWLKKKK..',
    '..KWWWWWWWLK..',
    '..KLLLWLLLLK..',
    '..KKKKWLKKKK..',
    '.....KWLK.....',
    '.....KWLK.....',
    '.....KWLK.....',
    '.....KWLK.....',
    '..DDDKLLKDDD..',
    '.DddddddddddD.',
    'DdddeddddedddD',
    '.DDDDDDDDDDDD.',
  ], { K: '#2a2140', W: '#e4e0ee', L: '#9c95b0', D: '#3b2a24', d: '#6b4a3a', e: '#8a6450' });

  const chip = pixels(['bb', 'bk'], { b: '#c86a48', k: '#8a3f34' });

  // ---- pixel-art spawn FX (hard edges, dithered instead of soft alpha)
  /** Column of light, `h` px tall, bottom = the hero's feet. [core, mid, outer] half widths; dither 0..2. */
  const beamFrame = (h: number, top: number, core: number, mid: number, outer: number, dither: number, phase: number) => {
    const W = 16, H = 112;
    const [c, g] = canvas(W, H);
    const cx = W / 2;
    for (let y = H - h; y < H; y++) {
      const fromTop = y - (H - h);
      for (let x = 0; x < W; x++) {
        const d = x < cx ? cx - 1 - x : x - cx; // 0 at the two centre columns
        let col = '';
        if (d < core) col = '#ffffff';
        else if (d < core + mid) col = '#c8f4ff';
        else if (d < core + mid + outer) col = (x + y + phase) % 2 === 0 ? '#6fd0f0' : '';
        if (!col) continue;
        if (dither === 1 && d >= core && (x + y + phase) % 2) continue;
        if (dither === 2 && (x + y * 3 + phase) % 4) continue;
        // ragged leading edge at the top
        if (fromTop < top && ((x * 7 + y * 3 + phase) % 5) < 5 - fromTop) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    // bright foot where it hits the ground
    if (h >= H - 8) { g.fillStyle = '#ffffff'; g.fillRect(cx - core - 1, H - 2, (core + 1) * 2, 2); }
    return fromCanvas(c);
  };
  const beam = [
    beamFrame(56, 6, 1, 0, 1, 0, 0),
    beamFrame(112, 6, 2, 2, 2, 0, 0),
    beamFrame(112, 6, 2, 2, 2, 0, 1),
    beamFrame(112, 6, 1, 1, 1, 1, 0),
    beamFrame(112, 6, 1, 1, 0, 2, 1),
  ];

  /** Pixel ellipse outline (1 px), optionally dithered. */
  const pixelRing = (rx: number, ry: number, color: string, dither: boolean) => {
    const W = rx * 2 + 1, H = ry * 2 + 1;
    const [c, g] = canvas(W, H);
    const inside = (x: number, y: number) => ((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2 <= 1;
    g.fillStyle = color;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
      if (dither && (x + y) % 2) continue;
      g.fillRect(x, y, 1, 1);
    }
    return fromCanvas(c);
  };
  const ringIn = [pixelRing(15, 6, '#bff4ff', true), pixelRing(12, 5, '#bff4ff', false), pixelRing(9, 4, '#ffffff', false), pixelRing(6, 2, '#ffffff', false)];
  const ringOut = [pixelRing(8, 3, '#ffffff', false), pixelRing(12, 5, '#c8f4ff', false), pixelRing(16, 7, '#9fe8ff', false), pixelRing(20, 8, '#9fe8ff', true)];

  /** Pixel starburst flash: frames shrink and dissolve. */
  const starburst = (L: number, diag: number, dither: boolean) => {
    const N = L * 2 + 1;
    const [c, g] = canvas(N, N);
    const put = (x: number, y: number, col: string) => {
      if (dither && (x + y) % 2) return;
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    };
    for (let i = -L; i <= L; i++) {
      const a = Math.abs(i), col = a < 2 ? '#ffffff' : a < L * 0.6 ? '#e8fbff' : '#9fe8ff';
      put(L + i, L, col); put(L, L + i, col);
      if (a <= 1) { put(L + i, L - 1, '#ffffff'); put(L + i, L + 1, '#ffffff'); }
    }
    for (let i = 1; i <= diag; i++) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put(L + sx * i, L + sy * i, i < 2 ? '#ffffff' : '#c8f4ff');
    return fromCanvas(c);
  };
  const burst = [starburst(5, 2, false), starburst(9, 4, false), starburst(11, 5, true), starburst(6, 0, true)];
  const pebble = pixels(['.g.', 'ggG', '.G.'], { g: '#b9b3a8', G: '#7d776e' });

  return { puff, glow, shadow, blockShadow, ring, vignette, star, sparkle, marker, skull, grave, chip, pebble, beam, ringIn, ringOut, burst, white: Texture.WHITE };
}

export type ProcTextures = ReturnType<typeof makeTextures>;
