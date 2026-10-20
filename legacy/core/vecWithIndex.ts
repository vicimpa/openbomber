import { Vec2 } from "@vicimpa/lib-vec2";

export function vecWithIndex(i: number, width: number, height: number) {
  return new Vec2(i % width, i / width | 0);
}