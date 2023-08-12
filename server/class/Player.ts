import { Socket } from "socket.io";

import { MESSAGE_LENGTH, NICK_LENGTH, PLAYER_TIMEOUT } from "../../src/config";
import { forwardApi, useApi } from "../../src/library/socketApi";
import { PlayerPositionsProto } from "../../src/proto";
import { EAnimate, EDir, EEffect } from "../../src/types";
import { IS_DEV } from "../env";
import { effectObject } from "../lib/effectObject";
import { find } from "../lib/find";
import { map } from "../lib/map";
import { pick } from "../lib/pick";
import { Bomb } from "./Bomb";
import { BombEffect } from "./BombEffect";
import { CrasyBombEffect } from "./CrasyBombEffect";
import { Effect } from "./Effect";
import { Entity } from "./Entity";
import { Game } from "./Game";
import { PlayerEffect } from "./PlayerEffect";
import { RadiusEffect } from "./RadiusEffect";
import { ShieldEffect } from "./ShieldEffect";
import { SpeedEffect } from "./SpeedEffect";

import type { TPlayer, TPoint, TServer } from "../../src/types";
export class Player extends Entity {
  #id = -1;
  api!: TPlayer;
  unforward?: () => {};

  isDeath = false;

  dir = EDir.BOTTOM;
  #animate = EAnimate.IDLE;

