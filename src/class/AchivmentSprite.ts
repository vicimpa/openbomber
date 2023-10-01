import { point } from "core/point";
import spriteSrc from "images/bonus.png";
import { EAchivment } from "shared/types";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

const FRAMES = {
  [EAchivment.APPEND_BOMB]: point(0, 0),
  [EAchivment.APPEND_EXPO]: point(1, 0),
  [EAchivment.ROLLERS]: point(2, 0),
  [EAchivment.APPEND_SPEED]: point(3, 0),
  [EAchivment.APPEND_SHIELD]: point(4, 0),
  [EAchivment.MOVING_BOMB]: point(5, 0),
  [EAchivment.FIRE]: point(6, 0),
  [EAchivment.RANDOM]: point(7, 0),
  [EAchivment.CRAZY_BOMB]: point(8, 0),
};

export class AchivmentSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  type!: EAchivment;

  update(dtime: number, time: number): void {
    this.frame.set(FRAMES[this.type] ?? point(-1, 0));
  }
}