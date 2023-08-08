const CACHE_SYMBOL = Symbol('cache');

export const bind = (object?: any) => {
  return <T extends (...args: any[]) => any>(
    target: any,
    key: string | symbol,
    { value }: TypedPropertyDescriptor<T>
  ) => {
    const cache: Set<string | symbol> = target[CACHE_SYMBOL] ?? (
      target[CACHE_SYMBOL] = new Set()
    );

    if (cache.has(key))
      return;

    cache.add(key);

    const keySymbol = Symbol(key.toString());

    return {
      get(this: any) {
        return this[keySymbol] ?? (
          this[keySymbol] = value?.bind(object ?? this)
        );
      }
    } as TypedPropertyDescriptor<T>;
  };
};