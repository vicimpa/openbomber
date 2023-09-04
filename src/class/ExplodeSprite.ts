import { plus, point, points } from "@/point";
import { EExplodeDir, EXPODER_DIRS } from "@/types";
import blockSrc from "images/blockDestroy.png";
import explodeSrc from "images/explode.png";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";

const BASE = points("2,2;7,2;2,7;7,7");
const BLOCK = points("0,0;1,0;2,0;3,0;4,0;5,0");

class BlockSprite extends Frame {
  sprite = new Sprite(blockSrc);
  speed = 100;
  startAnimate = -1;

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1) {
      this.startAnimate = time;
    }

    const list = BLOCK;
    const size = list.length;
    const frame = ((time - this.startAnimate) / this.speed | 0) % size;
    this.frame.set(list[frame]);
  }
}

export class ExplodeSprite extends Frame {
  sprite = new Sprite(explodeSrc);
  speed = 100;

  isFinaly = false;
  isBlock = false;
  dir = EExplodeDir.CENTER;

  block?: BlockSprite;

  startAnimate = -1;

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1)
      this.startAnimate = time;

    if (this.isBlock && !this.block)
      this.block = new BlockSprite();

    if (!this.isBlock && this.block)
      delete this.block;

    if (this.block)
      this.block.update(dtime, time);

    const list = plus(BASE, EXPODER_DIRS[this.dir], 1 + +this.isFinaly);
    const size = list.length;
    const frame = ((time - this.startAnimate) / this.speed | 0) % size;
    this.frame.set(list[frame]);
  }

  render(camera: Camera): void {
    super.render(camera);

    if (this.block)
      this.block.render(camera);
  }
}