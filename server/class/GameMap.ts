import { generatePerlinNoise } from "@vicimpa/perlin-noise";

import { random } from "../../core/random";
import { DIRECTIONS, EMapItem } from "../../shared/types";
import { Game } from "./Game";

import type { TConfig } from "./Game";

export class GameMap extends Uint8Array {
  width: number;
  height: number;
  achivments = new Set<number>();
  noize: number[] = [];

  constructor(
    public game: Game
  ) {
    const { width, height } = game;
    super(width * height);
    this.width = width;
    this.height = height;
    this.noize = generatePerlinNoise(width, height);
  }

  generate(config: TConfig) {
    const { width, } = this;

    const {
      fillAchivments,
      fillBlocks,
    } = config;

    const positions = new Set<number>();

    this.achivments.clear();

    for (let i = 0; i < this.length; i++) {
      let x = i % width;
      let y = i / width;

      if (x & 1 && y & 1) {
        this[i] = EMapItem.WALL;
      } else {
        const n = this.noize[i];
        this[i] = n < .1 ? EMapItem.GRAS : n < .4 ? EMapItem.SAND : EMapItem.CLEAR;
        positions.add(i);
      }
    }

    for (const { x: X, y: Y } of this.game.startPositions) {
      for (let i = 0; i <= 2; i++) {
        for (const [, dir] of Object.entries(DIRECTIONS)) {
          const { x: dx, y: dy } = dir;
          let x = X + dx * i;
          let y = Y + dy * i;
          positions.delete(x + y * width);
        }
      }
    }

    const blocksCount = (fillBlocks % 1) * positions.size;
    const blocksStore = new Set<number>();

    for (let i = 0; i < blocksCount; i++) {
      const p = random([...positions]);
      positions.delete(p);
      blocksStore.add(p);
      this[p] = EMapItem.BLOCK;
    }

    const achivmentsCount = (fillAchivments % 1) * blocksStore.size;

    for (let i = 0; i < achivmentsCount; i++) {
      const p = random([...blocksStore]);
      blocksStore.delete(p);
      this.achivments.add(p);
      this[p] = EMapItem.BLOCK;
    }
  }
}