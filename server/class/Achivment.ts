import { pick } from "../../core/pick";
import { random } from "../../core/random";
import { EAchivment, ESounds } from "../../shared/types";
import { BombEffect } from "./BombEffect";
import { CrasyBombEffect } from "./CrasyBombEffect";
import { Entity } from "./Entity";
import { Game } from "./Game";
import { Player } from "./Player";
import { RadiusEffect } from "./RadiusEffect";
import { ShieldEffect } from "./ShieldEffect";
import { SpeedEffect } from "./SpeedEffect";

const STORE = [
  EAchivment.APPEND_BOMB,
  EAchivment.APPEND_EXPO,
  EAchivment.APPEND_SHIELD,
  EAchivment.APPEND_SPEED,
  EAchivment.FIRE,
  EAchivment.CRAZY_BOMB,
];

export class Achivment extends Entity {
  constructor(
    game: Game,
    x: number,
    y: number,
    public type: EAchivment = random([...STORE, EAchivment.RANDOM])
  ) {
    super(game, x, y);
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

      case EAchivment.FIRE: {
        SpeedEffect.append(player, 0.5);
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


  get info() {
    return pick(this, [
      'x',
      'y',
      'type'
    ]);
  }
}