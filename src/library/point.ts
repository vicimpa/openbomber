export type TPoint = [x: number, y: number];

export const point = (x = 0, y = x): TPoint => {
  return [x, y];
};

export const points = (input: string) => {
  return input.split(';').map(item => {
    const [x, y] = item.split(',').map(Number);
    return point(x, y);
  });
};

export const plus = (points: TPoint[], [aX, aY]: TPoint, mul = 1): TPoint[] => {
  return points.map(([x, y]) => [
    x + aX * mul,
    y + aY * mul
  ]);
};