import { copyBuffer } from "./copyBuffer";

const stringEncoder = new TextEncoder();
const stringDecoder = new TextDecoder();

class StringReadArray extends Array<string> {
  #previewValue?: string;
  #previewBuffer?: ArrayBuffer;

  get buffer() {
    if (this.#previewBuffer && this.#previewValue === this[0]) {
      return this.#previewBuffer;
    }

    const bytes = stringEncoder.encode(this[0]);
    const buffer = new ArrayBuffer(bytes.length + 4);
    const data = new Uint8Array(buffer);
    data.set(bytes, 4);
    this.#previewBuffer = buffer;
    this.#previewValue = this[0];
    return buffer;
  }

  constructor(data: number | ArrayBuffer) {
    super(1);
    this[0] = '';

    if (data instanceof ArrayBuffer) {
      const dv = new DataView(data);
      const size = dv.getUint32(0);
      this[0] = stringDecoder.decode(data.slice(4, 4 + size));
    }
  }
}

export const PRIMITIVE_TYPES = {
  'int8': Int8Array,
  'int16': Int16Array,
  'int32': Int32Array,
  'uint8': Uint8Array,
  'uint16': Uint16Array,
  'uint32': Uint32Array,
  'float32': Float32Array,
  'float64': Float64Array,
  'bigint64': BigInt64Array,
  'biguint64': BigUint64Array,
  'string': StringReadArray,
};

export type TTypes = typeof PRIMITIVE_TYPES;
export type TType = keyof TTypes;
export type TInstanceType<T extends TType> = InstanceType<TTypes[T]>[0];
export type TGType<T extends TType> = InstanceType<TTypes[T]> & {
  constructor: TTypes[T];
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

  write<T extends TType>(type: T, value: TInstanceType<T>): void {
    const tmp = new PRIMITIVE_TYPES[type](1);
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

  read<T extends TType>(type: T, cursor = true): TInstanceType<T> {
    const valueType = new PRIMITIVE_TYPES[type](1);
    const { buffer, constructor: Type } = valueType as TGType<T>;
    const size = type === 'string' ? this.read('uint32', false) + 4 : buffer.byteLength;
    const oldCursor = this.#cursor;
    if (cursor) this.#cursor += size;
    return new Type(this.#buffer.slice(oldCursor, oldCursor + size))[0];
  }
}