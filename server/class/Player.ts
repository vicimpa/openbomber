import { Socket } from "socket.io";

import { calcSpeed } from "../../core/calcSpeed";
import { effectObject } from "../../core/effectObject";
import { find } from "../../core/find";
import { TMethodsOut } from "../../core/makeWebSocketApi";
import { map } from "../../core/map";
import { rem, round } from "../../core/math";
import { pick } from "../../core/pick";
import { Vec2 } from "../../core/Vec2";
import { gameApi, playerApi } from "../../shared/api";
import {
  MESSAGE_LENGTH,
  NICK_LENGTH,
  PLAYER_TIMEOUT,
  SKINS_COUNT,
  TIMEOUT_MESSAGE,
  TIMEOUT_RECONNECT,
} from "../../shared/config";
import { EAnimate, EDir, EEffect, EMapItem, ESounds } from "../../shared/types";
import { IS_DEV } from "../env";
import { Bomb } from "./Bomb";
import { BombEffect } from "./BombEffect";
import { CrasyBombEffect } from "./CrasyBombEffect";
import { Effect } from "./Effect";
import { Entity } from "./Entity";
import { Game } from "./Game";
import { MovingEffect } from "./MovingEffect";
import { Npc } from "./Npc";
import { PlayerEffect } from "./PlayerEffect";
import { RadiusEffect } from "./RadiusEffect";
import { ShieldEffect } from "./ShieldEffect";
import { SpeedEffect } from "./SpeedEffect";

let PLAYER_COUNTER = 0;

export class Player extends Entity {
  readonly #id = PLAYER_COUNTER++;
  newApi!: TMethodsOut<typeof playerApi>;
  unforward?: () => any;

  isDeath = false;

  dir = EDir.BOTTOM;
  inGame = false;
  #animate = EAnimate.IDLE;
  moved = false;

