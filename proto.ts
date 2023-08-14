import { ReadBuffer, WriteBuffer } from "./core/Buffers";

import type { Player } from "./server/class/Player";

export class PlayerPositionsProto {
  static readable = new ReadBuffer();
  static writable = new WriteBuffer();

  static from(buffer: ArrayBuffer) {
    const { readable } = this;

    readable.accept(buffer);

    const output: Player['posInfo'][] = [];
    const size = readable.read('uint8');

    for (let i = 0; i < size; i++) {
      output.push({
        id: readable.read('uint8'),
        x: readable.read('float32'),
        y: readable.read('float32'),
        dir: readable.read('uint8'),
        animate: readable.read('uint8'),
      });
    }

    return output;
  }

  static to(players: Player['posInfo'][]) {
    const { writable } = this;

    writable.write('uint8', players.length);

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      writable.write('uint8', player.id);
      writable.write('float32', player.x);
      writable.write('float32', player.y);
      writable.write('uint8', player.dir);
      writable.write('uint8', player.animate);
    }

    return writable.flush();
  }
}