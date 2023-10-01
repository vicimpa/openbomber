import { points } from "core/point";
import spriteSrc from "images/bombs.png";

import { CrazyEffectSprite } from "./CrazyEffectSprite";
import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
const BASE = points('0,0;1,0;2,0;1,0');
const CRAZY = points('0,1;1,1;2,1;1,1');
const RADIO = points('0,2;1,2;2,2;1,2');

export class BombSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  speed = 150;
  isCrazy = false;
  isRadio = false;

  startAnimate = -1;

  crazyEffect = new CrazyEffectSprite();

  update(dtime: number, time: number): void {
    if (this.startAnimate === -1)
      this.startAnimate = time;

    const speed = this.isCrazy ? this.speed / 2 : this.speed;
    const list = this.isRadio ? RADIO : this.isCrazy ? CRAZY : BASE;
    const size = list.length;
    const frame = ((time - this.startAnimate) / speed | 0) % size;

    this.frame.set(list[frame]);
    this.crazyEffect.update(dtime, time);
  }

  render(camera: Camera): void {
    super.render(camera);

    if (this.isCrazy) {
      this.crazyEffect.render(camera);
    }
  }
}