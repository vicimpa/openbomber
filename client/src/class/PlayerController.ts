import { EAnimate, EDir } from "@root/types";
import { makeController } from "library/makeController";
import { toLimit } from "library/toLimit";

import type { GameMap } from "./GameMap";
import type { TPoint } from "library/point";

export class PlayerController {
  x = 0;
  y = 0;

  dir: EDir = EDir.BOTTOM;
  animate: EAnimate = EAnimate.IDLE;

  keys = makeController({
    up: ["KeyW"],
    left: ["KeyA"],
    right: ["KeyD"],
    bottom: ["KeyS"]
  });

  constructor(public width = 0, public height = width) { }

  onBomb(x: number, y: number, i: number) { }

  collision(
    [moveX, moveY]: TPoint,
    [x, y]: TPoint,
    [X, Y]: TPoint,
    top = .8,
    down = .2
  ) {
    if (y > Y - top && y < Y + top) {
      if (moveX > 0 && x > X - 1 && x < X - down) moveX = 0;
      if (moveX < 0 && x < X + 1 && x > X + down) moveX = 0;
    }
    if (x > X - top && x < X + top) {
      if (moveY > 0 && y > Y - 1 && y < Y - down) moveY = 0;
      if (moveY < 0 && y < Y + 1 && y > Y + down) moveY = 0;
    }

    return [moveX, moveY] as TPoint;
  }

  tick(deltaTime: number, time: number, game: GameMap) {
    const { keys, width, height } = this;
    const { map, bombs, players } = game;
    const size = width * height;

    let { x, y, animate, dir } = this;
    let speed = deltaTime * 0.003;

    let moveX = 0;
    let moveY = 0;

    if (animate !== EAnimate.DEATH) {
      if (keys.up.isDown()) moveY -= 1;
      if (keys.left.isDown()) moveX -= 1;
      if (keys.right.isDown()) moveX += 1;
      if (keys.bottom.isDown()) moveY += 1;

      if (moveY) dir = moveY < 0 ? EDir.TOP : EDir.BOTTOM;
      if (moveX) dir = moveX < 0 ? EDir.LEFT : EDir.RIGHT;
    }

    if (moveX && moveY) speed *= 0.7;
    if (!moveX && !moveY) speed *= 0;

    if (animate !== EAnimate.DEATH) {
      animate = speed ? EAnimate.RUNNING : EAnimate.IDLE;
    }

    moveX *= speed;
    moveY *= speed;

    for (let i = 0; i < size; i++) {
      if (!map[i]) continue;

      const X = i % width;
      const Y = (i - X) / width;

      [moveX, moveY] = this.collision(
        [moveX, moveY],
        [x, y],
        [X, Y]
      );
    }

    for (const bomb of bombs) {
      const X = bomb.x;
      const Y = bomb.y;

      if (Math.round(x) === X && Math.round(y) === Y)
        continue;

      [moveX, moveY] = this.collision(
        [moveX, moveY],
        [x, y],
        [X, Y]
      );
    }

    for (const player of players) {
      const X = player.x;
      const Y = player.y;

      if (player.animate === 2)
        continue;

      [moveX, moveY] = this.collision(
        [moveX, moveY],
        [x, y],
        [X, Y]
      );
    }

    x += moveX;
    y += moveY;

    x = toLimit(x, 0, width - 1);
    y = toLimit(y, 0, height - 1);

    this.x = x;
    this.y = y;
    this.dir = dir;
    this.animate = animate;
  }
}