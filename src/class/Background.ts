import { points } from "@/core/point";
import { random } from "@/core/random";
import { generatePerlinNoise } from "@vicimpa/perlin-noise";
import sprite from "images/sprite.png";

import { Entity } from "./Entity";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
export class Background extends Entity {
  can = document.createElement('canvas');
  ctx = this.can.getContext('2d')!;

  pattern?: CanvasPattern;

  sprite = new Sprite(sprite, 16);
  points = points('6,1;7,0;6,0');
  persent = [.2, .4];

  constructor(public width: number, public height: number) {
    super(0, 0);
  }

  getFrom(i: number) {
    const { persent, points } = this;
    for (let j = 0; j < persent.length; j++) {
      if (i < persent[j])
        return points[j];
    }
    return points[persent.length];
  }

  generate(width: number, height: number, size = 16) {
    const noise = generatePerlinNoise(width, height);
    this.can.width = width * size;
    this.can.height = height * size;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < height; x++) {
        this.sprite.render(
          this.ctx,
          this.getFrom(noise[x + y * width]),
          x * size,
          y * size,
          size
        );
      }
    }

    this.pattern = this.ctx.createPattern(this.can, 'repeat')!;
  }

  update(dtime: number, time: number): void {
    if (this.ctx.imageSmoothingEnabled)
      this.ctx.imageSmoothingEnabled = false;
    if (!this.pattern && this.sprite.ready) {
      this.generate(this.width, this.height);
    }
  }

  render(camera: Camera): void {
    if (!this.pattern)
      return;

    const s = 1 / camera.s;
    const X = camera.width * s * .5;
    const Y = camera.height * s * .5;

    const { ctx } = camera;
    ctx.fillStyle = this.pattern;
    ctx.fillRect(-X + camera.x, -Y + camera.y, X * 2, Y * 2);
  }
}