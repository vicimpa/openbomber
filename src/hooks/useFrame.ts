import { usePusher } from "./usePusher";
import { useEvent } from "./useEvent";

type TCallback = (dtime: number, time: number) => any;

const listeners = new Set<TCallback>();
let lastTime = performance.now();

const loop = (time = performance.now()) => {
  const dtime = time - lastTime;
  lastTime = time;

  for (const listener of listeners) {
    listener(dtime, time);
  }

  requestAnimationFrame(loop);
};

loop();

export const useFrame = (
  (callback: TCallback) => {
    const refCallback = useEvent(callback);
    usePusher(listeners, refCallback);
  }
);