<script lang="ts">
  import { Vec2 } from "core/Vec2";
  import { INPUT_POSITION, playerApi } from "shared/api";
  import { point } from "core/point";
  import { Application } from "class/Application";
  import { Background } from "class/Background";
  import { FocusCamera } from "class/FocusCamera";
  import { Game } from "class/Game";
  import Controller from "./Controller.svelte";
  import { createEventDispatcher, onMount } from "svelte";
  import { updateIdMap } from "library/updateIdMap";
  import type { Socket } from "socket.io-client";
  import { PlayerControllerNew } from "class/PlayerControllerNew";
  import type { TProtoOut } from "core/Proto";
  import { onFrame } from "library/onFrame";
  import type { PlayerSprite } from "class/PlayerSprite";

  export let socket: Socket;
  export let view: PlayerSprite | null = null;
  export let viewCount = 0;

  const dispatch = createEventDispatcher<{
    setBomb: void;
    setPosition: TProtoOut<typeof INPUT_POSITION>;
  }>();

  let canvas: HTMLCanvasElement;
  let move = new Vec2();
  let state = {
    inGame: false,
  };

  const app = new Application(true);
  const back = new Background(256, 256);

  let game = new Game();
  export let cam: FocusCamera | undefined;

  onMount(() => {
    socket.disconnect();
    socket.connect();

    const unforward = playerApi.forward(socket, {
      updateGameInfo({ width, height, currentLimited }) {
        const position = point(width, height).div(-2).floor().times(16).plus(0);
        game.set(position);

        game.width = width;
        game.height = height;

        game.focusCamera = cam;
        game.appendTo(app);
        game.mapLayer.limit = currentLimited;

        game.updatePosition = (x, y, dir, animate) => {
          dispatch("setPosition", { x, y, dir, animate });
        };
      },

      setStartPosition({ x, y }) {
        game.currentPlayer = new PlayerControllerNew(game);
        game.currentPlayer.set({ x, y });
        game.currentPlayer.move = move;
      },
      updateMap(map) {
        game.newRender = new Uint8Array(map);
      },
      updatePlayers(players) {
        updateIdMap(players, game.players);
      },
      updatePlayerPositions(positions) {
        updateIdMap(positions, game.positions);
      },
      updateAchivments(achivments) {
        updateIdMap(achivments, game.achivments);
      },
      updateBombs(bombs) {
        updateIdMap(bombs, game.bombs);
      },
      updateEffects(effects) {
        updateIdMap(effects, game.effects);
      },
      updateExplodes(explodes) {
        updateIdMap(explodes, game.explodes);
      },
      updateLocalInfo(info) {
        game.localInfo = info;
        const { isDeath, inGame, effects } = info;
        state.inGame = inGame;
        if (!inGame || isDeath) delete game.currentPlayer;
        if (game.currentPlayer) game.currentPlayer.speedMulti = effects.speed;
      },
      updateWaitForRestart(restart) {
        game.waitRestart = restart;
      },
    });

    cam = new FocusCamera(canvas, 8);
    cam.s = 2;
    app.cameras.add(cam);
    back.appendTo(app);
    game.appendTo(app);

    return () => {
      app.cameras.clear();
      app.children.clear();
      cam = undefined;
      unforward();
    };
  });

  onFrame(() => {
    game.viewCount = viewCount;
    view = game.focusPlayer ?? null;
  });
</script>

<div class="container">
  <canvas class="canvas" bind:this={canvas} />
  <Controller
    inGame={state.inGame}
    bind:move
    on:bomb={() => dispatch("setBomb")}
  />
</div>

<style lang="sass">
  .container
    position: relative
    width: 100%
    height: 100%
    display: flex
    justify-content: center
    align-items: center

    .canvas
      image-rendering: pixelated
      position: absolute
</style>
