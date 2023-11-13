import { effectObject } from "core/effectObject";
import { makeVec2Filter } from "core/makeVec2Filter";
import { point, points } from "core/point";
import baseSpriteSrc from "images/Bomb/cammon bomb3.png";
import radioSpriteSrc from "images/Bomb/distance bomb1.png";
import crazySpriteSrc from "images/Bomb/random bomb.png";
import spriteSrc from "images/bombs.png";

import { CrazyEffectSprite } from "./CrazyEffectSprite";
import { FrameAnimation } from "./FrameAnimation";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
import type { Vec2 } from "core/Vec2";
const BASE = points('0,0;1,0;2,0;3,0');

export class BombSprite extends FrameAnimation {
  baseBomb = new Sprite(baseSpriteSrc, 32, 16);
  crazyBomb = new Sprite(crazySpriteSrc, 32, 16);
  radioBomb = new Sprite(radioSpriteSrc, 32, 16);

  sprite = this.baseBomb;
  frames = BASE;

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
    if (this.isCrazy)
      this.sprite = this.crazyBomb;
    else if (this.isRadio)
      this.sprite = this.radioBomb;
    else
      this.sprite = this.baseBomb;

    super.update(dtime, time);
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