import { abs, ceil, floor, pow, rem, round, sqrt } from "./math";

export interface IVec2 { x: number; y: number; }
export type TVec2 = [] | [xy: number] | [x: number, y: number] | [vec: IVec2];
export type TVec2Callback = (x: number, y: number, vec: Vec2) => any;

const _plus = (x: number, y: number, vec: Vec2) => (vec.x += x, vec.y += y, vec);
const _minus = (x: number, y: number, vec: Vec2) => (vec.x -= x, vec.y -= y, vec);
const _times = (x: number, y: number, vec: Vec2) => (vec.x *= x, vec.y *= y, vec);
const _div = (x: number, y: number, vec: Vec2) => (vec.x /= x, vec.y /= y, vec);
const _rem = (x: number, y: number, vec: Vec2) => (vec.x = rem(vec.x, x), vec.y = rem(vec.y, y), vec);
const _pow = (x: number, y: number, vec: Vec2) => (vec.x = pow(vec.x, x), vec.y = pow(vec.y, y), vec);
const _set = (x: number, y: number, vec: Vec2) => (vec.x = x, vec.y = y, vec);
const _equal = (x: number, y: number, vec: Vec2) => (vec.x === x && vec.y === y);
const _lower = (x: number, y: number, vec: Vec2) => (vec.x > x && vec.y > y);
const _bigger = (x: number, y: number, vec: Vec2) => (vec.x > x && vec.y > y);
const _minLimit = (x: number, y: number, vec: Vec2) => (vec.x < x && (vec.x = x), vec.y < y && (vec.y = y), vec);
const _maxLimit = (x: number, y: number, vec: Vec2) => (vec.x > x && (vec.x = x), vec.y > y && (vec.y = y), vec);;

export const vec2 = <F extends TVec2Callback>(
  ...args: [...TVec2, callback: F, vec: Vec2]
): ReturnType<F> => {
  const arg = args.at(-1) as Vec2;
  const callback = args.at(-2) as F;
  const first = args.at(0) ?? 0;

  if (typeof arg !== 'object')
    throw new Error('Need object');

  if (!(callback instanceof Function))
    throw new Error("Need callback");

  if (first instanceof Function)
    return callback(0, 0, arg);

  if (typeof first === 'object')
    return callback(first.x, first.y, arg);

  if (typeof first === 'number') {
    const second = args.at(1);

    if (typeof second === 'number')
      return callback(first, second, arg);

    return callback(first, first, arg);
  }

  throw new Error('Unknow arguments');
};

export class Vec2 {
  x: number = 0;
  y: number = 0;

  constructor(...args: TVec2) {
    this.set(...args);
  }

  length(...args: TVec2) {
    return (
      sqrt(
        this
          .cminus(...args)
          .pow(2)
          .sum()
      )
    );
  }

  toLog() { return `Vec2<x: ${this.x.toFixed(2)}, y: ${this.y.toFixed(2)}>`; }
  [Symbol.toStringTag]() { return this.toLog(); }
  toString() { return this.toLog(); }

  sum() { return this.x + this.y; }
  clone() { return new Vec2(this); }

  normalize() { return this.div(this.length() || 1); }
  round() { return this.set(round(this.x), round(this.y)); }
  floor() { return this.set(floor(this.x), floor(this.y)); }
  ceil() { return this.set(ceil(this.x), ceil(this.y)); }
  abs() { return this.set(abs(this.x), abs(this.y)); }


  cnormalize() { return this.cdiv(this.length() || 1); }
  cround() { return this.cset(round(this.x), round(this.y)); }
  cfloor() { return this.cset(floor(this.x), floor(this.y)); }
  cceil() { return this.cset(ceil(this.x), ceil(this.y)); }
  cabs() { return this.cset(abs(this.x), abs(this.y)); }

  plus(...args: TVec2) { return vec2(...args, _plus, this); }
  minus(...args: TVec2) { return vec2(...args, _minus, this); }
  times(...args: TVec2) { return vec2(...args, _times, this); }
  div(...args: TVec2) { return vec2(...args, _div, this); }
  rem(...args: TVec2) { return vec2(...args, _rem, this); }
  pow(...args: TVec2) { return vec2(...args, _pow, this); }
  set(...args: TVec2) { return vec2(...args, _set, this); }
  lower(...args: TVec2) { return vec2(...args, _lower, this); }
  bigger(...args: TVec2) { return vec2(...args, _bigger, this); }
  equal(...args: TVec2) { return vec2(...args, _equal, this); }

  cplus(...args: TVec2) { return vec2(...args, _plus, this.clone()); }
  cminus(...args: TVec2) { return vec2(...args, _minus, this.clone()); }
  ctimes(...args: TVec2) { return vec2(...args, _times, this.clone()); }
  cdiv(...args: TVec2) { return vec2(...args, _div, this.clone()); }
  crem(...args: TVec2) { return vec2(...args, _rem, this.clone()); }
  cpow(...args: TVec2) { return vec2(...args, _pow, this.clone()); }
  cset(...args: TVec2) { return vec2(...args, _set, this.clone()); }

  minLimit(...args: TVec2) { return vec2(...args, _minLimit, this); }
  maxLimit(...args: TVec2) { return vec2(...args, _maxLimit, this); }

  cminLimit(...args: TVec2) { return vec2(...args, _minLimit, this.clone()); }
  cmaxLimit(...args: TVec2) { return vec2(...args, _maxLimit, this.clone()); }

  static withIndex(i: number, width: number, height: number) {
    return new Vec2(i % width, i / width | 0);
  }
}