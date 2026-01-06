import type {
  ACHIVMENT_INFO,
  BOMB_INFO,
  EFFECT_INFO,
  EXPLODE_INFO,
  GAME_INFO,
  PLAYER_INFO,
  PLAYER_POSITION
} from "@ob/shared/api";
import type { EAnimate, EDir } from "@ob/shared/types";

import { AchivmentsLayer } from "./AchivmentsLayer";
import { BombsLayer } from "./BombsLayer";
import { EffectsLayer } from "./EffectsLayer";
import { Entity } from "./Entity";
import { ExplodesLayer } from "./ExplodesLayer";
import type { FocusCamera } from "./FocusCamera";
import { MapLayer } from "./MapLayer";
import { OUT_FRAME } from "../config";
import type { PlayerControllerNew } from "./PlayerControllerNew";
import { PlayerSprite } from "./PlayerSprite";
import { PlayersLayer } from "./PlayersLayer";
import type { TProtoOut } from "@vicimpa/proto";
import { makeEffect } from "@ob/core/makeEffect";
import { rem } from "@vicimpa/math";

export class Game extends Entity {
  mapLayer = new MapLayer(this);
  effectsLayer = new EffectsLayer(this);
  achivmentsLayer = new AchivmentsLayer(this);
  bombsLayer = new BombsLayer(this);
  explodesLayer = new ExplodesLayer(this);
  playersLayer = new PlayersLayer(this);

  width = 0;
  height = 0;

  focusCamera?: FocusCamera;
  newRender?: Uint8Array<ArrayBuffer>;

  players = new Map<number, TProtoOut<typeof PLAYER_INFO>>();
  positions = new Map<number, TProtoOut<typeof PLAYER_POSITION>>();
  bombs = new Map<number, TProtoOut<typeof BOMB_INFO>>();
  explodes = new Map<number, TProtoOut<typeof EXPLODE_INFO>>();
  achivments = new Map<number, TProtoOut<typeof ACHIVMENT_INFO>>();
  effects = new Map<number, TProtoOut<typeof EFFECT_INFO>>();

  focusPlayer?: PlayerSprite;
  currentPlayerSprite?: PlayerSprite;
  currentPlayer?: PlayerControllerNew;

  viewCount = 0;

  localInfo?: TProtoOut<typeof PLAYER_INFO>;
  waitRestart = -1;

  playerEffect = makeEffect<{ x: number, y: number, dir: EDir, animate: EAnimate; }>();
  updatePosition(x: number, y: number, dir: EDir, animate: EAnimate) { }

  update(dtime: number, time: number): void {
    const players = [...this.playersLayer.players.values()];
    this.focusPlayer = players[rem(this.viewCount, players.length)];

    if (this.currentPlayer && !this.currentPlayerSprite) {
      this.currentPlayerSprite = new PlayerSprite();
      this.currentPlayerSprite.appendTo(this);
      this.currentPlayerSprite.isMe = true;
    }

    if (!this.currentPlayer && this.currentPlayerSprite) {
      this.currentPlayerSprite.delete();
      delete this.currentPlayerSprite;
    }

    if (this.currentPlayer && this.localInfo) {
      this.currentPlayer.tick(dtime, time);

      let { x, y, dir, animate } = this.currentPlayer;

      x = ((x * 16) | 0) / 16;
      y = ((y * 16) | 0) / 16;

      this.playerEffect({ x, y, dir, animate }, () => (
        this.updatePosition(x, y, dir, animate)
      ));

      if (this.currentPlayerSprite) {
        this.currentPlayerSprite.dir = this.currentPlayer.dir;
        this.currentPlayerSprite.animate = this.currentPlayer.animate;
        this.currentPlayerSprite.set(
          this.currentPlayer
        ).times(OUT_FRAME);
      }
    }

    if (this.currentPlayerSprite && this.localInfo) {
      this.currentPlayerSprite.isSpeedUp = this.localInfo.effects.speed > 1;
      this.currentPlayerSprite.isFire = this.localInfo.effects.speed < 1;
      this.currentPlayerSprite.isShield = this.localInfo.effects.haveShield;
      this.currentPlayerSprite.isCrazy = this.localInfo.effects.crazy;
      this.currentPlayerSprite.isMoving = this.localInfo.effects.haveMove;
      this.currentPlayerSprite.skin = this.localInfo.skin;
      this.currentPlayerSprite.name = this.localInfo.name;
      this.currentPlayerSprite.isAdmin = this.localInfo.isAdmin;
    }

    if (this.focusCamera) {
      this.focusCamera.padding = 64;
      this.focusCamera.focus = this;
    }
  }
}