export const pick = <T extends object, S extends keyof T>(
  target: T,
  keys: S[]
) => {
  const out: Pick<T, S> = ({}) as any;

  for (const key of keys) {
    out[key] = target[key];
  }

  return out;
};