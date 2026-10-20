import { makePicker } from "./makePicker";

const CACHE = new Map<string, Function>;

export const pick = <T extends object, S extends keyof T>(
  target: T,
  keys: S[]
): Pick<T, S> => {
  const KEY = keys.join(',');
  let picker = CACHE.get(KEY);

  if (!picker) {
    picker = makePicker<T>(keys);
    CACHE.set(KEY, picker);
  }

  return picker(target);
};