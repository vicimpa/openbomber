import { OUT_FRAME } from "config";
import { createUpdateDelete } from "library/createUpdateDelete";

import { Entity } from "./Entity";
import { ExplodeSprite } from "./ExplodeSprite";

import type { Game } from "./Game";
export class ExplodesLayer extends Entity {
  constructor(public game: Game) {
    super(0, 0);
    this.appendTo(game);
  }

  explodes = new Map<number, ExplodeSprite[]>();

  update(dtime: number, time: number): void {
    createUpdateDelete(
      this.game.explodes,
      this.explodes,
      ({ points }) => (
        points.map(() => new ExplodeSprite().appendTo(this))
      ),
      ({ points }, explodePoints) => {
        for (let i = 0; i < points.length; i++) {
          explodePoints[i].set(points[i].x, points[i].y).times(OUT_FRAME);
          explodePoints[i].dir = points[i].dir;
          explodePoints[i].isBlock = points[i].isBlock;
          explodePoints[i].isFinaly = points[i].isFinaly;
        }
      },
      (points) => {
        for (const point of points)
          point.delete();
      }
    );
  }
}