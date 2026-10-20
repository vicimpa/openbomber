import type { Camera } from "./Camera";
import { Entity } from "./Entity";
import type { Sprite } from "./Sprite";
import { Vec2 } from "@vicimpa/lib-vec2";

export class Frame extends Entity {
  sprite?: Sprite;

  frame = new Vec2();

  render(camera: Camera): void {
    const { ctx } = camera;
    const { frame } = this;

    if (!this.sprite)
      return;

    this.sprite.render(
      ctx,
      frame,
      0,
      0
    );
  }
}