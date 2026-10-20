import { Game } from "./Game";
import { Vec2 } from "@vicimpa/lib-vec2";
import { isColide } from "@ob/core/isColide";

const me = new Vec2();
const size = new Vec2();
const pos = new Vec2();
const obj = new Vec2();

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