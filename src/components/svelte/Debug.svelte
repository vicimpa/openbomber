<script lang="ts">
  import { debug } from "data/debug";
  import { onMount } from "svelte";

  let show = false;

  onMount(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.code === "IntlBackslash") show = !show;
    };

    addEventListener("keydown", keydown);

    return () => {
      removeEventListener("keydown", keydown);
    };
  });
</script>

{#if show}
  <div class="debug">
    {#each [...$debug.entries()] as [key, value]}
      {#key key}
        <div class="item">
          <span>{key}:</span> <b>{String(value)}</b>
        </div>
      {/key}
    {/each}
  </div>
{/if}

<style lang="sass">
  .debug
    $filter: blur(5px)
    position: absolute
    top: 0px
    left: 0px
    z-index: 1
    padding: 20px
    gap: 5px
    display: flex
    flex-direction: column
    background-color: rgba(0,0,0,.5)
    backdrop-filter: $filter
    -webkit-backdrop-filter: $filter
    z-index: 99999

    .item
      display: flex
      gap: 10px
      justify-content: space-between
      font-size: 12px
</style>
