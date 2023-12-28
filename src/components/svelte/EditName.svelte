<script lang="ts">
  import { NICK_LENGTH } from "shared/config";
  import { createEventDispatcher, onMount } from "svelte";
  import Button from "./Button.svelte";

  export let name = "";
  export let editName = false;

  const dispatch = createEventDispatcher<{
    save: string;
  }>();
</script>

<p>
  {#if editName}
    <input placeholder="Name" maxlength={NICK_LENGTH} bind:value={name} />
    <Button on:click={() => ((editName = false), dispatch("save", name))}>
      Ок
    </Button>
  {:else}
    <span>{name ?? "noname"}</span>
    <Button on:click={() => (editName = true)}>Изменить</Button>
  {/if}
  <slot />
</p>

<style>
  p {
    display: flex;
    gap: 2px;
    align-items: center;
  }
</style>
