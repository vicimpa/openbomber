import { Socket } from "socket.io";
import { createLogger } from "vite";

import { delay } from "../../core/delay";
import { effectObject } from "../../core/effectObject";
import { find } from "../../core/find";
import { map } from "../../core/map";
import { pick } from "../../core/pick";
import { point } from "../../core/point";
import { random } from "../../core/random";
import { Vec2, vec2 } from "../../core/Vec2";
import { ESounds } from "../../shared/types";
import { IS_DEV } from "../env";
import { Achivment } from "./Achivment";
import { Bomb } from "./Bomb";
import { Effect } from "./Effect";
import { Explode } from "./Explode";
import { GameMap } from "./GameMap";
import { Player } from "./Player";

const logger = createLogger('info', { allowClearScreen: true });

export const defaultConfig = {
  fillBlocks: .5,
  fillAchivments: .1,
  startExplodeRadius: 1,
  startBombsCount: 1,
  startLiveCount: 1,
};

export const defaultStartPositions: Vec2[] = [
  point(0, 0),
  point(1, 0),
  point(1, 1),
  point(0, 1)
];

export type TConfig = typeof defaultConfig;

export class Game {
  #settings: TConfig;

  map!: GameMap;
  bombs = new Set<Bomb>();
  explodes = new Set<Explode>();
  achivments = new Set<Achivment>();
  players = new Set<Player>();
  effects = new Set<Effect>();
  nextSize = new Vec2();

  startPositions: Vec2[];
  usedPositions = new Set<number>();

  playerColors: number[] = [];
  usedColors = new Set<number>();

  running = false;
  kills = 0;
  winPlayerId: Player['id'] = -1;

  waitForRestart = -1;

  infoCache: Game['info'] = this.info;
  mapCache: number[] = [];
  bombsCache: Bomb['info'][] = [];
  explodesCahce: Explode['info'][] = [];
  achivmentsCache: Achivment['info'][] = [];
  effectsCache: Effect['info'][] = [];
  effectsTypeCache: Effect['infoType'][] = [];

  getFreePosition() {
    const free = Array.from({ length: this.startPositions.length }, (_, i) => i)
      .filter(e => !this.usedPositions.has(e));
    const position = random(free);
    this.usedPositions.add(position);
    return position;
  }

  getFreeColor() {
    const free = Array.from({ length: this.playerColors.length }, (_, i) => i)
      .filter(e => !this.usedColors.has(e));

    const color = random(free);
    this.usedColors.add(color);
    return color;
  }

  releasePosition(position: number) {
    this.usedPositions.delete(position);
  }

  releaseColor(color: number) {
    this.usedColors.delete(color);
  }

  get spectratorsCount() { return map(this.players, e => e, e => !e.inGame).length; }
  get playersCount() { return map(this.players, e => e, e => e.inGame).length; }
  get slotLimits() { return this.startPositions.length; }

  get settings() {
    return { ...this.#settings };
  }

  constructor(
    public width: number,
    public height: number,
    settings?: Partial<TConfig>,
    startPositions: Vec2[] = defaultStartPositions
  ) {
    this.nextSize.set(width, height);
    this.#settings = { ...defaultConfig, ...settings };
    this.startPositions = startPositions
      .map((point) => point.times(width - 1, height - 1).floor())
      .map((point) => vec2(point, (x, y) => {
        if (x & 1) point.x -= 1;
        if (y & 1) point.y -= 1;
        return point;
      }));

    for (let i = 0; i < 10; i++)
      this.playerColors.push(i);

    this.restart();
  }

  restart() {
    const { x: width, y: height } = this.nextSize;

    this.width = width;
    this.height = height;

    this.waitForRestart = -1;

    for (const player of this.players) {
      if (!player.inGame) continue;
      player.reset();
    }

    this.bombs.clear();
    this.achivments.clear();
    this.explodes.clear();
    this.effects.clear();
    this.kills = 0;
    this.map = new GameMap(this);
    this.map.generate(this.settings);
    this.winPlayerId = -1;
  }

  message(message: string, sender?: Player) {
    if (IS_DEV) {
      const find = /(\d+)x(\d+)/.exec(message);
      if (find) {
        const [, width, height] = find;
        this.nextSize.set(+width, +height);
        this.waitForRestart = 3000;
      }
    }

    for (const player of this.players) {
      player.newApi.playSound(ESounds.message);

      player.newApi.onMessage({
        message,
        sender: sender instanceof Player ? ({ name: sender.name }) : ({ name: 'server' }),
        isMe: sender === player
      });
    }
  }

  join(socket: Socket) {
    let player = find(this.players, { socket });
    if (player) return;
    player = new Player(this, socket);
    player.connect();
    this.players.add(player);
    this.start();
  }

  leave(socket: Socket) {
    const player = find(this.players, { socket });
    if (!player) return;
    this.players.delete(player);
    player.disconnect();
    if (!this.players.size)
      this.stop();
  }

  start() {
    if (this.running) return;
    this.running = true;
    logger.info('Game starting', { timestamp: true });
    this.loop()
      .catch(console.error);
  }

  stop() {
    if (!this.running) return;
    logger.info('Game stoping', { timestamp: true });
    this.running = false;
  }

  get info() {
    return pick(this, [
      'width',
      'height',
      'winPlayerId',
      'playersCount',
      'spectratorsCount'
    ]);
  }

  async loop() {
    while (this.running) {
      const { players, playersCount } = this;

      effectObject(
        this,
        'playersCount',
        this.playersCount,
        count => {
          logger.info('Players count ' + count, { timestamp: true });
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

      this.mapCache = [...this.map];
      this.infoCache = this.info;
      this.bombsCache = [...this.bombs];
      this.achivmentsCache = [...this.achivments];
      this.explodesCahce = [...this.explodes];
      this.effectsCache = [...this.effects];
      this.effectsTypeCache = map(this.effects, e => e.infoType);

      for (const player of this.players) {
        player.sendInfo();
      }

      effectObject(
        this,
        'restartGame',
        playersCount && map(
          players,
          e => e,
          e => !e.isDeath && e.inGame
        ).length <= +!!(playersCount - 1),
        (isRestart) => {
          if (isRestart) {
            logger.info("Wait restart", { timestamp: true });
            this.waitForRestart = Date.now() + (IS_DEV ? 0 : 5000);

            if (this.playersCount > 1 && this.kills > 0) {
              const winPlayer = find(this.players, e => e.inGame && !e.isDeath);
              if (winPlayer) {
                winPlayer.wins++;
                winPlayer.newApi.playSound(ESounds.win);
                this.winPlayerId = winPlayer.id;
                this.message(`${winPlayer.name} победил`);
              } else {
                this.message(`Никто не выиграл`);
              }
            }
          } else {
            if (this.waitForRestart > 0) {
              logger.info("Cancel restart", { timestamp: true });
            }
            this.waitForRestart = -1;
          }
        }
      );

      if (this.waitForRestart > 0) {
        if (Date.now() > this.waitForRestart + 500) {
          logger.info("Restart", { timestamp: true });
          this.restart();
        }
      }

      await delay(1000 / 60);
    }
  }
}