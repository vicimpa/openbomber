import { OUT_FRAME } from "config";
import { createUpdateDelete } from "library/createUpdateDelete";

import { Entity } from "./Entity";
import { PlayerSprite } from "./PlayerSprite";

import type { Game } from "./Game";
export class PlayersLayer extends Entity {
  constructor(public game: Game) {
    super(0, 0);
    this.appendTo(game);
  }

  players = new Map<number, PlayerSprite>();

  update(dtime: number, time: number): void {
    createUpdateDelete(
      this.game.positions,
      this.players,
      () => (
        new PlayerSprite()
          .appendTo(this)
      ),
      ({ id, x, y, dir, animate, }, player) => {
        const info = this.game.players.get(id)!;
        player.set(x, y).times(OUT_FRAME);
        player.id = id;
        player.dir = dir;
        player.animate = animate;
        player.name = !!info && info.name;
        player.color = !!info && info.color;
        player.isFire = !!info && info.effects.speed < 1;
        player.isShield = !!info && info.effects.haveShield;
        player.isCrazy = !!info && info.effects.crazy;
        player.isMoving = !!info && info.effects.haveMove;
      },
      (player) => {
        player.delete();
      }
    );
  }
}