<script lang="ts">
  import { OUT_FRAME } from "config";
  import { stylesVariable } from "library/stylesVariable";
  import Size from "./Size.svelte";
  import type { Vec2 } from "core/Vec2";

  export let src = "";

  export let size = OUT_FRAME;
  export let padding = 0;

  export let frame: Vec2 | undefined = undefined;

  export let x: number | undefined = undefined;
  export let y: number | undefined = undefined;

  $: _x = x ?? frame?.x ?? 0;
  $: _y = y ?? frame?.y ?? 0;

  export let scale: number | undefined = undefined;

  export let s = 1;

  export let sx = scale ?? s;
  export let sy = scale ?? s;

  $: style = stylesVariable({
    x: _x,
    y: _y,
    sx: sx,
    sy: sy,
    padding: padding + "px",
  });
</script>

<Size {size}>
  <div class="frame" style={`${style}`}>
    <div class="image" style={`background-image: url('${src}')`} />
  </div>
</Size>

<style lang="scss">
.frame {
  --x: 0;
  --y: 0;
  --sx: 0;
  --sy: 0;
  transform: scaleX(var(--sx)) scaleY(var(--sy));

  width: var(--size);
  height: var(--size);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;

  .image {
    position: absolute;
    --t: calc(var(--padding) * -1);
    --a: calc(var(--padding) * 2);
    --s: calc(var(--size) + var(--a));
    width: var(--s);
    height: var(--s);
      // transform: translateX(var(--t)) translateY(var(--t))
    image-rendering: pixelated;
    background-position-x: calc(var(--x) * var(--s) * -1);
    background-position-y: calc(var(--y) * var(--s) * -1);
  }
}

</style>
