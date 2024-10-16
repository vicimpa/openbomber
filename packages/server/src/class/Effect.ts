import { EEffect, EMapItem } from "@ob/shared/types";

import { Entity } from "./Entity";
import { Game } from "./Game";
import { pick } from "@ob/core/pick";

export class Effect extends Entity {
  id!: number;
  type: EEffect;
  time = Date.now();
  meta: number[] = [];

  get deltaTime() { return Date.now() - this.time; }

  constructor(game: Game, x: number, y: number, type: EEffect, meta: number[] = []) {
    super(game, x, y);
    this.id = game.effectsCounter++;
    this.type = type;
    this.meta = meta;
  }

  update(dtime: number, time: number): void {
    const { x, y } = this.cround();
    const { map, width } = this.game;
    const value = map[width * y + x];

    if (value === EMapItem.WALL || value === EMapItem.BLOCK)
      this.game.effects.delete(this);
  }

  get info() {
    return pick(
      this,
      [
        'id',
        'x',
        'y',
        'type',
        'deltaTime',
        'meta'
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