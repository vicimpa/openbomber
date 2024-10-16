import { ceil, clamp, floor } from "@vicimpa/math";

import { Vec2 } from "@vicimpa/lib-vec2";
import { point } from "@ob/core/point";

const PADDING = 6;
const MARGIN = 8;

export const calcMap = (players = 0) => {
  players = clamp(players, 1, Infinity);

  let width = 0;
  let height = 0;
  let internal = 0;

  const positions: Vec2[] = [];

  do {
    internal += .5;
    width = ceil(internal);
    height = floor(internal);
  } while (width * height < players);

  let px = PADDING;
  let py = PADDING;

  if (players > 1) px = 2;
  if (players > 2) py = 2;

  let m = MARGIN + PADDING;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      positions.push(
        point(
          px + m * x,
          py + m * y
        )
      );
    }
  }

  return {
    size: point(
      2 * px + m * (width - 1) + 1,
      2 * py + m * (height - 1) + 1,
    ),
    positions
  };
};