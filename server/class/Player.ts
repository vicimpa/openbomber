import { Socket } from "socket.io";

import { MESSAGE_LENGTH, NICK_LENGTH, PLAYER_TIMEOUT } from "../../src/config";
import { forwardApi, useApi } from "../../src/library/socketApi";
import { EAnimate, EDir } from "../../src/types";
import { effectObject } from "../lib/effectObject";
import { find } from "../lib/find";
import { map } from "../lib/map";
import { pick } from "../lib/pick";
import { Bomb } from "./Bomb";
import { Entity } from "./Entity";
import { Game } from "./Game";

import type { TPlayer, TPoint, TServer } from "../../src/types";

export class Player extends Entity {
  api!: TPlayer;
  unforward?: () => {};

  get inGame() { return !!this.startPosition; };
  isDeath = false;

  dir = EDir.BOTTOM;
  #animate = EAnimate.IDLE;

  get canJoin() { return this.game.slotLimits > this.game.playersCount; }
  get animate() { return this.isDeath ? EAnimate.DEATH : this.#animate; }
  set animate(v) { this.#animate = v; }

  name = '';
  color = 0;

  bombs = 1;
  radius = 1;
  blocks = 0;

  isAnimated = false;
  startPosition!: TPoint;
  lastAction = Date.now();

  get info() {
    return pick(this, [
      'x',
      'y',
      'dir',
      'animate',
      'name',
      'color',
      'inGame',
      'isDeath',
      'bombs',
      'radius',
      'isAnimated',
      'blocks'
    ]);
  }

  get localInfo() {
    return pick(this, [
      'name',
      'color',
      'inGame',
      'isDeath',
      'bombs',
      'radius',
      'isAnimated',
      'blocks',
      'canJoin'
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
  }

  methods: TServer = {
    setBlock: () => {
      if (this.isDeath) return;
      if (!this.blocks) return;
      let x = Math.round(this.x);
      let y = Math.round(this.y);

      const { game: { width, map, bombs, players } } = this;

      const index = x + y * width;

      if (map[index])
        return;

      if (find(bombs, { x, y }))
        return;

      if (find(players, e => e != this && e.checkCollision(x, y, .8)))
        return;

      map[index] = 2;
      this.blocks--;
    },

    sendMessage: (message) => {
      if (!message) return;
      message = message.slice(0, MESSAGE_LENGTH);
      this.game.message(message, this);
    },

    setBomb: () => {
      if (this.isDeath) return;

      const { bombs } = this.game;
      const newBomb = new Bomb(this);
      const { x, y } = newBomb;

      if (find(bombs, { x, y }))
        return;

      if (map(bombs, e => e, e => e.player === this).length >= this.bombs)
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
      if (this.startPosition) return;
      this.randomPosition();
      if (!this.startPosition) return;
      this.isDeath = true;
      this.blocks = 0;
      this.bombs = 1;
      this.radius = 1;
      this.lastAction = Date.now();
      this.game.message(`${this.name} подключился`);
    },

    toLeave: () => {
      if (!this.startPosition) return;
      this.game.releaseFreePosition(this.startPosition);
      this.startPosition = null;
      this.game.message(`${this.name} отключился`);
    }
  };

  reset() {
    const { startPosition } = this;
    this.isDeath = false;
    this.blocks = 0;
    this.bombs = 1;
    this.radius = 1;
    this.isAnimated = false;
    this.lastAction = Date.now();
    this.randomPosition();

    if (startPosition) {
      [this.x, this.y] = startPosition;
      effectObject(this, 'startPosition', [-1, -1], () => { });
    }
  }

  death(player?: Player) {
    this.isAnimated = true;
    this.isDeath = true;
    this.api.actionDeath();
    if (player) {
      const target = player === this ? 'самоубился' : `убит ${player.name}`;
      this.game.message(`${this.name} ${target}`);
    }
  }

  randomPosition() {
    if (this.startPosition) {
      this.game.releaseFreePosition(this.startPosition);
    }

    this.startPosition = this.game.getFreePosition();
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

    if (!this.isDeath && this.inGame)
      effectObject(
        this,
        'timeout',
        Date.now() - this.lastAction > PLAYER_TIMEOUT && !this.isDeath,
        (result) => {
          if (result)
            this.methods.toLeave();
        }
      );

    if (!this.isDeath && this.inGame) {
      for (const explode of explodes) {
        if (this.isDeath) continue;

        for (const { x, y } of explode.points) {
          if (this.isDeath) continue;

          if (this.checkCollision(x, y, .8)) {
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
        this.startPosition,
        ([x, y]) => {
          this.x = x;
          this.y = y;
          this.api.setStartPosition(x, y);
        }
      );

    effectObject(
      this,
      'localInfo',
      this.localInfo,
      localInfo => {
        this.api.updateLocalInfo(localInfo);
      }
    );

    effectObject(
      this,
      'map',
      gameMap,
      map => {
        this.api.updateMap(map);
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
  }
}