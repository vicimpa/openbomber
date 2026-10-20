// <Icon name="crown" size={20} />: pixel-art icons from ./icon-data drawn as inline SVG.
// Each colour is one <path> made of per-row runs (merged rects), rendered with crispEdges.
// `size` is snapped to a whole multiple of the 10px grid (10, 20, 30, ...), so every pixel
// is an integer number of CSS px and stays sharp at DPR 1, 2 and 3.
import type { JSX } from 'preact';
import { GRID, ICONS, PALETTE, type IconName } from './icon-data';

export type { IconName } from './icon-data';

const cache = new Map<IconName, { fill: string; d: string }[]>();

function layers(name: IconName) {
  let out = cache.get(name);
  if (out) return out;
  const by = new Map<string, string>();
  ICONS[name].forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      let e = x + 1;
      while (e < row.length && row[e] === ch) e++;
      if (ch !== '.') by.set(ch, `${by.get(ch) ?? ''}M${x} ${y}h${e - x}v1h${x - e}z`);
      x = e;
    }
  });
  out = [...by].map(([ch, d]) => ({ fill: PALETTE[ch], d }));
  cache.set(name, out);
  return out;
}

/** Nearest whole multiple of the grid (min 1×). */
export const iconPx = (size: number) => Math.max(1, Math.round(size / GRID)) * GRID;

export interface IconProps {
  name: IconName;
  /** CSS px; snapped to 10, 20, 30, ... Default 20. */
  size?: number;
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  title?: string;
  class?: string;
  style?: JSX.CSSProperties;
}

export function Icon({ name, size = 20, title, class: cls, style }: IconProps) {
  const px = iconPx(size);
  return (
    <svg
      class={`icon ${cls ?? ''}`}
      width={px}
      height={px}
      viewBox={`0 0 ${GRID} ${GRID}`}
      shape-rendering="crispEdges"
      style={{ '--icon': `${px}px`, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {layers(name).map((l) => <path fill={l.fill} d={l.d} />)}
    </svg>
  );
}
