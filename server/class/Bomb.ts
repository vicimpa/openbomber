import { pick } from "../../core/pick";
import { CRAZY_BOMB_BOOST, CRAZY_BOMB_MAX, CRAZY_BOMB_MIN } from "../../shared/config";
import { EEffect, ESounds } from "../../shared/types";
import { Effect } from "./Effect";
import { Entity } from "./Entity";
import { Explode } from "./Explode";
import { Player } from "./Player";

export class Bomb extends Entity {
  id!: number;

  time = Date.now();
  liveTime = 2000;

  isFake = false;
  public radius = 1;

  constructor(
    public player: Player, public isCrazy = false
  ) {
    const x = Math.round(player.x);
    const y = Math.round(player.y);

    super(player.game, x, y);
    this.id = player.game.bombsCounter++;
    this.radius = player.effects.radius;

    if (isCrazy) {
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
      'radius',
      'isCrazy',
    ]);
  }

  update(): void {
    const { time, liveTime, game: { waitForRestart } } = this;

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

      this.player.game.players.forEach(player => {
        player.newApi.playSoundPosition({
          sound: ESounds.explode,
          position: this
        });
      });

      Explode.run(this);
    }
  }
}