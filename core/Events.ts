export interface IEventsMap {
  [key: string]: any;
}

export type TCustomEventListener<M extends IEventsMap, K extends keyof M> = (
  (event: CustomEvent<M, K>) => any
);

export class CustomEvent<M extends IEventsMap, K extends keyof M> extends Event {
  constructor(type: K, public data: M[K]) {
    super(type as string);
  }
}

export class Events<M extends IEventsMap> {
  #target = new EventTarget();
  #regs = new Map<keyof M, Set<TCustomEventListener<M, any>>>();

  #getRegs<K extends keyof M>(key: K) {
    return this.#regs.get(key) ?? (
      this.#regs.set(key, new Set()),
      this.#regs.get(key)!
    );
  }

  addEventListener<K extends keyof M>(
    type: K,
    callback: TCustomEventListener<M, K> | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    this.#target.addEventListener(type as string, callback as any, options);
  }

  on<K extends keyof M>(type: K, callback: TCustomEventListener<M, K>) {
    this.#getRegs(type).add(callback);
    this.addEventListener(type, callback);
  }

  once<K extends keyof M>(type: K, callback: TCustomEventListener<M, K>) {
    const remove = () => {
      this.#getRegs(type).delete(callback);
      this.#getRegs(type).delete(remove);
    };

    this.#getRegs(type).add(callback);
    this.#getRegs(type).add(remove);

    this.addEventListener(type, callback, { once: true });
    this.addEventListener(type, remove, { once: false });
  }

  off<K extends keyof M>(type: K, callback?: TCustomEventListener<M, K>) {
    if (!callback) {
      const regs = this.#getRegs(type);

      for (const reg of regs)
        this.removeEventListener(type, reg);

      return regs.clear();
    }

    this.removeEventListener(type, callback);
  }

  emit<K extends keyof M>(type: K, data: M[K]) {
    this.dispatchEvent(type, data);
  }

  removeEventListener<K extends keyof M>(
    type: K,
    callback: TCustomEventListener<M, K> | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    this.#target.removeEventListener(type as string, callback as any, options);
  }

  dispatchEvent<K extends keyof M>(type: K, data: M[K]) {
    this.#target.dispatchEvent(
      new CustomEvent<M, K>(type, data)
    );
  }
}