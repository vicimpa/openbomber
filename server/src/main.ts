import genName from "@vicimpa/nick-name";
import Express from "express";
import { Server } from "http";
import { forwardApi, useApi } from "socket-api";
import { Server as SocketIO } from "socket.io";

import { delay } from "./lib/delay";
import { ReactiveSet } from "./lib/ReactiveSet";
import { IAchivment, IBomb, IExplode, IPlayer, TPlayer, TPoint, TServer } from "./types";

const app = Express();
const server = new Server(app);
const socketio = new SocketIO(server, { cors: { origin: '*' } });

const width = 17;
const height = 17;

const map = new Uint8Array(width * height);
const bombs = new ReactiveSet<IBomb>();
const achivments = new ReactiveSet<IAchivment>();
const explodes = new ReactiveSet<IExplode>();
const players = new ReactiveSet<IPlayer>();

const colors = [
  0,
  1,
  2,
  3,
  4,
  5,
  6
];

const positions: TPoint[] = [
  [0, 0],
  [width - 1, 0],
  [width - 1, height - 1],
  [0, height - 1]
];

const dirs: TPoint[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];
const empty = new Set<number>();

enum EAchivments {
  APPEND_BOMB,
  APPEND_EXPO,
  ROLLERS,
  APPEND_SPEED,
  APPEND_LIVE,
  MOVING_BOMB,
  FIRE,
  RANDOM,
}

const achivmentStore = [
  EAchivments.APPEND_BOMB,
  EAchivments.APPEND_EXPO,
  EAchivments.RANDOM,
];

function checkAllow(x: number, y: number) {
  for (const [X, Y] of positions) {
    for (let i = 0; i < 2; i++) {
      for (let [dx, dy] of dirs) {
        let cX = X + dx * i;
        let cY = Y + dy * i;

        if (cX === x && cY === y)
          return false;
      }
    }
  }

  return true;
}

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    let i = x + y * width;
    if (x & 1 && y & 1) {

      map[i] = 1;
      continue;
    }

    if (!checkAllow(x, y))
      continue;

    empty.add(i);
  }
}

const free = new Set(empty);
for (let i = 0; i < map.length * .3; i++) {
  const j = free.size * Math.random() | 0;
  const n = [...free][j];
  free.delete(n);
  map[n] = 2;
}

const achivment = new Set(empty);
const achivmentHave = new Set<number>();

for (let i = 0; i < map.length * .05; i++) {
  const j = achivment.size * Math.random() | 0;
  const n = [...achivment][j];
  map[n] = 2;
  achivment.delete(n);
  achivmentHave.add(n);
}


players.subscribe(() => {
  for (const player of players) {
    player.api.updatePlayers(
      [...players]
        .filter(p => p !== player)
        .map(p => p.data)
    );

    player.api.setInfo(player.data);
  }
});

bombs.subscribe(() => {
  for (const player of players) {
    player.bombs = player.bombs.filter(e => bombs.has(e));
    player.api.updateBombs([...bombs]);
  }
});

explodes.subscribe(() => {
  for (const player of players) {
    player.api.updateExposes([...explodes]);
  }
});

achivments.subscribe(() => {
  for (const player of players) {
    player.api.updateAchivments([...achivments]);
  }
});

function find<T extends object>(collect: Set<T> | T[], condition: Partial<T> | ((v: T, i: number) => boolean)) {
  if (typeof condition === 'object') {
    const data = condition;

    condition = (object) => {
      for (const key in data) {
        if (data[key] !== object[key])
          return false;
      }

      return true;
    };
  }

  let i = 0;

  for (const f of collect) {
    if (condition(f, i++))
      return f;
  }

  return null;
}

