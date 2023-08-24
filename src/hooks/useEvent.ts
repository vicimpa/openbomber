import { useCallback, useLayoutEffect, useRef } from "react";

export const useEvent = (
  <T extends (...args: any[]) => any>(
    callback: T
  ) => {
    const ref = useRef<T | null>(null);
    ref.current = callback;
    useLayoutEffect(() => () => { ref.current = null; }, []);
    return useCallback(
      (...args: Parameters<T>): ReturnType<T> => {
        return ref.current?.(...args);
      }, []
    );
  }
);