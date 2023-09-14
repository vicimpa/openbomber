import { Socket } from "socket.io";
import { createLogger } from "vite";

import { calcMap } from "../../core/calcMap";
import { effectObject } from "../../core/effectObject";
import { find } from "../../core/find";
import { map } from "../../core/map";
import { min } from "../../core/math";
import { pick } from "../../core/pick";
import { point } from "../../core/point";
import { random } from "../../core/random";
import { Vec2 } from "../../core/Vec2";
import { MAX_PLAYERS, WAIT_FOR_LIMIT, ZONELIMIT_TIMEOUT } from "../../shared/config";
import { EMapItem, ESounds } from "../../shared/types";
import { IS_DEV } from "../env";
import { Achivment } from "./Achivment";
import { Bomb } from "./Bomb";
import { Effect } from "./Effect";
import { Entity } from "./Entity";
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
  width = 1;
  height = 1;

  #settings: TConfig;
  lastLimit = 0;
  time = performance.now();

  map!: GameMap;
  bombs = new Set<Bomb>();
  explodes = new Set<Explode>();
  achivments = new Set<Achivment>();
  players = new Set<Player>();
  effects = new Set<Effect>();
  nextSize = new Vec2();

  startPositions: Vec2[] = [];
  usedPositions = new Set<Vec2>();

  running = false;
  winPlayerId: Player['id'] = -1;

  waitForRestart = -1;

  bombsCounter!: number;
  explodesCounter!: number;
  achivmentsCounter!: number;
  effectsCounter!: number;
  slotLimits = MAX_PLAYERS;

  timerLimit = -1;
  limitedMap = 1;

  isHaveWin = false;
  kills = 0;

  infoCache: Game['info'] = this.info;
  mapCache: number[] = [];
  bombsCache: Bomb['info'][] = [];
  explodesCahce: Explode['info'][] = [];
  achivmentsCache: Achivment['info'][] = [];
  effectsCache: Effect['info'][] = [];
  effectsTypeCache: Effect['infoType'][] = [];

  get currentLimited() {
    return this.timerLimit > 0 ? this.limitedMap : -1;
  }

  get info() {
    return pick(this, [
      'width',
      'height',
      'winPlayerId',
      'playersCount',
      'livePlayersCount',
      'spectratorsCount',
      'currentLimited',
    ]);
  }

  getFreePosition() {
    const free = Array.from(this.startPositions)
      .filter(e => !this.usedPositions.has(e));
    const position = random(free);
    this.usedPositions.add(position);
    return position;
  }

  releasePosition(position: Vec2) {
    this.usedPositions.delete(position);
  }

  get spectratorsCount() { return map(this.players, e => e, e => !e.inGame).length; }
  get playersCount() { return map(this.players, e => e, e => e.inGame).length; }
  get livePlayersCount() { return map(this.players, e => e, e => e.inGame && !e.isDeath).length; }

  get settings() {
    return { ...this.#settings };
  }

  constructor(
    settings?: Partial<TConfig>
  ) {
    this.#settings = { ...defaultConfig, ...settings };
    this.restart();
  }

  restart() {
    const { size, positions } = calcMap(this.playersCount);

    this.isHaveWin = this.playersCount > 1;

    if (!size.equal(this.width, this.height)) {
      this.width = size.x;
      this.height = size.y;
      this.startPositions = positions;
      this.message('Размер карты был изменен');
    }

    this.waitForRestart = -1;

    for (const player of this.players) {
      if (!player.inGame) continue;
      player.reset();
    }

    this.bombs.clear();
    this.achivments.clear();
    this.explodes.clear();
    this.effects.clear();
    this.map = new GameMap(this);
    this.map.generate(this.settings);

    this.winPlayerId = -1;
    this.bombsCounter = 0;
    this.effectsCounter = 0;
    this.explodesCounter = 0;
    this.achivmentsCounter = 0;
    this.kills = 0;
    this.limitedMap = 1;
    this.timerLimit = -1;
    this.lastLimit = Date.now();
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
    this.restart();
    this.loop()
      .catch(console.error);
  }

  stop() {
    if (!this.running) return;
    logger.info('Game stoping', { timestamp: true });
    this.running = false;
  }

  async loop() {
    const tick = () => {
      if (this.running) {
        setTimeout(tick, 1000 / 60);
      }

      const { players, playersCount } = this;
      const time = performance.now();
      const dtime = time - this.time;
      this.time = time;

      effectObject(
        this,
        'playersCount',
        this.playersCount,
        count => {
          logger.info('Players count ' + count, { timestamp: true });

          if (this.isHaveWin && count < 2 && !this.kills)
            this.isHaveWin = false;
        }
      );

      for (const bomb of this.bombs as Set<Entity>) {
        bomb.update(dtime, time);
      }

      for (const explode of this.effects as Set<Entity>) {
        explode.update(dtime, time);
      }

      for (const explode of this.explodes as Set<Entity>) {
        explode.update(dtime, time);
      }

      for (const achivment of this.achivments as Set<Entity>) {
        achivment.update(dtime, time);
      }

      for (const player of this.players as Set<Entity>) {
        player.update(dtime, time);
      }

      this.mapCache = [...this.map];
      this.infoCache = this.info;
      this.bombsCache = [...this.bombs].map(e => e.info);
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
        playersCount && this.livePlayersCount <= +!!(playersCount - 1),
        (isRestart) => {
          if (isRestart) {
            logger.info("Wait restart", { timestamp: true });
            this.waitForRestart = Date.now() + (IS_DEV || playersCount == 1 ? 0 : 5000);
          } else {
            if (this.waitForRestart > 0) {
              logger.info("Cancel restart", { timestamp: true });
            }
            this.waitForRestart = -1;
          }
        }
      );

      if (this.isHaveWin && this.livePlayersCount < 2 && !this.explodes.size) {
        const winPlayer = find(this.players, e => e.inGame && !e.isDeath);
        if (winPlayer) {
          winPlayer.wins++;
          winPlayer.newApi.playSound(ESounds.win);
          this.winPlayerId = winPlayer.id;
          this.message(`${winPlayer.name} победил`);
        } else {
          this.message(`Никто не выиграл`);
        }
        this.isHaveWin = false;
      }

      if (this.waitForRestart > 0) {
        if (Date.now() > this.waitForRestart + 500) {
          logger.info("Restart", { timestamp: true });
          this.restart();
        }
      }

      effectObject(
        this,
        'clearMap',
        this.map.findIndex(e => e == EMapItem.BLOCK) == -1 && playersCount <= 1 && this.achivments.size === 0 && this.waitForRestart === -1,
        (value) => {
          logger.info(`Change value ${value}`, { timestamp: true });
          if (value)
            this.waitForRestart = Date.now();
        }
      );

      effectObject(
        this,
        'limitMap',
        (
          true
          && this.lastLimit + WAIT_FOR_LIMIT < Date.now()
          && this.waitForRestart == -1
          && this.playersCount > 1
          && this.limitedMap < (min(this.width, this.height) / 2 - 1)
        ),
        (value) => {
          if (value && this.timerLimit == -1) {
            this.timerLimit = Date.now() + ZONELIMIT_TIMEOUT;
            this.message(`Уменьшение размера карты через ${ZONELIMIT_TIMEOUT / 1000 | 0} сек`);
          }
          if (!value && this.timerLimit > 0) {
            this.timerLimit = -1;
            this.message(`Уменьшение размера карты отменено`);
          }
        }
      );

      effectObject(
        this,
        'limitMapExec',
        this.timerLimit > 0 && this.timerLimit < Date.now(),
        (value) => {
          if (value) {
            this.lastLimit = Date.now();
            this.timerLimit = -1;
            this.map.limit(this.limitedMap++);
          }
        }
      );
    };

    tick();
  }
}