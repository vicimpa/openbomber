import { useLayoutEffect } from "react";

import { useEvent } from "./useEvent";
import { usePusher } from "./usePusher";

type TCallback = (dtime: number, time: number) => any;

const listeners = new Set<TCallback>();
let lastTime = -1;

const runListener = (time: number, listener: TCallback) => {
  const dtime = time - lastTime;
  listener(dtime, time);
};

const loop = (time: number) => {
  if (lastTime < 0) lastTime = time;

  for (const listener of listeners)
    runListener(time, listener);

  lastTime = time;
  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);

export const useFrame = (
  (callback: TCallback) => {
    useLayoutEffect(() => {
      runListener(lastTime, callback);
    }, [callback]);
    usePusher(listeners, callback);
  }
);