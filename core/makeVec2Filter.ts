import { Vec2 } from "./Vec2";

export const makeVec2Filter = (length: number) => {
  const positions: Vec2[] = [];

  return (vec: Vec2) => {
    const out = new Vec2();
    positions.push(vec);
    positions.splice(0, positions.length - length);

    for (const vec of positions)
      out.plus(vec);

    return out.div(positions.length);
  };
};