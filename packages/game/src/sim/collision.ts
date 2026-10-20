// Circle-vs-circle and circle-vs-square push-out, ported from new-openbomber's
// library/collides.ts. Scalar versions that write into a reusable vector so the
// movement hot path never allocates.

export interface Vec {
  x: number;
  y: number;
}

/**
 * Push-out for circle A against circle B (A moves). Writes the correction into `out`
 * and returns true when they overlap. Coincident centres are ignored (no direction).
 */
export function cir2cir(ax: number, ay: number, ar: number, bx: number, by: number, br: number, out: Vec): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const k = (rr - d) / d;
  out.x = dx * k;
  out.y = dy * k;
  return true;
}

/**
 * Push-out for circle A against an axis-aligned square centred at (cx, cy) with side
 * `size`. When the centre is inside the square it exits along the shallowest axis.
 */
export function cir2sqr(ax: number, ay: number, ar: number, cx: number, cy: number, size: number, out: Vec): boolean {
  const h = size * 0.5;
  const qx = ax < cx - h ? cx - h : ax > cx + h ? cx + h : ax;
  const qy = ay < cy - h ? cy - h : ay > cy + h ? cy + h : ay;
  const dx = ax - qx;
  const dy = ay - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= ar * ar) return false;
  if (d2 === 0) {
    const ox = ax - cx;
    const oy = ay - cy;
    const px = h - Math.abs(ox);
    const py = h - Math.abs(oy);
    if (px < py) {
      out.x = (ox < 0 ? -1 : 1) * (px + ar);
      out.y = 0;
    } else {
      out.x = 0;
      out.y = (oy < 0 ? -1 : 1) * (py + ar);
    }
    return true;
  }
  const d = Math.sqrt(d2);
  const k = (ar - d) / d;
  out.x = dx * k;
  out.y = dy * k;
  return true;
}

/** True when a circle overlaps the unit tile centred at (tx, ty). */
export function circleTouchesTile(ax: number, ay: number, r: number, tx: number, ty: number): boolean {
  const qx = ax < tx - 0.5 ? tx - 0.5 : ax > tx + 0.5 ? tx + 0.5 : ax;
  const qy = ay < ty - 0.5 ? ty - 0.5 : ay > ty + 0.5 ? ty + 0.5 : ay;
  const dx = ax - qx;
  const dy = ay - qy;
  return dx * dx + dy * dy < r * r;
}