  get id() { return this.#id; }
  get canJoin() { return this.game.slotLimits > this.game.playersCount; }
  get animate() { return this.#animate; }
  set animate(v) { this.#animate = v; }

  startPosition?: Vec2 | undefined;

  name = '';
  color = 0;

  get effects() {
    return {
      haveShield: ShieldEffect.hasShield(this),
      speed: SpeedEffect.getValue(this),
      crazy: !!CrasyBombEffect.get(this)
    };
  }

  wins = 0;
  kills = 0;
  deaths = 0;

  ping = 0;
  lastTestPing = 0;
  reconnect = 0;
  warningPing = 0;

  lastAction = Date.now();
  lastMessage = Date.now() - TIMEOUT_MESSAGE;
  lastConnect = Date.now() - TIMEOUT_RECONNECT;

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

  get remainingEffects() {
    const speed = SpeedEffect.get(this);
    const speedValue = speed ? round((speed.remaining ?? 0) / 1000) : 0;
    return {
      shield: round((ShieldEffect.get(this)?.remaining ?? 0) / 1000),
      crazy: round((CrasyBombEffect.get(this)?.remaining ?? 0) / 1000),
      sup: speed && speed.value > 1 ? speedValue : 0,
      sdown: speed && speed.value < 1 ? speedValue : 0,
      moving: round((MovingEffect.get(this)?.remaining ?? 0) / 1000),
      bombs: BombEffect.count(this) || 0,
      radius: RadiusEffect.count(this) || 0,
    };
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
      const { speed } = this.effects;
      const deltatime = Date.now() - this.lastAction;
      const distance = calcSpeed(deltatime, speed) + .2;

      if (this.length(x, y) > distance) {
        this.newApi.setStartPosition(this);
        return;
      }

      this.moved = true;

      x = (x * 16 | 0) / 16;
      y = (y * 16 | 0) / 16;

      this.lastAction = Date.now();
      this.x = x;
      this.y = y;
      this.dir = dir;
      this.animate = animate;
    },

    ping: () => {
      this.ping = Date.now() - this.lastTestPing;
    },
    sendMessage: (message) => {
      if (!message) return;
      const needTime = this.lastMessage + TIMEOUT_MESSAGE;
      const deltaTime = needTime - Date.now();
      if (deltaTime > 0) {
        this.newApi.onMessage({
          message: `Сообщение можно отправить через ${deltaTime / 1000 | 0} сек.`,
          sender: { name: 'server' },
          isMe: false
        });
        return;
      }
      this.lastMessage = Date.now();
      message = message.slice(0, MESSAGE_LENGTH);
      this.game.message(message, this);
    },

    setSkin: (skin) => {
      this.color = rem(skin | 0, SKINS_COUNT);
    },

    setBomb: () => {
      if (this.game.waitForRestart !== -1 || this.isDeath || !this.inGame) return;

      const { bombs, achivments } = this.game;
      const newBomb = new Bomb(this);
      const { x, y } = newBomb;
      const bombsCount = BombEffect.count(this) + 1;
      const value = this.game.map[x + y * this.game.width];

      if (value === EMapItem.WALL)
        return;

      if (find(bombs, { x, y }))
        return;

      if (find(achivments, { x, y }))
        return;

      if (map(bombs, e => e, e => e.creator === this).length >= bombsCount)
        return;

      bombs.add(newBomb);

      this.game.players.forEach(player => {
        player.newApi.playSoundPosition({
          sound: ESounds.putBomb,
          position: this
        });
      });
    },

    setName: (name: string) => {
      if (!name) return;
      this.name = name.slice(0, NICK_LENGTH);
    },

    toGame: () => {
      if (!this.canJoin || this.inGame) return;

      const needTime = this.lastConnect + TIMEOUT_RECONNECT * this.reconnect;
      const deltaTime = needTime - Date.now();

      if (deltaTime > 0) {
        this.newApi.onMessage({
          message: `Подключитесь через ${deltaTime / 1000 | 0} сек.`,
          sender: { name: 'server' },
          isMe: false
        });
        return;
      }

      this.randomPosition();
      this.isDeath = true;
      this.kills = 0;
      this.deaths = 0;
      this.wins = 0;
      this.inGame = true;
      this.lastConnect = Date.now();
      this.lastAction = Date.now();
      this.game.message(`${this.name ?? 'noname'} подключился`);
      PlayerEffect.clearEffets(this);
    },

    toLeave: () => {
      if (!this.inGame) return;
      this.releasePosition();
      this.reconnect++;
      this.color = -1;
      this.inGame = false;
      this.lastConnect = Date.now();
      this.lastAction = Date.now();
      this.game.message(`${this.name ?? 'noname'} отключился`);
      PlayerEffect.clearEffets(this);
    }
  };

  reset() {
    const { startPosition } = this;
    this.isDeath = false;
    this.lastAction = Date.now();
    this.randomPosition();
    this.moved = false;
    PlayerEffect.clearEffets(this);

    if (startPosition) {
      this.set(startPosition);
      effectObject(this, 'startPosition', [-1, -1], () => { });
    }
  }

  death(killer?: Player | Npc, isFire = false) {
    if (this.isDeath) return;
    const isSuicide = killer === this;
    this.reconnect = 0;

    this.isDeath = true;
    this.newApi.playSound(ESounds.death);

    this.game.effects.add(
      new Effect(this.game, this.x, this.y, EEffect.DEATH)
    );

    if (this.game.playersCount > 1) {
      this.deaths++;
      this.game.kills++;
    }

    if (!isSuicide && killer instanceof Player) {
      killer.kills++;
      killer.newApi.playSound(ESounds.kill);
    }

    const deathFn = ()=>{
      const murder = `${isFire ? 'сожжег' : 'убил'}`
      if (killer) {
        switch (isSuicide) {
          case true:
            return `${this.name} самоубился`
          case false:
            return `${killer.name} ${murder} ${this.name}`
        }       
      }
      return `${this.name ?? 'noname'} застрял в стене`
    }
    this.game.message(deathFn());
    PlayerEffect.clearEffets(this);
    this.releasePosition();
  }

  randomPosition() {
    this.releasePosition();
    this.startPosition = this.game.getFreePosition();
  }

  releasePosition() {
    if (this.startPosition) {
      this.game.releasePosition(this.startPosition);
    }
    delete this.startPosition;
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

  update() {
    const {
      explodes,
      achivments
    } = this.game;

    const speed = SpeedEffect.getValue(this);

    if (this.inGame && this.ping > 250) {
      this.warningPing++;
    } else {
      this.warningPing = 0;
    }

    effectObject(
      this,
      'kickWarningPing',
      this.warningPing > 200,
      (isKick) => {
        if (isKick) {
          this.newMethods.toLeave?.();
          this.newApi.onMessage({
            message: 'Вас кикнуло за высокий пинг',
            sender: { name: 'server' },
            isMe: false
          });
        }
      }
    );

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

    if (!this.isDeath && this.inGame && this.moved) {
      const vec = this.clone().round();
      const value = this.game.map[vec.y * this.game.width + vec.x];
      if (value === EMapItem.WALL || value === EMapItem.BLOCK)
        this.death();
    }

    if (!this.isDeath && this.inGame) {
      if (speed >= 1) {
        for (const player of this.game.players) {
          if (player === this || !player.inGame || player.isDeath)
            continue;

          if (SpeedEffect.getValue(player) >= 1)
            continue;

          if (this.checkCollision(player, .9))
            this.death(player, true);
        }
      }

      let shield = ShieldEffect.get(this);

      for (const explode of explodes) {
        if (this.isDeath || explode.ignore.has(this))
          continue;

        for (const point of explode.points) {
          if (this.isDeath) continue;

          if (this.checkCollision(point, .6)) {
            if (shield) {
              shield = null;
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
        if (this.checkCollision(achivment, .4)) {
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
      () => {
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

    effectObject(
      this,
      'startPosition',
      this.inGame && !this.isDeath ? this.startPosition : undefined,
      (point) => {
        if (point) {
          this.set(point);
          this.newApi.setStartPosition(point);
          this.newApi.playSound(ESounds.newLife);
        }
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
      'remainingEffects',
      this.remainingEffects,
      effects => {
        this.newApi.updateRemainingEffects(effects);
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