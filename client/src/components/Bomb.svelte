<script lang="ts">
  import type { IBomb } from "~server";
  import Move from "./Move.svelte";
  import sprite from "images/sprite.png";
  import { points } from "library/point";
  import Sprite from "./Sprite.svelte";

  export let bomb: IBomb | null = null;
</script>

{#if bomb}
  <Move x={bomb.x} y={bomb.y}>
    <Sprite src={sprite} frames={points("0,3;1,3;2,3;1,3")} />
  </Move>
{/if}
