<script lang="ts">
  import { makeEffect } from "@/core/makeEffect";
  import { NICK_LENGTH } from "@/config";

  import type { Player as TypePlayer } from "@/server/class/Player";
  import type { Game as TypeGame } from "@/server/class/Game";

  import { PlayerController } from "class/PlayerController";
  import Player from "components/Player.svelte";
  import { onFrame } from "library/onFrame";
  import Move from "components/Move.svelte";
  import { makeController, makeVectorController } from "library/makeController";
  import { onMount } from "svelte";
  import Game from "components/Game.svelte";
  import { GameMap } from "class/GameMap";
  import { socket } from "socket";
  import EditName from "components/EditName.svelte";

  import { sounds } from "library/sounds";
  import Volume from "components/Volume.svelte";
  import { ChatEvent } from "class/ChatEvent";
  import Chat from "components/Chat.svelte";
  import PlayerList from "components/PlayerList.svelte";
  import Effects from "components/Effects.svelte";
  import Button from "components/Button.svelte";
  import Link from "components/Link.svelte";
  import { gameApi, playerApi } from "@/api";

  const keys = makeController({
    bomb: ["Space", "Enter"],
  });

  const newApi = gameApi.use(socket);

  let gamemap: GameMap | null = null;
  let player: PlayerController | null = null;
  let info: TypePlayer["info"] | null = null;
  let gameInfo: TypeGame["info"] | null = null;
  let container: HTMLDivElement;
  let zoom: HTMLDivElement;
  let name = localStorage.getItem("name") || "";
  let restartAfter = -1;

  const controller = makeVectorController(
    {
      keys: ["KeyW", "ArrowUp"],
      plus: [0, -1],
    },
    {
      keys: ["KeyA", "ArrowLeft"],
      plus: [-1, 0],
    },
    {
      keys: ["KeyD", "ArrowRight"],
      plus: [1, 0],
    },
    {
      keys: ["KeyS", "ArrowDown"],
      plus: [0, 1],
    }
  );

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

  let isRestarting = false;
  let isOpenEditName = !name;

  onMount(() => {
    observer.observe(container);
    observer.observe(zoom);
    socket.connect();
    socket.once("disconnect", () => {
      isRestarting = true;
    });

    playerApi.forward(socket, {
      ping() {
        newApi.ping();
      },
      updateGameInfo(info) {
        const { width, height } = info;
        gameInfo = info;

        gameSizeEffect({ width: width, height: height }, () => {
          gamemap = new GameMap(width, height);
        });
      },
      playSound(sound) {
        sounds[sound]?.play();
      },
      updateLocalInfo(localInfo) {
        info = localInfo;

        if (!localInfo.inGame) {
          player = null;
        }
      },
      updateEffects(newEffects) {
        if (!gamemap) return;
        gamemap.effects = newEffects;
      },
      updateBombs(newBombs) {
        if (!gamemap) return;
        gamemap.bombs = newBombs;
      },
      updateMap(buffer) {
        if (!gamemap) return;
        gamemap.map = new Uint8Array(buffer);
      },
      setStartPosition({ x, y }) {
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
      updatePlayerPositions(newPositions) {
        if (!gamemap) return;
        gamemap.positions = newPositions;
      },
      updateExplodes(newExplodes) {
        if (!gamemap) return;
        gamemap.explodes = newExplodes;
      },
      updateAchivments(newAchivments) {
        if (!gamemap) return;
        gamemap.achivments = newAchivments;
      },
      updateWaitForRestart(count) {
        restartAfter = count;
      },
      onMessage({ message, sender, isMe }) {
        ChatEvent.dispatch(message, sender, isMe);
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
      newApi.setName(name);
      localStorage.setItem("name", name);
    }

    const { bomb } = keys;
    const { isDeath } = info;

    if (!info.inGame) return;

    if (!player || !gamemap) return;
    player.move.set(controller());
    if (restartAfter >= 0) return;
    if (isRestarting) return;

    if (!isDeath) player.speedMulti = info.effects.speed;
    if (!isDeath) player.tick(deltaTime, time, gamemap);

    player = player;
    gamemap.update();
    bomb.isSingle() && newApi.setBomb();
    let { x, y, dir, animate } = player;
    x = ((x * 16) | 0) / 16;
    y = ((y * 16) | 0) / 16;

    playerEffect({ x, y, dir, animate }, () => {
      newApi.setPosition({ x, y, dir, animate });
    });
  });
</script>

<div class="ui">
  <div class="side">
    <div class="item">
      {#if info}
        <span>Ping: {info.ping}ms</span>
      {/if}
      <EditName bind:name>
        <Button on:click={() => newApi.randomColor()}>Аватар</Button>
      </EditName>
    </div>
    <div class="item">
      Подключение

      {#if gameInfo}
        {#if !info?.inGame}
          <Button disabled={!info?.canJoin} on:click={() => newApi.toGame()}>
            Подключиться
          </Button>
        {:else}
          <Button on:click={() => newApi.toLeave()}>Отключится</Button>
        {/if}
      {/if}
    </div>
    {#if gamemap && info}
      <div class="item">
        <PlayerList
          current={info}
          players={[...(info.inGame ? [info] : []), ...gamemap.players]}
        />
      </div>
    {/if}
    <div class="item">
      Наблюдателей: {gameInfo?.spectratorsCount ?? 0}
    </div>
    <div class="item">
      <Volume />
    </div>
  </div>
  <div class="container">
    <div class="header">
      {#if gameInfo}
        {#if info?.inGame}
          <span>💣 x {info.effects.bombs}</span>
          <span>🔥 x {info.effects.radius}</span>
          <span>👑 x {info.wins}</span>
          <span>🔫 x {info.kills}</span>
          <span>💀 x {info.deaths}</span>
          <span>
            <Effects effects={info.effects} />
          </span>
        {:else}
          <p>Вы наблюдатель</p>
        {/if}
      {/if}
    </div>
    <div class="content" bind:this={container}>
      {#if restartAfter >= 0 && restartAfter <= 3}
        <div class="restart-back" />
        <div class="restart">
          <p>Новая игра через {restartAfter} сек</p>
        </div>
      {/if}
      {#if isOpenEditName}
        <div class="restart-back" />
        <div class="restart">
          <p>Введите имя</p>
          <input bind:value={name} maxlength={NICK_LENGTH} />
          <Button disabled={!name} on:click={() => (isOpenEditName = false)}>
            Сохранить
          </Button>
        </div>
      {/if}
      {#if isRestarting}
        <div class="restart-back" />
        <div class="restart">
          <p>Сервер перезагружается. Подождите.</p>
        </div>
      {/if}
      <div class="zoom" bind:this={zoom}>
        <Game gamemap={$gamemap}>
          {#if player && info}
            <Move x={player.x} y={player.y}>
              <Player
                isFire={info.effects.speed < 1}
                name={info.name}
                dir={player.dir}
                haveShield={info.effects.haveShield}
                isDeath={info.isDeath}
                color={info.color}
                animate={player.animate}
                marker
              />
            </Move>
          {/if}
        </Game>
      </div>
    </div>
  </div>

  <div class="side">
    <div class="item">
      <Chat
        on:message={({ detail }) => {
          newApi.sendMessage(detail);
        }}
      />
    </div>
    <div class="item">
      <p>Ссылки:</p>
      <ul>
        <li>
          <Link url="https://github.com/vicimpa/openbomber/">
            Репозиторий GitHub
          </Link>
        </li>
        <li>
          <Link url="https://discord.gg/gwh58DTe">Наш сервер в Discord</Link>
        </li>
        <li>
          <Link url="https://vk.com/openbomber">Группа игроков в VK</Link>
        </li>
        <li>
          <Link url="https://t.me/gameopenbomber">Группа игроков в TG</Link>
        </li>
        <li>
          <Link url="/new.html">Тут я делаю новый двигло</Link>
        </li>
      </ul>
    </div>
  </div>
</div>

<style lang="sass">
  ul, li
    list-style: none

  ul
    padding: 5px 0

  .ui 
    width: 100%
    height: 100%
    display: flex

    .side
      background-color: rgba(0,0,0,0.3)
      box-shadow: 0 0 10px #000
      padding: 0px
      width: 300px
      display: flex
      flex-direction: column
      gap: 10px
      overflow-y: auto
      font-size: 12px

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
      align-items: center
      gap: 20px

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
