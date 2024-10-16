import { Vec2 } from "@vicimpa/lib-vec2";
export const point = (...args: ConstructorParameters<typeof Vec2>) => {
  return new Vec2(...args);
};

export const points = (input: string) => {
  return input.split(';').map(item => {
    const [x, y] = item.split(',').map(Number);
    return point(x, y);
  });
};

export const plus = (points: Vec2[], plus: Vec2, times = 1): Vec2[] => {
  plus = plus.ctimes(times);
  return points.map(vec => vec.cplus(plus));
};