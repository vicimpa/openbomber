import { PRIMITIVE_TYPES } from "./Buffers";
import { DataBuffer } from "./DataBuffer";

export type TDataBuffer = DataBuffer;
export type PRIMITIVE_TYPES = (
  never
  | 'boolean'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'float32'
  | 'float64'
  | 'bigint64'
  | 'biguint64'
  | 'string'
);
export type TPrimitiveValue<T extends PRIMITIVE_TYPES> = (
  ReturnType<DataBuffer[`read${T}`]>
);

export type TCustomType<T> = {
  $from(db: DataBuffer, value: T): void;
  $to(db: DataBuffer): T;
};

export type TProtoType = (
  never
  | PRIMITIVE_TYPES
  | TCustomType<any>
);

export type TProtoParam = (
  never
  | TProtoType
  | TProtoObject
  | [TProtoType]
  | [TProtoObject]
);

export type TProtoObject = {
  [key: string]: TProtoParam;
};

export type TProtoValue<T extends TProtoParam> = (
  T extends PRIMITIVE_TYPES ? (
    TPrimitiveValue<T>
  ) : T extends TCustomType<any> ? (
    ReturnType<T['$to']>
  ) : T extends TProtoObject ? ({
    [key in keyof T]: TProtoValue<T[key]>
  }) : T extends [any] ? (
    TProtoValue<T[0]>[]
  ) : never
);

export class Proto<T extends TProtoParam> {
  #param: T;
  #db = new DataBuffer();

  #convert(buffer: ArrayBuffer) {
    if (typeof Buffer !== 'undefined' && buffer instanceof Buffer) {
      const out = buffer.buffer;
      return out.slice(out.byteLength - buffer.length);
    }

    return buffer;
  }

  constructor(param: T) {
    this.#param = param;
  }

  from(value: TProtoValue<T>, param = this.#param, db?: DataBuffer): ArrayBuffer {
    if (!db) {
      db = this.#db;
      db.cursor = 0;
    }

    if (typeof param === 'object') {
      if (Array.isArray(param)) {
        db.writeuint32(value.length);

        for (let i = 0; i < value.length; i++) {
          this.from(value[i], param[0] as any, db);
        }

        return db.buffer;
      }

      if ('$to' in param && '$from' in param) {
        (param as TCustomType<any>)['$from'](db, value);
        return db.buffer;
      }

      for (const key in param) {
        this.from(value[key], param[key] as any, db);
      }

      return db.buffer;
    }

    if (('write' + param) in db) {
      (db as any)['write' + param](value);
      return db.buffer;
    }

    return db.buffer;
  }

  to(buffer: ArrayBuffer, param = this.#param, db?: DataBuffer): TProtoValue<T> {
    if (!db) {
      db = this.#db;
      db.buffer = this.#convert(buffer);
    }

    if (typeof param === 'object') {
      if (Array.isArray(param)) {
        const length = db.readuint32();
        return Array.from({ length }, () => this.to(buffer, param[0] as any, db)) as any;
      }

      if ('$to' in param && '$from' in param)
        return (param as TCustomType<any>).$to(db);

      const object = {} as any;

      for (const key in param) {
        object[key] = this.to(buffer, param[key] as any, db);
      }

      return object;
    }

    if (('read' + param) in db)
      return (db as any)['read' + param]();

    return null as any;
  }
}