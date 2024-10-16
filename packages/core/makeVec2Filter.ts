import { Vec2 } from "@vicimpa/lib-vec2";

export const makeVec2Filter = (length: number) => {
  const positions: Vec2[] = [];

  return Object.assign((vec: Vec2) => {
    const out = new Vec2();

    positions.push(vec);
    positions.splice(0, positions.length - length);

    for (let i = 0; i < positions.length; i++)
      out.plus(positions[i]);

    return out.div(positions.length);
  }, { clear() { positions.splice(0); } }) as ((v: Vec2) => Vec2) & { clear(): void; };
};