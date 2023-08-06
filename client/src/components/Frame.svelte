<script lang="ts">
  import { stylesVariable } from "library/stylesVariable";

  export let src = "";

  export let x = 0;
  export let y = 0;

  export let scale: number | undefined = undefined;

  export let sx = scale ?? 1;
  export let sy = scale ?? 1;

  $: style = stylesVariable({
    x: x,
    y: y,
    sx: sx,
    sy: sy,
  });
</script>

<div class="frame" style={`${style}`}>
  <div class="image" style={`background-image: url(${src})`} />
</div>

<style lang="sass">
  .frame
    --x: 0
    --y: 0
    --sx: 0
    --sy: 0
    transform: scaleX(var(--sx)) scaleY(var(--sy))

    width: var(--size)
    height: var(--size)
    display: flex
    justify-content: center
    align-items: center

    .image
      width: var(--size)
      height: var(--size)
      image-rendering: pixelated
      background-position-x: calc(var(--x) * var(--size) * -1)
      background-position-y: calc(var(--y) * var(--size) * -1)

</style>
