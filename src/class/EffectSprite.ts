import { points } from "@/point";
import { toLimit } from "@/toLimit";
import { EEffect } from "@/types";
import spriteSrc from "images/sprite.png";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

const FRAMES = {
  [EEffect.DEATH]: points('0,2;1,2;2,2;3,2;4,2;5,2;6,2;7,2'),
  [EEffect.FAKE_EXPLODE]: points('8,0;9,0;10,0;11,0;12,0;13,0;8,1;9,1;10,1;11,1;12,1;13,1')
};

export class EffectSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  type!: EEffect;
  speed = 100;

  startAnimate = -1;

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1)
      this.startAnimate = time;

    const frame = (time - this.startAnimate) / this.speed | 0;
    const list = FRAMES[this.type];
    this.frame.set(list[toLimit(frame, 0, list.length - 1)]);
  }
}