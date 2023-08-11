<script lang="ts">
  import type { Bomb } from "../../server/class/Bomb";
  import Move from "./Move.svelte";
  import sprite from "images/sprite.png";
  import { points } from "library/point";
  import Sprite from "./Sprite.svelte";
  import { onMount } from "svelte";
  import { sounds } from "library/sounds";

  export let bomb: Bomb["info"] | null = null;

  onMount(() => {
    sounds.putBomb.play();
  });
</script>

{#if bomb}
  <Move x={bomb.x} y={bomb.y}>
    <Sprite
      src={sprite}
      speed={bomb.isCrazy ? 70 : 100}
      frames={points("0,3;1,3;2,3;1,3")}
    />
  </Move>
{/if}
