import { points } from "@/point";
import spriteSrc from "images/sprite.png";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

const FRAMES = points('0,3;1,3;2,3;1,3');

export class BombSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  speed = 150;
  isCrazy = false;
  startAnimate = -1;

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1)
      this.startAnimate = time;

    const size = FRAMES.length;
    const frame = ((time - this.startAnimate) / this.speed | 0) % size;

    this.frame.set(FRAMES[frame]);
  }
}