import { points } from "core/point";
import spriteSrc from "images/Fire/Fire1.png";
import spriteBackSrc from "images/Fire/Fire2.png";

import { FrameAnimation } from "./FrameAnimation";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";

const FRAMES = points('0,0;1,0;2,0;3,0;4,0;5,0;6,0');

export class FireSprite extends FrameAnimation {
  sprite = new Sprite(spriteSrc, 32, 16);
  backSprite = new Sprite(spriteBackSrc, 32, 16);
  speed = 100;
  frames = FRAMES;

  renderBack({ ctx }: Camera): void {
    this.backSprite.render(ctx, this.frame);
  }
}