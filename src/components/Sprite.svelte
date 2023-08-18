<script lang="ts">
  import { onFrame } from "library/onFrame";
  import { toLimit } from "@/toLimit";
  import Frame from "./Frame.svelte";
  import { isEqual } from "@/isEqual";
  import { createEventDispatcher } from "svelte";
  import { Vec2 } from "@/Vec2";
  import { point } from "@/point";

  const dispatch = createEventDispatcher<{
    end: [];
  }>();

  export let src = "";

  export let isFinite = false;

  export let speed = 100;
  export let frames: Vec2[] = [point(0, 0)];

  export let scale: number | undefined = undefined;

  export let sx = scale ?? 1;
  export let sy = scale ?? 1;

  export let deltaTime = 0;

  let previewFrames: Vec2[] | null = null;
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
    x = frames[frame].x;
    y = frames[frame].y;

    if (isFinite && frame === size - 1) {
      dispatch("end");
    }
  });
</script>

<Frame {src} {x} {y} {sx} {sy} />
