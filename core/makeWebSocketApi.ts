import { DataBuffer } from "./DataBuffer";
import { Proto } from "./Proto";

import type { TProtoParam, TProtoValue } from "./Proto";

let API_COUNTER = 0;

export type TApiParam = {
  [key: string]: {
    input?: TProtoParam;
    output?: TProtoParam;
  };
};


export type TApiFunctionInput<T extends TApiParam[`${string}`]> = (
  T['input'] extends TProtoParam ? [input: TProtoValue<T['input']>] : []
);

export type TApiFunctionOutput<T extends TApiParam[`${string}`]> = (
  T['output'] extends TProtoParam ? TProtoValue<T['output']> : void
);

export type TApiResult<T extends TApiParam> = {
  [key in keyof T]: (...args: TApiFunctionInput<T[key]>) => (
    TApiFunctionOutput<T[key]>
  )
};

export type TApiPromiseResult<T extends TApiParam> = {
  [key in keyof T]: (...args: TApiFunctionInput<T[key]>) => (
    TApiFunctionOutput<T[key]> extends void ? void : Promise<TApiFunctionOutput<T[key]>>
  )
};

export type TApi<T extends TApiParam> = {
  forward(socket: TSocket, api: Partial<TApiResult<T>>): () => void;
  use(socket: TSocket): (() => void) & TApiPromiseResult<T>;
};

export type TMethods<T extends TApi<any>> = (
  Required<Parameters<T['forward']>[1]>
);

export type TApiMethod = {
  id: number;
  key: string;
  input?: Proto<any>;
  output?: Proto<any>;
};

export type TSocket = {
  on(event: string, callback: (buffer: ArrayBuffer) => any): any;
  off(event: string, callback: (buffer: ArrayBuffer) => any): any;
  emit(event: string, buffer: ArrayBuffer): any;
};

export const makeWebSocketApi = (
  <T extends TApiParam>(param: T) => {
    const db = new DataBuffer();
    const API_KEY = API_COUNTER++;
    const METHODS_MAP = new Map<number, TApiMethod>();
    const METHODS_KEY_MAP = new Map<string, TApiMethod>();
    let METHOD_COUNTER = 0;

    for (const key in param) {
      const { input, output } = param[key];
      const METHOD_KEY = METHOD_COUNTER++;

      const method = {
        id: METHOD_KEY,
        key,
        input: input ? new Proto(input) : undefined,
        output: output ? new Proto(output) : undefined
      };

      METHODS_MAP.set(METHOD_KEY, method);
      METHODS_KEY_MAP.set(key, method);
    }

    return {
      forward(socket: TSocket, api: Partial<TApiResult<T>>) {
        const listening = (data: ArrayBuffer) => {
          db.write(data, 0);
          db.cursor = 0;

          if (db.readuint8() !== API_KEY) return;
          if (db.readuint8() !== 0) return;

          const METHOD_KEY = db.readuint8();
          const RETURN_KEY = db.readint8();
          const method = METHODS_MAP.get(METHOD_KEY);

          if (!method || !(method.key in api)) return;

          const input = method.input ? [
            method.input.to(undefined, undefined, db)
          ] : [];

          try {
            const result = (api[method.key] as (...args: typeof input) => any)(...input);
            db.reset();

            if (method.output) {
              db.writeuint8(API_KEY);
              db.writeuint8(1);
              db.writeuint8(METHOD_KEY);
              db.writeint8(RETURN_KEY);
              method.output.from(result, undefined, db);
              socket.emit(`${API_KEY}`, db.buffer);
            }
          } catch (e) {
            console.error(e);
          }
        };

        socket.on(`${API_KEY}`, listening);

        return () => {
          socket.off(`${API_KEY}`, listening);
        };
      },

      use(socket: TSocket): TApiPromiseResult<T> & (() => void) {
        const CAllBACK_MAP = new Map<number, (out: any) => any>;
        let CALLBACK_COUNTER = 0;

        const listener = (data: ArrayBuffer) => {
          db.write(data, 0);
          db.cursor = 0;

          if (db.readuint8() !== API_KEY) return;
          if (db.readuint8() !== 1) return;
          const RETURN_KEY = db.readint8();
          const METHOD_KEY = db.readuint8();
          const method = METHODS_MAP.get(METHOD_KEY);
          const callback = CAllBACK_MAP.get(RETURN_KEY);
          if (!method || !callback || !method.output) return;

          callback(
            method.output.to(undefined, undefined, db)
          );

          CAllBACK_MAP.delete(RETURN_KEY);
        };

        socket.on(`${API_KEY}`, listener);

        return Object.assign(
          () => {
            socket.off(`${API_KEY}`, listener);
          },
          Object.entries(param)
            .reduce((acc, [key]) => {
              const method = METHODS_KEY_MAP.get(key);
              if (!method) return acc;
              const { id: METHOD_KEY } = method;

              (acc as any)[key] = (input: any) => {
                const RETURN_KEY = CALLBACK_COUNTER++;
                db.reset();
                db.writeuint8(API_KEY);
                db.writeuint8(0);
                db.writeuint8(METHOD_KEY);
                db.writeuint8(RETURN_KEY);

                if (method.input)
                  method.input.from(input, undefined, db);

                socket.emit(`${API_KEY}`, db.buffer);

                if (method.output)
                  return new Promise(resolve => {
                    CAllBACK_MAP.set(RETURN_KEY, resolve);
                  });
              };
              return acc;
            }, {} as TApiPromiseResult<T>)
        );
      }
    } as TApi<T>;
  }
);