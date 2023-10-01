import { ReactiveMap } from "core/ReactiveMap";
import { IS_DEV } from "env";

export const debug = new ReactiveMap<string, any>();

type TShowDebug = [name: string, value: any] | [
  { [key: string]: any; }
];

export const showDebug = (...args: TShowDebug) => {
  if (!IS_DEV) return;

  const first = args.at(0);

  if (typeof first === 'object') {
    for (const key in first)
      showDebug(key, first[key]);

    return;
  }

  debug.set(first, args.at(1));
};