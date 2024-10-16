import { onMount } from "svelte";

export const onFrame = (callback: (deltaTime: number, time: number) => any) => {
  onMount(() => {
    let work = true;
    let last = -1;

    const update = (current: number) => {
      if (last < 0) last = current;

      try {
        let delta = current - last;
        last = current;

        callback(delta, current);
      } catch (e) {
        console.error(e);
      }

      if (work)
        requestAnimationFrame(update);
    };

    requestAnimationFrame(update);

    return () => {
      work = false;
    };
  });
};