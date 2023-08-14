import { copyBuffer } from "./copyBuffer";

const types = {
  int8: new Int8Array(1),
  uint8: new Uint8Array(1),
  float32: new Float32Array(1),
  float64: new Float64Array(1)
};

export type TTypes = typeof types;
export type TType = keyof TTypes;
export type TGType<T extends TType> = TTypes[T] & {
  constructor: typeof Float32Array;
};

export class WriteBuffer {
  #buffers: ArrayBuffer[] = [];

  get size() {
    return this.#buffers
      .reduce((acc, { byteLength: l }) => acc + l, 0);
  }

  concat(): ArrayBuffer {
    const buffers = this.#buffers;
    const tmp = new Uint8Array(this.size);

    for (let i = 0, c = 0; i < buffers.length; i++) {
      tmp.set(new Uint8Array(buffers[i]), c);
      c += buffers[i].byteLength;
    }

    return tmp.buffer;
  }

  write<T extends TType>(type: T, value: number): void {
    const tmp = types[type];
    tmp[0] = value;
    this.#buffers.push(tmp.buffer.slice(0));
  }

  flush(): ArrayBuffer {
    const buffer = this.concat();
    this.#buffers.splice(0);
    return copyBuffer(buffer);
  }
}

export class ReadBuffer {
  #buffer = new ArrayBuffer(0);
  #cursor = 0;

  accept(buffer: ArrayBuffer) {
    this.#cursor = 0;
    this.#buffer = buffer;
  }

  read<T extends TType>(type: T) {
    const valueType = types[type];
    const { buffer, constructor: Type } = valueType as TGType<T>;
    const { byteLength: size } = buffer;
    const oldCursor = this.#cursor;
    this.#cursor += size;
    return new Type(this.#buffer.slice(oldCursor, oldCursor + size))[0];
  }
}