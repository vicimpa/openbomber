import { effectObject } from "core/effectObject";
import { makeVec2Filter } from "core/makeVec2Filter";
import { point, points } from "core/point";
import spriteSrc from "images/bombs.png";

import { CrazyEffectSprite } from "./CrazyEffectSprite";
import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
import type { Vec2 } from "core/Vec2";

const BASE = points('0,0;1,0;2,0;1,0');
const CRAZY = points('0,1;1,1;2,1;1,1');
const RADIO = points('0,2;1,2;2,2;1,2');

export class BombSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  speed = 150;
  isCrazy = false;
  isRadio = false;
  isMove = false;

  startAnimate = -1;

  filter = makeVec2Filter(5);
  lastTime = 0;
  lastPos = this.clone();

  crazyEffect = new CrazyEffectSprite();

  previewPos?: Vec2;
  dir?: Vec2;

  effect(x: number, y: number, isMove: boolean, time: number) {
    effectObject(this, 'position', { x, y, isMove }, () => {
      if (!this.previewPos) {
        this.previewPos = this.clone();
        return;
      }
      this.lastPos.set(this);
      this.lastTime = time;

      const delta = this.cminus(this.previewPos).normalize();
      this.previewPos.set(this);
      if (isMove)
        this.dir = delta;
      else
        delete this.dir;
    });
  }

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1)
      this.startAnimate = time;

    const speed = this.isCrazy ? this.speed / 2 : this.speed;
    const list = this.isRadio ? RADIO : this.isCrazy ? CRAZY : BASE;
    const size = list.length;
    const frame = ((time - this.startAnimate) / speed | 0) % size;

    this.frame.set(list[frame]);
    this.crazyEffect.update(dtime, time);

    if (this.dir && this.isMove) {
      const delta = time - this.lastTime;
      this.set(
        this.filter(
          this.dir
            .ctimes(delta * .1)
            .plus(this.lastPos)
        )
      );
    } else {
      this.set(
        this.filter(
          this
        )
      );
    }
  }

  render(camera: Camera): void {
    super.render(camera);

    if (this.isCrazy) {
      this.crazyEffect.render(camera);
    }
  }
}