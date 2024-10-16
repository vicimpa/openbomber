import type { Vec2 } from "@vicimpa/lib-vec2";

export const isColide = (a: Vec2, b: Vec2, sa: Vec2, sb: Vec2) => {
  if (
    false
    || (
      true
      && a.x >= b.x - sb.x
      && a.y >= b.y - sb.y
      && a.x <= b.x
      && a.y <= b.y
    )
    || (
      true
      && a.x + sa.x >= b.x
      && a.y + sa.y >= b.y
      && a.x <= b.x + sb.x
      && a.y <= b.y + sb.y
    )
  ) return true;

  return false;
};