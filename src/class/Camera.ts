import { point } from "@/point";
import { Vec2 } from "@/Vec2";

import { Entity } from "./Entity";

export class Camera extends Entity {
  ctx!: CanvasRenderingContext2D;

  upScale = 1;

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
    const { upScale } = this;
    const { parentElement } = this.can;
    this.ctx.imageSmoothingEnabled = false;

    if (parentElement instanceof HTMLElement) {
      this.can.style.transform = `scale(${1 / upScale})`;

      if (typeof this.can.offsetWidth === 'number')
        if (this.can.width !== parentElement.offsetWidth * upScale)
          this.can.width = parentElement.offsetWidth * upScale;

      if (typeof this.can.offsetHeight === 'number')
        if (this.can.height !== parentElement.offsetHeight * upScale)
          this.can.height = parentElement.offsetHeight * upScale;
    }
  }

  apply() {
    const { ctx, width, height, s } = this;
    const translate = point(width, height)
      .times(.5)
      .minus(
        this.clone().times(s)
      ).round();

    ctx.resetTransform();
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(s, 0, 0, s, translate.x, translate.y);
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