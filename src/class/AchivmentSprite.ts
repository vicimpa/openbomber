import { point } from "@/point";
import { EAchivment } from "@/types";
import spriteSrc from "images/sprite.png";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

const FRAMES = {
  [EAchivment.APPEND_BOMB]: point(0, 14),
  [EAchivment.APPEND_EXPO]: point(1, 14),
  [EAchivment.ROLLERS]: point(2, 14),
  [EAchivment.APPEND_SPEED]: point(3, 14),
  [EAchivment.APPEND_SHIELD]: point(4, 14),
  [EAchivment.MOVING_BOMB]: point(5, 14),
  [EAchivment.FIRE]: point(6, 14),
  [EAchivment.RANDOM]: point(7, 14),
  [EAchivment.CRAZY_BOMB]: point(8, 14),
};

export class AchivmentSprite extends Frame {
  sprite = new Sprite(spriteSrc);
  type!: EAchivment;

  update(dtime: number, time: number): void {
    this.frame.set(FRAMES[this.type] ?? point(-1, 14));
  }
}