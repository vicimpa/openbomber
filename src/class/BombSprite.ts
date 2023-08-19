import { points } from "@/point";
import spriteSrc from "images/sprite.png";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

const FRAMES = points('0,3;1,3;2,3;1,3');
const CRAZY = points('8,2;9,2;10,2;9,2');

export class BombSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  speed = 150;
  isCrazy = false;
  startAnimate = -1;

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1)
      this.startAnimate = time;

    const speed = this.isCrazy ? this.speed / 2 : this.speed;
    const list = this.isCrazy ? CRAZY : FRAMES;
    const size = list.length;
    const frame = ((time - this.startAnimate) / speed | 0) % size;

    this.frame.set(list[frame]);
  }
}