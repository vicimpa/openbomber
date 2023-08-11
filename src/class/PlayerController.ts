import { makeController } from "library/makeController";
import { toLimit } from "library/toLimit";
import { EAnimate, EDir, EMapItem } from "types";

import type { GameMap } from "./GameMap";
import type { TPoint } from "library/point";

export class PlayerController {
  x = 0;
  y = 0;

  dir: EDir = EDir.BOTTOM;
  animate: EAnimate = EAnimate.IDLE;

  keys = makeController({
    up: ["KeyW", "ArrowUp"],
    left: ["KeyA", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
    bottom: ["KeyS", "ArrowDown"]
  });

  constructor(public width = 0, public height = width) { }

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
    [moveX, moveY]: TPoint,
    [x, y]: TPoint,
    [X, Y]: TPoint,
    top = .8,
    down = .2,
    canCircle = false
  ) {
    if (y > Y - top && y < Y + top) {
      if (
        false
        || (moveX > 0 && x > X - 1 && x < X - down)
        || (moveX < 0 && x < X + 1 && x > X + down)
      ) {
        if (canCircle)
          moveY = this.circle(y, Y, moveY, moveX);
        moveX = 0;
      }
    }

    if (x > X - top && x < X + top) {
      if (
        false
        || (moveY > 0 && y > Y - 1 && y < Y - down)
        || (moveY < 0 && y < Y + 1 && y > Y + down)
      ) {
        if (canCircle)
          moveX = this.circle(x, X, moveX, moveY);
        moveY = 0;
      }
    }

    return [moveX, moveY] as TPoint;
  }

  tick(deltaTime: number, time: number, game: GameMap) {
    const { keys, width, height } = this;
    const { map, bombs, playersWidthPositions } = game;
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
      if (
        false
        || map[i] === EMapItem.CLEAR
        || map[i] === EMapItem.GRAS
        || map[i] === EMapItem.SAND
      ) continue;

      const X = i % width;
      const Y = (i - X) / width;

      [moveX, moveY] = this.collision(
        [moveX, moveY],
        [x, y],
        [X, Y],
        undefined,
        undefined,
        map[i] == EMapItem.WALL
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

    for (const player of playersWidthPositions) {
      const X = player.x ?? 0;
      const Y = player.y ?? 0;

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