import spriteSrc from "images/Shild/Shild1.png";
import backSpriteSrc from "images/Shild/Shild2.png";

import { points } from "@core/point";

import { FrameAnimation } from "./FrameAnimation";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";

const FRAMES = points('0,0;1,0;2,0;3,0;4,0;5,0;6,0');

export class ShieldSprite extends FrameAnimation {
  sprite = new Sprite(spriteSrc, 32, 16);
  backSprite = new Sprite(backSpriteSrc, 32, 16);
  speed = 140;
  frames = FRAMES;

  renderBack({ ctx }: Camera): void {
    this.backSprite.render(ctx, this.frame);
  }
}