import { isColide } from "@core/isColide";
import { point } from "@core/point";
import { Vec2 } from "@core/Vec2";

import { Game } from "./Game";

const me = point();
const size = point();
const pos = point();
const obj = point();

export class Entity extends Vec2 {
  constructor(
    public game: Game,
    x: number,
    y: number
  ) {
    super(x, y);
  }

  checkCollision(o: Vec2, over = 1) {
    const s = 1 - over;

    me.set(this).plus(s / 2);
    pos.set(o).plus(s / 2);
    size.set(over);
    obj.set(over);

    return isColide(me, pos, size, obj);
  }

  update(dtime: number, time: number): void { }
}