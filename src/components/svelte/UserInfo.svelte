<script lang="ts">
  import type { TProtoOut } from "@/Proto";
  import type { PLAYER_INFO } from "@/api";
  import Button from "./Button.svelte";
  import { createEventDispatcher } from "svelte";

  export let info: TProtoOut<typeof PLAYER_INFO> | null = null;

  const dispatch = createEventDispatcher<{
    connect: void;
  }>();
</script>

{#if info}
  <div class="header" style="z-index: 4;">
    {#if info.inGame}
      <span>👑 x {info.wins}</span>
      <span>🔫 x {info.kills}</span>
      <span>💀 x {info.deaths}</span>
    {:else}
      <p>Вы наблюдатель</p>
      <Button disabled={!info.canJoin} on:click={() => dispatch("connect")}>
        Подключиться
      </Button>
    {/if}
  </div>
{/if}

<style lang="sass">
  .header
    display: flex
    padding: 0px 10px
    background-color: rgba(0,0,0,0.5)
    justify-content: center
    align-items: center
    gap: 20px
    position: absolute
    top: 0
    padding: 10px
    border-radius: 0 0 10px 10px
    z-index: 1
    backdrop-filter: blur(5px)
    -webkit-backdrop-filter: blur(5px)
    user-select: none
</style>
