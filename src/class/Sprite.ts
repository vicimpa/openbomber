import { OUT_FRAME } from "config";

import type { Vec2 } from "@core/Vec2";

const CACHE = new Map<string | HTMLImageElement | HTMLCanvasElement, Sprite>();

export class Sprite {
  image?: HTMLImageElement | HTMLCanvasElement;
  delta = 0;

  get ready() {
    return !!this.image && !!this.image.width && !!this.image.height;
  }

  constructor(
    image: string | HTMLImageElement | HTMLCanvasElement,
    public grid = 16,
    public padding = 0
  ) {
    if (CACHE.has(image))
      return CACHE.get(image)!;

    this.delta = padding / grid;

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
    const { padding } = this;
    const grid = this.grid + padding * 2;
    const delta = OUT_FRAME * this.delta;

    ctx.drawImage(
      this.image,
      frame.x * grid,
      frame.y * grid,
      grid,
      grid,
      x - delta, y - delta,
      OUT_FRAME + delta * 2,
      OUT_FRAME + delta * 2
    );
  }
}