import type { Vec2 } from "@/Vec2";

const CACHE = new Map<string, Sprite>();

export class Sprite {
  image = new Image();
  ready = false;

  constructor(
    image: string,
    public grid = 16
  ) {
    if (CACHE.has(image))
      return CACHE.get(image)!;

    this.image.src = image;
    this.image.onload = (
      () => this.ready = true
    );

    CACHE.set(image, this);
  }

  render(ctx: CanvasRenderingContext2D, frame: Vec2, x: number, y: number, size = this.grid) {
    ctx.drawImage(
      this.image,
      frame.x * this.grid,
      frame.y * this.grid,
      this.grid,
      this.grid,
      x, y,
      size,
      size
    );
  }
}