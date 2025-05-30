<script lang="ts">
  import { EXTERNAL_LINKS, HOWTOPLAYKEY, OUT_FRAME } from "./config";
  import { onMount } from "svelte";
  import { socket } from "./socket";

  import { NICK_LENGTH, SKINS_COUNT } from "@ob/shared/config";
  import {
    GAME_INFO,
    PLAYER_INFO,
    REMAINING_EFFECTS,
    gameApi,
    playerApi,
  } from "@ob/shared/api";

  import type { TProtoOut } from "@vicimpa/proto";

  import { FocusCamera } from "./class/FocusCamera";
  import { ChatEvent } from "./class/ChatEvent";

  import { sounds } from "./library/sounds";

  import PlayerList from "./components/PlayerList.svelte";
  import Button from "./components/Button.svelte";
  import EditName from "./components/EditName.svelte";
  import Volume from "./components/Volume.svelte";
  import Chat from "./components/Chat.svelte";
  import ChatView from "./components/ChatView.svelte";
  import CanvasRender from "./components/CanvasRender.svelte";
  import Effects from "./components/Effects.svelte";
  import Connect from "./components/Connect.svelte";
  import ExternalLinks from "./components/ExternalLinks.svelte";
  import UserInfo from "./components/UserInfo.svelte";
  import SelectSkin from "./components/SelectSkin.svelte";
  import HowToPlay from "./components/HowToPlay.svelte";
  import { Vec2 } from "@vicimpa/lib-vec2";

  const newApi = gameApi.use(socket);

  let ui: HTMLDivElement | null;

  let info: TProtoOut<typeof PLAYER_INFO> | null = null;
  let gameInfo: TProtoOut<typeof GAME_INFO> | null = null;
  let players: TProtoOut<typeof PLAYER_INFO>[] = [];
  let effects: TProtoOut<typeof REMAINING_EFFECTS> | null = null;
  let name = localStorage.getItem("name") || "";
  let localSkin = +(localStorage.getItem("skin") ?? -1);

  $: {
    if (name[0] === "@") {
      name = name.slice(1);
    }
  }

  let startScreen = !(localStorage.getItem(HOWTOPLAYKEY) ?? "");
  let selectSkin = localSkin < 0;
  let restartAfter = -1;
  let cam: FocusCamera | undefined;
  let isRestarting = false;
  let isOpenEditName = !name;

  const toggleFullScreen = () => {
    if (document.fullscreenElement != ui) ui?.requestFullscreen();
    else document.exitFullscreen();
  };

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
        if (!cam || !cam.focus || !gameInfo) return sounds[sound]?.play();
        const p = new Vec2(position).times(OUT_FRAME);
        const delta = cam
          .cminus(cam.focus)
          .minus(OUT_FRAME / 2)
          .minus(p);

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

  let editingName = false;

  $: if (info && info.name !== name && !editingName && !isOpenEditName) {
    newApi.setName(name);
    localStorage.setItem("name", name);
  }

  $: if (!startScreen) {
    localStorage.setItem(HOWTOPLAYKEY, "1");
  }

  $: if (info && info.skin !== localSkin) {
    if (localSkin >= 0 && localSkin < SKINS_COUNT) {
      newApi.setSkin(localSkin);
      localStorage.setItem("skin", localSkin + "");

      // work with IT
      // newApi.setCustomSkin(customSkin);
      // localStorage.setItem("CustomSkin", customSkin + "");
    }
  }
</script>

<div bind:this={ui} class="ui">
  <div class="side left">
    <div class="scroll">
      <div class="item">
        <Button on:click={() => (startScreen = true)}>Как играть?</Button>
      </div>

      <div class="item">
        <EditName bind:name bind:editName={editingName}>
          <Button on:click={() => (selectSkin = true)}>Аватар</Button>
        </EditName>
      </div>

      {#if gameInfo}
        <div class="item">
          <Connect
            bind:info
            on:connect={() => newApi.toGame()}
            on:disconnect={() => newApi.toLeave()}
          />
        </div>
      {/if}

      <div class="item">
        <Button on:click={toggleFullScreen}>Полный экран</Button>
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
        <ExternalLinks links={EXTERNAL_LINKS} />
      </div>
    </div>
  </div>
  <div class="container">
    {#if gameInfo}
      <UserInfo
        bind:info
        bind:cam
        bind:game={gameInfo}
        on:disconnect={() => newApi.toLeave()}
        on:connect={() => newApi.toGame()}
      />
    {/if}

    <CanvasRender
      {socket}
      bind:cam
      on:setBomb={() => newApi.setBomb()}
      on:setPosition={({ detail }) => newApi.setPosition(detail)}
    />

    <Effects bind:effects />

    {#if !isRestarting && restartAfter >= 0 && restartAfter <= 3}
      <div class="restart-back" />
      <div class="restart">
        <p>Новая игра через {restartAfter} сек</p>
      </div>
    {/if}

    {#if !isRestarting && !isOpenEditName && selectSkin}
      <div class="restart-back" />
      <div class="restart">
        <SelectSkin
          selected={localSkin}
          on:changeSkin={({ detail }) => {
            localSkin = detail;
            selectSkin = false;
          }}
        />
      </div>
    {/if}

    {#if !isRestarting && isOpenEditName}
      <div class="restart-back" />
      <form class="restart" on:submit={() => (isOpenEditName = false)}>
        <p>Введите имя</p>
        <input bind:value={name} maxlength={NICK_LENGTH} />
        <Button disabled={!name} on:click={() => (isOpenEditName = false)}>
          Сохранить
        </Button>
      </form>
    {/if}

    {#if !isRestarting && startScreen && !selectSkin && !isOpenEditName}
      <div class="restart-back" />
      <div class="restart">
        <HowToPlay
          on:submit={() => {
            startScreen = false;
          }}
        />
      </div>
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

<style lang="scss">
  .ui {
    width: 100%;
    height: 100%;
    display: flex;

    $side: 370px;

    .side {
      background-color: rgba(11, 10, 45, 0.7);
      box-shadow: 0 0 10px #000;
      padding: 0px;
      width: $side;
      display: flex;
      flex-direction: column;
      gap: 20px;
      font-size: 12px;
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 2;
      transition: transform 0.3s;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 11;
      user-select: none;

      .scroll {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        overflow-y: scroll;
      }
      &:after {
        display: block;
        position: absolute;
        width: 30px;
        height: 100px;
        top: 0;
        bottom: 0;
        margin: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(100, 100, 100, 0.5);
        border-radius: 100px;
        font-size: 20px;
      }
      &.left {
        left: 0;
        transform: translateX(-$side + 15px);

        &:after {
          content: "🕹️";
          right: -15px;
        }
      }
      &.right {
        right: 0;
        transform: translateX($side - 15px);

        &:after {
          content: "💬";
          left: -15px;
        }
      }
      &:hover {
        transform: translateX(0);
      }
      .item {
        background-color: rgba(0, 0, 0, 0.3);
        padding: 10px;
        position: relative;
        display: flex;
        flex-direction: column;
      }
    }
    .container {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      justify-content: center;
      align-items: center;

      .restart {
        position: absolute;
        margin: auto;
        background-color: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 20px 50px;
        font-size: 30px;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        z-index: 12;
      }
      .restart-back {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1;
      }
    }
  }
</style>
