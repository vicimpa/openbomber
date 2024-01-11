import { OUT_FRAME } from "config";
import spriteSrc from "images/Map/Tile.png";
import wartingSrc from "images/warning.png";

import { points } from "@core/point";
import { EMapItem, MAP_ITEMS } from "@shared/types";

import { Entity } from "./Entity";
import { Sprite } from "./Sprite";

import type { Camera } from "./Camera";
import type { Game } from "./Game";

const WARNING_FRAMES = points('0,0;1,0;2,0;3,0;4,0;5,0');

export class MapLayer extends Entity {
  sprite = new Sprite(spriteSrc, 32);
  warning = new Sprite(wartingSrc);

  constructor(public game: Game) {
    super(-OUT_FRAME);
    this.appendTo(game);
  }

  mapLayer = document.createElement('canvas');
  mapCtx = this.mapLayer.getContext('2d')!;

  map = new Uint8Array(0);

  limit = 0;
  warningFrame = 0;

  update(dtime: number, time: number): void {
    this.warningFrame = (time * .01 | 0) % WARNING_FRAMES.length;
  }

  render(camera: Camera): void {
    const {
      game: {
        width,
        height,
        newRender,
      },
      sprite,
      mapLayer,
      mapCtx,
      limit,
      warning,
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

    if (limit > 0) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const value: EMapItem = this.map[y * width + x];

          if (
            value !== EMapItem.WALL && (
              false
              || x <= limit - 1
              || y <= limit - 1
              || x >= width - 1 - limit + 1
              || y >= height - 1 - limit + 1
            )
          ) {
            warning.render(
              camera.ctx,
              WARNING_FRAMES[this.warningFrame],
              (x + 1) * OUT_FRAME,
              (y + 1) * OUT_FRAME
            );
          }
        }
      }
    }

    super.render(camera);
  }
}