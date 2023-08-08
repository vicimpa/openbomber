import { DIRECTIONS } from "@root/types";

import { random } from "../lib/random";
import { Game, TConfig } from "./Game";

export class GameMap extends Uint8Array {
  achivments = new Set<number>();

  constructor(
    public width: number,
    public height: number,
    public game: Game
  ) {
    super(width * height);
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
      let y = i / height | 0;

      if (x & 1 && y & 1) {
        this[i] = 1;
      } else {
        positions.add(i);
      }
    }

    for (const [X, Y] of this.game.startPositions) {
      for (let i = 0; i < 2; i++) {
        for (const [, dir] of Object.entries(DIRECTIONS)) {
          let [dx, dy] = dir;
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
      this[p] = 2;
    }

    const achivmentsCount = (fillAchivments % 1) * blocksStore.size;

    for (let i = 0; i < achivmentsCount; i++) {
      const p = random([...blocksStore]);
      blocksStore.delete(p);
      this.achivments.add(p);
      this[p] = 2;
    }

  }

  get info() {
    return [...this];
  }
}