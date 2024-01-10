import { pick } from "core/pick";
import { point } from "core/point";
import { Vec2 } from "core/Vec2";
import { BOMB_TIME, CRAZY_BOMB_BOOST, CRAZY_BOMB_MAX, CRAZY_BOMB_MIN } from "shared/config";
import { DIRECTIONS, EAnimate, EEffect, EMapItem, ESounds } from "shared/types";

import { CrasyBombEffect } from "./CrasyBombEffect";
import { Effect } from "./Effect";
import { Entity } from "./Entity";
import { Explode } from "./Explode";
import { MovingEffect } from "./MovingEffect";
import { Player } from "./Player";
import { RadiusEffect } from "./RadiusEffect";

export class Bomb extends Entity {
  id!: number;
  creator!: Player;

  time = Date.now();
  liveTime = BOMB_TIME;
  dir?: Vec2;

  isFake = false;
  radius = 1;

  maked = true;

  isCrazy = false;
  isRadio = false;
  get isMove() { return !!this.dir; }

  constructor(
    public player: Player
  ) {
    const x = Math.round(player.x);
    const y = Math.round(player.y);
    super(player.game, x, y);
    this.creator = player;
    this.id = player.game.bombsCounter++;
    this.radius = RadiusEffect.count(player) + 1;
    this.isCrazy = !!CrasyBombEffect.get(player);

    if (this.isCrazy) {
      this.isFake = Math.random() < .1 ? true : false;

      this.liveTime = CRAZY_BOMB_MIN + (
        Math.random() * (CRAZY_BOMB_MAX - CRAZY_BOMB_MIN)
      );

      this.radius = this.radius + (
        Math.random() * (this.radius * CRAZY_BOMB_BOOST - this.radius)
      ) | 0;
    }
  }

  get info() {
    return pick(this, [
      'id',
      'x',
      'y',
      'isMove',
      'radius',
      'isCrazy',
      'isRadio',
    ]);
  }

  update(dtime: number): void {
    const { time, liveTime, game: { waitForRestart, players, bombs, map, achivments }, player } = this;

    if (!this.dir) {
      const mapValue = this.game.map[this.cfloor().times(1, this.game.width).sum()];

      if (mapValue === EMapItem.WALL || mapValue === EMapItem.BLOCK) {
        this.game.bombs.delete(this);
        return;
      }
    }

    if (!player.checkCollision(this, .5) && this.maked) {
      this.maked = false;
    }

    if (!this.maked && !this.dir) {
      for (const player of players) {
        if (player.animate === EAnimate.IDLE) continue;
        if (!MovingEffect.get(player)) continue;
        if (player.isDeath || !player.inGame) continue;
        if (player.checkCollision(this) && !this.dir) {
          const dir = this.cminus(player).round();
          if (dir.equal(DIRECTIONS[player.dir])) {
            this.player = player;
            this.dir = dir;
          }
        }
      }
    }

    if (this.dir !== undefined) {
      const move = this.dir;
      const newSet = this.cplus(move.ctimes(.3));
      let haveColide = false;

      for (const item of bombs) {
        if (haveColide) continue;
        if (this === item) continue;
        if (item.checkCollision(newSet, .8)) haveColide = true;
      }

      for (const item of players) {
        if (haveColide) continue;
        if (item.isDeath || !item.inGame) continue;
        if (item.checkCollision(newSet, .8)) haveColide = true;
      }

      for (const item of achivments) {
        if (haveColide) continue;
        if (item.checkCollision(newSet, .8)) haveColide = true;
      }

      const vec = point();

      for (let i = 0; i < map.length; i++) {
        if (haveColide) continue;
        if (map[i] === EMapItem.BLOCK || map[i] === EMapItem.WALL) {

          vec.set(i % map.width, i / map.width | 0);
          if (Entity.prototype.checkCollision.call(vec, newSet, .8)) haveColide = true;
        }
      }

      if (newSet.x < 0 || newSet.y < 0 || newSet.x > map.width - 1 || newSet.y > map.height - 1)
        haveColide = true;

      if (haveColide) {
        this.round();
        this.dir = undefined;
      } else {
        this.plus(move.ctimes(dtime * .01));
      }
    }

    if (Date.now() > time + liveTime && waitForRestart < 0) {
      if (this.isFake) {
        this.game.bombs.delete(this);
        this.game.effects.add(
          new Effect(this.game, this.x, this.y, EEffect.FAKE_EXPLODE)
        );
        this.player.game.players.forEach(player => {
          player.newApi.playSoundPosition({
            sound: ESounds.explodeFail,
            position: this
          });
        });
        return;
      }

      Explode.run(this);
    }
  }
}