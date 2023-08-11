<script lang="ts">
  import { onFrame } from "library/onFrame";
  import { type TPoint } from "library/point";
  import { toLimit } from "library/toLimit";
  import Frame from "./Frame.svelte";
  import { isEqual } from "library/isEqual";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher<{
    end: [];
  }>();

  export let src = "";

  export let isFinite = false;

  export let speed = 100;
  export let frames: TPoint[] = [[0, 0]];

  export let scale: number | undefined = undefined;

  export let sx = scale ?? 1;
  export let sy = scale ?? 1;

  export let deltaTime = 0;

  let previewFrames: TPoint[] | null = null;
  let startAnimation = 0;

  let x = 0;
  let y = 0;

  onFrame((_, time) => {
    if (!isEqual(previewFrames, frames)) {
      previewFrames = frames;
      startAnimation = time - deltaTime;
    }

    const size = frames.length;
    const delta = time - startAnimation;
    const pFrame = (delta / speed) | 0;
    const frame = isFinite ? toLimit(pFrame, 0, size - 1) : pFrame % size;

    [x, y] = frames[frame];

    if (isFinite && frame === size - 1) {
      dispatch("end");
    }
  });
</script>

<Frame {src} {x} {y} {sx} {sy} />
