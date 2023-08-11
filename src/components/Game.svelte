<script lang="ts">
  import sprite from "images/sprite.png";
  import Frame from "components/Frame.svelte";
  import Map from "components/Map.svelte";
  import Move from "components/Move.svelte";
  import { arange } from "library/range";
  import Bomb from "components/Bomb.svelte";
  import Explode from "components/Explode.svelte";
  import type { GameMap } from "class/GameMap";
  import Player from "./Player.svelte";
  import { EMapItem } from "types";

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
        {#if val === EMapItem.CLEAR}
          <Frame src={sprite} x={6} y={0} />
        {/if}

        {#if val === EMapItem.WALL}
          <Frame src={sprite} x={3} y={3} />
        {/if}

        {#if val === EMapItem.BLOCK}
          <Frame src={sprite} x={4} y={3} />
        {/if}

        {#if val === EMapItem.GRAS}
          <Frame src={sprite} x={6} y={1} />
        {/if}

        {#if val === EMapItem.SAND}
          <Frame src={sprite} x={7} y={0} />
        {/if}

        {#if val === EMapItem.WATER}
          <Frame src={sprite} x={7} y={1} />
        {/if}
      </div>
    {/each}

    {#each gamemap.bombs as bomb}
      <Bomb {bomb} />
    {/each}

    {#each gamemap.explodes as expl}
      <Explode {expl} />
    {/each}

    {#each gamemap.achivments as { x, y, type }}
      <Move {x} {y}>
        <Frame src={sprite} x={type} y={14} />
      </Move>
    {/each}

    {#each gamemap.playersWidthPositions as { x = 0, y = 0, dir = 0, animate = 0, name, color, effects, isDeath }}
      <Move {x} {y}>
        <Player
          {dir}
          {animate}
          {color}
          {name}
          {isDeath}
          haveShield={effects.haveShield}
        />
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
