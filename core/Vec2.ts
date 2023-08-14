import { ceil, floor, pow, rem, round } from "./math";

export interface IVec2 { x: number; y: number; }
export type TVec2 = [] | [xy: number] | [x: number, y: number] | [vec: IVec2];
export type TVec2Callback = (x: number, y: number) => any;

export const vec2 = <F extends TVec2Callback>(
  ...args: [...TVec2, callback: F]
): ReturnType<F> => {
  const callback = args.at(-1);
  const first = args.at(0) ?? 0;

  if (!(callback instanceof Function))
    throw new Error("Need callback");

  if (first instanceof Function)
    return callback(0, 0);

  if (typeof first === 'object')
    return callback(first.x, first.y);


  if (typeof first === 'number') {
    const second = args.at(1);

    if (typeof second === 'number')
      return callback(first, second);

    return callback(first, first);
  }

  throw new Error('Unknow arguments');
};

export class Vec2 {
  x: number = 0;
  y: number = 0;

  #plus = (x: number, y: number) => {
    this.x += x;
    this.y += y;
    return this;
  };

  #minus = (x: number, y: number) => {
    this.x -= x;
    this.y -= y;
    return this;
  };

  #times = (x: number, y: number) => {
    this.x *= x;
    this.y *= y;
    return this;
  };

  #div = (x: number, y: number) => {
    this.x /= x;
    this.y /= y;
    return this;
  };

  #rem = (x: number, y: number) => {
    this.x = rem(this.x, x);
    this.y = rem(this.y, y);
    return this;
  };

  #pow = (x: number, y: number) => {
    this.x = pow(this.x, x);
    this.y = pow(this.y, y);
    return this;
  };

  #set = (x: number, y: number) => {
    this.x = x;
    this.y = y;
    return this;
  };

  #minLimit = (x: number, y: number) => {
    if (this.x < x) this.x = x;
    if (this.y < y) this.y = y;
    return this;
  };

  #maxLimit = (x: number, y: number) => {
    if (this.x > x) this.x = x;
    if (this.y > y) this.y = y;
    return this;
  };

  #equal = (x: number, y: number) => {
    return this.x === x && this.y === y;
  };

  constructor(...args: TVec2) { this.set(...args); }

  length(...args: TVec2) {
    return (
      Math.sqrt(
        this
          .clone()
          .minus(...args)
          .pow(2)
          .sum()
      )
    );
  }

  toLog() { return `Vec2<x: ${this.x}, y: ${this.y}>`; }

  sum() { return this.x + this.y; }
  clone() { return new Vec2(this); }
  normalize() { return this.div(this.length() || 1); }
  round() { return this.set(round(this.x), round(this.y)); }
  floor() { return this.set(floor(this.x), floor(this.y)); }
  ceil() { return this.set(ceil(this.x), ceil(this.y)); }

  plus(...args: TVec2) { return vec2(...args, this.#plus); }
  minus(...args: TVec2) { return vec2(...args, this.#minus); }
  times(...args: TVec2) { return vec2(...args, this.#times); }
  div(...args: TVec2) { return vec2(...args, this.#div); }
  rem(...args: TVec2) { return vec2(...args, this.#rem); }
  pow(...args: TVec2) { return vec2(...args, this.#pow); }
  set(...args: TVec2) { return vec2(...args, this.#set); }
  minLimit(...args: TVec2) { return vec2(...args, this.#minLimit); }
  maxLimit(...args: TVec2) { return vec2(...args, this.#maxLimit); }
  equal(...args: TVec2) { return vec2(...args, this.#equal); }

  static withIndex(i: number, width: number, height: number) {
    return new Vec2(i % width, i / width | 0);
  }
}