<script lang="ts">
  import { points } from "library/point";
  import Move from "./Move.svelte";
  import fakeExplode from "images/explodeFake.png";
  import Sprite from "./Sprite.svelte";

  export let x = 0;
  export let y = 0;
  export let deltaTime = 0;

  const FRAMES = points("0,0;1,0;2,0;3,0;4,0;5,0;6,0;7,0;8,0;9,0;10,0;11,0");
</script>

<Move {x} {y}>
  <Sprite src={fakeExplode} speed={20} frames={FRAMES} {deltaTime} isFinite />
</Move>
