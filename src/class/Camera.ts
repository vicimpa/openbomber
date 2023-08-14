import { makeEffect } from "@/core/makeEffect";
import { makeNumberFilter } from "@/core/makeNumberFilter";
import { makeVec2Filter } from "@/core/makeVec2Filter";
import { cos, min, sin } from "@/core/math";
import { point } from "@/core/point";

import { Entity } from "./Entity";

import type { Vec2 } from "@/core/Vec2";
export class Camera extends Entity {
  ctx!: CanvasRenderingContext2D;

  resizeEffect = makeEffect<number>();

  get width() { return this.can.width; }
  get height() { return this.can.height; }

  focus?: Vec2;

  filter = makeVec2Filter(30);
  scaleFilter = makeNumberFilter(100);

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
    if (this.ctx.imageSmoothingEnabled)
      this.ctx.imageSmoothingEnabled = false;

    if (typeof this.can.offsetWidth === 'number')
      if (this.can.width !== this.can.offsetWidth)
        this.can.width = this.can.offsetWidth;

    if (typeof this.can.offsetHeight === 'number')
      if (this.can.height !== this.can.offsetHeight)
        this.can.height = this.can.offsetHeight;

    this.s = min(this.width, this.height) / (16 * 16);

    const stime = time * .00001;
    const move = (this.focus ? (
      this.focus.clone()
        .minus(this)
        .normalize()
    ) : (
      point(
        sin(stime),
        cos(stime)
      )
    )).times(
      (this.focus ? this.focus.length(this) * .01 : .03) * dtime
    );

    this.plus(move);
  }

  apply() {
    const { ctx, width, height, s, x, y } = this;
    const center = point(width, height).times(.5);

    ctx.resetTransform();
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(s, 0, 0, s, center.x - x * s, center.y - y * s);
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