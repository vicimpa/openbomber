<script lang="ts">
  import achivmentSrc from "images/Bonus/Ikonki.png";
  import type { TProtoOut } from "core/Proto";
  import { ReactiveMap } from "core/ReactiveMap";
  import type { REMAINING_EFFECTS } from "shared/api";
  import {
    ACHIVMEN_DESCRIPTION,
    ACHIVMEN_POINTS,
    EAchivment,
  } from "shared/types";
  import Frame from "./Frame.svelte";

  export let effects: TProtoOut<typeof REMAINING_EFFECTS> | null = null;

  const effectsList = new ReactiveMap<EAchivment, string>();

  $: for (const [name, value] of Object.entries(effects ?? {})) {
    let type!: EAchivment;
    let remaining = `${value}`;

    switch (name) {
      case "sup": {
        type = EAchivment.APPEND_SPEED;
        remaining += " сек.";
        break;
      }
      case "sdown": {
        type = EAchivment.FIRE;
        remaining += " сек.";
        break;
      }
      case "moving": {
        type = EAchivment.MOVING_BOMB;
        remaining += " сек.";
        break;
      }
      case "shield": {
        type = EAchivment.APPEND_SHIELD;
        remaining += " сек.";
        break;
      }
      case "crazy": {
        type = EAchivment.CRAZY_BOMB;
        remaining += " сек.";
        break;
      }

      case "bombs": {
        type = EAchivment.APPEND_BOMB;
        remaining = "x " + remaining;
        break;
      }

      case "radius": {
        type = EAchivment.APPEND_EXPO;
        remaining = "x " + remaining;
        break;
      }
    }

    if (value > 0) {
      effectsList.set(type, remaining);
    } else {
      effectsList.delete(type);
    }
  }
</script>

<div class="effects">
  {#each $effectsList.entries() as [type, remaining]}
    <div class="item" title={ACHIVMEN_DESCRIPTION[type]}>
      <div class="info">
        <Frame
          s={1}
          size={32}
          padding={16}
          src={achivmentSrc}
          frame={ACHIVMEN_POINTS[type]}
        />
      </div>
      <span class="desc">{ACHIVMEN_DESCRIPTION[type]}</span>
      <span>
        {remaining}
      </span>
    </div>
  {/each}
</div>

<style lang="sass">
.effects
  position: absolute
  top: 50px
  left: 0px
  display: flex
  flex-direction: column
  align-items: flex-start
  gap: 10px
  z-index: 1

  .item
    padding: 5px 30px
    border-radius: 15px
    background-color: rgba(0,0,0,0.4)
    backdrop-filter: blur(10px)
    -webkit-backdrop-filter: blur(10px)
    display: flex
    align-items: center
    justify-content: space-between
    gap: 15px

    .desc
      display: inline-block
      overflow: hidden
      max-width: 0px
      transition: .3s
      white-space: nowrap

    &:hover
      .desc
        max-width: 200px

    .info
      display: flex
      flex-direction: column
      align-items: flex-start
      gap: 10px

    span
      font-size: 10px
</style>
