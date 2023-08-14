export const random = <T>(collect: T[]) => {
  return collect[collect.length * Math.random() | 0];
};