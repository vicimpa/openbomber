import { DIRECTIONS, EAnimate, EDir } from "@ob/shared/types";

import type { Camera } from "./Camera";
import { CrazyEffectSprite } from "./CrazyEffectSprite";
import { Entity } from "./Entity";
import { FireSprite } from "./FireSprite";
import { MovingSprite } from "./MovingSprite";
import { OUT_FRAME } from "../config";
import { SPRITES } from "../images/Heroes2/";
import { ShieldSprite } from "./ShieldSprite";
import { Sprite } from "./Sprite";
import { Vec2 } from "@vicimpa/lib-vec2";
import { calcSpeed } from "@ob/core/calcSpeed";
import dust1Src from "../images/Dust/Dust1.png";
import dust2Src from "../images/Dust/Dust2.png";
import { effectObject } from "@ob/core/effectObject";
import { makeVec2Filter } from "@ob/core/makeVec2Filter";
import { points } from "@ob/core/point";

const IDLE = points('0,0;1,0;2,0;3,0');
const RUNNING = points('0,0;1,0;2,0;3,0;4,0;5,0');

const sprites = SPRITES.map(e => new Sprite(e, 32, 16));

const FRAMES = {
  [EDir.TOP]: new Vec2(0, 2 * 4),
  [EDir.LEFT]: new Vec2(0, 3 * 4),
  [EDir.RIGHT]: new Vec2(0, 1 * 4),
  [EDir.BOTTOM]: new Vec2(0, 5 * 0),
};

export class PlayerSprite extends Entity {
  id = -1;
  frame = new Vec2();
  speed = 150;
  skin = 0;
  customSkin = -1;

  // cap = new Sprite(NewYear, 32, 16);

  get sprite() { return sprites[this.skin] ?? sprites[0]; };

  dust1 = new Sprite(dust1Src, 32, 16);
  dust2 = new Sprite(dust2Src, 32, 16);

  dir = EDir.BOTTOM;
  animate = EAnimate.IDLE;
  previewAnimate?: EAnimate;

  isFire = false;
  isShield = false;
  isCrazy = false;
  isMoving = false;
  isAdmin = false;
  isSpeedUp = false;

  fireAnimate = new FireSprite();
  shieldAnimate = new ShieldSprite();
  crazyEffect = new CrazyEffectSprite();
  movingAnimate = new MovingSprite();

  moveSpeed = 0;
  posFilter = makeVec2Filter(10);
  lastPos = this.clone();
  lastTime = 0;
  isMe = false;

  name = '';

  startAnimate = 0;

  effect(x: number, y: number, dir: EDir, animate: EAnimate, time: number) {
    effectObject(this, 'pos', { x, y, dir, animate }, () => {
      this.lastTime = time;
      this.lastPos.set(this);
    });
  }

  update(dtime: number, time: number): void {
    if (this.animate !== this.previewAnimate) {
      this.previewAnimate = this.animate;
      this.startAnimate = time;
    }

    this.fireAnimate.update(dtime, time);
    this.shieldAnimate.update(dtime, time);
    this.crazyEffect.update(dtime, time);
    this.movingAnimate.update(dtime, time);

    const speed = this.animate === EAnimate.IDLE ? 200 : 100;
    const list = this.animate === EAnimate.IDLE ? IDLE : RUNNING;
    const size = list.length;
    const frame = (((time - this.startAnimate) / speed | 0) + +(this.animate === EAnimate.RUNNING)) % size;

    this.frame.set(list[frame].ctimes(1, this.skin));
    this.frame.plus(0, this.animate === EAnimate.IDLE ? 2 : 3);
    this.frame.plus(FRAMES[this.dir]);

    if (!this.isMe && time - this.lastTime < 50) {
      this.set(
        this.posFilter(
          DIRECTIONS[this.dir]
            .ctimes(this.animate)
            .normalize()
            .times(OUT_FRAME)
            .times(calcSpeed(time - this.lastTime, this.moveSpeed))
            .plus(this.lastPos))
      );
    } else {
      this.set(this.posFilter(this));
    }
  }

  render(camera: Camera): void {
    const { ctx } = camera;

    if (this.isShield)
      this.shieldAnimate.renderBack(camera);

    if (this.isFire)
      this.fireAnimate.renderBack(camera);

    if (this.isSpeedUp)
      this.dust1.render(ctx, this.frame);

    this.sprite.render(ctx, this.frame);

    // this.cap.render(ctx, this.frame);

    if (this.isSpeedUp)
      this.dust2.render(ctx, this.frame);

    if (this.isShield)
      this.shieldAnimate.render(camera);

    if (this.isFire)
      this.fireAnimate.render(camera);

    if (this.isMoving)
      this.movingAnimate.render(camera);

    if (this.isCrazy)
      this.crazyEffect.render(camera);

    if (this.name) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = this.isAdmin ? '#f00' : '#fff';
      ctx.font = this.isAdmin ? "bold 5px BetterVCR" : "normal 4px BetterVCR";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.name, OUT_FRAME / 2, -2);
      ctx.globalAlpha = 1;
    }
  }
}