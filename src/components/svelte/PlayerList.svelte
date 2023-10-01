<script lang="ts">
  import type { Player as TypePlayer } from "server/class/Player";
  import Frame from "./Frame.svelte";
  import spriteSrc from "images/characters.png";

  export let players: TypePlayer["info"][] = [];
  export let current: TypePlayer["info"] | null = null;

  $: sortedPlayers = players.sort((a, b) =>
    b.wins > a.wins
      ? 1
      : a.wins > b.wins
      ? -1
      : b.kills > a.kills
      ? 1
      : a.kills > b.kills
      ? -1
      : b.name.localeCompare(a.name)
  );

  $: leavePlayers = sortedPlayers.filter((e) => !e.isDeath);
  $: deathPlayers = sortedPlayers.filter((e) => e.isDeath);
</script>

Список игроков:
<ul>
  {#each [...leavePlayers, ...deathPlayers] as player}
    <li data-death={player.isDeath} data-me={player === current}>
      <div class="player">
        <Frame src={spriteSrc} x={1} y={player.color} />
      </div>
      <span class="name">
        {player.name || "noname"}
      </span>
      <span class="stat">{player.ping} ms</span>
      <small class="stats">
        <span class="stat">👑<b>{player.wins}</b></span>
        <span class="stat">🔫<b>{player.kills}</b></span>
        <span class="stat">💀<b>{player.deaths}</b></span>
      </small>
    </li>
  {/each}
</ul>

<style lang="sass">
  .player
    position: relative
    width: 16px
    height: 16px
    transform: scale(1.5)

  .name
    flex-grow: 1
    font-size: 12px
    
  ul, li
    padding: 0px 
    margin: 0
    list-style: none

  ul
    padding: 10px 0px
    display: flex
    flex-direction: column
    gap: 5px
  
  li
    display: flex
    gap: 10px
    justify-content: space-between
    align-items: center
    border-radius: 10px
    padding: 10px 15px
    background-color: rgba(0,0,0,0.2)

    .stats
      display: flex
      gap: 10px

      .stat
        transform: scale(1.4)
        display: flex
        flex-direction: column
        align-items: center
        justify-content: center
        flex-wrap: wrap
        height: 30px

        b
          color: #fff

    &[data-me="true"]
      background-color: rgba(255,255,255,0.1)

    small
      gap: 3px
      display: flex
      font-size: 9px


  li[data-death="true"]
    color: red

  li[data-death="false"]
    color: green
</style>