  get id() { return this.#id; }
  get inGame() { return this.#id !== -1; };
  get canJoin() { return this.game.slotLimits > this.game.playersCount; }
  get animate() { return this.isDeath ? EAnimate.DEATH : this.#animate; }
  set animate(v) { this.#animate = v; }
  get startPosition(): TPoint | undefined { return this.game.startPositions[this.#id]; };

  name = '';
  color = -1;

  get effects() {
    return {
      bombs: BombEffect.count(this) + 1,
      radius: RadiusEffect.count(this) + 1,
      haveShield: ShieldEffect.hasShield(this),
      speed: SpeedEffect.getValue(this),
      crazyBomb: CrasyBombEffect.hasCrasyBomb(this),
    };
  }

  kills = 0;
  deaths = 0;

  lastAction = Date.now();

  get posInfo() {
    return pick(
      this,
      [
        'id',
        'x',
        'y',
        'dir',
        'animate',
      ]
    );
  }

  get info() {
    return pick(this, [
      'id',
      'name',
      'color',
      'inGame',
      'isDeath',
      'canJoin',
      'kills',
      'deaths',
      'effects',
      'color'
    ]);
  }

  get chatInfo() {
    return pick(this, [
      'name',
      'color',
      'inGame',
      'isDeath'
    ]);
  }

  constructor(
    game: Game,
    public socket: Socket
  ) {
    super(game, 0, 0);
    this.api = useApi<TPlayer>(socket);
    if (IS_DEV)
      this.methods.toGame();
  }

  methods: TServer = {
    randomColor: () => {
      this.randomColor();
    },
    sendMessage: (message) => {
      if (!message) return;
      message = message.slice(0, MESSAGE_LENGTH);
      this.game.message(message, this);
    },

    setBomb: () => {
      if (this.isDeath) return;

      const { bombs } = this.game;
      const newBomb = new Bomb(this, CrasyBombEffect.hasCrasyBomb(this));
      const { x, y } = newBomb;

      if (find(bombs, { x, y }))
        return;

      if (map(bombs, e => e, e => e.player === this).length >= this.effects.bombs)
        return;

      bombs.add(newBomb);
    },

    setPosition: (x: number, y: number, dir: EDir, animate: EAnimate) => {
      if (this.isDeath && !this.inGame) return;
      if (Math.sqrt((this.x - x) ** 2 + (this.y - y) ** 2) > 1) {
        this.api.setStartPosition(this.x, this.y);
        return;
      }

      this.lastAction = Date.now();
      this.x = (x * 16 | 0) / 16;
      this.y = (y * 16 | 0) / 16;
      this.dir = dir;
      this.animate = animate;
    },

    setName: (name: string) => {
      if (!name) return;
      this.name = name.slice(0, NICK_LENGTH);
    },

    toGame: () => {
      if (this.#id >= 0) return;
      this.randomPosition();
      if (this.#id === -1) return;
      this.isDeath = true;
      this.kills = 0;
      this.deaths = 0;
      this.lastAction = Date.now();
      PlayerEffect.clearEffets(this);
      this.randomColor();
      this.game.message(`${this.name} подключился`);
    },

    toLeave: () => {
      if (!this.startPosition) return;
      this.game.releasePosition(this.#id);
      this.game.releaseColor(this.color);
      this.#id = -1;
      this.color = -1;
      this.game.message(`${this.name} отключился`);
    }
  };

  reset() {
    const { startPosition } = this;
    this.isDeath = false;
    this.lastAction = Date.now();
    this.randomPosition();
    PlayerEffect.clearEffets(this);

    if (startPosition) {
      [this.x, this.y] = startPosition;
      effectObject(this, 'startPosition', [-1, -1], () => { });
    }
  }

  death(player?: Player) {
    if (this.isDeath) return;
    this.isDeath = true;
    this.api.actionDeath();
    this.game.effects.add(
      new Effect(this, EEffect.DEATH)
    );

    if (player) {
      this.deaths++;
      this.game.kills++;

      if (player !== this)
        player.kills++;
    }

    if (player) {
      const target = player === this ? 'самоубился' : `убит ${player.name}`;
      this.game.message(`${this.name} ${target}`);
    }
  }

  randomPosition() {
    if (this.startPosition) {
      this.game.releasePosition(this.#id);
    }

    this.#id = this.game.getFreePosition();
  }

  randomColor() {
    if (this.color !== -1)
      this.game.releaseColor(this.color);

    this.color = this.game.getFreeColor();
  }

  connect() {
    if (this.unforward) {
      this.unforward();
      delete this.unforward;
    }

    forwardApi<TServer>(this.socket, this.methods);
  }

  disconnect() {
    this.methods.toLeave();
    this.unforward?.();
  }

  checkCollision(X: number, Y: number, over = 1) {
    const { x, y } = this;
    return x < X + over && x > X - over && y < Y + over && y > Y - over;
  }

  update() {
    const {
      bombs,
      explodes,
      achivments,
      players,
      info,
      map: {
        info: gameMap
      }
    } = this.game;
    if (!this.isDeath && this.inGame) {
      for (const effect of PlayerEffect.effects(this))
        effect.update();
    }

    if (!this.isDeath && this.inGame)
      effectObject(
        this,
        'timeout',
        Date.now() - this.lastAction > PLAYER_TIMEOUT && !this.isDeath && !IS_DEV,
        (result) => {
          if (result)
            this.methods.toLeave();
        }
      );

    if (!this.isDeath && this.inGame) {
      if (this.effects.speed >= 1) {
        for (const player of this.game.players) {
          if (player === this || !player.inGame || player.isDeath)
            continue;

          if (player.effects.speed >= 1)
            continue;

          if (this.checkCollision(player.x, player.y, 1))
            this.death(player);
        }
      }

      for (const explode of explodes) {
        if (this.isDeath || explode.ignore.has(this)) continue;

        for (const { x, y } of explode.points) {
          if (this.isDeath) continue;

          if (this.checkCollision(x, y, .6)) {
            if (this.effects.haveShield) {
              ShieldEffect.delete(this);
              explode.ignore.add(this);
              continue;
            }

            this.death(explode.player);

          }
        }
      }
    }

    if (!this.isDeath && this.inGame) {
      for (const achivment of achivments) {
        const { x, y } = achivment;
        if (this.checkCollision(x, y, .9)) {
          achivment.accept(this);
          achivments.delete(achivment);
        }
      }
    }

    effectObject(
      this,
      'gameInfo',
      info,
      info => {
        this.api.updateGameInfo(info);
      }
    );

    effectObject(
      this,
      'waitForRestart',
      this.game.waitForRestart > 0 ? (this.game.waitForRestart - Date.now()) / 1000 | 0 : -1,
      time => {
        this.api.updateWaitForRestart(time);
      }
    );

    if (this.inGame && !this.isDeath)
      effectObject(
        this,
        'startPosition',
        this.startPosition ?? [0, 0],
        ([x, y]) => {
          this.x = x;
          this.y = y;
          this.api.setStartPosition(x, y);
        }
      );

    effectObject(
      this,
      'localInfo',
      this.info,
      localInfo => {
        this.api.updateLocalInfo(localInfo);
      }
    );

    effectObject(
      this,
      'map',
      new Uint8Array(gameMap),
      map => {
        this.api.updateMap(map.buffer);
      }
    );

    effectObject(
      this,
      'effects',
      map(this.game.effects, ({ x, y, type }) => ({ x, y, type })),
      () => {
        this.api.updateEffects(map(this.game.effects, e => e.info));
      }
    );

    effectObject(
      this,
      'bombs',
      map(bombs, e => e.info),
      bombs => {
        this.api.updateBombs(bombs);
      }
    );

    effectObject(
      this,
      'explodes',
      map(explodes, e => e.info),
      explodes => {
        this.api.updateExposes(explodes);
      }
    );

    effectObject(
      this,
      'achivments',
      map(achivments, e => e.info),
      achivments => {
        this.api.updateAchivments(achivments);
      }
    );

    effectObject(
      this,
      'players',
      map(players, e => e.info, (e, d) => e !== this && d.inGame),
      players => {
        this.api.updatePlayers(players);
      }
    );

    effectObject(
      this,
      'positions',
      PlayerPositionsProto.to(
        map(players, e => e.posInfo, (e, d) => e !== this && d.id !== -1)
      ),
      positions => {
        this.api.updatePlayerPositions(positions);
      }
    );
  }
}