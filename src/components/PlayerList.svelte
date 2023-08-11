<script lang="ts">
  import type { Player as TypePlayer } from "../../server/class/Player";
  import Player from "./Player.svelte";
  export let players: TypePlayer["info"][] = [];
</script>

Список игроков:
<ul>
  {#each players as player}
    <li data-death={player.isDeath}>
      <div class="player">
        <Player color={player.color} isDeath={false} />
      </div>
      <span class="name">
        {player.name || "noname"}
      </span>
      <small>
        <span class="stat">💣 {player.effects.bombs}</span>
        <span class="stat">🔥 {player.effects.radius}</span>
        <span class="stat">🔫 {player.kills}</span>
        <span class="stat">💀 {player.deaths}</span>

        <span class="stat">
          {#if player.effects.haveShield}
            🛡️
          {/if}
        </span>
      </small>
    </li>
  {/each}
</ul>

<style lang="sass">
  .player
    position: relative
    width: 16px
    height: 16px
    transform: scale(1.3)

  .name
    flex-grow: 1
  ul, li
    padding: 0
    margin: 0
    list-style: none

  ul
    padding: 10px
  
  li
    display: flex
    gap: 10px
    justify-content: space-between

    small
      gap: 3px
      display: flex
      font-size: 9px


  li[data-death="true"]
    color: red

  li[data-death="false"]
    color: green
</style>
