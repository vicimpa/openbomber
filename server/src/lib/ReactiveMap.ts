export class ReactiveMap<K, V> extends Map<K, V> {
  #subs = new Set<() => void>();

  update() {
    for (const sub of this.#subs) {
      sub();
    }
  }

  subscribe(callback: () => void) {
    return (
      this.#subs.add(callback),
      () => { this.#subs.delete(callback); }
    );
  }

  set(key: K, value: V): this {
    const result = super.set(key, value);
    this.update();
    return result;
  }

  delete(key: K): boolean {
    const result = super.delete(key);
    this.update();
    return result;
  }

  clear(): void {
    const result = super.clear();
    this.update();
    return result;
  }
}