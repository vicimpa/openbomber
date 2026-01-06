<script lang="ts">
  import { SKINS_COUNT } from "@ob/shared/config";
  import { each } from "../library/each";
  import Frame from "./Frame.svelte";
  import Button from "./Button.svelte";
  import { createEventDispatcher } from "svelte";
  import { SPRITES } from "../images/Heroes2";
  import { onFrame } from "../library/onFrame";

  const rows = [4, 9, 19, 14];

  export let selected = 0;

  let loop1 = 0;
  let loop2 = 0;

  $: frame = (loop1 | 0) % 6;
  $: dir = loop2 % 4 | 0;

  onFrame((dt) => {
    loop1 += dt / 100;
    loop2 += dt / 1000;
  });

  const dispatch = createEventDispatcher<{ changeSkin: number }>();
</script>

<p>Выберите скин</p>

<div class="skins">
  {#each each(SKINS_COUNT) as skin}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      on:mousedown={() => ((selected = skin), (loop1 = 0), (loop2 = 0))}
      class="skin-item"
      data-select={selected === skin}
    >
      <Frame
        src={SPRITES[skin]}
        s={2}
        size={64}
        x={selected === skin ? frame : 0}
        y={3 + (selected === skin ? dir * 4 : 0)}
      />
    </div>
  {/each}
</div>

<Button
  on:click={() => {
    selected !== null && dispatch("changeSkin", selected);
  }}>Сохранить</Button
>

<style lang="scss">
  .skins {
    display: flex;
    flex-wrap: wrap;
    width: 40vw;
    max-width: 350px;
    overflow: hidden;
    justify-content: center;
    align-content: start;
    gap: 10px;
    padding: 10px;
    box-sizing: content-box;

    .skin-item {
      width: 64px;
      height: 64px;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;

      & :global(.frame) {
        pointer-events: none;
      }

      &[data-select="true"] {
        background-color: #999;
        border-radius: 100%;
      }
    }
  }
</style>
