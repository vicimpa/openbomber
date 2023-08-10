<script lang="ts">
  import { EAnimate, EDir } from "types";
  import sprite from "images/sprite.png";
  import Sprite from "./Sprite.svelte";
  import { points } from "library/point";
  import { stylesVariable } from "library/stylesVariable";
  import Short from "./Short.svelte";

  const IDLE = {
    [EDir.TOP]: points("4,1"),
    [EDir.LEFT]: points("1,0"),
    [EDir.RIGHT]: points("1,1"),
    [EDir.BOTTOM]: points("4,0"),
  };

  const RUNNING = {
    [EDir.TOP]: points("4,1;3,1;4,1;5,1"),
    [EDir.LEFT]: points("1,0;0,0;1,0;2,0"),
    [EDir.RIGHT]: points("1,1;0,1;1,1;2,1"),
    [EDir.BOTTOM]: points("4,0;3,0;4,0;5,0"),
  };

  const DEATH = points("0,2;1,2;2,2;3,2;4,2;5,2;6,2;0,4");

  export let dir: EDir = EDir.BOTTOM;
  export let animate: EAnimate = EAnimate.IDLE;
  export let color = 0;
  export let name = "";
  export let marker = "transparent";
  export let isAnimated = false;
  export let haveShield = true;

  $: isLeave = animate !== EAnimate.DEATH;
</script>

{#if name && isLeave}
  <Short>
    {name}
  </Short>
{/if}

<div style={stylesVariable({ c: color, m: isLeave ? marker : "transparent" })}>
  {#if !isLeave}
    {#if isAnimated}
      <Sprite frames={DEATH} isFinite speed={100} src={sprite} />
    {/if}
  {:else}
    {#if haveShield}
      <div class="shield" />
    {/if}
    <Sprite
      frames={animate === EAnimate.IDLE ? IDLE[dir] : RUNNING[dir]}
      speed={150}
      src={sprite}
    />
  {/if}
</div>

<style lang="sass">
  div
    filter:  hue-rotate(calc(var(--c) * 100deg))
    box-shadow: 0 0 3px var(--m), inset 0 0 3px var(--m)
    border-radius: 5px

    .shield
      $size: -2px
      position: absolute
      top: $size
      left: $size
      right: $size
      bottom: $size
      border-radius: 100%

      box-shadow: 0 0 5px blue, inset 0 0 5px blue
      background-color: blue
      opacity: 0.5
</style>
