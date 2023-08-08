<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let name = "";

  let editName = false;

  const dispatch = createEventDispatcher<{
    save: string;
  }>();
</script>

<p>
  <span>Nick: </span>
  {#if editName}
    <input placeholder="Name" maxlength="18" bind:value={name} />
    <button on:click={() => (editName = false)}>Close</button>
  {:else}
    <span>{name}</span>
    <button on:click={() => ((editName = true), dispatch("save", name))}>
      Edit
    </button>
  {/if}
</p>

<style>
  button {
    font-size: 8px;
    padding: 0px 1px;
  }
  p {
    display: flex;
    gap: 2px;
  }
</style>
