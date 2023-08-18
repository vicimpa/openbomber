import { generatePerlinNoise } from "@vicimpa/perlin-noise";

import { copyBuffer } from "../../core/copyBuffer";
import { random } from "../../core/random";
import { DIRECTIONS, EMapItem } from "../../types";
import { Game } from "./Game";

import type { TConfig } from "./Game";

export class GameMap extends Uint8Array {
  achivments = new Set<number>();
  noize: number[] = [];

  constructor(
    public width: number,
    public height: number,
    public game: Game
  ) {
    super(width * height);
    this.noize = generatePerlinNoise(width, height);
  }

  generate(config: TConfig) {
    const {
      width,
      height
    } = this;

    const {
      fillAchivments,
      fillBlocks,
    } = config;

    const positions = new Set<number>();

    this.achivments.clear();

    for (let i = 0; i < this.length; i++) {
      let x = i % width;
      let y = i / width;


      const n = this.noize[i];
      this[i] = n < .1 ? EMapItem.GRAS : n < .4 ? EMapItem.SAND : EMapItem.CLEAR;
      positions.add(i);
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

  get info() {
    return copyBuffer(this.buffer);
  }
}