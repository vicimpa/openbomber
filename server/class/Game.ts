import { Socket } from "socket.io";
import { createLogger } from "vite";

import { delay } from "../lib/delay";
import { effectObject } from "../lib/effectObject";
import { find } from "../lib/find";
import { map } from "../lib/map";
import { pick } from "../lib/pick";
import { random } from "../lib/random";
import { Achivment } from "./Achivment";
import { Bomb } from "./Bomb";
import { Explode } from "./Explode";
import { GameMap } from "./GameMap";
import { Player } from "./Player";

import type { TPoint } from "../../src/types";

const logger = createLogger('info', { allowClearScreen: true });

export const defaultConfig = {
  fillBlocks: .5,
  fillAchivments: .1,
  startExplodeRadius: 1,
  startBombsCount: 1,
  startLiveCount: 1,
};

export type TConfig = typeof defaultConfig;

export class Game {
  #settings: TConfig;

  map!: GameMap;
  bombs = new Set<Bomb>();
  explodes = new Set<Explode>();
  achivments = new Set<Achivment>();
  players = new Set<Player>();

  startPositions: TPoint[];
  usedPositions = new Set<TPoint>();

  running = false;

  waitForRestart = -1;

  getFreePosition() {
    const free = this.startPositions
      .filter(e => !this.usedPositions.has(e));
    const position = random(free);
    this.usedPositions.add(position);
    return position;
  }

  releaseFreePosition(position: TPoint) {
    this.usedPositions.delete(position);
  }

  get playersCount() { return this.players.size; }

  get settings() {
    return { ...this.#settings };
  }

  constructor(
    public width: number,
    public height: number,
    settings?: Partial<TConfig>
  ) {
    this.startPositions = [
      [0, 0],
      [width - 1, 0],
      [width - 1, height - 1],
      [0, height - 1]
    ];
    this.#settings = { ...defaultConfig, ...settings };
    this.restart();
  }

  restart() {
    const { width, height } = this;

    this.waitForRestart = -1;

    for (const player of this.players) {
      const { startPosition } = player;
      player.isDeath = false;
      player.blocks = 0;
      player.bombs = 1;
      player.radius = 1;
      [player.x, player.y] = startPosition;
      effectObject(player, 'startPosition', [-1, -1], () => { });
    }

    this.bombs.clear();
    this.achivments.clear();
    this.explodes.clear();

    this.map = new GameMap(width, height, this);
    this.map.generate(this.settings);
  }

  join(socket: Socket) {
    let player = find(this.players, { socket });
    if (player) return;
    player = new Player(this, socket);
    player.connect();
    this.players.add(player);
  }

  leave(socket: Socket) {
    const player = find(this.players, { socket });
    if (!player) return;
    this.players.delete(player);
    player.disconnect();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop()
      .catch(console.error);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
  }

  get info() {
    return pick(this, [
      'width',
      'height',
      'playersCount'
    ]);
  }

  async loop() {
    while (this.running) {

      effectObject(
        this,
        'playersCount',
        this.playersCount,
        count => {
          logger.info('Players count ' + count);
        }
      );

      for (const explode of this.explodes) {
        explode.update();
      }

      for (const bomb of this.bombs) {
        bomb.update();
      }

      for (const achivment of this.achivments) {
        achivment.update();
      }

      for (const player of this.players) {
        player.update();
      }

      effectObject(
        this,
        'restartGame',
        map(this.players, e => e, e => !e.isDeath).length <= (this.players.size > 1 ? 1 : 0),
        (isRestart) => {
          if (isRestart) {

            this.waitForRestart = Date.now() + 3000;
          } else {
            this.waitForRestart = -1;
          }
        }
      );

      if (this.waitForRestart > 0) {
        if (Date.now() > this.waitForRestart) {
          this.restart();
        }
      }

      await delay(20);
    }
  }
}