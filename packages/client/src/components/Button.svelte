<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let disabled = false;

  const dispatch = createEventDispatcher<{
    click: void;
  }>();
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  on:mousedown={() => {
    !disabled && dispatch("click");
  }}
  class="button"
  data-disabled={disabled}
>
  <slot />
</div>

<style lang="scss">
  .button {
    display: inline-block;
    padding: 3px 10px;
    cursor: pointer;
    background-color: #444;
    color: #fff;
    text-align: center;
    padding: 10px 20px;

    &[data-disabled="true"] {
      cursor: not-allowed;
      opacity: 0.8;
      background-color: #222;
    }
  }
</style>
