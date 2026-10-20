export type TApi = { [key: string | symbol]: (...args: any[]) => void; };
export type TSocket = {
  on(name: string, callback: (...args: any[]) => any): any;
  off(name: string, callback: (...args: any[]) => any): any;
  emit(name: string, ...args: any[]): any;
};

const useApi = <T extends TApi>(socket: TSocket): T => {
  return new Proxy({} as T, {
    get(_, key) {
      if (typeof key !== 'string')
        throw new Error('Method not with symbol');

      return (...args: any) => {
        return new Promise((resolve, reject) => {
          socket.emit(key, ...args);
        });
      };
    }
  });
};

const forwardApi = <T extends TApi>(socket: TSocket, api: Partial<T>) => {
  const unforwardSet = new Set<Function>();

  for (const key in api) {
    if (api[key] instanceof Function) {
      const func = (...args: any[]) => {
        Promise.resolve()
          .then(() => (api as any)[key](...args))
          .catch(console.error);
      };

      socket.on(key, func);
      unforwardSet.add(() => socket.off(key, func));
    }
  }

  return () => {
    for (const unforward of unforwardSet) {
      unforward();
    }

    unforwardSet.clear();
  };
};

export { forwardApi, useApi };