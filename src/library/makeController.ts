import { Vec2 } from "core/Vec2";

import type { TVec2 } from "core/Vec2";

const keymap = new Map<TKey, boolean>();

addEventListener('keydown', ({ code, target }) => {
  if (target instanceof HTMLInputElement) return;
  keymap.set(code, true);
});

addEventListener('keyup', ({ code, target }) => {
  if (target instanceof HTMLInputElement) return;
  keymap.set(code, false);
});

addEventListener('contextmenu', () => {
  keymap.clear();
});

addEventListener('blur', () => {
  keymap.clear();
});

type TKey = string | (() => boolean);

interface IControllerConfig {
  [key: string]: TKey[];
}

interface IKeyCtl {
  isDown(): boolean;
  isUp(): boolean;
  isSingle(): boolean;
  isEvery(n: number): boolean;
}

class KeyController {
  #keys!: TKey[];
  #pressed = false;
  #lastClick = 0;

  constructor(keys: TKey[]) {
    this.#keys = keys;
  }

  isDown() {
    return !!this.#keys.filter(key => typeof key === 'string' ? keymap.get(key) : key()).length;
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
      .reduce((acc, [key, value]: [keyof T, TKey[]]) => {
        acc[key] = new KeyController(value);
        return acc;
      }, {} as { [key in keyof T]: IKeyCtl });
  }
);

export const makeVectorController = (
  ...args: {
    keys: TKey[],
    plus: TVec2;
  }[]
) => {
  const controllers = args.map(({ keys, plus }) => ({
    ctrl: new KeyController(keys),
    plus,
  }));

  return () => {
    const vec = new Vec2();

    for (const { ctrl, plus } of controllers) {
      if (ctrl.isDown())
        vec.plus(...plus);
    }

    return vec;
  };
};