import { EAchivment } from "../../src/types";
import { pick } from "../lib/pick";
import { random } from "../lib/random";
import { Entity } from "./Entity";
import { Game } from "./Game";
import { Player } from "./Player";

const STORE = [
  EAchivment.APPEND_BOMB,
  EAchivment.APPEND_EXPO
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

  accept(player: Player, type = this.type) {
    switch (type) {
      case EAchivment.APPEND_BOMB: {
        player.bombs++;
        break;
      }

      case EAchivment.APPEND_EXPO: {
        player.radius++;
        break;
      }

      case EAchivment.RANDOM: {
        this.accept(player, random(STORE));
        break;
      }

      default: {
        console.log('Unknow', type);
      }
    }
  }


  get info() {
    return pick(this, [
      'x',
      'y',
      'type'
    ]);
  }
}