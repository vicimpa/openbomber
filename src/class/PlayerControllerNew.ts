import { calcSpeed } from "@/calcSpeed";
import { abs } from "@/math";
import { EAnimate, EDir, EMapItem } from "@/types";
import { Vec2 } from "@/Vec2";

import { Game } from "./Game";


export class PlayerControllerNew extends Vec2 {
  dir: EDir = EDir.BOTTOM;
  animate: EAnimate = EAnimate.IDLE;
  speedMulti = 1;
  move = new Vec2();

  constructor(public game: Game) {
    super();
  }

  onBomb(x: number, y: number, i: number) { }

  circle(value: number, block: number, move: number, d: number) {
    if (move) return move;

    const over = .4;
    const delta = value - block;

    if (delta < -over) return -Math.abs(d);
    if (delta > over) return Math.abs(d);

    return 0;
  }

  collision(
    move: Vec2,
    obj: Vec2,
    col: Vec2,
    top = .8,
    down = .2,
    canCircle = false
  ) {
    if (obj.y > col.y - top && obj.y < col.y + top) {
      if (
        false
        || (move.x > 0 && obj.x > col.x - 1 && obj.x < col.x - down)
        || (move.x < 0 && obj.x < col.x + 1 && obj.x > col.x + down)
      ) {
        if (canCircle)
          move.y = this.circle(obj.y, col.y, move.y, move.x);
        move.x = 0;
      }
    }

    if (obj.x > col.x - top && obj.x < col.x + top) {
      if (
        false
        || (move.y > 0 && obj.y > col.y - 1 && obj.y < col.y - down)
        || (move.y < 0 && obj.y < col.y + 1 && obj.y > col.y + down)
      ) {
        if (canCircle)
          move.x = this.circle(obj.x, col.x, move.x, move.y);

        move.y = 0;
      }
    }
  }

  tick(deltaTime: number, time: number) {
    if (!this.game) return;
    const { width, height } = this.game;
    const { mapLayer: { map }, bombs, positions, players } = this.game;
    const size = width * height;

    let { animate, dir } = this;
    const speed = calcSpeed(deltaTime, this.speedMulti);

    const move = this.move.clone().normalize();

    if (abs(move.y) > .5) dir = move.y < 0 ? EDir.TOP : EDir.BOTTOM;
    if (abs(move.x) > .5) dir = move.x < 0 ? EDir.LEFT : EDir.RIGHT;

    animate = !move.equal(0) ? EAnimate.RUNNING : EAnimate.IDLE;

    move.times(speed);

    for (let i = 0; i < size; i++) {
      if (
        false
        || map[i] === EMapItem.CLEAR
        || map[i] === EMapItem.GRAS
        || map[i] === EMapItem.SAND
      ) continue;

      const col = Vec2.withIndex(i, width, height);

      this.collision(
        move,
        this,
        col,
        undefined,
        undefined,
        map[i] == EMapItem.WALL
      );
    }

    for (const [_, bomb] of bombs) {
      const obj = new Vec2(bomb);

      if (obj.equal(this.clone().round()))
        continue;

      this.collision(
        move,
        this,
        obj
      );
    }


    for (const [id, { x, y }] of positions) {
      const { isDeath } = players.get(id)!;
      const obj = new Vec2(x ?? 0, y ?? 0);

      if (isDeath)
        continue;

      this.collision(
        move,
        this,
        obj
      );
    }

    this.plus(move);

    this.minLimit(0);
    this.maxLimit(width - 1, height - 1);

    this.dir = dir;
    this.animate = animate;
  }
}