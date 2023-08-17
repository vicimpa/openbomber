import { random } from "./math";

export const makeData = () => (
  Array.from(
    { length: 32 },
    _ => random() * 255 | 0
  )
);

export const calc = (numbers: number[]) => (
  numbers.reduce(
    (acc, e, i) => (
      i & 1 && i & 2 ? acc * e : acc + e
    ),
    0
  ) | 0
);