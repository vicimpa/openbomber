import { plus, point, points } from "@/point";
import { EAnimate, EDir } from "@/types";
import { OUT_FRAME } from "config";
import { IS_DEV } from "env";
import spriteSrc from "images/characters.png";

import { CrazyEffectSprite } from "./CrazyEffectSprite";
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
  isCrazy = false;

  fireAnimate = new FireSprite();
  shieldAnimate = new ShieldSprite();
  crazyEffect = new CrazyEffectSprite();

  name = '';

  startAnimate = 0;

  update(dtime: number, time: number): void {
    if (this.animate !== this.previewAnimate) {
      this.previewAnimate = this.animate;
      this.startAnimate = time;
    }

    this.fireAnimate.update(dtime, time);
    this.shieldAnimate.update(dtime, time);
    this.crazyEffect.update(dtime, time);

    const list = FRAMES[this.dir];
    const size = this.animate === EAnimate.IDLE ? 1 : list.length;
    const frame = ((time - this.startAnimate) / this.speed | 0) % size;

    this.frame.set(list[frame].ctimes(1, this.color));
  }

  render(camera: Camera): void {
    const { ctx } = camera;

    if (this.isFire)
      this.fireAnimate.render(camera);

    super.render(camera);


    if (this.name) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#fff';
      ctx.font = "normal 3px BetterVCR";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.name, OUT_FRAME / 2, 0);
      ctx.globalAlpha = 1;
    }

    if (this.isShield)
      this.shieldAnimate.render(camera);

    if (this.isCrazy)
      this.crazyEffect.render(camera);

    if (IS_DEV)
      ctx.strokeRect(0, 0, OUT_FRAME, OUT_FRAME);
  }
}