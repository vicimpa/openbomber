import spriteSrc from "images/Bonus/Ikonki.png";

import { point } from "@core/point";
import { ACHIVMEN_POINTS, EAchivment } from "@shared/types";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";

export class AchivmentSprite extends Frame {
  sprite = new Sprite(spriteSrc, 32, 16);
  type!: EAchivment;

  update(dtime: number, time: number): void {
    this.frame.set(ACHIVMEN_POINTS[this.type] ?? point(-1, 0));
  }
}