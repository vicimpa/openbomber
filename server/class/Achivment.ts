import { EAchivment } from "../../src/types";
import { pick } from "../lib/pick";
import { random } from "../lib/random";
import { BombEffect } from "./BombEffect";
import { Entity } from "./Entity";
import { Game } from "./Game";
import { Player } from "./Player";
import { RadiusEffect } from "./RadiusEffect";
import { ShieldEffect } from "./ShieldEffect";

const STORE = [
  EAchivment.APPEND_BOMB,
  EAchivment.APPEND_EXPO,
  EAchivment.APPEND_SHIELD,
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

      case EAchivment.RANDOM: {
        return this.accept(player, random(STORE));
      }

      default: {
        console.log('Unknow', type);
      }
    }

    player.api.actionBonus();
  }


  get info() {
    return pick(this, [
      'x',
      'y',
      'type'
    ]);
  }
}