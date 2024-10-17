<script lang="ts">
  import { Sound, gainNode } from "../library/sounds";
  import { stylesVariable } from "../library/stylesVariable";
  import { clamp } from "@vicimpa/math";
  import { beforeUpdate } from "svelte";
  import { onMount } from "svelte";
  import Button from "./Button.svelte";
  import { Vec2 } from "@vicimpa/lib-vec2";

  let volume = clamp(+(localStorage.getItem("volume") ?? 0.2), 0, 1);
  let step = 0.01;
  let span: HTMLDivElement;
  let start: Vec2 | null = null;
  let startVolume = volume;

  const change = (val = 0) => {
    volume = clamp(volume + val, 0, 1);
  };

  const mouseDown = ({ x, y }: MouseEvent) => {
    startVolume = volume;
    start = new Vec2(x, y);
  };

  const mouseUp = ({}: MouseEvent) => {
    start = null;
  };

  const mouseMove = ({ x }: MouseEvent) => {
    if (!start) return;
    const delta = (start.x - x) / span.offsetWidth;
    volume = clamp(startVolume - delta, 0, 1);
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
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="volume" bind:this={span} on:mousedown={mouseDown}>
    <div class="slider" style="{stylesVariable({ w: `${persent}%` })})}" />
    <span title="Тест звука">
      {persent}%
    </span>
  </div>
  <Button on:click={() => change(+step)}>+</Button>
</div>

<style lang="scss">
  .header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
  }
  .container {
    display: flex;
    gap: 10px;
    align-items: center;
    user-select: none;

    .volume {
      display: flex;
      justify-content: center;
      flex-grow: 1;
      text-align: center;
      cursor: pointer;
      position: relative;
      user-select: none;

      .slider {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: var(--w);
        background-color: rgba(255, 255, 255, 0.3);
      }
      span {
        z-index: 2;
      }
    }
  }
</style>
