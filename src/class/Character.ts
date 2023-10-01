import { OUT_FRAME } from "config";
import { effectObject } from "core/effectObject";
import { point } from "core/point";
import spriteMode from "images/characters-model.png";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
export class Character extends Frame {
  sourceFrame = new Sprite(spriteMode);

  headType = 0;
  headColors = [0, 0, 0, 0, 0];

  bodyType = 0;
  bodyColors = [0, 0, 0, 0, 0];

  render(camera: Camera): void {
    if (!this.sourceFrame.ready)
      return;

    const { headType, bodyType, headColors, bodyColors } = this;

    effectObject(
      this,
      'params',
      [headType, bodyType, headColors, bodyColors],
      () => {
        const can = document.createElement('canvas')!;
        const ctx = can.getContext('2d')!;

        can.width = 12 * OUT_FRAME;
        can.height = OUT_FRAME;

        this.sourceFrame.render(ctx, point(0, 0), 0, 0);
        this.sprite = new Sprite(can);
      }
    );

    super.render(camera);
  }
}