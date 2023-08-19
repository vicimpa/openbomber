import { DataBuffer } from "./DataBuffer";

const FROM_SYMBOL = Symbol();
const TO_SYMBOL = Symbol();

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
  [FROM_SYMBOL](db: DataBuffer, value: T): void;
  [TO_SYMBOL](db: DataBuffer): T;
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

export type TProtoOut<T extends TCustomType<any>> =
  T[typeof TO_SYMBOL] extends (...args: any[]) => any ? ReturnType<T[typeof TO_SYMBOL]> : never;

export type TProtoValue<T extends TProtoParam> = (
  T extends PRIMITIVE_TYPES ? (
    TPrimitiveValue<T>
  ) : T extends TCustomType<any> ? (
    ReturnType<T[typeof TO_SYMBOL]>
  ) : T extends TProtoObject ? ({
    [key in keyof T]: TProtoValue<T[key]>
  }) : T extends [any] ? (
    TProtoValue<T[0]>[]
  ) : never
);

export const makeCustomType = <T>(
  from: TCustomType<T>[typeof FROM_SYMBOL],
  to: TCustomType<T>[typeof TO_SYMBOL]
) => {
  return {
    [FROM_SYMBOL]: from,
    [TO_SYMBOL]: to,
  } as TCustomType<T>;
};

type StandardEnum<T> = {
  [id: string]: T | string;
  [nu: number]: string;
};

export const makeEnum = <T extends StandardEnum<unknown>>(type: T) => {
  return makeCustomType<T[keyof T]>(
    (db, value) => {
      db.writeuint8(value as number);
    },
    (db) => {
      return db.readuint8() as T[keyof T];
    }
  );
};

export class Proto<T extends TProtoParam> {
  #param: T;
  #db?: DataBuffer;

  get db() {
    return this.#db ?? (
      this.#db = new DataBuffer()
    );
  }

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

  [FROM_SYMBOL](db: DataBuffer, value: TProtoValue<T>) {
    this.from(value, undefined, db);
  }

  [TO_SYMBOL](db: DataBuffer) {
    return this.to(undefined, undefined, db);
  }

  from(value: TProtoValue<T>, param = this.#param, db?: DataBuffer): ArrayBuffer {
    if (!db) {
      db = this.db;
      db.cursor = 0;
    }

    if (typeof param === 'object') {
      if (Array.isArray(param)) {
        if (!Array.isArray(value))
          throw new Error('Value is not array');

        db.writeuint32(value.length);

        for (let i = 0; i < value.length; i++) {
          this.from(value[i] as any, param[0] as any, db);
        }

        return db.buffer;
      }

      if (FROM_SYMBOL in param && TO_SYMBOL in param) {
        (param as TCustomType<any>)[FROM_SYMBOL](db, value);
        return db.buffer;
      }

      for (const key in param) {
        this.from((value as any)[key], param[key] as any, db);
      }

      return db.buffer;
    }

    if (('write' + param) in db) {
      (db as any)['write' + param](value);
      return db.buffer;
    }

    return db.buffer;
  }

  to(buffer?: ArrayBuffer, param = this.#param, db?: DataBuffer): TProtoValue<T> {
    if (!db) {
      db = this.db;
      db.write(this.#convert(buffer ?? new ArrayBuffer(0)), 0);
      db.cursor = 0;
    }

    if (typeof param === 'object') {
      if (Array.isArray(param)) {
        const length = db.readuint32();
        return Array.from({ length }, () => this.to(buffer, param[0] as any, db)) as any;
      }

      if (TO_SYMBOL in param && FROM_SYMBOL in param)
        return (param as TCustomType<any>)[TO_SYMBOL](db);

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