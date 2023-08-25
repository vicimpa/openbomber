import { usePusher } from "./usePusher";
import { useEvent } from "./useEvent";

type TCallback = (dtime: number, time: number) => any;

const listeners = new Set<TCallback>();
let lastTime = -1;

const loop = (time: number) => {
  if (lastTime < 0) lastTime = time;
  const dtime = time - lastTime;
  lastTime = time;

  for (const listener of listeners) {
    listener(dtime, time);
  }

  requestAnimationFrame(loop);
};

requestAnimationFrame(loop);

export const useFrame = (
  (callback: TCallback) => {
    const refCallback = useEvent(callback);
    usePusher(listeners, refCallback);
  }
);