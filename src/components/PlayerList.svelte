<script lang="ts">
  import type { Player as TypePlayer } from "@/class/Player";
  import Effects from "./Effects.svelte";
  import Player from "./Player.svelte";

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
        <Player color={player.color} isDeath={false} />
      </div>
      <span class="name">
        {player.name || "noname"} ({player.ping} ms)
      </span>
      <small class="stats">
        <span class="stat">💣<b>{player.effects.bombs}</b></span>
        <span class="stat">🔥<b>{player.effects.radius}</b></span>
        <span class="stat">👑<b>{player.wins}</b></span>
        <span class="stat">🔫<b>{player.kills}</b></span>
        <span class="stat">💀<b>{player.deaths}</b></span>

        <span class="stat effects">
          <Effects effects={player.effects} />
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
    transform: scale(1.5)

  .name
    flex-grow: 1
    font-size: 10px
    
  ul, li
    padding: 0
    margin: 0
    list-style: none

  ul
    padding: 0px
    display: flex
    flex-direction: column
    gap: 5px
  
  li
    display: flex
    gap: 10px
    justify-content: space-between
    align-items: center
    border-radius: 10px
    padding: 10px 5px
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

        &.effects
          font-size: 6px
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
