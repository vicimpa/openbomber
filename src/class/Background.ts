import { OUT_FRAME } from "config";
import sprite from "images/Map/Tile.png";

import { EMapItem, MAP_ITEMS } from "@shared/types";
import { generatePerlinNoise } from "@vicimpa/perlin-noise";

import { Entity } from "./Entity";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";

export class Background extends Entity {
  can = document.createElement('canvas');
  ctx = this.can.getContext('2d')!;

  pattern?: CanvasPattern;

  sprite = new Sprite(sprite, 32);
  points = [MAP_ITEMS[EMapItem.GRAS], MAP_ITEMS[EMapItem.SAND], MAP_ITEMS[EMapItem.CLEAR]];
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

  generate() {
    if (!this.sprite.ready) return;
    const { width, height } = this;

    const noise = generatePerlinNoise(
      width,
      height,
      {
        seed: 0
      }
    );

    this.can.width = width * OUT_FRAME;
    this.can.height = height * OUT_FRAME;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < height; x++) {
        this.sprite.render(
          this.ctx,
          this.getFrom(noise[x + y * width]),
          x * OUT_FRAME,
          y * OUT_FRAME
        );
      }
    }

    this.pattern = this.ctx.createPattern(this.can, 'repeat')!;
  }

  update(): void {
    if (this.ctx.imageSmoothingEnabled)
      this.ctx.imageSmoothingEnabled = false;
  }

  render(camera: Camera): void {
    if (!this.pattern)
      return this.generate();

    const s = 1 / camera.s;
    const X = camera.width * s * .5;
    const Y = camera.height * s * .5;

    const { ctx } = camera;

    ctx.fillStyle = this.pattern;
    ctx.fillRect(-X + camera.x, -Y + camera.y, X * 2, Y * 2);
  }
}