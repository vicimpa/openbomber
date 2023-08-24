import { useLayoutEffect } from "react";

export const usePusher = <T>(list: Set<T>, item: T) => {
  if (!list.has(item))
    list.add(item);

  useLayoutEffect(() => () => {
    list.delete(item);
  }, [item]);
};