<script lang="ts">
  import type { Bomb } from "@root/types";
  import Move from "./Move.svelte";
  import sprite from "images/sprite.png";
  import { points } from "library/point";
  import Sprite from "./Sprite.svelte";
  import type { TInfo } from "@root/types";

  export let bomb: TInfo<Bomb> | null = null;
</script>

{#if bomb}
  <Move x={bomb.x} y={bomb.y}>
    <Sprite src={sprite} frames={points("0,3;1,3;2,3;1,3")} />
  </Move>
{/if}
