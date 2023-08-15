import { Socket } from "socket.io";

import { gameApi, playerApi } from "../../api";
import { MESSAGE_LENGTH, NICK_LENGTH, PLAYER_TIMEOUT } from "../../config";
import { effectObject } from "../../core/effectObject";
import { find } from "../../core/find";
import { TMethods } from "../../core/makeWebSocketApi";
import { map } from "../../core/map";
import { pick } from "../../core/pick";
import { point } from "../../core/point";
import { Vec2 } from "../../core/Vec2";
import { EAnimate, EDir, EEffect, ESounds } from "../../types";
import { IS_DEV } from "../env";
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

export class Player extends Entity {
  #id = -1;
  newApi!: TMethods<typeof playerApi>;
  unforward?: () => any;

  isDeath = false;

  dir = EDir.BOTTOM;
  #animate = EAnimate.IDLE;

  get id() { return this.#id; }
  get inGame() { return this.#id !== -1; };
  get canJoin() { return this.game.slotLimits > this.game.playersCount; }
  get animate() { return this.#animate; }
  set animate(v) { this.#animate = v; }
  get startPosition(): Vec2 | undefined { return this.game.startPositions[this.#id]; };

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

  wins = 0;
  kills = 0;
  deaths = 0;

  ping = 0;
  lastTestPing = 0;

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
      'wins',
      'kills',
      'deaths',
      'effects',
      'color',
      'ping'
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
    this.newApi = playerApi.use(socket);

    if (IS_DEV)
      this.newMethods.toGame?.();
  }

  newMethods: Parameters<typeof gameApi['forward']>[1] = {
    setPosition: ({ x, y, dir, animate }) => {
      if (this.isDeath && !this.inGame) return;
      if (Math.sqrt((this.x - x) ** 2 + (this.y - y) ** 2) > 1) {
        this.newApi.setStartPosition(this);
        return;
      }

      this.lastAction = Date.now();
      this.x = (x * 16 | 0) / 16;
      this.y = (y * 16 | 0) / 16;
      this.dir = dir;
      this.animate = animate;
    },

    ping: () => {
      this.ping = Date.now() - this.lastTestPing;
    },
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
      this.game.players.forEach(player => {
        player.newApi.playSound(ESounds.putBomb);
      });
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
      this.wins = 0;
      this.lastAction = Date.now();
      PlayerEffect.clearEffets(this);
      this.randomColor();
      this.game.message(`${this.name ?? 'noname'} подключился`);
    },

    toLeave: () => {
      if (!this.startPosition) return;
      this.game.releasePosition(this.#id);
      this.game.releaseColor(this.color);
      this.#id = -1;
      this.color = -1;
      this.game.message(`${this.name ?? 'noname'} отключился`);
    }
  };


  reset() {
    const { startPosition } = this;
    this.isDeath = false;
    this.lastAction = Date.now();
    this.randomPosition();
    PlayerEffect.clearEffets(this);

    if (startPosition) {
      this.set(startPosition);
      effectObject(this, 'startPosition', [-1, -1], () => { });
    }
  }

  death(player?: Player) {
    if (this.isDeath) return;
    this.isDeath = true;
    this.newApi.playSound(ESounds.death);
    this.game.effects.add(
      new Effect(this.game, this.x, this.y, EEffect.DEATH)
    );

    if (player) {
      this.deaths++;
      this.game.kills++;
      player.newApi.playSound(ESounds.kill);

      if (player !== this)
        player.kills++;
    }

    if (player) {
      const target = player === this ? 'самоубился' : `убит ${player.name}`;
      this.game.message(`${this.name ?? 'noname'} ${target}`);
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

    const un2 = gameApi.forward(this.socket, this.newMethods);

    this.unforward = () => {
      un2();
    };
  }

  disconnect() {
    this.newMethods.toLeave?.();
    this.unforward?.();
  }

  checkCollision(X: number, Y: number, over = 1) {
    const { x, y } = this;
    return x < X + over && x > X - over && y < Y + over && y > Y - over;
  }

  update() {
    const {
      explodes,
      achivments
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
            this.newMethods.toLeave?.();
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

    if (this.lastTestPing + 3000 < Date.now()) {
      this.lastTestPing = Date.now();
      this.newApi.ping();
    }
  }

  sendInfo() {
    const {
      players,
      infoCache,
      mapCache,
      bombsCache,
      achivmentsCache,
      effectsCache,
      effectsTypeCache,
      explodesCahce
    } = this.game;

    effectObject(
      this,
      'gameInfo',
      infoCache,
      info => {
        this.newApi.updateGameInfo(this.game);
      }
    );

    effectObject(
      this,
      'waitForRestart',
      this.game.waitForRestart > 0 ? (this.game.waitForRestart - Date.now()) / 1000 | 0 : -1,
      time => {
        this.newApi.updateWaitForRestart(time);
      }
    );

    if (this.inGame && !this.isDeath)
      effectObject(
        this,
        'startPosition',
        this.startPosition ?? point(0),
        (point) => {
          this.set(point);
          this.newApi.setStartPosition(point);
          this.newApi.playSound(ESounds.newLife);
        }
      );

    effectObject(
      this,
      'localInfo',
      this.info,
      localInfo => {
        this.newApi.updateLocalInfo(localInfo);
      }
    );

    effectObject(
      this,
      'map',
      mapCache,
      (gameMap) => {
        this.newApi.updateMap(gameMap);
      }
    );

    effectObject(
      this,
      'effects',
      effectsTypeCache,
      () => {
        this.newApi.updateEffects(effectsCache);
      }
    );

    effectObject(
      this,
      'bombs',
      bombsCache,
      bombs => {
        this.newApi.updateBombs(bombs);
      }
    );

    effectObject(
      this,
      'explodes',
      explodesCahce,
      explodes => {
        this.newApi.updateExplodes(explodes);
      }
    );

    effectObject(
      this,
      'achivments',
      achivmentsCache,
      achivments => {
        this.newApi.updateAchivments(achivments);
      }
    );

    effectObject(
      this,
      'players',
      map(players, e => e.info, (e, d) => e !== this && e.inGame),
      players => {
        this.newApi.updatePlayers(players);
      }
    );

    effectObject(
      this,
      'positions',
      map(players, e => e.posInfo, (e, d) => e !== this && e.inGame && !e.isDeath),
      (positions) => {
        this.newApi.updatePlayerPositions(positions);
      }
    );
  }
}