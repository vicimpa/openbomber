<script lang="ts">
  import type { Bomb } from "@/class/Bomb";
  import { points } from "@/point";

  import Move from "./Move.svelte";
  import sprite from "images/sprite.png";
  import Sprite from "./Sprite.svelte";

  export let bomb: Bomb["info"] | null = null;
</script>

{#if bomb}
  <Move x={bomb.x} y={bomb.y}>
    <div class="bomb" data-crazy={bomb.isCrazy}>
      <Sprite
        src={sprite}
        speed={bomb.isCrazy ? 70 : 100}
        frames={points("0,3;1,3;2,3;1,3")}
      />
    </div>
  </Move>
{/if}

<style lang="sass">
  @keyframes crazy
    from 
      background-color: #Ff0
      opacity: .5
      box-shadow: 0 0 5px #0F0
      filter: hue-rotate(0deg)

    to
      opacity: 1
      background-color: #f0f
      box-shadow: 0 0 10px #F0F
      filter: hue-rotate(360deg)

  .bomb[data-crazy="true"]
    animation: crazy .5s infinite
    border-radius: 100%

</style>
