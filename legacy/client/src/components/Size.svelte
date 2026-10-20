<script lang="ts">
  export let size: number;
</script>

<div style="--size: {size}px">
  <slot />
</div>

<style lang="scss">
  div {
    display: contents;
  }
</style>
