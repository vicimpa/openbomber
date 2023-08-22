import { makeVec2Filter } from "@/makeVec2Filter";
import { min } from "@/math";
import { point } from "@/point";
import { Vec2 } from "@/Vec2";
import { OUT_FRAME } from "config";

import { Camera } from "./Camera";
import { Game } from "./Game";
import { PlayerSprite } from "./PlayerSprite";
import { toLimit } from "@/toLimit";

export class FocusCamera extends Camera {
  focus?: Game | PlayerSprite;

  scale = 1;
  padding = 0;

  filterNeed = makeVec2Filter(25);
  need = point(0);

  update(dtime: number, time: number): void {
    const { focus } = this;


    if (focus instanceof Game) {
      const focusSize = new Vec2(focus.width, focus.height)
        .times(OUT_FRAME);

      const minScale = min(this.width, this.height) / (OUT_FRAME * 10)
      const maxScale = min(
        this.height / (focusSize.y + this.padding),
        this.width / (focusSize.x + this.padding)
      )

      const rectView = focus.positions.size ? (
        [...focus.positions].reduce((acc, [, { x, y }]) => {
          if(acc.min.x > x) acc.min.x = x;
          if(acc.min.y > y) acc.min.y = y;
          if(acc.max.x < x) acc.max.x = x;
          if(acc.max.y < y) acc.max.y = y;
          return acc;
        }, {min: new Vec2(Infinity), max: new Vec2(-Infinity)})
      ) : null

      const focusPlayer = focus.waitRestart === -1 ? (
        focus.currentPlayerSprite // ?? focus.focusPlayer
      ) : undefined;

      if (focusPlayer) {
        this.need.set(
          this.filterNeed(
            focus.clone()
              .plus(focusPlayer)
          )
        );

        this.scale = minScale;
      } else if(focus.waitRestart == -1 && rectView) {
        const {min: minVec, max: maxVec} = rectView;
        const size = maxVec.clone().minus(minVec)
        const center = size.clone().div(2).plus(minVec)

        size.times(OUT_FRAME)
        center.times(OUT_FRAME)

        this.need.set(
          this.filterNeed(
            center
            .plus(minVec)
            .plus(focus)
          )
        );

        const vec = point(this.width, this.height)
            .div(
              size.clone()
                .plus(8 * OUT_FRAME)
            )

        this.scale = toLimit(
          min(vec.x, vec.y),
          maxScale, 
          minScale
        )
        
      } else {
        this.need.set(
          this.filterNeed(
            focusSize.clone()
              .div(2)
              .plus(focus)
          )
        );

        this.scale = maxScale;
      }
    }


    this.plus(
      this.need
        .minus(this)
        .times(dtime * .005)
    );
    this.s += (this.scale - this.s) * dtime * .002;
    super.update(dtime, time);
  }
}