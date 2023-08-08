import { onMount } from "svelte";

export const onFrame = (callback: (deltaTime: number, time: number) => any) => {
  onMount(() => {
    let work = true;
    let last = performance.now();

    const update = () => {
      try {
        let current = performance.now();
        let delta = current - last;
        last = current;

        callback(delta, current);
      } catch (e) {
        console.error(e);
      }

      if (work)
        requestAnimationFrame(update);
    };

    update();

    return () => {
      work = false;
    };
  });
};