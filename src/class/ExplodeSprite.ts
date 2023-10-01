import { plus, point, points } from "core/point";
import { toLimit } from "core/toLimit";
import blockSrc from "images/destroyBlock2.png";
import explodeSrc from "images/explode.png";
import { EExplodeDir, EXPODER_DIRS } from "shared/types";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
const BASE = points("2,2;7,2;2,7;7,7");
const BLOCK = points("0,0;1,0;2,0;3,0;4,0;5,0;6,0;7,0;8,0");

class BlockSprite extends Frame {
  sprite = new Sprite(blockSrc);
  speed = 50;
  startAnimate = -1;

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1) {
      this.startAnimate = time;
    }

    const list = BLOCK;
    const size = list.length;
    const frame = toLimit(((time - this.startAnimate) / this.speed | 0), 0, size - 1);
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
    if (this.block)
      this.block.render(camera);

    super.render(camera);
  }
}