import { Entity } from "./Entity";
import { makeNumberFilter } from "@ob/core/makeNumberFilter";
import { point } from "@ob/core/point";
import { writable } from "svelte/store";

export class Camera extends Entity {
  ctx!: CanvasRenderingContext2D;
  fps = 0;
  fpsState = writable(0);

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

  fpsFilter = makeNumberFilter(30);

  update(dtime: number, time: number): void {
    const { upScale } = this;
    const { parentElement } = this.can;
    this.fps = this.fpsFilter(1000 / dtime);
    this.fpsState.set(this.fps | 0);
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
      .minus(this.ctimes(s));

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