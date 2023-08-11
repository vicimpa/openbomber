<script lang="ts">
  import type { Player } from "../../server/class/Player";

  export let effects: Player["effects"] | null = null;
</script>

{#if effects}
  {#if effects.haveShield}
    🛡️
  {/if}
  {#if effects.speed > 1}
    ⏫
  {/if}
  {#if effects.speed < 1}
    ⏬
  {/if}
  {#if effects.crazyBomb}
    💥
  {/if}
{/if}
