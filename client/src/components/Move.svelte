<script lang="ts">
  import { stylesVariable } from "library/stylesVariable";

  export let x = 0;
  export let y = 0;
</script>

<div class="move" style={stylesVariable({ x, y })}>
  <slot />
</div>

<style lang="sass">
  .move
    --x: 0
    --y: 0

    position: absolute

    top: calc(var(--y) * var(--size))
    left: calc(var(--x) * var(--size))
</style>
