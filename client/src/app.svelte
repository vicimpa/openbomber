<script lang="ts">
  import { PlayerController } from "class/PlayerController";
  import Player from "components/Player.svelte";
  import { onFrame } from "library/onFrame";
  import Move from "components/Move.svelte";
  import { makeController } from "library/makeController";
  import { onMount } from "svelte";
  import { forwardApi, useApi } from "socket-api/src/index";
  import Game from "components/Game.svelte";
  import { GameMap } from "class/GameMap";
  import {
    type Player as TypePlayer,
    type TPlayer,
    type TServer,
    type Game as TypeGame,
    EAnimate,
  } from "@root/types";
  import { makeEffect } from "library/makeEffect";
  import { socket } from "socket";
  import EditName from "components/EditName.svelte";

  const keys = makeController({
    block: ["KeyE"],
    bomb: ["Space"],
  });

  const api = useApi<TServer>(socket);

  let gamemap: GameMap | null = null;
  let player: PlayerController | null = null;
  let info: TypePlayer["localInfo"] | null = null;
  let gameInfo: TypeGame["info"] | null = null;
  let container: HTMLDivElement;
  let zoom: HTMLDivElement;
  let name = localStorage.getItem("name") || "";
  let restartAfter = -1;

  const resize = () => {
    const min = Math.min(
      container.offsetWidth / zoom.offsetWidth,
      container.offsetHeight / zoom.offsetHeight
    );

    zoom.style.transform = `scale(${min})`;
  };

  const observer = new ResizeObserver(resize);

  const playerEffect = makeEffect();
  const gameSizeEffect = makeEffect();
  const nameEffect = makeEffect<string>();

  onMount(() => {
    observer.observe(container);
    observer.observe(zoom);
    socket.connect();

    forwardApi<TPlayer>(socket, {
      updateGameInfo(info) {
        const { width, height } = info;
        gameInfo = info;

        gameSizeEffect({ width: width, height: height }, () => {
          gamemap = new GameMap(width, height);
        });
      },
      updateLocalInfo(localInfo) {
        info = localInfo;
      },
      updateBombs(newBombs) {
        if (!gamemap) return;
        gamemap.bombs = newBombs;
      },
      updateMap(newMap) {
        if (!gamemap) return;
        gamemap.map.fill(0);

        for (let i = 0; i < gamemap.map.length; i++) {
          gamemap.map[i] = newMap[i];
        }
      },
      setStartPosition(x, y) {
        if (!gameInfo) return;
        const { width, height } = gameInfo;
        player = new PlayerController(width, height);
        player.x = x;
        player.y = y;
      },
      updatePlayers(newPlayers) {
        if (!gamemap) return;
        gamemap.players = newPlayers;
      },
      updateExposes(newExposes) {
        if (!gamemap) return;
        gamemap.explodes = newExposes;
      },
      updateAchivments(newAchivments) {
        if (!gamemap) return;
        gamemap.achivments = newAchivments;
      },
      updateWaitForRestart(count) {
        restartAfter = count;
      },
    });

    return () => {
      observer.disconnect();
      socket.disconnect();
    };
  });

  onFrame((deltaTime, time) => {
    if (!player || !gamemap || !info) return;
    const { bomb, block } = keys;
    const { isDeath } = info;

    if (!isDeath) player.tick(deltaTime, time, gamemap);

    if (name !== info.name) {
      info.name = name;
      api.setName(name);
      localStorage.setItem("name", name);
    }

    player = player;
    gamemap.update();
    bomb.isSingle() && api.setBomb();
    block.isSingle() && api.setBlock();
    const { x, y, dir, animate } = player;
    playerEffect({ x, y, dir, animate }, () => {
      api.setPosition(x, y, dir, animate);
    });
  });
</script>

<div class="ui">
  <div class="side">
    <div class="item">
      Имя:
      <EditName bind:name />
    </div>
    <div class="item">
      Список игроков:
      <ul>
        {#if info}
          <li data-death={info.isDeath}>
            : {info.name || "noname"} (me)
          </li>
        {/if}
        {#if gamemap}
          {#each gamemap.players as player}
            <li data-death={player.isDeath}>
              : {player.name || "noname"}
              <small
                >(B: {player.bombs} R: {player.radius} D: {player.blocks})</small
              >
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  </div>
  <div class="container">
    <div class="header">
      <p>Bombs: {info?.bombs}</p>
      <p>Radius: {info?.radius}</p>
      <p>Blocks: {info?.blocks}</p>
    </div>
    <div class="content" bind:this={container}>
      {#if restartAfter > 0}
        <div class="restart">
          <p>Новая игра через {restartAfter} сек</p>
        </div>
      {/if}
      <div class="zoom" bind:this={zoom}>
        <Game gamemap={$gamemap}>
          {#if player && info}
            <Move x={player.x} y={player.y}>
              <Player
                name={info.name}
                dir={player.dir}
                animate={info.isDeath ? EAnimate.DEATH : player.animate}
                marker={"#fff"}
              />
            </Move>
          {/if}
        </Game>
      </div>
    </div>
  </div>
</div>

<style lang="sass">
  ul, li
    padding: 0
    margin: 0
    list-style: none

  ul
    padding: 10px


  li[data-death="true"]
    color: red

  li[data-death="false"]
    color: green

  .ui 
    width: 100%
    height: 100%
    display: flex

    .side
      background-color: rgba(0,0,0,0.3)
      box-shadow: 0 0 10px #000
      padding: 10px
      min-width: 300px
      display: flex
      flex-direction: column
      gap: 10px

      .item
        background-color: rgba(0,0,0,0.3)
        padding: 10px
        position: relative

    .container
      flex-grow: 1
      display: flex
      flex-direction: column
      position: relative

      .restart
        position: absolute
        margin: auto
        background-color: rgba(0,0,0,1)
        padding: 20px 50px
        font-size: 30px
        z-index: 1
    .header
      display: flex
      padding: 10px
      background-color: rgba(0,0,0,0.3)
      justify-content: center
      gap: 10px

    .content
      flex-grow: 1
      display: flex
      justify-content: center
      align-items: center
      overflow: hidden
</style>
