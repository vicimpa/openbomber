import { OUT_FRAME } from "config";
import { createUpdateDelete } from "library/createUpdateDelete";

import { AchivmentSprite } from "./AchivmentSprite";
import { Entity } from "./Entity";

import type { Game } from "./Game";
export class AchivmentsLayer extends Entity {
  constructor(public game: Game) {
    super(0, 0);
    this.appendTo(game);
  }

  achivments = new Map<number, AchivmentSprite>();

  update(dtime: number, time: number): void {
    createUpdateDelete(
      this.game.achivments,
      this.achivments,
      () => (
        new AchivmentSprite()
          .appendTo(this)
      ),
      ({ x, y, type }, bomb) => {
        bomb.set(x, y).times(OUT_FRAME);
        bomb.type = type;
      },
      (bomb) => {
        bomb.delete();
      }
    );
  }
}