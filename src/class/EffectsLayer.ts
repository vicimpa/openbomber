import { OUT_FRAME } from "config";
import { createUpdateDelete } from "library/createUpdateDelete";

import { EffectSprite } from "./EffectSprite";
import { Entity } from "./Entity";

import type { Game } from "./Game";
export class EffectsLayer extends Entity {
  constructor(public game: Game) {
    super(0, 0);
    this.appendTo(game);
  }

  effects = new Map<number, EffectSprite>();

  update(dtime: number, time: number): void {
    createUpdateDelete(
      this.game.effects,
      this.effects,
      ({ deltaTime }) => {
        const effect = new EffectSprite();
        effect.startAnimate = time - deltaTime;
        effect.appendTo(this);
        return effect;
      },
      ({ x, y, type, meta }, effect) => {
        effect.set(x, y).times(OUT_FRAME);
        effect.type = type;
        effect.meta = meta;
      },
      (bomb) => {
        bomb.delete();
      }
    );
  }
}