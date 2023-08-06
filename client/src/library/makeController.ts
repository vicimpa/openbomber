const keymap = new Map<string, boolean>();

addEventListener('keydown', ({ code }) => {
  keymap.set(code, true);
});
addEventListener('keyup', ({ code }) => {
  keymap.set(code, false);
});

interface IControllerConfig {
  [key: string]: string[];
}

interface IKeyCtl {
  isDown(): boolean;
  isUp(): boolean;
  isSingle(): boolean;
  isEvery(n: number): boolean;
}

class KeyController {
  #keys!: string[];
  #pressed = false;
  #lastClick = 0;

  constructor(keys: string[]) {
    this.#keys = keys;
  }

  isDown() {
    return !!this.#keys.filter(key => keymap.get(key)).length;
  }

  isUp() {
    return !this.isDown();
  }

  isSingle() {
    if (!this.#pressed && this.isDown()) {
      this.#pressed = true;
      return true;
    }

    if (!this.isDown())
      this.#pressed = false;

    return false;
  }

  isEvery(n = 0) {
    const time = performance.now();

    if (this.isDown()) {
      if (!this.#lastClick) {
        this.#lastClick = time;
        return true;
      }

      if (this.#lastClick + n < time) {
        this.#lastClick = time;
        return true;
      }

      return false;
    } else {
      this.#lastClick = 0;
      return false;
    }
  }
}

export const makeController = (
  <T extends IControllerConfig>(opt: T) => {

    return Object
      .entries(opt)
      .reduce((acc, [key, value]: [keyof T, string[]]) => {
        acc[key] = new KeyController(value);
        return acc;
      }, {} as { [key in keyof T]: IKeyCtl });
  }
);
