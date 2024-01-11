import { abs, ceil, floor, hypot, pow, rem, round, sqrt } from "./math";

export interface IVec2 { x: number; y: number; }
export type TVec2 = [] | [xy: number] | [x: number, y: number] | [vec: IVec2];
export type TVec2Callback<V extends IVec2, O> = (x: number, y: number, vec: V) => O;

const _plus = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x += x, vec.y += y, vec);
const _minus = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x -= x, vec.y -= y, vec);
const _times = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x *= x, vec.y *= y, vec);
const _div = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x /= x, vec.y /= y, vec);
const _rem = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x = rem(vec.x, x), vec.y = rem(vec.y, y), vec);
const _pow = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x = pow(vec.x, x), vec.y = pow(vec.y, y), vec);
const _set = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x = x, vec.y = y, vec);
const _equal = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x === x && vec.y === y);
const _lower = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x > x && vec.y > y);
const _bigger = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x > x && vec.y > y);
const _minLimit = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x < x && (vec.x = x), vec.y < y && (vec.y = y), vec);
const _maxLimit = <V extends IVec2>(x: number, y: number, vec: V) => (vec.x > x && (vec.x = x), vec.y > y && (vec.y = y), vec);;
const _length = <V extends IVec2>(x: number, y: number, vec: V) => hypot(vec.x - x, vec.y - y);

const vec2 = <V extends IVec2, O>(
  args: TVec2,
  callback: TVec2Callback<V, O>,
  vec: V,
): O => {
  const first = args.at(0) ?? 0;

  if (typeof vec !== 'object')
    throw new Error('Need object');

  if (!(callback instanceof Function))
    throw new Error("Need callback");

  if (first instanceof Function)
    return callback(0, 0, vec);

  if (typeof first === 'object')
    return callback(first.x, first.y, vec);

  if (typeof first === 'number') {
    const second = args.at(1);

    if (typeof second === 'number')
      return callback(first, second, vec);

    return callback(first, first, vec);
  }

  throw new Error('Unknow arguments');
};

export class Vec2 {
  x: number = 0;
  y: number = 0;

  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
  }

  [Symbol.toStringTag]() {
    return this.toLog();
  }

  constructor(...args: TVec2) {
    this.set(...args);
  }

  length(...args: TVec2) { return vec2(args, _length, this); }
  toLog() { return `Vec2<x: ${this.x.toFixed(2)}, y: ${this.y.toFixed(2)}>`; }
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

  plus(...args: TVec2) { return vec2(args, _plus, this); }
  minus(...args: TVec2) { return vec2(args, _minus, this); }
  times(...args: TVec2) { return vec2(args, _times, this); }
  div(...args: TVec2) { return vec2(args, _div, this); }
  rem(...args: TVec2) { return vec2(args, _rem, this); }
  pow(...args: TVec2) { return vec2(args, _pow, this); }
  set(...args: TVec2) { return vec2(args, _set, this); }
  lower(...args: TVec2) { return vec2(args, _lower, this); }
  bigger(...args: TVec2) { return vec2(args, _bigger, this); }
  equal(...args: TVec2) { return vec2(args, _equal, this); }

  cplus(...args: TVec2) { return vec2(args, _plus, this.clone()); }
  cminus(...args: TVec2) { return vec2(args, _minus, this.clone()); }
  ctimes(...args: TVec2) { return vec2(args, _times, this.clone()); }
  cdiv(...args: TVec2) { return vec2(args, _div, this.clone()); }
  crem(...args: TVec2) { return vec2(args, _rem, this.clone()); }
  cpow(...args: TVec2) { return vec2(args, _pow, this.clone()); }
  cset(...args: TVec2) { return vec2(args, _set, this.clone()); }

  minLimit(...args: TVec2) { return vec2(args, _minLimit, this); }
  maxLimit(...args: TVec2) { return vec2(args, _maxLimit, this); }

  cminLimit(...args: TVec2) { return vec2(args, _minLimit, this.clone()); }
  cmaxLimit(...args: TVec2) { return vec2(args, _maxLimit, this.clone()); }

  static withIndex(i: number, width: number, height: number) {
    return new Vec2(i % width, i / width | 0);
  }
}