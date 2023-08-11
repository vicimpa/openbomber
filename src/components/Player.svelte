<script lang="ts">
  import { EAnimate, EDir, type TPoint } from "types";
  import sprite from "images/sprite.png";
  import Sprite from "./Sprite.svelte";
  import { plus, points } from "library/point";
  import generic from "images/generic.png";
  import { stylesVariable } from "library/stylesVariable";
  import Short from "./Short.svelte";

  const IDLE = {
    [EDir.TOP]: points("1,3"),
    [EDir.LEFT]: points("1,1"),
    [EDir.RIGHT]: points("1,2"),
    [EDir.BOTTOM]: points("1,0"),
  };

  const RUNNING = {
    [EDir.TOP]: points("1,3;0,3;1,3;2,3"),
    [EDir.LEFT]: points("1,1;0,1;1,1;2,1"),
    [EDir.RIGHT]: points("1,2;0,2;1,2;2,2"),
    [EDir.BOTTOM]: points("1,0;0,0;1,0;2,0"),
  };

  export let dir: EDir = EDir.BOTTOM;
  export let animate: EAnimate = EAnimate.IDLE;
  export let color = -1;
  export let name = "";
  export let marker = "transparent";
  export let haveShield = false;
  export let isDeath = true;

  $: frames = animate === EAnimate.IDLE ? IDLE[dir] : RUNNING[dir];

  const COLORS = Array.from({ length: 10 }, (_, i) => i)
    .map((e) => [e % 5, (e / 5) | 0])
    .map(([x, y]) => [x * 3, y * 4] as TPoint);
</script>

{#if name && !isDeath && COLORS[color]}
  <Short>
    {name}
  </Short>
{/if}

<div style={stylesVariable({ c: color, m: !isDeath ? marker : "transparent" })}>
  {#if !isDeath && COLORS[color]}
    {#if haveShield}
      <div class="shield" />
    {/if}

    <Sprite frames={plus(frames, COLORS[color])} speed={150} src={generic} />
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
