<script lang="ts">
  import { NICK_LENGTH, SKINS_COUNT } from "@/config";

  import type { Player as TypePlayer } from "@/class/Player";
  import type { Game as TypeGame } from "@/class/Game";

  import { onMount } from "svelte";
  import { socket } from "socket";
  import EditName from "components/EditName.svelte";

  import Volume from "components/Volume.svelte";
  import { ChatEvent } from "class/ChatEvent";
  import Chat from "components/Chat.svelte";
  import PlayerList from "components/PlayerList.svelte";
  import Effects from "components/Effects.svelte";
  import Button from "components/Button.svelte";
  import Link from "components/Link.svelte";
  import { PLAYER_INFO, gameApi, playerApi } from "@/api";
  import ChatView from "components/ChatView.svelte";
  import type { TProtoOut } from "@/Proto";
  import CanvasRender from "components/CanvasRender.svelte";
  import type { PlayerSprite } from "class/PlayerSprite";
  import type { FocusCamera } from "class/FocusCamera";
  import { sounds } from "library/sounds";
  import { point } from "@/point";
  import { OUT_FRAME } from "config";
  import { each } from "library/each";
  import Player from "components/Player.svelte";
  import { rem } from "@/math";

  const newApi = gameApi.use(socket);

  let info: TypePlayer["info"] | null = null;
  let gameInfo: TypeGame["info"] | null = null;
  let players: TProtoOut<typeof PLAYER_INFO>[] = [];
  let name = localStorage.getItem("name") || "";
  let localSkin = +(localStorage.getItem("skin") ?? -1);
  let selectSkin = localSkin < 0;
  let restartAfter = -1;
  let viewer = 0;
  let cam: FocusCamera | undefined;
  let view: PlayerSprite | null;

  $: viewPlayer =
    info && (!info.inGame || info.isDeath)
      ? players.find((e) => e.id === (view as any)?.["id"])
      : null;

  let isRestarting = false;
  let isOpenEditName = !name;

  onMount(() => {
    socket.connect();
    socket.once("disconnect", () => {
      isRestarting = true;
    });

    playerApi.forward(socket, {
      ping() {
        newApi.ping();
      },
      playSound(sound) {
        sounds[sound]?.play();
      },
      playSoundPosition({ sound, position }) {
        if (!cam || !gameInfo) return sounds[sound]?.play();
        const delta = cam.clone().minus(
          point(position)
            .times(OUT_FRAME)
            .minus(
              point(gameInfo.width || gameInfo.height)
                .times(OUT_FRAME)
                .div(2)
            )
        );
        sounds[sound].play(delta);
      },
      updatePlayers(newPlayers) {
        players = newPlayers;
      },
      updateGameInfo(info) {
        gameInfo = info;
      },
      updateLocalInfo(localInfo) {
        info = localInfo;
      },
      updateWaitForRestart(count) {
        restartAfter = count;
      },
      onMessage({ message, sender, isMe }) {
        ChatEvent.dispatch(message, sender, isMe);
      },
    });

    return () => {
      socket.disconnect();
    };
  });

  $: if (info && info.name !== name) {
    newApi.setName(name);
    localStorage.setItem("name", name);
  }

  $: if (info && info.color !== localSkin) {
    localSkin = rem(localSkin, SKINS_COUNT);
    newApi.setSkin(localSkin);
    localStorage.setItem("skin", localSkin + "");
  }
</script>

<div class="ui">
  <div class="side left">
    <div class="scroll">
      <div class="item">
        {#if info}
          <span>Ping: {info.ping}ms</span>
        {/if}
        <EditName bind:name>
          <Button on:click={() => (selectSkin = true)}>Аватар</Button>
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
      {#if info}
        <div class="item">
          <PlayerList
            current={info}
            players={[...(info.inGame ? [info] : []), ...players]}
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
    <CanvasRender
      {socket}
      bind:view
      bind:cam
      bind:viewCount={viewer}
      on:setBomb={() => newApi.setBomb()}
      on:setPosition={({ detail }) => newApi.setPosition(detail)}
    />
    {#if restartAfter >= 0 && restartAfter <= 3}
      <div class="restart-back" />
      <div class="restart">
        <p>Новая игра через {restartAfter} сек</p>
      </div>
    {/if}

    {#if !isOpenEditName && selectSkin}
      <div class="restart-back" />
      <div class="restart">
        <p>Выберите скин</p>

        <div class="skins">
          {#each each(SKINS_COUNT) as skin}
            <div
              on:mousedown={() => (localSkin = skin)}
              class="skin-item"
              data-select={localSkin === skin}
            >
              <div class="scale">
                <Player color={skin} isDeath={false} />
              </div>
            </div>
          {/each}
        </div>

        <Button disabled={!name} on:click={() => (selectSkin = false)}>
          Сохранить
        </Button>
      </div>
    {/if}

    {#if isOpenEditName}
      <div class="restart-back" />
      <form class="restart" on:submit={() => (isOpenEditName = false)}>
        <p>Введите имя</p>
        <input bind:value={name} maxlength={NICK_LENGTH} />
        <Button disabled={!name} on:click={() => (isOpenEditName = false)}>
          Сохранить
        </Button>
      </form>
    {/if}

    {#if isRestarting}
      <div class="restart-back" />
      <div class="restart">
        <p>Сервер перезагружается. Подождите.</p>
      </div>
    {/if}
    <ChatView />
    {#if viewPlayer}
      <div class="viewer">
        <Button on:click={() => viewer--}>◀️</Button>
        <p>Наблюдение за <b>{viewPlayer.name}</b></p>
        <Button on:click={() => viewer++}>▶️</Button>
      </div>
    {/if}
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
    user-select: none

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
      z-index: 11
      user-select: none

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

    .skins
      display: flex
      flex-wrap: wrap
      width: 100%
      max-width: 300px
      height: 300px
      overflow: hidden
      overflow-y: scroll

      .skin-item
        width: 32px
        height: 32px
        position: relative
        display: flex
        justify-content: center
        align-items: center
        cursor: pointer

        & > .scale
          transform: scale(1.8)

        &[data-select='true']
          background-color: #999
          border-radius: 100%

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
      user-select: none
</style>
