

export class DataBuffer {
  #cursor = 0;
  #end = 0;

  mem = new ArrayBuffer(1024 * 1024);
  dv = new DataView(this.mem);
  ua = new Uint8Array(this.mem);
  enc = new TextEncoder();
  dec = new TextDecoder();

  get byteLength() {
    return this.#end + 1;
  }

  get buffer() {
    return this.mem.slice(0, this.#end);
  }


  get cursor() {
    return this.#cursor;
  }

  set cursor(v) {
    this.#cursor = v;
    if (v > this.#end)
      this.#end = v;
  }

  constructor(data: number | ArrayBuffer = 0) {
    if (typeof data === 'number')
      this.#end = -1;

    if (data instanceof ArrayBuffer) {
      this.write(data);
      this.cursor = 0;
    }

    this.ua.fill(0);
  }

  reset() {
    this.#cursor = 0;
    this.#end = 0;
  }

  cm(cursor?: number, move?: number) {
    if (typeof cursor === 'number')
      this.#cursor = cursor;

    cursor = this.#cursor;

    if (typeof move === 'number')
      this.cursor += move;

    return cursor;
  }

  // Read buffer
  read(c?: number, offset = this.byteLength - (c ?? this.cursor)) {
    const start = this.cm(c, offset);
    return this.buffer.slice(start, this.cursor);
  }

  // Read boolean
  readboolean(c?: number, m = 1) {
    return !!this.readint8(c, m);
  }

  // Read 8 bit
  readint8(c?: number, m = 1) {
    const cursor = this.cm(c, m);
    return this.dv.getInt8(cursor);
  }
  readuint8(c?: number, m = 1) {
    const cursor = this.cm(c, m);
    return this.dv.getUint8(cursor);
  }

  // Read 16 bit
  readint16(c?: number, m = 2) {
    const cursor = this.cm(c, m);
    return this.dv.getInt16(cursor);
  }
  readuint16(c?: number, m = 2) {
    const cursor = this.cm(c, m);
    return this.dv.getUint16(cursor);
  }

  // Read 32 bit
  readint32(c?: number, m = 4) {
    const cursor = this.cm(c, m);
    return this.dv.getInt32(cursor);
  }
  readuint32(c?: number, m = 4) {
    const cursor = this.cm(c, m);
    return this.dv.getUint32(cursor);
  }

  // Read float
  readfloat32(c?: number, m = 4) {
    const cursor = this.cm(c, m);
    return this.dv.getFloat32(cursor);
  }
  readfloat64(c?: number, m = 8) {
    const cursor = this.cm(c, m);
    return this.dv.getFloat64(cursor);
  }

  // Read bigint
  readbigint64(c?: number, m = 8) {
    const cursor = this.cm(c, m);
    return this.dv.getBigInt64(cursor);
  }
  readbiguint64(c?: number, m = 8) {
    const cursor = this.cm(c, m);
    return this.dv.getBigUint64(cursor);
  }

  // Read string
  readstring(c?: number) {
    const size = this.readuint32(c);
    return this.dec.decode(
      this.read(undefined, size)
    );
  }

  // Write buffer
  write(value: ArrayBuffer | Uint8Array, c?: number) {
    if (value instanceof ArrayBuffer)
      value = new Uint8Array(value);

    if (value instanceof Uint8Array) {
      if (typeof c === 'number')
        this.#cursor = c;

      const start = this.#cursor;
      this.cursor += value.length;
      this.ua.set(value, start);
    }
  }

  // Write boolean
  writeboolean(value: boolean, c?: number, m = 1) {
    this.writeuint8(+value, c, m);
  }

  // Write 8 bit
  writeint8(value: number, c?: number, m = 1) {
    const cursor = this.cm(c, m);
    this.dv.setInt8(cursor, value);
  }
  writeuint8(value: number, c?: number, m = 1) {
    const cursor = this.cm(c, m);
    this.dv.setUint8(cursor, value);
  }

  // Write 16 bit
  writeint16(value: number, c?: number, m = 2) {
    const cursor = this.cm(c, m);
    this.dv.setInt16(cursor, value);
  }
  writeuint16(value: number, c?: number, m = 2) {
    const cursor = this.cm(c, m);
    this.dv.setUint16(cursor, value);
  }

  // Write 32 bit
  writeint32(value: number, c?: number, m = 4) {
    const cursor = this.cm(c, m);
    this.dv.setInt32(cursor, value);
  }
  writeuint32(value: number, c?: number, m = 4) {
    const cursor = this.cm(c, m);
    this.dv.setUint32(cursor, value);
  }

  // Write Float
  writefloat32(value: number, c?: number, m = 4) {
    const cursor = this.cm(c, m);
    this.dv.setFloat32(cursor, value);
  }
  writefloat64(value: number, c?: number, m = 8) {
    const cursor = this.cm(c, m);
    this.dv.setFloat64(cursor, value);
  }

  // Write Bigint
  writebigint64(value: bigint, c?: number, m = 8) {
    const cursor = this.cm(c, m);
    this.dv.setBigInt64(cursor, value);
  }
  writebiguint64(value: bigint, c?: number, m = 8) {
    const cursor = this.cm(c, m);
    this.dv.setBigUint64(cursor, value);
  }

  // Write string
  writestring(value: string, c?: number) {
    const buffer = this.enc.encode(value);
    this.writeuint32(buffer.length, c);
    this.write(buffer);
  }
}