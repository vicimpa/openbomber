<script lang="ts">
  import { stylesVariable } from "library/stylesVariable";

  export let width = 0;
  export let height = 0;
  export let border = 1;
</script>

<div
  class="map"
  style={stylesVariable({
    w: width,
    h: height,
    b: border,
  })}
>
  <slot />
</div>

<style lang="sass">
  .map
    border: calc(var(--b) * var(--size)) solid #999
    position: relative
    width: calc(var(--w) * var(--size))
    height: calc(var(--h) * var(--size))
    display: grid
    grid-template-columns: repeat(var(--w), var(--size))
    box-sizing: content-box
</style>
