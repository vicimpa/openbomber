<script lang="ts">
  import { Sound, gainNode, sounds } from "library/sounds";
  import { stylesVariable } from "library/stylesVariable";
  import { toLimit } from "library/toLimit";
  import { beforeUpdate } from "svelte";
  import { onMount } from "svelte";
  import type { TPoint } from "types";
  import Button from "./Button.svelte";

  let volume = toLimit(+(localStorage.getItem("volume") ?? 0.2), 0, 1);
  let step = 0.01;
  let span: HTMLDivElement;
  let start: TPoint | null = null;
  let startVolume = volume;

  const change = (val = 0) => {
    volume = toLimit(volume + val, 0, 1);
  };

  const mouseDown = ({ x, y }: MouseEvent) => {
    startVolume = volume;
    start = [x, y];
  };
  const mouseUp = ({ x, y }: MouseEvent) => {
    start = null;
  };
  const mouseMove = ({ x, y }: MouseEvent) => {
    if (!start) return;
    const delta = (start[0] - x) / span.offsetWidth;
    volume = toLimit(startVolume - delta, 0, 1);
  };

  onMount(() => {
    addEventListener("mousemove", mouseMove);
    addEventListener("mouseup", mouseUp);

    return () => {
      removeEventListener("mousemove", mouseMove);
      removeEventListener("mouseup", mouseUp);
    };
  });

  beforeUpdate(() => {
    gainNode.gain.value = volume;
    localStorage.setItem("volume", `${volume}`);
  });

  $: persent = (volume * 100) | 0;
</script>

<div class="header">
  Громкость: <Button on:click={() => Sound.test()}>ТЕСТ</Button>
</div>
<div class="container">
  <Button on:click={() => change(-step)}>-</Button>
  <div class="volume" bind:this={span} on:mousedown={mouseDown}>
    <div class="slider" style="{stylesVariable({ w: `${persent}%` })})}" />
    <span title="Тест звука">
      {persent}%
    </span>
  </div>
  <Button on:click={() => change(+step)}>+</Button>
</div>

<style lang="sass">
  .header
    display: flex
    justify-content: space-between
    margin-bottom: 5px

  .container
    display: flex
    gap: 10px
    align-items: center
    user-select: none

    .volume
      display: flex
      justify-content: center
      flex-grow: 1
      text-align: center
      cursor: pointer
      position: relative
      user-select: none

      .slider
        position: absolute
        top: 0
        left: 0
        bottom: 0
        width: var(--w)
        background-color: rgba(255,255,255,0.3)

      span
        z-index: 2
</style>
