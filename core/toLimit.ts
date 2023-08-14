export const toLimit = (n: number, min = -Infinity, max = Infinity) => {
  return Math.min(Math.max(n, min), max);
};