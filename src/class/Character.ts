import { makeEffect } from "@/makeEffect";
import { cos, sin } from "@/math";
import { point, points } from "@/point";
import { random } from "@/random";
import { toLimit } from "@/toLimit";
import { DIRECTIONS } from "@/types";
import sprite from "images/generic.png";

import { Entity } from "./Entity";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
import type { Vec2 } from "@/Vec2";
export class Character extends Entity {
  sprite = new Sprite(sprite, 16);
  cam?: Camera;

  frames = points('1,0;0,0;1,0;2,0');
  positions: (Vec2 | undefined)[] = [];
  vectors = Object.values(DIRECTIONS);
  effectPosition = makeEffect<Vec2 | undefined>();

  updatePositions() {
    if (!this.cam) return;
    this.positions.splice(0, this.positions.length - 10);
    let last = this.positions.at(-1);
    if (last) last = last.clone().plus(8);
    this.cam.focus = last;
  }

  newPosition() {
    if (!this.cam) return;

    this.positions.push(
      this.cam.clone()
        .plus(
          random(this.vectors)
            .clone()
            .times(1000)
        )
        .div(16)
        .floor()
        .times(16)
    );
  }

  removePosition() {
    if (!this.cam) return;
    this.positions.push(undefined);
  }

  update(dtime: number, time: number): void {
    this.effectPosition(
      this.positions.at(-1),
      (position) => {
        console.log(position?.toLog());
        this.updatePositions();
      }
    );
  }

  render(camera: Camera): void {
    const { sprite, frames } = this;
    const { ctx } = camera;

    for (const position of this.positions) {
      if (!position) continue;

      sprite.render(
        ctx,
        frames[0],
        position.x,
        position.y,
        16
      );
    }
  }
}