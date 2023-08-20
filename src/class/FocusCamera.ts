import { makeVec2Filter } from "@/makeVec2Filter";
import { min } from "@/math";
import { point } from "@/point";
import { Vec2 } from "@/Vec2";
import { OUT_FRAME } from "config";

import { Camera } from "./Camera";
import { Game } from "./Game";
import { PlayerSprite } from "./PlayerSprite";

export class FocusCamera extends Camera {
  focus?: Game | PlayerSprite;

  scale = 1;
  padding = 0;

  filterNeed = makeVec2Filter(25);
  need = point(0);

  update(dtime: number, time: number): void {

    const { focus } = this;

    if (focus instanceof Game) {
      const focusPlayer = focus.waitRestart === -1 ? (
        focus.currentPlayerSprite ?? focus.focusPlayer
      ) : undefined;

      if (focusPlayer) {
        this.need.set(
          this.filterNeed(
            focus.clone()
              .plus(focusPlayer)
          )
        );

        this.scale = min(this.width, this.height) / (OUT_FRAME * 10);
      } else {
        const size = new Vec2(focus.width, focus.height)
          .times(OUT_FRAME);

        this.need.set(
          this.filterNeed(
            size.clone()
              .div(2)
              .plus(focus)
          )
        );

        this.scale = min(
          this.height / (size.y + this.padding),
          this.width / (size.x + this.padding)
        );
      }
    }


    this.plus(
      this.need
        .minus(this)
        .times(dtime * .005)
    );
    this.s += (this.scale - this.s) * dtime * .005;
    super.update(dtime, time);
  }
}