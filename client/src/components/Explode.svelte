<script lang="ts">
  import { EXPODER_DIRS, type Explode } from "@root/types";
  import Move from "./Move.svelte";
  import sprite from "images/sprite.png";
  import { plus, points } from "library/point";
  import Sprite from "./Sprite.svelte";
  import type { TInfo } from "@root/types";

  export let expl: TInfo<Explode> | null = null;

  const center = points("2,6;7,6;2,11;7,11");
</script>

{#if expl}
  {#each expl.points as { x, y, dir, isFinaly = false, isBlock = false }}
    <Move {x} {y}>
      <Sprite
        src={sprite}
        frames={plus(center, EXPODER_DIRS[dir], 1 + +isFinaly)}
      />
    </Move>

    {#if isBlock}
      <Move {x} {y}>
        <Sprite src={sprite} frames={points("5,3;6,3;7,3;8,3;9,3,10,3;0,5")} />
      </Move>
    {/if}
  {/each}
{/if}
