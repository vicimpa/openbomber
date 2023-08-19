import { EMapItem, MAP_ITEMS } from "@/types";
import { OUT_FRAME } from "config";
import spriteSrc from "images/sprite.png";

import { Entity } from "./Entity";
import { Sprite } from "./Sprite";

import type { FocusCamera } from "./FocusCamera";

import type { Camera } from "./Camera";
import type { Game } from "./Game";
export class MapLayer extends Entity {
  sprite = new Sprite(spriteSrc);

  constructor(public game: Game) {
    super(-OUT_FRAME);
    this.appendTo(game);
  }

  mapLayer = document.createElement('canvas');
  mapCtx = this.mapLayer.getContext('2d')!;

  map = new Uint8Array(0);

  render(camera: Camera): void {
    const {
      game: {
        width,
        height,
        newRender,
      },
      sprite,
      mapLayer,
      mapCtx
    } = this;

    if (!width || !height) return;

    if (newRender && sprite.ready) {
      mapLayer.width = (width + 2) * OUT_FRAME;
      mapLayer.height = (height + 2) * OUT_FRAME;

      for (let y = -1; y <= height; y++) {
        for (let x = -1; x <= width; x++) {
          const value: EMapItem = (
            x < 0 || y < 0 || x === width || y === height
          ) ? EMapItem.WALL : newRender[y * width + x] ?? EMapItem.CLEAR;

          sprite.render(
            mapCtx,
            MAP_ITEMS[value],
            (x + 1) * OUT_FRAME,
            (y + 1) * OUT_FRAME
          );
        }
      }

      this.map = newRender;
      delete this.game.newRender;
    }

    camera.ctx.drawImage(
      mapLayer,
      0,
      0,
      (width + 2) * OUT_FRAME,
      (height + 2) * OUT_FRAME,
    );

    super.render(camera);
  }
}