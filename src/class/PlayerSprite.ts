import { OUT_FRAME } from "config";
import { calcSpeed } from "core/calcSpeed";
import { effectObject } from "core/effectObject";
import { makeVec2Filter } from "core/makeVec2Filter";
import { plus, point, points } from "core/point";
import { debug } from "data/debug";
import { IS_DEV } from "env";
import spriteSrc from "images/characters.png";
import CustomSpriteSrc from "images/CustomCharacters.png";
import { DIRECTIONS, EAnimate, EDir } from "shared/types";

import { CrazyEffectSprite } from "./CrazyEffectSprite";
import { FireSprite } from "./FireSprite";
import { Frame } from "./Frame";
import { MovingSprite } from "./MovingSprite";
import { ShieldSprite } from "./ShieldSprite";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";

const BASE = points('1,1;0,1;1,1;2,1');

const FRAMES = {
  [EDir.TOP]: plus(BASE, point(9, 0)),
  [EDir.LEFT]: plus(BASE, point(3, 0)),
  [EDir.RIGHT]: plus(BASE, point(6, 0)),
  [EDir.BOTTOM]: plus(BASE, point(0, 0)),
};

export class PlayerSprite extends Frame {
  id = -1;
  MainSprites = new Sprite(spriteSrc);
  CustumSprites = new Sprite(CustomSpriteSrc);
  sprite = this.MainSprites;
  speed = 150;
  skin = 0;
  customSkin = -1;

  dir = EDir.BOTTOM;
  animate = EAnimate.IDLE;
  previewAnimate?: EAnimate;

  isFire = false;
  isShield = false;
  isCrazy = false;
  isMoving = false;
  isAdmin = false;

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

    const list = FRAMES[this.dir];
    const size = this.animate === EAnimate.IDLE ? 1 : list.length;
    const frame = ((time - this.startAnimate) / this.speed | 0) % size;

    this.frame.set(list[frame].ctimes(1, this.skin));

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

    if (this.isFire)
      this.fireAnimate.render(camera);

    super.render(camera);


    if (this.name) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = this.isAdmin ? '#f00' : '#fff';
      ctx.font = this.isAdmin ? "bold 4px BetterVCR" : "normal 3px BetterVCR";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.name, OUT_FRAME / 2, 0);
      ctx.globalAlpha = 1;
    }

    if (this.isMoving)
      this.movingAnimate.render(camera);

    if (this.isShield)
      this.shieldAnimate.render(camera);

    if (this.isCrazy)
      this.crazyEffect.render(camera);

    // if (IS_DEV)
    //   ctx.strokeRect(0, 0, OUT_FRAME, OUT_FRAME);
  }
}