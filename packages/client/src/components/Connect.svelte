<script lang="ts">
  import type { TProtoOut } from "@vicimpa/proto";
  import type { PLAYER_INFO } from "@ob/shared/api";
  import Button from "./Button.svelte";
  import { createEventDispatcher } from "svelte";

  export let info: TProtoOut<typeof PLAYER_INFO> | null = null;

  const dispatch = createEventDispatcher<{
    connect: void;
    disconnect: void;
  }>();
</script>

<div>
  Подключение

  {#if !info?.inGame}
    <Button disabled={!info?.canJoin} on:click={() => dispatch("connect")}>
      Подключиться
    </Button>
  {:else}
    <Button on:click={() => dispatch("disconnect")}>Отключится</Button>
  {/if}
</div>
