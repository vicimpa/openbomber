<script lang="ts">
  import { PlayerController } from "class/PlayerController";
  import Player from "components/Player.svelte";
  import { onFrame } from "library/onFrame";
  import Move from "components/Move.svelte";
  import { makeController } from "library/makeController";
  import { onMount } from "svelte";
  import { forwardApi, useApi } from "library/socketApi";
  import Game from "components/Game.svelte";
  import { GameMap } from "class/GameMap";
  import { EAnimate } from "types";
  import { makeEffect } from "library/makeEffect";
  import { socket } from "socket";
  import EditName from "components/EditName.svelte";

  import type { Player as TypePlayer } from "../server/class/Player";
  import type { Game as TypeGame } from "../server/class/Game";
  import type { TPlayer, TServer } from "types";
  import { sounds } from "library/sounds";
  import Volume from "components/Volume.svelte";
  import { ChatEvent } from "class/ChatEvent";
  import Chat from "components/Chat.svelte";
  import { NICK_LENGTH } from "config";

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
    const offset = 60;
    const min = Math.min(
      (container.offsetWidth - offset) / zoom.offsetWidth,
      (container.offsetHeight - offset) / zoom.offsetHeight
    );

    zoom.style.transform = `scale(${min})`;
  };

  const observer = new ResizeObserver(resize);

  const playerEffect = makeEffect();
  const gameSizeEffect = makeEffect();
  const winEffect = makeEffect<boolean>();

  let isRestarting = false;
  let isOpenEditName = !name;

  onMount(() => {
    observer.observe(container);
    observer.observe(zoom);
    socket.connect();
    socket.once("disconnect", () => {
      isRestarting = true;
    });

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

        if (!localInfo.inGame) {
          player = null;
        }
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
        if (info?.inGame) sounds.newLife.play();
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
      actionBonus() {
        sounds.bonus.play();
      },
      actionDeath() {
        sounds.death.play();
      },
      onMessage(message, player, isMe) {
        ChatEvent.dispatch(message, player, isMe);
      },
    });

    return () => {
      observer.disconnect();
      socket.disconnect();
    };
  });

  onFrame((deltaTime, time) => {
    if (!info) return;
    if (name !== info.name) {
      name = name.slice(0, NICK_LENGTH);
      info.name = name;
      api.setName(name);
      localStorage.setItem("name", name);
    }

    if (!player || !gamemap) return;
    if (restartAfter >= 0) return;
    if (isRestarting) return;
    const { bomb, block } = keys;
    const { isDeath } = info;

    winEffect(!isDeath && restartAfter >= 0, (isWin) => {
      sounds.win.play();
    });

    if (!isDeath) player.tick(deltaTime, time, gamemap);

    player = player;
    gamemap.update();
    bomb.isSingle() && api.setBomb();
    block.isSingle() && api.setBlock();
    let { x, y, dir, animate } = player;
    x = ((x * 16) | 0) / 16;
    y = ((y * 16) | 0) / 16;
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
        {#if info?.inGame}
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
    <div class="item">
      Наблюдателей: {gameInfo?.spectratorsCount ?? 0}
    </div>
    <div class="item">
      <Volume />
    </div>
    <div class="item">
      Чат
      <Chat
        on:message={({ detail }) => {
          api.sendMessage(detail);
        }}
      />
    </div>
  </div>
  <div class="container">
    <div class="header">
      {#if gameInfo}
        {#if info?.inGame}
          <p>Bombs: {info.bombs}</p>
          <p>Radius: {info.radius}</p>
          <p>Blocks: {info.blocks}</p>

          <button on:click={() => api.toLeave()}> Отключится </button>
        {:else}
          <p>Вы наблюдатель</p>
          {#if info?.canJoin}
            <button on:click={() => api.toGame()}> Подключиться </button>
          {/if}
        {/if}
      {/if}
    </div>
    <div class="content" bind:this={container}>
      {#if restartAfter >= 0}
        <div class="restart-back" />
        <div class="restart">
          <p>Новая игра через {restartAfter} сек</p>
        </div>
      {/if}
      {#if isRestarting}
        <div class="restart-back" />
        <div class="restart">
          <p>Сервер перезагружается. Подождите.</p>
        </div>
      {/if}
      {#if isOpenEditName}
        <div class="restart-back" />
        <div class="restart">
          <p>Введите имя</p>
          <input bind:value={name} maxlength={NICK_LENGTH} />
          <button disabled={!name} on:click={() => (isOpenEditName = false)}>
            Сохранить
          </button>
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
                isAnimated={info.isAnimated}
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
        display: flex
        flex-direction: column
        align-items: center
        gap: 20px

      .restart-back
        position: absolute
        top: 0
        left: 0
        right: 0
        bottom: 0
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
      padding: 20px
      position: relative

    .zoom
      box-shadow: 5px 5px 10px #000
      position: absolute
</style>
