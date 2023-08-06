<script lang="ts">
  import { PlayerController } from "class/PlayerController";
  import Player from "components/Player.svelte";
  import { connect } from "socket.io-client";
  import { onFrame } from "library/onFrame";
  import Move from "components/Move.svelte";
  import { makeController } from "library/makeController";
  import { onMount } from "svelte";
  import { forwardApi, useApi } from "socket-api/src/index";
  import type { IPlayer, TPlayer, TServer } from "~server";
  import { isEqual } from "library/isEqual";
  import Game from "components/Game.svelte";
  import { GameMap } from "class/GameMap";

  const keys = makeController({
    block: ["KeyE"],
    bomb: ["Space"],
  });

  const socket = connect(`ws://${location.hostname}:3001`, {
    reconnectionDelay: 500,
    reconnectionDelayMax: 500,
    autoConnect: false,
  });

  const api = useApi<TServer>(socket);

  let gamemap: GameMap | null = null;
  let player: PlayerController | null = null;
  let playerInfo: Omit<IPlayer["data"], "x" | "y"> = {
    name: "",
    dir: 0,
    color: 0,
    animate: 0,
    bombs: 0,
    exp: 0,
  };

  function grid(n: number, grid = 1) {
    return ((n * grid) | 0) / grid;
  }

  function info() {
    return {
      x: grid(player?.x ?? 0, 16),
      y: grid(player?.y ?? 0, 16),
      dir: player?.dir ?? 0,
      animate: player?.animate ?? 0,
    };
  }

  let previewPlayer: ReturnType<typeof info> | null = null;

  onMount(() => {
    socket.connect();

    forwardApi<TPlayer>(socket, {
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
      updatePlayers(newPlayers) {
        if (!gamemap) return;
        gamemap.players = newPlayers;
      },
      setInfo(info) {
        if (player) player.animate = info.animate;
        playerInfo = info;
      },
      setPosition({ x, y }) {
        if (!player) return;
        player.x = x;
        player.y = y;
      },
      updateExposes(newExposes) {
        if (!gamemap) return;
        gamemap.explodes = newExposes;
      },
      updateAchivments(newAchivments) {
        if (!gamemap) return;
        gamemap.achivments = newAchivments;
      },
      setGameInfo(width, height) {
        gamemap = new GameMap(width, height);
        player = new PlayerController(width, height);
      },
    });

    return () => {
      socket.disconnect();
    };
  });

  onFrame((deltaTime, time) => {
    if (!player || !gamemap) return;

    player.tick(deltaTime, time, gamemap);
    player = player;
    gamemap.update();

    if (keys.bomb.isSingle()) {
      api.setBomb();
    }

    const newInfo = info();

    if (!isEqual(newInfo, previewPlayer)) {
      previewPlayer = newInfo;
      const { x, y, dir, animate } = newInfo;
      api.setPosition(x, y, dir, animate);
    }
  });
</script>

<p>Bomb: {playerInfo.bombs}, Expo: {playerInfo.exp}</p>

<Game gamemap={$gamemap}>
  {#if player}
    <Move x={player.x} y={player.y}>
      <Player
        name={playerInfo.name}
        dir={player.dir}
        animate={player.animate}
        color={playerInfo.color}
        marker={"#fff"}
      />
    </Move>
  {/if}
</Game>
