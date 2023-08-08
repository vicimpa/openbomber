<script lang="ts">
  import { onFrame } from "library/onFrame";

  let container: HTMLDivElement;
  let element: HTMLSpanElement;
  let left = 0;

  onFrame(() => {
    if (!container || !element) return;
    const { offsetWidth: WIDTH } = container;
    const { offsetWidth: width } = element;

    left = WIDTH / 2 - width / 2;
  });
</script>

<div bind:this={container} class="short">
  <span bind:this={element} style="left: {left}px">
    <slot />
  </span>
</div>

<style lang="sass">
  
  .short
    position: absolute
    margin: auto
    left: 0
    right: 0
    bottom: calc(100% + 2px)
    font-size: 4px
    text-align: center
    z-index: 1

    span
      position: absolute
      padding: 2px
      background-color: #000
      opacity: .3
      bottom: 0
</style>
