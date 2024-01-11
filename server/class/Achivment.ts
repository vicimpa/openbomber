import { pick } from "@core/pick";
import { random } from "@core/random";
import { EAchivment, EMapItem, ESounds } from "@shared/types";

import { BombEffect } from "./BombEffect";
import { CrasyBombEffect } from "./CrasyBombEffect";
import { Entity } from "./Entity";
import { Game } from "./Game";
import { MovingEffect } from "./MovingEffect";
import { Player } from "./Player";
import { RadiusEffect } from "./RadiusEffect";
import { ShieldEffect } from "./ShieldEffect";
import { SpeedEffect } from "./SpeedEffect";

const STORE = [
  EAchivment.APPEND_BOMB,
  EAchivment.APPEND_EXPO,
  EAchivment.APPEND_SHIELD,
  EAchivment.APPEND_SPEED,
  EAchivment.MOVING_BOMB,
  EAchivment.FIRE,
  EAchivment.CRAZY_BOMB,
];

export class Achivment extends Entity {
  id!: number;
  constructor(
    game: Game,
    x: number,
    y: number,
    public type: EAchivment = random([...STORE, EAchivment.RANDOM])
  ) {
    super(game, x, y);
    this.id = game.achivmentsCounter++;
  }

  accept(player: Player, type = this.type): void {
    switch (type) {
      case EAchivment.APPEND_BOMB: {
        BombEffect.append(player);
        break;
      }

      case EAchivment.APPEND_EXPO: {
        RadiusEffect.append(player);
        break;
      }

      case EAchivment.APPEND_SHIELD: {
        ShieldEffect.append(player);
        break;
      }

      case EAchivment.APPEND_SPEED: {
        SpeedEffect.append(player, 1.5);
        break;
      }

      case EAchivment.MOVING_BOMB: {
        MovingEffect.append(player);
        break;
      }

      case EAchivment.FIRE: {
        SpeedEffect.append(player, 0.7);
        break;
      }

      case EAchivment.CRAZY_BOMB: {
        CrasyBombEffect.append(player);
        break;
      }

      case EAchivment.RANDOM: {
        return this.accept(player, random(STORE));
      }

      default: {
        console.log('Unknow', type);
      }
    }

    player.newApi.playSound(ESounds.bonus);
  }

  update(dtime: number, time: number): void {
    const i = this.x + this.y * this.game.width;
    if (this.game.map[i] === EMapItem.WALL)
      this.game.achivments.delete(this);
  }


  get info() {
    return pick(this, [
      'id',
      'x',
      'y',
      'type'
    ]);
  }
}