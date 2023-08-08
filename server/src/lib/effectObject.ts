import { makeEffect } from "./effect";

const SYMBOLS_MAP = new Map<string, symbol>;

function getSymbol(key: string): symbol {
  return SYMBOLS_MAP.get(key) ?? (
    SYMBOLS_MAP.set(key, Symbol(key)),
    SYMBOLS_MAP.get(key)!
  );
}

export const effectObject = <T>(
  target: any,
  key: string,
  newValue: T,
  callback: (value: T) => any
) => {
  const symbol = getSymbol(key);
  const effect: ReturnType<typeof makeEffect<T>> = (
    target[symbol] ?? (
      target[symbol] = makeEffect()
    )
  );
  effect(newValue, callback);
};