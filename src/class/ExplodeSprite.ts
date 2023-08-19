import { plus, point, points } from "@/point";
import { EExplodeDir, EXPODER_DIRS } from "@/types";
import spriteSrc from "images/sprite.png";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

const BASE = points("2,6;7,6;2,11;7,11");
const BLOCK = points("5,3;6,3;7,3;8,3;9,3,10,3;0,5");

export class ExplodeSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  speed = 100;

  isFinaly = false;
  isBlock = false;
  dir = EExplodeDir.CENTER;

  startAnimate = -1;

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1) {
      this.startAnimate = time;
    }

    const list = this.isBlock ? BLOCK : plus(BASE, EXPODER_DIRS[this.dir], 1 + +this.isFinaly);
    const size = list.length;
    const frame = ((time - this.startAnimate) / this.speed | 0) % size;
    this.frame.set(list[frame]);
  }
}