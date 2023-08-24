<script lang="ts">
  import { OUT_FRAME } from "config";
  import { onMount } from "svelte";
  import { socket } from "socket";

  import spriteSrc from "images/characters.png";
  import achivmentSrc from "images/sprite.png";

  import { rem } from "@/math";
  import { point } from "@/point";
  import { ACHIVMEN_DESCRIPTION, EAchivment } from "@/types";
  import { NICK_LENGTH, SKINS_COUNT } from "@/config";
  import { PLAYER_INFO, REMAINING_EFFECTS, gameApi, playerApi } from "@/api";

  import type { TProtoOut } from "@/Proto";
  import type { Player as TypePlayer } from "@/class/Player";
  import type { Game as TypeGame } from "@/class/Game";

  import { FocusCamera } from "class/FocusCamera";
  import { ChatEvent } from "class/ChatEvent";

  import { each } from "library/each";
  import { sounds } from "library/sounds";

  import Frame from "components/svelte/Frame.svelte";
  import PlayerList from "components/svelte/PlayerList.svelte";
  import Button from "components/svelte/Button.svelte";
  import EditName from "components/svelte/EditName.svelte";
  import Volume from "components/svelte/Volume.svelte";
  import Chat from "components/svelte/Chat.svelte";
  import ChatView from "components/svelte/ChatView.svelte";
  import Link from "components/svelte/Link.svelte";
  import CanvasRender from "components/svelte/CanvasRender.svelte";
  import { IS_DEV } from "env";
  import Debug from "components/svelte/Debug.svelte";
  import { debug } from "data/debug";

  const newApi = gameApi.use(socket);

  let info: TypePlayer["info"] | null = null;
  let gameInfo: TypeGame["info"] | null = null;
  let players: TProtoOut<typeof PLAYER_INFO>[] = [];
  let effects: TProtoOut<typeof REMAINING_EFFECTS> | null = null;
  let name = localStorage.getItem("name") || "";
  let localSkin = +(localStorage.getItem("skin") ?? -1);
  let selectSkin = localSkin < 0;
  let restartAfter = -1;
  let cam: FocusCamera | undefined;
  let isRestarting = false;
  let isOpenEditName = !name;

  $: effectsList = Object.entries(effects ?? {})
    .filter((e) => e[1] > 0)
    .map(([name, value]) => {
      let type!: EAchivment;
      let remaining = `${value}`;

      switch (name) {
        case "speed": {
          type =
            info && info.effects.speed > 1
              ? EAchivment.APPEND_SPEED
              : EAchivment.FIRE;

          remaining += " сек.";
          break;
        }
        case "shield": {
          type = EAchivment.APPEND_SHIELD;
          remaining += " сек.";
          break;
        }
        case "crazy": {
          type = EAchivment.CRAZY_BOMB;
          remaining += " сек.";
          break;
        }

        case "bombs": {
          type = EAchivment.APPEND_BOMB;
          remaining = "x " + remaining;
          break;
        }

        case "radius": {
          type = EAchivment.APPEND_EXPO;
          remaining = "x " + remaining;
          break;
        }
      }

      return { type, remaining };
    });

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
      updateRemainingEffects(newEffects) {
        effects = newEffects;
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
        <EditName bind:name>
          <Button on:click={() => (selectSkin = true)}>Аватар</Button>
        </EditName>
      </div>
      <div class="item">
        <div>
          Подключение

          {#if gameInfo}
            {#if !info?.inGame}
              <Button
                disabled={!info?.canJoin}
                on:click={() => newApi.toGame()}
              >
                Подключиться
              </Button>
            {:else}
              <Button on:click={() => newApi.toLeave()}>Отключится</Button>
            {/if}
          {/if}
        </div>
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
            <Link url="https://discord.gg/JzapKXFqzt">
              Наш сервер в Discord
            </Link>
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
          <span>👑 x {info.wins}</span>
          <span>🔫 x {info.kills}</span>
          <span>💀 x {info.deaths}</span>
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
      bind:cam
      on:setBomb={() => newApi.setBomb()}
      on:setPosition={({ detail }) => newApi.setPosition(detail)}
    />

    {#if IS_DEV}
      <Debug />
    {/if}

    <div class="effects">
      {#each effectsList as { type, remaining }}
        <div class="item" title={ACHIVMEN_DESCRIPTION[type]}>
          <div class="info">
            <Frame s={2} src={achivmentSrc} x={type} y={14} />
          </div>
          <span class="desc">{ACHIVMEN_DESCRIPTION[type]}</span>
          <span>
            {remaining}
          </span>
        </div>
      {/each}
    </div>

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
                <Frame src={spriteSrc} x={1} y={skin} />
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

  .effects
    position: absolute
    top: 50px
    left: 0px
    display: flex
    flex-direction: column
    align-items: flex-start
    gap: 10px
    z-index: 1

    .item
      padding: 5px 30px
      border-radius: 15px
      background-color: rgba(0,0,0,0.4)
      backdrop-filter: blur(10px)
      -webkit-backdrop-filter: blur(10px)
      display: flex
      align-items: center
      justify-content: space-between
      gap: 15px

      .desc
        display: inline-block
        overflow: hidden
        max-width: 0px
        transition: .3s
        white-space: nowrap

      &:hover
        .desc
          max-width: 200px

      .info
        display: flex
        flex-direction: column
        align-items: flex-start
        gap: 10px

      span
        font-size: 10px

  .ui 
    width: 100%
    height: 100%
    display: flex

    $side: 370px

    .side
      background-color: rgba(11, 10, 45,0.7) 
      box-shadow: 0 0 10px #000
      padding: 0px
      width: $side
      display: flex
      flex-direction: column
      gap: 20px
      font-size: 12px
      position: absolute
      top: 0
      bottom: 0
      z-index: 2
      transition: transform 0.3s
      backdrop-filter: blur(10px)
      -webkit-backdrop-filter: blur(10px)
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
      width: 40vw
      height: 20vh
      max-width: 300px
      max-height: 200px
      overflow: hidden
      overflow-y: scroll
      justify-content: space-around

      .skin-item
        width: 48px
        height: 48px
        position: relative
        display: flex
        justify-content: center
        align-items: center
        cursor: pointer

        & > .scale
          transform: scale(2.4)

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
        z-index: 12

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
      -webkit-backdrop-filter: blur(5px)
      user-select: none
</style>
