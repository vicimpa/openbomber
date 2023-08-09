<script lang="ts">
  import { NICK_LENGTH } from "config";
  import { createEventDispatcher } from "svelte";

  export let name = "";

  let editName = false;

  const dispatch = createEventDispatcher<{
    save: string;
  }>();
</script>

<p>
  {#if editName}
    <input placeholder="Name" maxlength={NICK_LENGTH} bind:value={name} />
    <button on:click={() => ((editName = false), dispatch("save", name))}
      >Close</button
    >
  {:else}
    <span>{name}</span>
    <button on:click={() => (editName = true)}> Edit </button>
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
