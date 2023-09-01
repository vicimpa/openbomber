import { makeVec2Filter } from "@/makeVec2Filter";
import { min } from "@/math";
import { point } from "@/point";
import { toLimit } from "@/toLimit";
import { EEffect } from "@/types";
import { Vec2 } from "@/Vec2";
import { OUT_FRAME } from "config";
import { showDebug } from "data/debug";

import { Camera } from "./Camera";
import { Game } from "./Game";

export class FocusCamera extends Camera {
  focus?: Game;

  scale = 1;
  padding = 0;

  filterNeed = makeVec2Filter(25);
  need = point(0);

  update(dtime: number, time: number): void {
    const { focus } = this;

    if (focus instanceof Game) {
      const focusSize = new Vec2(focus.width, focus.height)
        .times(OUT_FRAME);

      showDebug({ focusSize });

      const focusPlayer = focus.waitRestart === -1 ? (
        focus.currentPlayerSprite // ?? focus.focusPlayer
      ) : undefined;

      if (focusPlayer) {
        this.need.set(
          this.filterNeed(
            focus
              .cplus(focusPlayer)
              .plus(.5 * OUT_FRAME)
          )
        );

        this.scale = min(this.width, this.height) / (OUT_FRAME * 10);
      } else if (focus.waitRestart == -1 && focus.positions.size) {
        const time = Date.now();
        const minVec = point(Infinity);
        const maxVec = point(-Infinity);

        for (const [_, item] of focus.positions) {
          minVec.maxLimit(item);
          maxVec.minLimit(item);
        }

        minVec.times(OUT_FRAME);
        maxVec.times(OUT_FRAME);

        for (const [_, item] of focus.effectsLayer.effects) {
          const { created, type } = item;
          if (type !== EEffect.DEATH) continue;
          if (created + 3000 < time) continue;
          minVec.maxLimit(item);
          maxVec.minLimit(item);
        }

        const size = maxVec.minus(minVec);
        const center = size.cdiv(2).plus(minVec).plus(.5 * OUT_FRAME);


        this.need.set(
          this.filterNeed(
            center.plus(focus)
          )
        );

        const vec = point(this.width, this.height)
          .div(size.plus(8 * OUT_FRAME));

        this.scale = toLimit(
          min(vec.x, vec.y),
          min(
            this.height / (focusSize.y + this.padding),
            this.width / (focusSize.x + this.padding)
          ),
          min(this.width, this.height) / (OUT_FRAME * 10)
        );

      } else {
        this.need.set(
          this.filterNeed(
            focusSize
              .cdiv(2)
              .plus(focus)
          )
        );

        this.scale = min(
          this.height / (focusSize.y + this.padding),
          this.width / (focusSize.x + this.padding)
        );
      }
    } else {
      this.need.set(this.cplus(dtime * .5, dtime * .3));

      this.scale = min(
        this.width,
        this.height
      ) / (OUT_FRAME * 10);
    }

    this.plus(
      this.need
        .minus(this)
        .times(dtime * .005)
    );
    this.s += (this.scale - this.s) * dtime * .002;
    super.update(dtime, time);

    showDebug('Camera', this);
    showDebug('Need', this.need);
    showDebug('Focus', this.focus);
  }
}