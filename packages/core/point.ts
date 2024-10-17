import { Vec2 } from "@vicimpa/lib-vec2";

export const points = (input: string) => {
  return input.split(';').map(item => {
    const [x, y] = item.split(',').map(Number);
    return new Vec2(x, y);
  });
};

export const plus = (points: Vec2[], plus: Vec2, times = 1): Vec2[] => {
  plus = plus.ctimes(times);
  return points.map(vec => vec.cplus(plus));
};