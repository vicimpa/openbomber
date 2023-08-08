<script lang="ts">
  import { PlayerController } from "class/PlayerController";
  import Player from "components/Player.svelte";
  import { connect } from "socket.io-client";
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
  import EditName from "components/EditName.svelte";
  import { socket } from "socket";

  const keys = makeController({
    block: ["KeyE"],
    bomb: ["Space"],
  });

  const api = useApi<TServer>(socket);

  let gamemap: GameMap | null = null;
  let player: PlayerController | null = null;
  let info: TypePlayer["localInfo"] | null = null;
  let gameInfo: TypeGame["info"] | null = null;

  const playerEffect = makeEffect();
  const gameSizeEffect = makeEffect();

  onMount(() => {
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
    });

    return () => {
      socket.disconnect();
    };
  });

  onFrame((deltaTime, time) => {
    if (!player || !gamemap || !info) return;
    const { bomb, block } = keys;
    const { isDeath } = info;

    if (!isDeath) player.tick(deltaTime, time, gamemap);
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

<p>Bombs: {info?.bombs} Radius: {info?.radius} Blocks: {info?.blocks}</p>

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
