import { ceil, floor } from "./math";
import { point } from "./point";
import { toLimit } from "./toLimit";
import { Vec2 } from "./Vec2";

const PADDING = 6;
const MARGIN = 8;

export const calcMap = (players = 0) => {
  players = toLimit(players, 1);

  let width = 0;
  let height = 0;
  let internal = 0;

  const positions: Vec2[] = [];

  do {
    internal += .5;
    width = ceil(internal);
    height = floor(internal);
  } while (width * height < players);

  const m = MARGIN + PADDING;
  const p = PADDING;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      positions.push(
        point(
          p + m * x,
          p + m * y
        )
      );
    }
  }

  return {
    size: point(
      p + m * (width - 1) + p + 1,
      p + m * (height - 1) + p + 1
    ),
    positions
  };
};