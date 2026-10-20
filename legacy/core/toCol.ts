export const toCol = (n: number, c = 2) => {
  return `${n}`.padStart(c, '0');
};