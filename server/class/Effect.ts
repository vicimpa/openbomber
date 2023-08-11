import { EEffect } from "../../src/types";
import { pick } from "../lib/pick";
import { Entity } from "./Entity";
import { Player } from "./Player";

export class Effect extends Entity {
  type: EEffect;

  constructor(player: Player, type: EEffect) {
    super(player.game, player.x, player.y);
    this.type = type;
  }

  get info() {
    return pick(
      this,
      [
        'x',
        'y',
        'type'
      ]
    );
  }
}