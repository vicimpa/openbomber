export type TApi = { [key: string]: (...args: any[]) => any; };
export type TSocket = {
  on(name: string, callback: (...args: any[]) => any): any;
  emit(name: string, ...args: any[]): any;
};

const useApi = <T extends TApi>(socket: TSocket): T => {
  return new Proxy({} as T, {
    get(_, key) {
      if (typeof key !== 'string')
        throw new Error('Method not with symbol');

      return (...args: any) => {
        socket.emit(key, ...args);
      };
    }
  });
};

const forwardApi = <T extends TApi>(socket: TSocket, api: Partial<T>) => {
  for (const key in api) {
    if (api[key] instanceof Function)
      socket.on(key, (api as any)[key]);
  }
};

export { forwardApi, useApi };