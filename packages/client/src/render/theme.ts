// Round themes (Theme in @ob/game): one colour transform per theme, applied to the arena tiles and
// to the countryside near the arena, so both always agree. Grass and foliage carry the theme
// (snow, sand, autumn leaves), water freezes in winter; stone and wood keep their colour.
import { Theme } from '@ob/game';

/** HSL in [0, 1]. */
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  if (s <= 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** One colour of the meadow look → the same colour in `theme`. */
export function themeRgb(theme: Theme, r: number, g: number, b: number): [number, number, number] {
  if (theme === Theme.Meadow) return [r, g, b];
  const [h0, s, l] = rgb2hsl(r, g, b);
  const h = h0 * 360;
  const green = s > 0.08 && h >= 55 && h <= 170;
  const water = s > 0.15 && h > 170 && h < 250;
  const soil = s < 0.32 && s > 0.04 && h >= 15 && h < 55 && l > 0.42; // trampled dirt, sand, dry grass
  switch (theme) {
    case Theme.Winter:
      if (green) return l < 0.42 ? hsl2rgb(150 / 360, 0.18, l * 0.8 + 0.08) : hsl2rgb(212 / 360, 0.22, clamp01(0.74 + 0.3 * (l - 0.45)));
      if (water) return hsl2rgb(200 / 360, s * 0.45, clamp01(l + 0.28));
      if (soil) return hsl2rgb(215 / 360, 0.12, clamp01(0.66 + 0.25 * (l - 0.45)));
      return hsl2rgb(h0, s * 0.85, l);
    case Theme.Desert:
      if (green) return l < 0.42 ? hsl2rgb(36 / 360, 0.28, l + 0.08) : hsl2rgb(42 / 360, 0.42, clamp01(0.68 + 0.35 * (l - 0.5)));
      if (soil) return hsl2rgb(40 / 360, clamp01(s + 0.12), clamp01(l + 0.06));
      if (s < 0.1) return hsl2rgb(36 / 360, 0.24, clamp01(l * 0.97 + 0.03)); // grey stone → sandstone
      return [r, g, b];
    case Theme.Autumn:
      if (green) return l < 0.45 ? hsl2rgb((18 + 60 * (h0 - 0.15)) / 360, clamp01(s * 1.5 + 0.18), l) : hsl2rgb(43 / 360, clamp01(s * 2 + 0.05), l);
      return [r, g, b];
    default:
      return [r, g, b];
  }
}

const luts = new Map<Theme, Map<number, number>>();

/** ImageData uint32 (ABGR) pixel → the same pixel in `theme` (cached per colour). */
export function themePixel(theme: Theme, c: number): number {
  if (theme === Theme.Meadow || !(c >>> 24)) return c;
  let lut = luts.get(theme);
  if (!lut) luts.set(theme, (lut = new Map()));
  let v = lut.get(c);
  if (v === undefined) {
    const [r, g, b] = themeRgb(theme, c & 255, (c >> 8) & 255, (c >> 16) & 255);
    v = ((c & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
    if (lut.size < 8192) lut.set(c, v);
  }
  return v;
}
