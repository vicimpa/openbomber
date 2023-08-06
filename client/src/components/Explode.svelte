<script lang="ts">
  import type { IExplode } from "~server";
  import Move from "./Move.svelte";
  import sprite from "images/sprite.png";
  import { plus, points } from "library/point";
  import Sprite from "./Sprite.svelte";

  export let expl: IExplode | null = null;

  const center = points("2,6;7,6;2,11;7,11");
  const dirs = points("0,0;-1,0;1,0;0,-1;0,1");
</script>

{#if expl}
  {#each expl.points as [x, y, d, s = 0]}
    <Move {x} {y}>
      {#if d === 5}
        <Sprite src={sprite} frames={points("5,3;6,3;7,3;8,3;9,3,10,3;0,5")} />
      {:else}
        <Sprite src={sprite} frames={plus(center, dirs[d], 1 + s)} />
      {/if}
    </Move>
  {/each}
{/if}
