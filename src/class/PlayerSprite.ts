import { plus, point, points } from "@/point";
import { EAnimate, EDir } from "@/types";
import { OUT_FRAME } from "config";
import spriteSrc from "images/characters.png";

import { FireSprite } from "./FireSprite";
import { Frame } from "./Frame";
import { ShieldSprite } from "./ShieldSprite";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
const BASE = points('1,1;0,1;1,1;2,1');

const FRAMES = {
  [EDir.TOP]: plus(BASE, point(9, 0)),
  [EDir.LEFT]: plus(BASE, point(3, 0)),
  [EDir.RIGHT]: plus(BASE, point(6, 0)),
  [EDir.BOTTOM]: plus(BASE, point(0, 0)),
};

export class PlayerSprite extends Frame {
  id = -1;
  sprite = new Sprite(spriteSrc);
  speed = 150;
  color = 0;

  dir = EDir.BOTTOM;
  animate = EAnimate.IDLE;
  previewAnimate?: EAnimate;

  isFire = false;
  isShield = false;

  fireAnimate = new FireSprite();
  shieldAnimate = new ShieldSprite();

  name = '';

  startAnimate = 0;

  update(dtime: number, time: number): void {
    if (this.animate !== this.previewAnimate) {
      this.previewAnimate = this.animate;
      this.startAnimate = time;
    }

    this.fireAnimate.update(dtime, time);
    this.shieldAnimate.update(dtime, time);

    const list = FRAMES[this.dir];
    const size = this.animate === EAnimate.IDLE ? 1 : list.length;
    const frame = ((time - this.startAnimate) / this.speed | 0) % size;

    this.frame.set(list[frame].clone().times(1, this.color));
  }

  render(camera: Camera): void {
    if (this.isFire)
      this.fireAnimate.render(camera);

    super.render(camera);

    if (this.name) {
      camera.ctx.fillStyle = '#fff';
      camera.ctx.font = "normal 4px serif";
      camera.ctx.textAlign = 'center';
      camera.ctx.textBaseline = 'bottom';
      camera.ctx.fillText(
        this.name,
        OUT_FRAME / 2 | 0,
        0
      );

    }

    if (this.isShield)
      this.shieldAnimate.render(camera);
  }
}