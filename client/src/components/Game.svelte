<script lang="ts">
  import sprite from "images/sprite.png";
  import Frame from "components/Frame.svelte";
  import Map from "components/Map.svelte";
  import Move from "components/Move.svelte";
  import { arange } from "library/range";
  import Bomb from "components/Bomb.svelte";
  import Explode from "components/Explode.svelte";
  import type { GameMap } from "class/GameMap";
  import Short from "./Short.svelte";
  import Player from "./Player.svelte";

  export let gamemap: GameMap | null = null;
</script>

{#if gamemap}
  <Map width={gamemap.width} height={gamemap.height}>
    {#each arange(-1, gamemap.height + 1) as y}
      {#each arange(-1, gamemap.width + 1) as x}
        {#if x < 0 || x > gamemap.width - 1 || y < 0 || y > gamemap.height - 1}
          <Move {x} {y}>
            <Frame src={sprite} x={3} y={3} />
          </Move>
        {/if}
      {/each}
    {/each}

    {#each gamemap.map as val}
      <div class="item">
        {#if val === 1}
          <Frame src={sprite} x={3} y={3} />
        {/if}

        {#if val === 2}
          <Frame src={sprite} x={4} y={3} />
        {/if}
      </div>
    {/each}

    {#each gamemap.bombs as bomb}
      <Bomb {bomb} />
    {/each}

    {#each gamemap.explodes as expl}
      <Explode {expl} />
    {/each}

    {#each gamemap.achivments as { x, y, value }}
      <Move {x} {y}>
        <Frame src={sprite} x={value} y={14} />
      </Move>
    {/each}

    {#each gamemap.players as { x, y, dir, animate, name, color }}
      <Move {x} {y}>
        <Player {dir} {animate} {color} {name} />
      </Move>
    {/each}w

    <slot />
  </Map>
{/if}

<style lang="sass">
  .item
    width: var(--size)
    height: var(--size)
    background-color: green
</style>
