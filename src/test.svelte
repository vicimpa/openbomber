<script lang="ts">
  import { toLimit } from "@/toLimit";
  import { calcMap } from "@/calcMap";

  let count = 0;

  $: {
    count = toLimit(count, 0);
  }

  $: map = calcMap(count);

  function each(length: number) {
    return Array.from({ length }, (_, i) => i);
  }
</script>

<p>
  Count {count}
  {map.size.toLog()}
</p>
<p>
  <button on:click={() => count++}>+</button>
  <button on:click={() => count--}>-</button>
  <button on:click={() => (count = 0)}>C</button>
</p>

<div class="map">
  {#each each(map.size.y) as y}
    <div class="row">
      {#each each(map.size.x) as x}
        <div
          class="item"
          data-wall={(x & 1) == 1 && (y & 1) === 1}
          data-pos={map.positions.find((e) => e.equal(x, y))}
        />
      {/each}
    </div>
  {/each}
</div>

<style lang="sass">
  .map
    $size: 16px
    display: flex
    flex-direction: column
    gap: 2px

    .row
      display: flex
      flex-direction: row
      gap: 2px

      .item
        width: $size
        height: $size
        background-color: #999

        &[data-wall='true']
          background-color: #333
        &[data-pos]
          background-color: #f00
</style>
