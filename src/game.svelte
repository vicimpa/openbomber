<script lang="ts">
  import { makeEffect } from "@/makeEffect";
  import { NICK_LENGTH } from "@/config";

  import type { Player as TypePlayer } from "@/class/Player";
  import type { Game as TypeGame } from "@/class/Game";

  import { PlayerController } from "class/PlayerController";
  import Player from "components/Player.svelte";
  import { onFrame } from "library/onFrame";
  import Move from "components/Move.svelte";
  import { makeController } from "library/makeController";
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
  import Controller from "components/Controller.svelte";
  import { Vec2 } from "@/Vec2";
  import { DIRECTIONS } from "@/types";
  import { point } from "@/point";
  import ChatView from "components/ChatView.svelte";
  import App from "app.svelte";
  import { stylesVariable } from "library/stylesVariable";

  const newApi = gameApi.use(socket);
  let move = new Vec2();

  let gamemap: GameMap | null = null;
  let player: PlayerController | null = null;
  let info: TypePlayer["info"] | null = null;
  let gameInfo: TypeGame["info"] | null = null;
  let container: HTMLDivElement;
  let zoom: HTMLDivElement;
  let name = localStorage.getItem("name") || "";
  let restartAfter = -1;
  let offset = 40;
  let scale = 0;
  let normalScale = 0;
  let viewer = 0;

  const current = {
    pos: new Vec2(0, 0),
    scale: 0,
  };

  const toStyles = {
    x: "",
    y: "",
    s: "",
  };

  const resize = () => {
    scale = Math.min(container.offsetWidth, container.offsetHeight) / (16 * 10);
    normalScale = Math.min(
      (container.offsetWidth - offset) / zoom.offsetWidth,
      (container.offsetHeight - offset) / zoom.offsetHeight
    );
  };

  $: view =
    player && info && info.inGame && !info.isDeath
      ? player
      : gamemap
      ? gamemap.positions[viewer % gamemap.positions.length]
      : null;

  $: viewPlayer = gamemap?.players.find((e) => e.id === (view as any)?.["id"]);

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
          if (player) {
            player.width = width;
            player.height = height;
          }
        });
      },
      playSound(sound) {
        sounds[sound]?.play();
      },
      playSoundPosition({ sound, position }) {
        if (!player) return sounds[sound]?.play();
        const delta = player.clone().minus(position);
        sounds[sound].play(delta);
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

  const keys = makeController({
    map: ["KeyE"],
  });

  onFrame((deltaTime, time) => {
    {
      if (deltaTime > 100) return;
      const isPlayer = view && restartAfter < 0;
      let { offsetWidth: width, offsetHeight: height } = zoom;
      let s = isPlayer ? scale : normalScale;
      let a = isPlayer ? DIRECTIONS[view!.dir] : point(0, 0);

      width *= 0.5;
      height *= 0.5;
      let { x, y } = isPlayer
        ? view!
        : {
            x: (width / 16) | 0,
            y: (height / 16) | 0,
          };
      const append = a.clone().times(0);
      x += append.x;
      y += append.y;

      x += 1.5;
      y += 1.5;

      x *= 16;
      y *= 16;

      x -= width;
      y -= height;

      let delta = (current.scale - s) * deltaTime * 0.003;

      if (isFinite(delta)) {
        current.scale -= delta;
      }

      current.pos.minus(
        current.pos
          .clone()
          .minus(x, y)
          .times(deltaTime * 0.003)
      );

      current.scale = ((current.scale * 1000) | 0) / 1000;
      current.pos.times(100).floor().div(100);

      if (zoom) {
        toStyles.s = current.scale + "";
        toStyles.x = `${-current.pos.x}px`;
        toStyles.y = `${-current.pos.y}px`;
      }
    }

    if (!info) return;
    if (name !== info.name) {
      name = name.slice(0, NICK_LENGTH);
      info.name = name;
      newApi.setName(name);
      localStorage.setItem("name", name);
    }

    const { isDeath } = info;

    if (!info.inGame) return;

    if (!player || !gamemap) return;
    player.move.set(move);
    if (restartAfter >= 0) return;
    if (isRestarting) return;

    if (!isDeath) player.speedMulti = info.effects.speed;
    if (!isDeath) player.tick(deltaTime, time, gamemap);

    player = player;
    gamemap.update();

    let { x, y, dir, animate } = player;

    x = ((x * 16) | 0) / 16;
    y = ((y * 16) | 0) / 16;

    playerEffect({ x, y, dir, animate }, () => {
      newApi.setPosition({ x, y, dir, animate });
    });
  });
</script>

<div class="ui">
  <div class="side left">
    <div class="scroll">
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
            <Link url="https://www.donationalerts.com/r/promise">
              Донат на DonationAlerts
            </Link>
          </li>
          <li>
            <Link url="https://boosty.to/vic_dev">Донат на Boosty</Link>
          </li>
          <li>
            <Link url="/new.html">Тут я делаю новый двигло</Link>
          </li>
        </ul>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="header" style="z-index: 4;">
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
          <Button disabled={!info?.canJoin} on:click={() => newApi.toGame()}>
            Подключиться
          </Button>
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
      <div class="zoom" bind:this={zoom} style={stylesVariable(toStyles)}>
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
      <ChatView />
      {#if viewPlayer}
        <div class="viewer">
          <Button on:click={() => viewer--}>◀️</Button>
          <p>Наблюдение за <b>{viewPlayer.name}</b></p>
          <Button on:click={() => viewer++}>▶️</Button>
        </div>
      {/if}
      <Controller
        bind:move
        inGame={info?.inGame ?? false}
        on:bomb={() => {
          if (info && info.inGame && !info.isDeath) newApi.setBomb();
          else viewer++;
        }}
      />
    </div>
  </div>

  <div class="side right">
    <div class="scroll">
      <div class="item" style="flex-grow: 1;">
        <Chat
          on:message={({ detail }) => {
            newApi.sendMessage(detail);
          }}
        />
      </div>
    </div>
  </div>
</div>

<style lang="sass">
  ul, li
    list-style: none

  ul
    padding: 5px 0

  .viewer
    position: absolute
    bottom: 50px
    padding: 10px 20px
    border-radius: 10px
    background-color: rgba(0,0,0,0.5)
    display: flex
    transform: scale(1.3)
    gap: 10px
    align-items: center
    z-index: 10

  .ui 
    width: 100%
    height: 100%
    display: flex

    $side: 350px

    .side
      background-color: rgba(0,0,0,0.7)
      box-shadow: 0 0 10px #000
      padding: 0px
      width: $side
      display: flex
      flex-direction: column
      gap: 10px
      font-size: 12px
      position: absolute
      top: 0
      bottom: 0
      z-index: 2
      transition: transform 0.3s
      backdrop-filter: blur(10px)
      z-index: 10

      .scroll
        display: flex
        flex-direction: column
        flex-grow: 1
        overflow-y: scroll

      &:after
        display: block
        position: absolute
        width: 30px
        height: 100px
        top: 0
        bottom: 0
        margin: auto
        display: flex
        align-items: center
        justify-content: center
        background-color: rgba(100,100,100, 0.5)
        border-radius: 100px
        font-size: 20px

      &.left
        left: 0
        transform: translateX(-$side + 15px)

        &:after
          content: '🕹️'
          right: -15px

      &.right
        right: 0
        transform: translateX($side - 15px)

        &:after
          content: '💬'
          left: -15px 

      &:hover
        transform: translateX(0)

      .item
        background-color: rgba(0,0,0,0.3)
        padding: 10px
        position: relative
        display: flex
        flex-direction: column

    .container
      flex-grow: 1
      display: flex
      flex-direction: column
      position: relative
      justify-content: center
      align-items: center

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
        z-index: 2

      .restart-back
        position: absolute
        top: 0
        left: 0
        right: 0
        bottom: 0
        z-index: 1

    .header
      display: flex
      padding: 0px 10px
      background-color: rgba(0,0,0,0.5)
      justify-content: center
      align-items: center
      gap: 20px
      position: absolute
      top: 0
      padding: 10px
      border-radius: 0 0 10px 10px
      z-index: 1
      backdrop-filter: blur(5px)
      

    .content
      flex-grow: 1
      display: flex
      justify-content: center
      align-items: center
      overflow: hidden
      position: relative
      padding: 30px
      padding-bottom: 0px
      width: 100%
      height: 100%

    .zoom
      box-shadow: 5px 5px 10px #000
      position: absolute
      transform: scale(var(--s)) translateX(var(--x))  translateY(var(--y))
</style>