function explode(bomb: IBomb) {
  if (bombs.has(bomb)) {
    bombs.delete(bomb);

    const expo: IExplode = {
      time: Date.now(),
      points: []
    };

    expo.points.push([bomb.x, bomb.y, 0, 1]);

    for (let d = 0; d < dirs.length; d++) {
      const [dx, dy] = dirs[d];

      for (let i = 1; i <= bomb.exp; i++) {
        const x = i * dx + bomb.x;
        const y = i * dy + bomb.y;
        const index = x + y * width;
        const bombFind = find(bombs, { x, y });

        const achivmentFind = find(achivments, { x, y });

        if (x < 0 || x > width - 1 || y < 0 || y > height - 1)
          break;

        if (map[index]) {
          if (map[index] == 2) {
            map[index] = 0;
            expo.points.push([x, y, dirs.length + 1, 1]);
            expo.points.push([x, y, d + 1, 1]);

            if (achivmentHave.delete(index)) {
              achivments.add({
                x,
                y,
                value: achivmentStore[achivmentStore.length * Math.random() | 0]
              });
            }
          } else {
            expo.points.slice(-1)[0][3] = 1;
          }

          break;
        }


        if (bombFind) {
          bombFind.time = Date.now() - 1950;
          expo.points.slice(-1)[0][3] = 1;
          break;
        }

        if (achivmentFind) {
          achivments.delete(achivmentFind);
          expo.points.push([x, y, d + 1, 1]);
          break;
        }

        expo.points.push([x, y, d + 1, bomb.exp === i ? 1 : 0]);
      }
    }

    for (const [x, y] of expo.points) {
      const playerFind = find(players, ({ data }: IPlayer) => {
        const X = data.x;
        const Y = data.y;

        return x > X - .7 && x < X + .7 && y > Y - .7 && y < Y + .7;
      });

      if (playerFind) {
        playerFind.data.isDeath = true;
      }
    }

    explodes.add(expo);
    updateMap();
    players.update();
  }
}

function updateMap() {
  for (const player of players) {
    player.api.updateMap([...map] as any);
  }
}

function giveAchivment(n: number, player: IPlayer) {
  switch (n) {
    case EAchivments.APPEND_BOMB: {
      player.data.bombs++;
      break;
    };

    case EAchivments.APPEND_EXPO: {
      player.data.exp++;
      break;
    }

    case EAchivments.RANDOM: {
      giveAchivment(
        achivmentStore[
        (achivmentStore.length - 1) * Math.random() | 0
        ],
        player
      );
      break;
    }
  }
}

async function main() {
  while (true) {
    const time = Date.now();

    for (const bomb of bombs) {
      if (time > bomb.time + 2000) {
        explode(bomb);
      }
    }

    for (const expo of explodes) {
      if (time > expo.time + 500)
        explodes.delete(expo);
    }

    for (const player of players) {
      const x = Math.round(player.data.x);
      const y = Math.round(player.data.y);

      if (player.data.isDeath) {
        if (player.data.animate !== 2) {
          player.data.animate = 2;
          players.update();
        }
      }

      for (const achivment of achivments) {
        const X = achivment.x;
        const Y = achivment.y;

        if (x + 1 > X && x < X + 1 && y + 1 > Y && y < Y + 1) {
          achivments.delete(achivment);
          giveAchivment(achivment.value, player);
          players.update();
        }
      }
    }

    await delay(20);
  }
}

const positionsUse = new Set<TPoint>();
const colorsUse = new Set<number>();

socketio.on('connection', (socket) => {
  const api: TPlayer = useApi<TPlayer>(socket);
  const filterPositions = positions.filter(e => !positionsUse.has(e));
  const filterColors = colors.filter(e => !colorsUse.has(e));

  const position = filterPositions[filterPositions.length * Math.random() | 0];
  const color = filterColors[filterColors.length * Math.random() | 0];

  if (!position)
    return;

  positionsUse.add(position);
  colorsUse.add(color);

  const data: IPlayer['data'] = {
    name: genName(3, 5),
    x: position[0],
    y: position[1],
    color,
    bombs: 1,
    exp: 1,
    dir: 3,
    animate: 0
  };
  const player: IPlayer = { socket, api, data, bombs: [] };

  console.log('Connect', new Date());
  api.setGameInfo(width, height);
  api.setPosition({ x: data.x, y: data.y });

  forwardApi<TServer>(socket, {
    setPosition(x, y, dir, animate) {
      if (data.isDeath)
        return;

      data.x = x;
      data.y = y;
      data.dir = dir;
      data.animate = animate;
      players.update();
    },
    setBomb() {
      let { x, y, isDeath } = data;

      if (isDeath)
        return;

      x = Math.round(x);
      y = Math.round(y);

      const i = x + y * width;
      if (find(bombs, { x, y }))
        return;

      if (map[i])
        return;

      if (data.bombs <= player.bombs.length)
        return;

      const bomb: IBomb = {
        x,
        y,
        exp: data.exp,
        time: Date.now()
      };

      player.bombs.push(bomb);
      bombs.add(bomb);
    },
    setBlock() {

    },
    getTestInfo() {
      return process.argv.join(', ');
    },
    setName(name) {
      player.data.name = name;
      players.update();
    }
  });

  players.add(player);
  updateMap();
  achivments.update();
  bombs.update();

  socket.once('disconnect', () => {
    positionsUse.delete(position);
    players.delete(player);
    colorsUse.delete(color);
    console.log('Disconnect', new Date());
  });
});

main();
server.listen(3001, '0.0.0.0');