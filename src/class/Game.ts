import { makeEffect } from "@/makeEffect";
import { rem } from "@/math";
import { OUT_FRAME } from "config";
import { showDebug } from "data/debug";

import { AchivmentsLayer } from "./AchivmentsLayer";
import { BombsLayer } from "./BombsLayer";
import { EffectsLayer } from "./EffectsLayer";
import { Entity } from "./Entity";
import { ExplodesLayer } from "./ExplodesLayer";
import { MapLayer } from "./MapLayer";
import { PlayersLayer } from "./PlayersLayer";
import { PlayerSprite } from "./PlayerSprite";

import type { FocusCamera } from "./FocusCamera";
import type { TProtoOut } from "@/Proto";
import type {
  ACHIVMENT_INFO,
  BOMB_INFO,
  EFFECT_INFO,
  EXPLODE_INFO,
  GAME_INFO,
  PLAYER_INFO,
  PLAYER_POSITION
} from "@/api";

import type { PlayerControllerNew } from "./PlayerControllerNew";
import type { EAnimate, EDir } from "@/types";
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
  newRender?: Uint8Array;

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
    }

    showDebug('Player', this.currentPlayer);

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
      this.currentPlayerSprite.isFire = this.localInfo.effects.speed < 1;
      this.currentPlayerSprite.isShield = this.localInfo.effects.haveShield;
      this.currentPlayerSprite.isCrazy = this.localInfo.effects.crazy;
      this.currentPlayerSprite.color = this.localInfo.color;
      this.currentPlayerSprite.name = this.localInfo.name;
    }

    if (this.focusCamera) {
      this.focusCamera.padding = 64;
      this.focusCamera.focus = this;
    }
  }
}