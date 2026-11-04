// Eight-way touch input. Cardinal sectors are wider than diagonal sectors.
// Directions go clockwise from right (0), with -1 meaning the stick is at rest.
export const STICK_START = 0.42;
export const STICK_STOP = 0.32;
const DIAGONAL = Math.SQRT1_2;
const VECTORS = [
  [1, 0], [DIAGONAL, DIAGONAL], [0, 1], [-DIAGONAL, DIAGONAL],
  [-1, 0], [-DIAGONAL, -DIAGONAL], [0, -1], [DIAGONAL, -DIAGONAL],
] as const;

export interface StickInput { dx: number; dy: number; direction: number }

export function snapStick(x: number, y: number, previous = -1): StickInput {
  const distance = Math.hypot(x, y);
  if (!Number.isFinite(distance) || distance < (previous < 0 ? STICK_START : STICK_STOP)) {
    return { dx: 0, dy: 0, direction: -1 };
  }
  const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const delta = (direction: number) => Math.abs(((angle - direction * 45 + 540) % 360) - 180);
  let direction: number;
  // Enter a diagonal above 30° from a cardinal; leave it below 25°.
  // The 5° overlap stops small finger movements from toggling between the two.
  if (previous >= 0 && previous < 8 && delta(previous) <= (previous % 2 ? 20 : 30)) {
    direction = previous;
  } else {
    const cardinal = (Math.round(angle / 90) * 2) % 8;
    direction = delta(cardinal) <= 30 ? cardinal : Math.round(angle / 45) % 8;
  }
  const [dx, dy] = VECTORS[direction]!;
  return { dx, dy, direction };
}
