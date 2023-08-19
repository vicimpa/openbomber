import { points } from "@/point";
import spriteSrc from "images/sprite.png";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

const FRAMES = points('0,2;1,2;2,2;3,2;4,2');

export class FireSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  speed = 100;

  startAnimate = -1;

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1)
      this.startAnimate = time;

    const frame = ((time - this.startAnimate) / this.speed | 0) % FRAMES.length;

    this.frame.set(FRAMES[frame]);
  }
}