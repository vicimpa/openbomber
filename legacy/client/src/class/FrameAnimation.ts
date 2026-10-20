import { Frame } from "./Frame";
import { Vec2 } from "@vicimpa/lib-vec2";
import { effectObject } from "@ob/core/effectObject";

export class FrameAnimation extends Frame {
  frames: Vec2[] = [];
  frame = new Vec2();
  speed = 100;
  startAnimate = -1;

  update(dtime: number, time: number): void {
    effectObject(this, 'animation', [
      this.sprite,
      this.speed,
      this.frames
    ], () => this.startAnimate = time);
    const { frames, speed, startAnimate } = this;
    this.frame = frames[((time - startAnimate) / speed | 0) % frames.length];
    this.frame.set(this.frame);
  }
}