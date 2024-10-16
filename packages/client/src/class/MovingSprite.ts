import { Frame } from "./Frame";
import { Sprite } from "./Sprite";
import { points } from "@ob/core/point";
import spriteSrc from "../images/bombKicking.png";

const FRAMES = points('0,0;1,0;2,0;3,0;4,0;5,0;6,0;7,0;8,0;9,0');

export class MovingSprite extends Frame {
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