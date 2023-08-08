import { TPoint } from "@root/types";
import { Socket } from "socket.io";

import { delay } from "../lib/delay";
import { effectObject } from "../lib/effectObject";
import { find } from "../lib/find";
import { pick } from "../lib/pick";
import { random } from "../lib/random";
import { Achivment } from "./Achivment";
import { Bomb } from "./Bomb";
import { Explode } from "./Explode";
import { GameMap } from "./GameMap";
import { Player } from "./Player";

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

  map: GameMap;
  bombs = new Set<Bomb>();
  explodes = new Set<Explode>();
  achivments = new Set<Achivment>();
  players = new Set<Player>();

  startPositions: TPoint[];
  usedPositions = new Set<TPoint>();

  running = false;

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
    this.map = new GameMap(width, height, this);
    this.startPositions = [
      [0, 0],
      [width - 1, 0],
      [width - 1, height - 1],
      [0, height - 1]
    ];
    this.#settings = { ...defaultConfig, ...settings };
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
          console.log(new Date(), 'Players count', count);
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

      await delay(20);
    }
  }
}