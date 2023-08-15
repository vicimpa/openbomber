export type TFV<T, A extends any[] = []> = T | ((...args: A) => T);
export const fv = <T, A extends any[]>(fv: TFV<T, A>, ...args: A) => (
  fv instanceof Function ? fv(...args) : fv
);