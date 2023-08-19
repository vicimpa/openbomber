import { pick } from "../../core/pick";
import { EEffect } from "../../shared/types";
import { Entity } from "./Entity";
import { Game } from "./Game";

export class Effect extends Entity {
  id!: number;
  type: EEffect;
  time = Date.now();
  get deltaTime() { return Date.now() - this.time; }

  constructor(game: Game, x: number, y: number, type: EEffect) {
    super(game, x, y);
    this.id = game.effectsCounter++;
    this.type = type;
  }

  get info() {
    return pick(
      this,
      [
        'id',
        'x',
        'y',
        'type',
        'deltaTime'
      ]
    );
  }

  get infoType() {
    return pick(
      this,
      [
        'type'
      ]
    );
  }
}