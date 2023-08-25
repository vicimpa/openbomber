export class ReactiveSet<T> extends Set<T> {
  #subs = new Set<(v: this) => void>();

  update() {
    for (const sub of this.#subs) {
      sub(this);
    }
  }

  subscribe(callback: (v: this) => void) {
    callback(this);
    return (
      this.#subs.add(callback),
      () => { this.#subs.delete(callback); }
    );
  }

  add(value: T): this {
    const result = super.add(value);
    this.update();
    return result;
  }

  delete(value: T): boolean {
    const result = super.delete(value);
    this.update();
    return result;
  }

  clear(): void {
    const result = super.clear();
    this.update();
    return result;
  }
}