import { pick } from "./pick";

export const map = <T extends object, S extends keyof T, D = Pick<T, S>>(
  collect: T[] | Set<T>,
  func: ((v: T, i: number) => D) | (S[]),
  filter?: (source: T, target: D) => any
) => {
  const output: D[] = [];

  if (Array.isArray(func)) {
    const keys = func;

    func = pick<T, S> as (v: T) => D;
  }

  let index = 0;

  for (const item of collect) {
    const target = func(item, index++);

    if (!filter || filter(item, target))
      output.push(target);
  }

  return output;
};