<script lang="ts">
  import type { Player } from "@/class/Player";

  export let effects: Player["effects"] | null = null;
</script>

{#if effects}
  {#if effects.haveShield}
    <span>🛡️</span>
  {/if}
  {#if effects.speed > 1}
    <span>⏫</span>
  {/if}
  {#if effects.speed < 1}
    <span>⏬</span>
  {/if}
  {#if effects.crazyBomb}
    <span>💥</span>
  {/if}
{/if}
