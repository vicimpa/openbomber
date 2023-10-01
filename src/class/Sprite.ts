import { OUT_FRAME } from "config";

import type { Vec2 } from "core/Vec2";
const CACHE = new Map<string | HTMLImageElement | HTMLCanvasElement, Sprite>();

export class Sprite {
  image?: HTMLImageElement | HTMLCanvasElement;

  get ready() {
    return !!this.image && !!this.image.width && !!this.image.height;
  }

  constructor(
    image: string | HTMLImageElement | HTMLCanvasElement,
    public grid = 16
  ) {
    if (CACHE.has(image))
      return CACHE.get(image)!;

    if (typeof image === 'string') {
      const img = new Image();

      img.onload = () => {
        this.image = img;
      };

      img.onerror = (e) => {
        throw e;
      };

      img.src = image;
    } else {
      this.image = image;
    }

    CACHE.set(image, this);
  }

  render(
    ctx: CanvasRenderingContext2D,
    frame: Vec2,
    x = 0,
    y = 0
  ) {
    if (!this.image) return;

    ctx.drawImage(
      this.image,
      frame.x * this.grid,
      frame.y * this.grid,
      this.grid,
      this.grid,
      x, y,
      OUT_FRAME,
      OUT_FRAME
    );
  }
}