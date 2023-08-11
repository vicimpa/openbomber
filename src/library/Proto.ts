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
};

export type TPrimitiveTypes = typeof PRIMITIVE_TYPES;
export type TPrimitiveType = keyof TPrimitiveTypes;
export type TTypeFrom<T> = {
  $type$: {
    from(data: T): ArrayBuffer;
    to(data: ArrayBuffer): T;
  };
};
export type TObject = {
  [key: string]: TProto;
};

export type TProto = (
  TPrimitiveType |
  TObject |
  [TProto]
);

export type TValue<T> = (
  T extends TPrimitiveType ? (
    InstanceType<TPrimitiveTypes[T]>[0]
  ) : T extends TTypeFrom<any> ? (
    ReturnType<T['$type$']['to']>
  ) : T extends TObject ? (
    { [K in keyof T]: TValue<T[K]> }
  ) : T extends [] ? TValue<T[0]> : never

);

export type TData<T extends TProto> = (
  T extends [] ? T[0][] : T
);

export class Proto<T extends TProto> {
  constructor(param: T) { }

  from(data: TValue<T>) {

  }

  to(data: ArrayBuffer): TValue<T> {


    return null as any;
  }
}

const a = new Proto({
  id: 'uint8',
  x: 'float32',
  y: 'float32',
  dir: 'uint8',
  animate: 'uint8',
  test: {
    a: 'int8',
    b: 'int16',
    c: 'bigint64'
  }
});