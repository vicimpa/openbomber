<script lang="ts">
  import { EAnimate, EDir } from "@/types";
  import sprite from "images/sprite.png";
  import Sprite from "./Sprite.svelte";
  import { plus, point, points } from "@/point";
  import generic from "images/characters.png";
  import { stylesVariable } from "library/stylesVariable";
  import Short from "./Short.svelte";
  import Move from "./Move.svelte";
  import Frame from "./Frame.svelte";
  import crosshair from "images/crosshair.png";

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

  const FIRE = points("0,2;1,2;2,2;3,2;2,2;1,2;0,2");

  export let dir: EDir = EDir.BOTTOM;
  export let animate: EAnimate = EAnimate.IDLE;
  export let color = -1;
  export let name = "";
  export let marker = false;
  export let haveShield = false;
  export let isDeath = true;
  export let isFire = false;

  $: frames = animate === EAnimate.IDLE ? IDLE[dir] : RUNNING[dir];
</script>

{#if name && !isDeath}
  <Short>
    {name}
  </Short>
{/if}

<div style={stylesVariable({ c: color })}>
  {#if !isDeath}
    {#if haveShield}
      <div class="shield" />
    {/if}

    {#if isFire}
      <Move>
        <Sprite frames={FIRE} src={sprite} />
      </Move>
    {/if}

    {#if marker}
      <Move>
        <div class="marker">
          <Frame src={crosshair} />
        </div>
      </Move>
    {/if}

    <Sprite frames={plus(frames, point(0, color))} speed={150} src={generic} />
  {/if}
</div>

<style lang="sass">
  div
    border-radius: 5px

    @keyframes marker 
      0%
        opacity: 0

      50%
        opacity: 1

      100%
        opacity: 0

    .marker
      animation: marker 1s infinite linear

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
