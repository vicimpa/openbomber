import { ACHIVMEN_POINTS, EAchivment } from "@ob/shared/types";

import { Frame } from "./Frame";
import { Sprite } from "./Sprite";
import { point } from "@ob/core/point";
import spriteSrc from "../images/Bonus/Ikonki.png";

export class AchivmentSprite extends Frame {
  sprite = new Sprite(spriteSrc, 32, 16);
  type!: EAchivment;

  update(dtime: number, time: number): void {
    this.frame.set(ACHIVMEN_POINTS[this.type] ?? point(-1, 0));
  }
}