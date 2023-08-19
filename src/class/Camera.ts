import { point } from "@/point";

import { Entity } from "./Entity";

import type { Vec2 } from "@/Vec2";

export class Camera extends Entity {
  ctx!: CanvasRenderingContext2D;

  get width() { return this.can.width; }
  get height() { return this.can.height; }

  constructor(
    public can: HTMLCanvasElement,
    x?: number,
    y?: number,
    public s: number = 1
  ) {
    super(x ?? 0, y ?? x ?? 0);
    this.ctx = can.getContext('2d')!;
  }

  update(dtime: number, time: number): void {
    this.ctx.imageSmoothingEnabled = false;

    if (typeof this.can.offsetWidth === 'number')
      if (this.can.width !== this.can.offsetWidth)
        this.can.width = this.can.offsetWidth;

    if (typeof this.can.offsetHeight === 'number')
      if (this.can.height !== this.can.offsetHeight)
        this.can.height = this.can.offsetHeight;
  }

  apply() {
    const { ctx, width, height, s, x, y } = this;
    const center = point(width, height).times(.5);

    ctx.resetTransform();
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(s, 0, 0, s, center.x - x * s, center.y - y * s);
  }

  inCamera(x: number, y: number, width: number, height: number) {

  }

  save() {
    return this.ctx.save();
  }

  restore() {
    return this.ctx.restore();
  }

  renderObject(object: Entity) {
    const { x, y } = object;
    this.ctx.transform(1, 0, 0, 1, x, y);
    object.render(this);
  }
}