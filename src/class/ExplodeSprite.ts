import { plus, points } from "core/point";
import { toLimit } from "core/toLimit";
import blockSrc from "images/DestroyBox/DestroyBox.png";
import explodeSrc from "images/explode/explode.png";
import { EExplodeDir, EXPODER_DIRS } from "shared/types";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";

const BASE = points("12,2;22,2;27,2;27,2;27,2;27,2;32,2;37,2;42,2");
const BLOCK = points("0,0;1,0;2,0;3,0;4,0;5,0;6,0;7,0;8,0");

class BlockSprite extends Frame {
  sprite = new Sprite(blockSrc, 32, 16);
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
  isFinaly = false;
  isBlock = false;
  dir = EExplodeDir.CENTER;

  block?: BlockSprite;

  startAnimate = -1;

  sprite = new Sprite(explodeSrc, 32, 0);
  speed = 500 / BASE.length;
  frames = plus(BASE, EXPODER_DIRS[this.dir], 1 + +this.isFinaly);

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