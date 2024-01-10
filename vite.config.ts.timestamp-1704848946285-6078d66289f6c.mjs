// vite.config.ts
import "file:///Users/vic/CodeProjects/openbomber/node_modules/dotenv/config.js";
import { defineConfig } from "file:///Users/vic/CodeProjects/openbomber/node_modules/vite/dist/node/index.js";
import commonjs from "file:///Users/vic/CodeProjects/openbomber/node_modules/vite-plugin-commonjs/dist/index.mjs";
import glsl from "file:///Users/vic/CodeProjects/openbomber/node_modules/vite-plugin-glsl/src/index.js";
import { viteSingleFile } from "file:///Users/vic/CodeProjects/openbomber/node_modules/vite-plugin-singlefile/dist/esm/index.js";
import paths from "file:///Users/vic/CodeProjects/openbomber/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { svelte } from "file:///Users/vic/CodeProjects/openbomber/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import react from "file:///Users/vic/CodeProjects/openbomber/node_modules/@vitejs/plugin-react-swc/index.mjs";

// server/main.ts
import { Server as SocketIO } from "file:///Users/vic/CodeProjects/openbomber/node_modules/socket.io/wrapper.mjs";
import { createLogger as createLogger2 } from "file:///Users/vic/CodeProjects/openbomber/node_modules/vite/dist/node/index.js";

// core/math.ts
var rem = (v, a) => {
  if (!isFinite(v))
    v = 0;
  if (v < 0)
    return rem(v + a, a);
  return v % a;
};
var {
  abs,
  acos,
  acosh,
  asin,
  asinh,
  atan,
  atan2,
  atanh,
  cbrt,
  ceil,
  clz32,
  cos,
  cosh,
  E,
  exp,
  expm1,
  floor,
  fround,
  hypot,
  imul,
  log,
  log10,
  log1p,
  log2,
  LN10,
  LN2,
  LOG10E,
  LOG2E,
  max,
  min,
  pow,
  PI,
  random,
  round,
  sign,
  sin,
  sinh,
  sqrt,
  SQRT1_2,
  SQRT2,
  tan,
  tanh,
  trunc
} = Math;

// core/verify.ts
var makeData = () => Array.from(
  { length: 32 },
  (_) => random() * 255 | 0
);
var calc = (numbers) => numbers.reduce(
  (acc, e, i) => i & 1 && i & 2 ? acc * e : acc + e,
  0
) | 0;

// core/DataBuffer.ts
var DataBuffer = class {
  #cursor = 0;
  #end = 0;
  mem = new ArrayBuffer(1024 * 1024);
  dv = new DataView(this.mem);
  ua = new Uint8Array(this.mem);
  enc = new TextEncoder();
  dec = new TextDecoder();
  get byteLength() {
    return this.#end + 1;
  }
  get buffer() {
    return this.mem.slice(0, this.#end);
  }
  get cursor() {
    return this.#cursor;
  }
  set cursor(v) {
    this.#cursor = v;
    if (v > this.#end)
      this.#end = v;
  }
  constructor(data = 0) {
    if (typeof data === "number") {
      this.cursor = 0;
      this.#end = data - 1;
    }
    if (data instanceof ArrayBuffer) {
      this.write(data);
      this.cursor = 0;
    }
  }
  reset() {
    this.#cursor = 0;
    this.#end = 0;
  }
  cm(cursor, move) {
    if (typeof cursor === "number")
      this.#cursor = cursor;
    cursor = this.#cursor;
    if (typeof move === "number")
      this.cursor += move;
    return cursor;
  }
  // Read buffer
  read(c, offset = this.byteLength - (c ?? this.cursor)) {
    const start = this.cm(c, offset);
    return this.buffer.slice(start, this.cursor);
  }
  // Read boolean
  readboolean(c, m = 1) {
    return !!this.readint8(c, m);
  }
  // Read 8 bit
  readint8(c, m = 1) {
    const cursor = this.cm(c, m);
    return this.dv.getInt8(cursor);
  }
  readuint8(c, m = 1) {
    const cursor = this.cm(c, m);
    return this.dv.getUint8(cursor);
  }
  // Read 16 bit
  readint16(c, m = 2) {
    const cursor = this.cm(c, m);
    return this.dv.getInt16(cursor);
  }
  readuint16(c, m = 2) {
    const cursor = this.cm(c, m);
    return this.dv.getUint16(cursor);
  }
  // Read 32 bit
  readint32(c, m = 4) {
    const cursor = this.cm(c, m);
    return this.dv.getInt32(cursor);
  }
  readuint32(c, m = 4) {
    const cursor = this.cm(c, m);
    return this.dv.getUint32(cursor);
  }
  // Read float
  readfloat32(c, m = 4) {
    const cursor = this.cm(c, m);
    return this.dv.getFloat32(cursor);
  }
  readfloat64(c, m = 8) {
    const cursor = this.cm(c, m);
    return this.dv.getFloat64(cursor);
  }
  // Read bigint
  readbigint64(c, m = 8) {
    const cursor = this.cm(c, m);
    return this.dv.getBigInt64(cursor);
  }
  readbiguint64(c, m = 8) {
    const cursor = this.cm(c, m);
    return this.dv.getBigUint64(cursor);
  }
  // Read string
  readstring(c) {
    const size2 = this.readuint32(c);
    return this.dec.decode(
      this.read(void 0, size2)
    );
  }
  // Write buffer
  write(value, c) {
    if (value instanceof ArrayBuffer)
      value = new Uint8Array(value);
    if (value instanceof Uint8Array) {
      if (typeof c === "number")
        this.#cursor = c;
      const start = this.#cursor;
      this.cursor += value.length;
      this.ua.set(value, start);
    }
  }
  // Write boolean
  writeboolean(value, c, m = 1) {
    this.writeuint8(+value, c, m);
  }
  // Write 8 bit
  writeint8(value, c, m = 1) {
    const cursor = this.cm(c, m);
    this.dv.setInt8(cursor, value);
  }
  writeuint8(value, c, m = 1) {
    const cursor = this.cm(c, m);
    this.dv.setUint8(cursor, value);
  }
  // Write 16 bit
  writeint16(value, c, m = 2) {
    const cursor = this.cm(c, m);
    this.dv.setInt16(cursor, value);
  }
  writeuint16(value, c, m = 2) {
    const cursor = this.cm(c, m);
    this.dv.setUint16(cursor, value);
  }
  // Write 32 bit
  writeint32(value, c, m = 4) {
    const cursor = this.cm(c, m);
    this.dv.setInt32(cursor, value);
  }
  writeuint32(value, c, m = 4) {
    const cursor = this.cm(c, m);
    this.dv.setUint32(cursor, value);
  }
  // Write Float
  writefloat32(value, c, m = 4) {
    const cursor = this.cm(c, m);
    this.dv.setFloat32(cursor, value);
  }
  writefloat64(value, c, m = 8) {
    const cursor = this.cm(c, m);
    this.dv.setFloat64(cursor, value);
  }
  // Write Bigint
  writebigint64(value, c, m = 8) {
    const cursor = this.cm(c, m);
    this.dv.setBigInt64(cursor, value);
  }
  writebiguint64(value, c, m = 8) {
    const cursor = this.cm(c, m);
    this.dv.setBigUint64(cursor, value);
  }
  // Write string
  writestring(value, c) {
    const buffer = this.enc.encode(value);
    this.writeuint32(buffer.length, c);
    this.write(buffer);
  }
};

// core/Proto.ts
var FROM_SYMBOL = Symbol();
var TO_SYMBOL = Symbol();
var makeCustomType = (from, to) => {
  return {
    [FROM_SYMBOL]: from,
    [TO_SYMBOL]: to
  };
};
var makeEnum = (type) => {
  return makeCustomType(
    (db, value) => {
      db.writeuint8(value);
    },
    (db) => {
      return db.readuint8();
    }
  );
};
var Proto = class {
  #param;
  #db;
  get db() {
    return this.#db ?? (this.#db = new DataBuffer());
  }
  #convert(buffer) {
    if (typeof Buffer !== "undefined" && buffer instanceof Buffer) {
      const out = buffer.buffer;
      return out.slice(out.byteLength - buffer.length);
    }
    return buffer;
  }
  constructor(param) {
    this.#param = param;
  }
  [FROM_SYMBOL](db, value) {
    this.from(value, void 0, db);
  }
  [TO_SYMBOL](db) {
    return this.to(void 0, void 0, db);
  }
  from(value, param = this.#param, db) {
    if (!db) {
      db = this.db;
      db.cursor = 0;
    }
    if (typeof param === "object") {
      if (Array.isArray(param)) {
        if (!Array.isArray(value))
          throw new Error("Value is not array");
        db.writeuint32(value.length);
        for (let i = 0; i < value.length; i++) {
          this.from(value[i], param[0], db);
        }
        return db.buffer;
      }
      if (FROM_SYMBOL in param && TO_SYMBOL in param) {
        param[FROM_SYMBOL](db, value);
        return db.buffer;
      }
      for (const key in param) {
        this.from(value[key], param[key], db);
      }
      return db.buffer;
    }
    if ("write" + param in db) {
      db["write" + param](value);
      return db.buffer;
    }
    return db.buffer;
  }
  to(buffer, param = this.#param, db) {
    if (!db) {
      db = this.db;
      db.write(this.#convert(buffer ?? new ArrayBuffer(0)), 0);
      db.cursor = 0;
    }
    if (typeof param === "object") {
      if (Array.isArray(param)) {
        const length = db.readuint32();
        return Array.from({ length }, () => this.to(buffer, param[0], db));
      }
      if (TO_SYMBOL in param && FROM_SYMBOL in param)
        return param[TO_SYMBOL](db);
      const object = {};
      for (const key in param) {
        object[key] = this.to(buffer, param[key], db);
      }
      return object;
    }
    if ("read" + param in db)
      return db["read" + param]();
    return null;
  }
};

// core/makeWebSocketApi.ts
var API_COUNTER = 0;
var makeWebSocketApi = (param) => {
  const db = new DataBuffer();
  const API_KEY = API_COUNTER++;
  const METHODS_MAP = /* @__PURE__ */ new Map();
  const METHODS_KEY_MAP = /* @__PURE__ */ new Map();
  let METHOD_COUNTER = 0;
  for (const key in param) {
    const { input, output } = param[key];
    const METHOD_KEY = METHOD_COUNTER++;
    const method = {
      id: METHOD_KEY,
      key,
      input: input ? new Proto(input) : void 0,
      output: output ? new Proto(output) : void 0
    };
    METHODS_MAP.set(METHOD_KEY, method);
    METHODS_KEY_MAP.set(key, method);
  }
  return {
    forward(socket, api) {
      const listening = (data) => {
        db.write(data, 0);
        db.cursor = 0;
        if (db.readuint8() !== API_KEY)
          return;
        if (db.readuint8() !== 0)
          return;
        const METHOD_KEY = db.readuint8();
        const RETURN_KEY = db.readint8();
        const method = METHODS_MAP.get(METHOD_KEY);
        if (!method || !(method.key in api))
          return;
        const input = method.input ? [
          method.input.to(void 0, void 0, db)
        ] : [];
        try {
          const result = api[method.key](...input);
          db.reset();
          if (method.output) {
            db.writeuint8(API_KEY);
            db.writeuint8(1);
            db.writeuint8(METHOD_KEY);
            db.writeint8(RETURN_KEY);
            method.output.from(result, void 0, db);
            socket.emit(`${API_KEY}`, db.buffer);
          }
        } catch (e) {
          console.error(e);
        }
      };
      socket.on(`${API_KEY}`, listening);
      return () => {
        socket.off(`${API_KEY}`, listening);
      };
    },
    use(socket) {
      const CAllBACK_MAP = /* @__PURE__ */ new Map();
      let CALLBACK_COUNTER = 0;
      const listener = (data) => {
        db.write(data, 0);
        db.cursor = 0;
        if (db.readuint8() !== API_KEY)
          return;
        if (db.readuint8() !== 1)
          return;
        const RETURN_KEY = db.readint8();
        const METHOD_KEY = db.readuint8();
        const method = METHODS_MAP.get(METHOD_KEY);
        const callback = CAllBACK_MAP.get(RETURN_KEY);
        if (!method || !callback || !method.output)
          return;
        callback(
          method.output.to(void 0, void 0, db)
        );
        CAllBACK_MAP.delete(RETURN_KEY);
      };
      socket.on(`${API_KEY}`, listener);
      return Object.assign(
        () => {
          socket.off(`${API_KEY}`, listener);
        },
        Object.entries(param).reduce((acc, [key]) => {
          const method = METHODS_KEY_MAP.get(key);
          if (!method)
            return acc;
          const { id: METHOD_KEY } = method;
          acc[key] = (input) => {
            const RETURN_KEY = CALLBACK_COUNTER++;
            db.reset();
            db.writeuint8(API_KEY);
            db.writeuint8(0);
            db.writeuint8(METHOD_KEY);
            db.writeuint8(RETURN_KEY);
            if (method.input)
              method.input.from(input, void 0, db);
            socket.emit(`${API_KEY}`, db.buffer);
            if (method.output)
              return new Promise((resolve) => {
                CAllBACK_MAP.set(RETURN_KEY, resolve);
              });
          };
          return acc;
        }, {})
      );
    }
  };
};

// core/Vec2.ts
var _plus = (x, y, vec) => (vec.x += x, vec.y += y, vec);
var _minus = (x, y, vec) => (vec.x -= x, vec.y -= y, vec);
var _times = (x, y, vec) => (vec.x *= x, vec.y *= y, vec);
var _div = (x, y, vec) => (vec.x /= x, vec.y /= y, vec);
var _rem = (x, y, vec) => (vec.x = rem(vec.x, x), vec.y = rem(vec.y, y), vec);
var _pow = (x, y, vec) => (vec.x = pow(vec.x, x), vec.y = pow(vec.y, y), vec);
var _set = (x, y, vec) => (vec.x = x, vec.y = y, vec);
var _equal = (x, y, vec) => vec.x === x && vec.y === y;
var _lower = (x, y, vec) => vec.x > x && vec.y > y;
var _bigger = (x, y, vec) => vec.x > x && vec.y > y;
var _minLimit = (x, y, vec) => (vec.x < x && (vec.x = x), vec.y < y && (vec.y = y), vec);
var _maxLimit = (x, y, vec) => (vec.x > x && (vec.x = x), vec.y > y && (vec.y = y), vec);
var vec2 = (args, callback, vec) => {
  const first = args.at(0) ?? 0;
  if (typeof vec !== "object")
    throw new Error("Need object");
  if (!(callback instanceof Function))
    throw new Error("Need callback");
  if (first instanceof Function)
    return callback(0, 0, vec);
  if (typeof first === "object")
    return callback(first.x, first.y, vec);
  if (typeof first === "number") {
    const second = args.at(1);
    if (typeof second === "number")
      return callback(first, second, vec);
    return callback(first, first, vec);
  }
  throw new Error("Unknow arguments");
};
var Vec2 = class _Vec2 {
  x = 0;
  y = 0;
  constructor(...args) {
    this.set(...args);
  }
  length(...args) {
    return sqrt(
      this.cminus(...args).pow(2).sum()
    );
  }
  toLog() {
    return `Vec2<x: ${this.x.toFixed(2)}, y: ${this.y.toFixed(2)}>`;
  }
  [Symbol.toStringTag]() {
    return this.toLog();
  }
  toString() {
    return this.toLog();
  }
  sum() {
    return this.x + this.y;
  }
  clone() {
    return new _Vec2(this);
  }
  normalize() {
    return this.div(this.length() || 1);
  }
  round() {
    return this.set(round(this.x), round(this.y));
  }
  floor() {
    return this.set(floor(this.x), floor(this.y));
  }
  ceil() {
    return this.set(ceil(this.x), ceil(this.y));
  }
  abs() {
    return this.set(abs(this.x), abs(this.y));
  }
  cnormalize() {
    return this.cdiv(this.length() || 1);
  }
  cround() {
    return this.cset(round(this.x), round(this.y));
  }
  cfloor() {
    return this.cset(floor(this.x), floor(this.y));
  }
  cceil() {
    return this.cset(ceil(this.x), ceil(this.y));
  }
  cabs() {
    return this.cset(abs(this.x), abs(this.y));
  }
  plus(...args) {
    return vec2(args, _plus, this);
  }
  minus(...args) {
    return vec2(args, _minus, this);
  }
  times(...args) {
    return vec2(args, _times, this);
  }
  div(...args) {
    return vec2(args, _div, this);
  }
  rem(...args) {
    return vec2(args, _rem, this);
  }
  pow(...args) {
    return vec2(args, _pow, this);
  }
  set(...args) {
    return vec2(args, _set, this);
  }
  lower(...args) {
    return vec2(args, _lower, this);
  }
  bigger(...args) {
    return vec2(args, _bigger, this);
  }
  equal(...args) {
    return vec2(args, _equal, this);
  }
  cplus(...args) {
    return vec2(args, _plus, this.clone());
  }
  cminus(...args) {
    return vec2(args, _minus, this.clone());
  }
  ctimes(...args) {
    return vec2(args, _times, this.clone());
  }
  cdiv(...args) {
    return vec2(args, _div, this.clone());
  }
  crem(...args) {
    return vec2(args, _rem, this.clone());
  }
  cpow(...args) {
    return vec2(args, _pow, this.clone());
  }
  cset(...args) {
    return vec2(args, _set, this.clone());
  }
  minLimit(...args) {
    return vec2(args, _minLimit, this);
  }
  maxLimit(...args) {
    return vec2(args, _maxLimit, this);
  }
  cminLimit(...args) {
    return vec2(args, _minLimit, this.clone());
  }
  cmaxLimit(...args) {
    return vec2(args, _maxLimit, this.clone());
  }
  static withIndex(i, width, height) {
    return new _Vec2(i % width, i / width | 0);
  }
};

// core/point.ts
var point = (...args) => {
  return new Vec2(...args);
};
var points = (input) => {
  return input.split(";").map((item) => {
    const [x, y] = item.split(",").map(Number);
    return point(x, y);
  });
};

// shared/types.ts
var DEATH_FRAMES = points("0,0;0,1;0,2;0,3;0,4;0,5;0,6;0,7");
var MAP_ITEMS = {
  [0 /* CLEAR */]: point(1, 3),
  [1 /* WALL */]: point(0, 3),
  [2 /* BLOCK */]: point(0, 4),
  [3 /* GRAS */]: point(1, 1),
  [4 /* SAND */]: point(1, 4),
  [5 /* WATER */]: point(1, 1)
};
var ESounds = /* @__PURE__ */ ((ESounds2) => {
  ESounds2[ESounds2["win"] = 0] = "win";
  ESounds2[ESounds2["bonus"] = 1] = "bonus";
  ESounds2[ESounds2["death"] = 2] = "death";
  ESounds2[ESounds2["putBomb"] = 3] = "putBomb";
  ESounds2[ESounds2["explode"] = 4] = "explode";
  ESounds2[ESounds2["newLife"] = 5] = "newLife";
  ESounds2[ESounds2["message"] = 6] = "message";
  ESounds2[ESounds2["shield"] = 7] = "shield";
  ESounds2[ESounds2["crazy"] = 8] = "crazy";
  ESounds2[ESounds2["explodeFail"] = 9] = "explodeFail";
  ESounds2[ESounds2["fireOn"] = 10] = "fireOn";
  ESounds2[ESounds2["fireOff"] = 11] = "fireOff";
  ESounds2[ESounds2["speedOn"] = 12] = "speedOn";
  ESounds2[ESounds2["speedOff"] = 13] = "speedOff";
  ESounds2[ESounds2["kill"] = 14] = "kill";
  ESounds2[ESounds2["moving"] = 15] = "moving";
  return ESounds2;
})(ESounds || {});
var EDir = /* @__PURE__ */ ((EDir2) => {
  EDir2[EDir2["TOP"] = 0] = "TOP";
  EDir2[EDir2["LEFT"] = 1] = "LEFT";
  EDir2[EDir2["RIGHT"] = 2] = "RIGHT";
  EDir2[EDir2["BOTTOM"] = 3] = "BOTTOM";
  return EDir2;
})(EDir || {});
var EAnimate = /* @__PURE__ */ ((EAnimate2) => {
  EAnimate2[EAnimate2["IDLE"] = 0] = "IDLE";
  EAnimate2[EAnimate2["RUNNING"] = 1] = "RUNNING";
  return EAnimate2;
})(EAnimate || {});
var DIRECTIONS = {
  [0 /* TOP */]: point(0, -1),
  [1 /* LEFT */]: point(-1, 0),
  [2 /* RIGHT */]: point(1, 0),
  [3 /* BOTTOM */]: point(0, 1)
};
var EAchivment = /* @__PURE__ */ ((EAchivment2) => {
  EAchivment2[EAchivment2["APPEND_BOMB"] = 0] = "APPEND_BOMB";
  EAchivment2[EAchivment2["APPEND_EXPO"] = 1] = "APPEND_EXPO";
  EAchivment2[EAchivment2["APPEND_SPEED"] = 2] = "APPEND_SPEED";
  EAchivment2[EAchivment2["RANDOM"] = 3] = "RANDOM";
  EAchivment2[EAchivment2["APPEND_SHIELD"] = 4] = "APPEND_SHIELD";
  EAchivment2[EAchivment2["MOVING_BOMB"] = 5] = "MOVING_BOMB";
  EAchivment2[EAchivment2["FIRE"] = 6] = "FIRE";
  EAchivment2[EAchivment2["CRAZY_BOMB"] = 7] = "CRAZY_BOMB";
  return EAchivment2;
})(EAchivment || {});
var ACHIVMEN_POINTS = {
  [0 /* APPEND_BOMB */]: point(0, 0),
  [1 /* APPEND_EXPO */]: point(1, 0),
  [2 /* APPEND_SPEED */]: point(2, 0),
  [3 /* RANDOM */]: point(3, 0),
  [4 /* APPEND_SHIELD */]: point(4, 0),
  [5 /* MOVING_BOMB */]: point(5, 0),
  [7 /* CRAZY_BOMB */]: point(6, 0),
  [6 /* FIRE */]: point(7, 0)
};
var EEffect = /* @__PURE__ */ ((EEffect3) => {
  EEffect3[EEffect3["DEATH"] = 0] = "DEATH";
  EEffect3[EEffect3["FAKE_EXPLODE"] = 1] = "FAKE_EXPLODE";
  return EEffect3;
})(EEffect || {});
var EExplodeDir = /* @__PURE__ */ ((EExplodeDir3) => {
  EExplodeDir3[EExplodeDir3["CENTER"] = 0] = "CENTER";
  EExplodeDir3[EExplodeDir3["TOP"] = 1] = "TOP";
  EExplodeDir3[EExplodeDir3["LEFT"] = 2] = "LEFT";
  EExplodeDir3[EExplodeDir3["RIGHT"] = 3] = "RIGHT";
  EExplodeDir3[EExplodeDir3["BOTTOM"] = 4] = "BOTTOM";
  return EExplodeDir3;
})(EExplodeDir || {});
var EXPODER_DIRS = {
  [0 /* CENTER */]: point(0, 0),
  [1 /* TOP */]: point(0, -1),
  [2 /* LEFT */]: point(-1, 0),
  [3 /* RIGHT */]: point(1, 0),
  [4 /* BOTTOM */]: point(0, 1)
};

// shared/api.ts
var POSITION = makeCustomType(
  (db, value) => {
    db.writeint32(value * 1e3);
  },
  (db) => {
    return db.readint32() / 1e3;
  }
);
var DIRECTION = makeEnum(EDir);
var ANIMATION = makeEnum(EAnimate);
var SOUND = makeEnum(ESounds);
var EFFECT = makeEnum(EEffect);
var ACHIVMENT = makeEnum(EAchivment);
var EXPLODEDIRECTION = makeEnum(EExplodeDir);
var INPUT_POSITION = new Proto({
  x: POSITION,
  y: POSITION,
  dir: DIRECTION,
  animate: ANIMATION
});
var MESSAGE_INFO = new Proto({
  message: "string",
  sender: {
    name: "string"
  },
  isMe: "boolean"
});
var EFFECT_INFO = new Proto({
  id: "uint32",
  x: POSITION,
  y: POSITION,
  type: EFFECT,
  deltaTime: "float64",
  meta: ["uint8"]
});
var GAME_INFO = new Proto({
  width: "uint8",
  height: "uint8",
  winPlayerId: "uint32",
  playersCount: "uint8",
  livePlayersCount: "uint8",
  spectratorsCount: "uint8",
  currentLimited: "int16"
});
var PLAYER_POSITION = new Proto({
  id: "uint32",
  x: POSITION,
  y: POSITION,
  speed: "float32",
  dir: DIRECTION,
  animate: ANIMATION
});
var PLAYER_INFO = new Proto({
  id: "uint32",
  name: "string",
  skin: "uint8",
  inGame: "boolean",
  isDeath: "boolean",
  canJoin: "boolean",
  wins: "uint8",
  kills: "uint8",
  deaths: "uint8",
  isAdmin: "boolean",
  effects: {
    haveShield: "boolean",
    speed: "float32",
    crazy: "boolean",
    haveMove: "boolean"
  },
  ping: "uint16"
});
var ACHIVMENT_INFO = new Proto({
  id: "uint32",
  x: POSITION,
  y: POSITION,
  type: ACHIVMENT
});
var EXPLODE_INFO = new Proto({
  id: "uint32",
  x: POSITION,
  y: POSITION,
  points: [{
    x: POSITION,
    y: POSITION,
    dir: EXPLODEDIRECTION,
    isFinaly: "boolean",
    isBlock: "boolean"
  }]
});
var START_POSITION = new Proto({
  x: POSITION,
  y: POSITION
});
var BOMB_INFO = new Proto({
  id: "uint32",
  x: POSITION,
  y: POSITION,
  radius: "uint16",
  isMove: "boolean",
  isCrazy: "boolean",
  isRadio: "boolean"
});
var POSITION_SOUND = new Proto({
  position: {
    x: POSITION,
    y: POSITION
  },
  sound: SOUND
});
var REMAINING_EFFECTS = new Proto({
  radius: "uint16",
  bombs: "uint16",
  sup: "uint16",
  sdown: "uint16",
  shield: "uint16",
  crazy: "uint16",
  moving: "uint16"
});
var gameApi = makeWebSocketApi({
  setPosition: { input: INPUT_POSITION },
  setBomb: {},
  setName: { input: "string" },
  toGame: {},
  toLeave: {},
  sendMessage: { input: "string" },
  setSkin: { input: "uint8" },
  setCustomSkin: { input: "uint8" },
  ping: {}
});
var playerApi = makeWebSocketApi({
  setStartPosition: { input: START_POSITION },
  updateMap: { input: ["uint8"] },
  updateBombs: { input: [BOMB_INFO] },
  updatePlayers: { input: [PLAYER_INFO] },
  updateExplodes: { input: [EXPLODE_INFO] },
  updateAchivments: { input: [ACHIVMENT_INFO] },
  updateLocalInfo: { input: PLAYER_INFO },
  updatePlayerPositions: { input: [PLAYER_POSITION] },
  updateGameInfo: { input: GAME_INFO },
  updateRemainingEffects: { input: REMAINING_EFFECTS },
  updateWaitForRestart: { input: "int8" },
  updateEffects: { input: [EFFECT_INFO] },
  playSound: { input: SOUND },
  playSoundPosition: { input: POSITION_SOUND },
  onMessage: { input: MESSAGE_INFO },
  ping: {}
});
var verifyApi = makeWebSocketApi({
  verify: { input: ["uint8"], output: "int32" },
  addressBlock: { input: "uint8" }
});

// core/toCol.ts
var toCol = (n, c = 2) => {
  return ("0".repeat(c) + n).slice(-c);
};

// core/FDate.ts
var FORMAT_RE = /(\w)\1*/g;
var PARSE_RE = /(\d+)\s*(\w?)/g;
var FDate = class extends Date {
  get h() {
    return this.getHours();
  }
  get m() {
    return this.getMinutes();
  }
  get s() {
    return this.getSeconds();
  }
  get ms() {
    return this.getMilliseconds();
  }
  set h(v) {
    this.setHours(v);
  }
  set m(v) {
    this.setMinutes(v);
  }
  set s(v) {
    this.setSeconds(v);
  }
  set ms(v) {
    this.setMilliseconds(v);
  }
  get D() {
    return this.getDate();
  }
  get M() {
    return this.getMonth() + 1;
  }
  get Y() {
    return this.getFullYear();
  }
  set D(v) {
    this.setDate(v);
  }
  set M(v) {
    this.setMonth(v - 1);
  }
  set Y(v) {
    this.setFullYear(v);
  }
  static makeFormat(format) {
    return this.format.bind(this, format);
  }
  static format(format, date) {
    if (!(date instanceof this))
      date = new this(date);
    return format.replace(FORMAT_RE, (source) => {
      const d = date;
      const [key] = source;
      if (key in d)
        return toCol(d[key], source.length);
      return source;
    });
  }
  static from(string) {
    const date = new this(0);
    string.replace(PARSE_RE, (_, num, key) => {
      if (key in date) {
        date[key] += +num;
      }
      if (!key)
        date.ms += +num;
      return "";
    });
    return +date;
  }
};

// shared/config.ts
var TEST_ADMIN_IP = /(127.0.0.\d+|10\.242\.36\.\d+)/;
var MAX_PLAYERS = 16;
var NICK_LENGTH = 18;
var MESSAGE_LENGTH = 100;
var PLAYER_TIMEOUT = FDate.from("1m");
var SHIELD_TIME = FDate.from("50s");
var SPEED_TIME = FDate.from("25s");
var CRAZY_BOMB_TIME = FDate.from("30s");
var MOVING_TIME = FDate.from("35s");
var BOMB_TIME = FDate.from("2s");
var CRAZY_BOMB_MIN = FDate.from("1s");
var CRAZY_BOMB_MAX = FDate.from("5s");
var CRAZY_BOMB_BOOST = 5;
var SKINS_COUNT = 11;
var TIMEOUT_MESSAGE = FDate.from("2s");
var TIMEOUT_NICKNAME = FDate.from("500");
var TIMEOUT_SKIN = FDate.from("500");
var TIMEOUT_RECONNECT = FDate.from("10s");
var WAIT_FOR_LIMIT = FDate.from("15s");
var ZONELIMIT_TIMEOUT = FDate.from("15s");
var MAX_ADDRESS_CONNECT = 5;

// core/Events.ts
var CustomEvent = class extends Event {
  constructor(type, data) {
    super(type);
    this.data = data;
  }
};
var Events = class {
  #target = new EventTarget();
  #regs = /* @__PURE__ */ new Map();
  #getRegs(key) {
    return this.#regs.get(key) ?? (this.#regs.set(key, /* @__PURE__ */ new Set()), this.#regs.get(key));
  }
  addEventListener(type, callback, options) {
    this.#target.addEventListener(type, callback, options);
  }
  on(type, callback) {
    this.#getRegs(type).add(callback);
    this.addEventListener(type, callback);
  }
  once(type, callback) {
    const remove = () => {
      this.#getRegs(type).delete(callback);
      this.#getRegs(type).delete(remove);
    };
    this.#getRegs(type).add(callback);
    this.#getRegs(type).add(remove);
    this.addEventListener(type, callback, { once: true });
    this.addEventListener(type, remove, { once: false });
  }
  off(type, callback) {
    if (!callback) {
      const regs = this.#getRegs(type);
      for (const reg of regs)
        this.removeEventListener(type, reg);
      return regs.clear();
    }
    this.removeEventListener(type, callback);
  }
  emit(type, data) {
    this.dispatchEvent(type, data);
  }
  removeEventListener(type, callback, options) {
    this.#target.removeEventListener(type, callback, options);
  }
  dispatchEvent(type, data) {
    this.#target.dispatchEvent(
      new CustomEvent(type, data)
    );
  }
};

// server/bot/index.ts
var isEnable = process.env.DISCORD_INFO === "enable";
var discordChannel = process.env.DISCORD_CHANNEL ?? null;
var discordToken = process.env.DISCORD_TOKEN ?? null;
var events = new Events();
events.on("change", (type) => {
  type.data.name;
});
function run() {
}

// server/class/Game.ts
import "file:///Users/vic/CodeProjects/openbomber/node_modules/socket.io/wrapper.mjs";
import { createLogger } from "file:///Users/vic/CodeProjects/openbomber/node_modules/vite/dist/node/index.js";

// core/toLimit.ts
var toLimit = (n, min2 = -Infinity, max2 = Infinity) => {
  return Math.min(Math.max(n, min2), max2);
};

// core/calcMap.ts
var PADDING = 6;
var MARGIN = 8;
var calcMap = (players = 0) => {
  players = toLimit(players, 1);
  let width = 0;
  let height = 0;
  let internal = 0;
  const positions = [];
  do {
    internal += 0.5;
    width = ceil(internal);
    height = floor(internal);
  } while (width * height < players);
  let px = PADDING;
  let py = PADDING;
  if (players > 1)
    px = 2;
  if (players > 2)
    py = 2;
  let m = MARGIN + PADDING;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      positions.push(
        point(
          px + m * x,
          py + m * y
        )
      );
    }
  }
  return {
    size: point(
      2 * px + m * (width - 1) + 1,
      2 * py + m * (height - 1) + 1
    ),
    positions
  };
};

// core/makeEffect.ts
import equal from "file:///Users/vic/CodeProjects/openbomber/node_modules/fast-deep-equal/index.js";

// core/isEqualBuffer.ts
var isEqualBuffer = (buffer1, buffer2) => {
  const data1 = new Uint8Array(buffer1);
  const data2 = new Uint8Array(buffer2);
  for (let i = 0; i < data1.length; i++)
    if (data1[i] !== data2[i])
      return false;
  return true;
};

// core/makeEffect.ts
var makeEffect = () => {
  let previewValue = null;
  return (newValue, callback) => {
    try {
      if (newValue instanceof ArrayBuffer && previewValue instanceof ArrayBuffer) {
        if (isEqualBuffer(previewValue, newValue))
          return;
      } else {
        if (equal(previewValue, newValue))
          return;
      }
    } catch (e) {
      callback(newValue, previewValue);
      previewValue = newValue;
      return;
    }
    callback(newValue, previewValue);
    previewValue = newValue;
  };
};

// core/effectObject.ts
var SYMBOLS_MAP = /* @__PURE__ */ new Map();
function getSymbol(key) {
  return SYMBOLS_MAP.get(key) ?? (SYMBOLS_MAP.set(key, Symbol(key)), SYMBOLS_MAP.get(key));
}
var effectObject = (target, key, newValue, callback) => {
  const symbol = getSymbol(key);
  const effect = target[symbol] ?? (target[symbol] = makeEffect());
  effect(newValue, callback);
};

// core/find.ts
function find(collect, condition) {
  if (typeof condition === "object") {
    const data = condition;
    condition = (object) => {
      for (const key in data) {
        if (data[key] !== object[key])
          return false;
      }
      return true;
    };
  }
  let i = 0;
  for (const f of collect) {
    if (condition(f, i++))
      return f;
  }
  return null;
}

// core/makePicker.ts
var makePicker = (keys) => {
  return new Function(
    "obj",
    "return {" + keys.map((key) => `${key.toString()}: obj['${key.toString()}']`).join(", ") + "};"
  );
};

// core/pick.ts
var CACHE = /* @__PURE__ */ new Map();
var pick = (target, keys) => {
  const KEY = keys.join(",");
  let picker = CACHE.get(KEY);
  if (!picker) {
    picker = makePicker(keys);
    CACHE.set(KEY, picker);
  }
  return picker(target);
};

// core/map.ts
var map = (collect, func, filter) => {
  const output = [];
  if (Array.isArray(func)) {
    const keys = func;
    func = pick;
  }
  let index = 0;
  for (const item of collect) {
    const target = func(item, index++);
    if (!filter || filter(item, target))
      output.push(target);
  }
  return output;
};

// core/random.ts
var random2 = (collect) => {
  return collect[collect.length * Math.random() | 0];
};

// server/env.ts
var IS_DEV = process.env["npm_lifecycle_event"] === "dev";

// server/class/Player.ts
import "file:///Users/vic/CodeProjects/openbomber/node_modules/socket.io/wrapper.mjs";

// core/calcSpeed.ts
var calcSpeed = (dtime = 0, multi = 0) => 3e-3 * dtime * multi;

// server/data/addressTime.ts
var ADDRESS_STORE = /* @__PURE__ */ new Map();
var getTime = (address) => {
  return ADDRESS_STORE.get(address) ?? (ADDRESS_STORE.set(address, Date.now() - TIMEOUT_RECONNECT), ADDRESS_STORE.get(address));
};
var setTime = (address, value) => {
  ADDRESS_STORE.set(address, value);
};

// server/class/PlayerEffect.ts
var EFFECTS_SYMBOL = Symbol("effects");
var PlayerEffect = class _PlayerEffect {
  constructor(player) {
    this.player = player;
  }
  isCreated = false;
  created = Date.now();
  lifetime = Infinity;
  get remaining() {
    return this.created + this.lifetime - Date.now();
  }
  appendTime(time = 0) {
    if (!isFinite(this.lifetime))
      this.lifetime = 0;
    this.lifetime += time;
  }
  update() {
    if (!this.isCreated) {
      this.isCreated = true;
      this.onCreate();
    }
    if (!isFinite(this.lifetime))
      return;
    if (this.remaining > 0)
      return;
    this.delete();
  }
  delete() {
    const result = _PlayerEffect.effects(this.player).delete(this);
    if (result) {
      this.onDelete();
    }
    return result;
  }
  onCreate() {
  }
  onDelete() {
  }
  static effects(player) {
    return player[EFFECTS_SYMBOL] ?? (player[EFFECTS_SYMBOL] = /* @__PURE__ */ new Set());
  }
  static getEffects(player, type) {
    return [...this.effects(player)].filter((e) => !type || e instanceof type);
  }
  static clearEffets(player, type) {
    const effects = this.effects(player);
    for (const effect of this.getEffects(player, type)) {
      effects.delete(effect);
    }
  }
};

// server/class/CrasyBombEffect.ts
var CrasyBombEffect = class extends PlayerEffect {
  onCreate() {
    const { player: { newApi } } = this;
    newApi.playSound(8 /* crazy */);
  }
  onDelete() {
    const { player: { newApi } } = this;
    newApi.playSound(8 /* crazy */);
  }
  static get(player) {
    return this.getEffects(player, this)[0];
  }
  static hasCrasyBomb(player) {
    return !!this.get(player);
  }
  static delete(player) {
    var _a;
    (_a = this.get(player)) == null ? void 0 : _a.delete();
  }
  static append(player) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player);
    currentEffect.appendTime(CRAZY_BOMB_TIME);
    effets.add(currentEffect);
  }
};

// core/isColide.ts
var isColide = (a, b, sa, sb) => {
  if (a.x >= b.x - sb.x && a.y >= b.y - sb.y && a.x <= b.x && a.y <= b.y || a.x + sa.x >= b.x && a.y + sa.y >= b.y && a.x <= b.x + sb.x && a.y <= b.y + sb.y)
    return true;
  return false;
};

// server/class/Entity.ts
var me = point();
var size = point();
var pos = point();
var obj = point();
var Entity = class extends Vec2 {
  constructor(game2, x, y) {
    super(x, y);
    this.game = game2;
  }
  checkCollision(o, over = 1) {
    const s = 1 - over;
    me.set(this).plus(s / 2);
    pos.set(o).plus(s / 2);
    size.set(over);
    obj.set(over);
    return isColide(me, pos, size, obj);
  }
  update(dtime, time) {
  }
};

// server/class/Effect.ts
var Effect = class extends Entity {
  id;
  type;
  time = Date.now();
  meta = [];
  get deltaTime() {
    return Date.now() - this.time;
  }
  constructor(game2, x, y, type, meta = []) {
    super(game2, x, y);
    this.id = game2.effectsCounter++;
    this.type = type;
    this.meta = meta;
  }
  update(dtime, time) {
    const { x, y } = this.cround();
    const { map: map2, width } = this.game;
    const value = map2[width * y + x];
    if (value === 1 /* WALL */ || value === 2 /* BLOCK */)
      this.game.effects.delete(this);
  }
  get info() {
    return pick(
      this,
      [
        "id",
        "x",
        "y",
        "type",
        "deltaTime",
        "meta"
      ]
    );
  }
  get infoType() {
    return pick(
      this,
      [
        "type"
      ]
    );
  }
};

// server/class/Explode.ts
var ExplodePoint = class extends Entity {
  constructor(explode, x, y, dir, isFinaly = false, isBlock = false) {
    super(explode.game, x, y);
    this.explode = explode;
    this.dir = dir;
    this.isFinaly = isFinaly;
    this.isBlock = isBlock;
  }
  update(dtime, time) {
    const { bombs, achivments } = this.game;
    for (const bomb of bombs) {
      if (bomb.checkCollision(this, 0.7)) {
        bomb.player = this.explode.player;
        Explode.run(bomb);
      }
    }
    if (!this.isBlock) {
      for (const achivment of achivments) {
        if (achivment.checkCollision(this, 0.9))
          achivments.delete(achivment);
      }
    }
  }
};
var Explode = class _Explode extends Entity {
  id;
  #points = [];
  created = Date.now();
  liveTime = 500;
  radius = 1;
  player;
  ignore = /* @__PURE__ */ new Set();
  constructor(bomb) {
    super(bomb.game, bomb.x, bomb.y);
    this.id = bomb.game.explodesCounter++;
    this.radius = bomb.radius;
    this.player = bomb.player;
    this.explode();
  }
  static run(bomb) {
    const { bombs, explodes, players } = bomb.game;
    players.forEach((player) => {
      player.newApi.playSoundPosition({
        sound: 4 /* explode */,
        position: bomb
      });
    });
    if (bombs.delete(bomb)) {
      bomb.round();
      explodes.add(new _Explode(bomb));
    }
  }
  explode() {
    const points2 = this.#points;
    const {
      x,
      y,
      radius,
      game: game2
    } = this;
    const {
      width,
      height,
      map: map2
    } = game2;
    const vec = point();
    for (const [_id, direction] of Object.entries(EXPODER_DIRS)) {
      const { x: dx, y: dy } = direction;
      const dir = +_id;
      for (let i = +_id ? 1 : 0; i <= radius; i++) {
        const x2 = i * dx + this.x;
        const y2 = i * dy + this.y;
        const index = x2 + y2 * width;
        vec.set(x2, y2);
        if (x2 < 0 || x2 > width - 1 || y2 < 0 || y2 > height - 1)
          break;
        if (map2[index] === 1 /* WALL */ || map2[index] === 2 /* BLOCK */) {
          if (map2[index] == 2 /* BLOCK */) {
            map2[index] = 0 /* CLEAR */;
            if (map2.achivments.delete(index)) {
              this.game.achivments.add(
                new Achivment(this.game, x2, y2)
              );
            }
            points2.push(new ExplodePoint(this, x2, y2, dir, true, true));
          }
          const last = points2.slice(-1)[0];
          if (last)
            last.isFinaly = true;
          break;
        }
        points2.push(new ExplodePoint(this, x2, y2, dir, radius === i));
      }
      for (const { x: x2, y: y2 } of points2) {
        const index = y2 * width + x2;
        if (map2[index] === 0 /* CLEAR */)
          map2[index] = 3 /* GRAS */;
      }
    }
  }
  update(dtime, time) {
    const { explodes } = this.game;
    const { created, liveTime } = this;
    if (Date.now() > created + liveTime) {
      explodes.delete(this);
      this.ignore.clear();
    }
    for (const point2 of this.points) {
      point2.update(dtime, time);
    }
  }
  get points() {
    return [].concat(this.#points);
  }
  get info() {
    return pick(this, [
      "id",
      "x",
      "y",
      "points"
    ]);
  }
};

// server/class/MovingEffect.ts
var MovingEffect = class extends PlayerEffect {
  onCreate() {
    this.player.newApi.playSound(15 /* moving */);
  }
  onDelete() {
    this.player.newApi.playSound(15 /* moving */);
  }
  static get(player) {
    return this.getEffects(player, this)[0];
  }
  static hasShield(player) {
    return !!this.get(player);
  }
  static delete(player) {
    var _a;
    (_a = this.get(player)) == null ? void 0 : _a.delete();
  }
  static append(player) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player);
    currentEffect.appendTime(MOVING_TIME);
    effets.add(currentEffect);
  }
};

// server/class/RadiusEffect.ts
var RadiusEffect = class _RadiusEffect extends PlayerEffect {
  static count(player) {
    return this.getEffects(player, this).length;
  }
  static append(player) {
    const effects = this.effects(player);
    effects.add(new _RadiusEffect(player));
  }
};

// server/class/Bomb.ts
var Bomb2 = class extends Entity {
  constructor(player) {
    const x = Math.round(player.x);
    const y = Math.round(player.y);
    super(player.game, x, y);
    this.player = player;
    this.creator = player;
    this.id = player.game.bombsCounter++;
    this.radius = RadiusEffect.count(player) + 1;
    this.isCrazy = !!CrasyBombEffect.get(player);
    if (this.isCrazy) {
      this.isFake = Math.random() < 0.1 ? true : false;
      this.liveTime = CRAZY_BOMB_MIN + Math.random() * (CRAZY_BOMB_MAX - CRAZY_BOMB_MIN);
      this.radius = this.radius + Math.random() * (this.radius * CRAZY_BOMB_BOOST - this.radius) | 0;
    }
  }
  id;
  creator;
  time = Date.now();
  liveTime = BOMB_TIME;
  dir;
  isFake = false;
  radius = 1;
  maked = true;
  isCrazy = false;
  isRadio = false;
  get isMove() {
    return !!this.dir;
  }
  get info() {
    return pick(this, [
      "id",
      "x",
      "y",
      "isMove",
      "radius",
      "isCrazy",
      "isRadio"
    ]);
  }
  update(dtime) {
    const { time, liveTime, game: { waitForRestart, players, bombs, map: map2, achivments }, player } = this;
    if (!this.dir) {
      const mapValue = this.game.map[this.cfloor().times(1, this.game.width).sum()];
      if (mapValue === 1 /* WALL */ || mapValue === 2 /* BLOCK */) {
        this.game.bombs.delete(this);
        return;
      }
    }
    if (!player.checkCollision(this, 0.5) && this.maked) {
      this.maked = false;
    }
    if (!this.maked && !this.dir) {
      for (const player2 of players) {
        if (player2.animate === 0 /* IDLE */)
          continue;
        if (!MovingEffect.get(player2))
          continue;
        if (player2.isDeath || !player2.inGame)
          continue;
        if (player2.checkCollision(this) && !this.dir) {
          const dir = this.cminus(player2).round();
          if (dir.equal(DIRECTIONS[player2.dir])) {
            this.player = player2;
            this.dir = dir;
          }
        }
      }
    }
    if (this.dir !== void 0) {
      const move = this.dir;
      const newSet = this.cplus(move.ctimes(0.3));
      let haveColide = false;
      for (const item of bombs) {
        if (haveColide)
          continue;
        if (this === item)
          continue;
        if (item.checkCollision(newSet, 0.8))
          haveColide = true;
      }
      for (const item of players) {
        if (haveColide)
          continue;
        if (item.isDeath || !item.inGame)
          continue;
        if (item.checkCollision(newSet, 0.8))
          haveColide = true;
      }
      for (const item of achivments) {
        if (haveColide)
          continue;
        if (item.checkCollision(newSet, 0.8))
          haveColide = true;
      }
      const vec = point();
      for (let i = 0; i < map2.length; i++) {
        if (haveColide)
          continue;
        if (map2[i] === 2 /* BLOCK */ || map2[i] === 1 /* WALL */) {
          vec.set(i % map2.width, i / map2.width | 0);
          if (Entity.prototype.checkCollision.call(vec, newSet, 0.8))
            haveColide = true;
        }
      }
      if (newSet.x < 0 || newSet.y < 0 || newSet.x > map2.width - 1 || newSet.y > map2.height - 1)
        haveColide = true;
      if (haveColide) {
        this.round();
        this.dir = void 0;
      } else {
        this.plus(move.ctimes(dtime * 0.01));
      }
    }
    if (Date.now() > time + liveTime && waitForRestart < 0) {
      if (this.isFake) {
        this.game.bombs.delete(this);
        this.game.effects.add(
          new Effect(this.game, this.x, this.y, 1 /* FAKE_EXPLODE */)
        );
        this.player.game.players.forEach((player2) => {
          player2.newApi.playSoundPosition({
            sound: 9 /* explodeFail */,
            position: this
          });
        });
        return;
      }
      Explode.run(this);
    }
  }
};

// server/class/ShieldEffect.ts
var ShieldEffect = class extends PlayerEffect {
  onCreate() {
    this.player.newApi.playSound(7 /* shield */);
  }
  onDelete() {
    this.player.newApi.playSound(7 /* shield */);
  }
  static get(player) {
    return this.getEffects(player, this)[0];
  }
  static hasShield(player) {
    return !!this.get(player);
  }
  static delete(player) {
    var _a;
    (_a = this.get(player)) == null ? void 0 : _a.delete();
  }
  static append(player) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player);
    currentEffect.appendTime(SHIELD_TIME);
    effets.add(currentEffect);
  }
};

// server/class/SpeedEffect.ts
var SpeedEffect = class extends PlayerEffect {
  value = 1;
  onCreate() {
    const { value, player: { newApi } } = this;
    if (value > 1)
      newApi.playSound(12 /* speedOn */);
    if (value < 1)
      newApi.playSound(10 /* fireOn */);
  }
  onDelete() {
    const { value, player: { newApi } } = this;
    if (value > 1)
      newApi.playSound(13 /* speedOff */);
    if (value < 1)
      newApi.playSound(11 /* fireOff */);
  }
  constructor(player, value = 1) {
    super(player);
    this.value = value;
  }
  static get(player) {
    return this.getEffects(player, this)[0];
  }
  static getValue(player) {
    var _a;
    return ((_a = this.get(player)) == null ? void 0 : _a.value) ?? 1;
  }
  static delete(player) {
    var _a;
    (_a = this.get(player)) == null ? void 0 : _a.delete();
  }
  static append(player, value = 1) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player, value);
    if (value !== currentEffect.value) {
      currentEffect.appendTime(-SPEED_TIME);
      return;
    }
    currentEffect.value = value;
    currentEffect.appendTime(SPEED_TIME);
    effets.add(currentEffect);
  }
};

// server/class/Player.ts
var PLAYER_COUNTER = 0;
var Player9 = class _Player extends Entity {
  constructor(game2, socket) {
    var _a, _b;
    super(game2, 0, 0);
    this.socket = socket;
    this.newApi = playerApi.use(socket);
    this.isAdmin = TEST_ADMIN_IP.test(this.address);
    if (IS_DEV)
      (_b = (_a = this.newMethods).toGame) == null ? void 0 : _b.call(_a);
  }
  #id = PLAYER_COUNTER++;
  newApi;
  unforward;
  isDeath = false;
  dir = 3 /* BOTTOM */;
  inGame = false;
  isAdmin = false;
  #animate = 0 /* IDLE */;
  moved = false;
  get id() {
    return this.#id;
  }
  get canJoin() {
    return this.game.slotLimits > this.game.playersCount;
  }
  get animate() {
    return this.#animate;
  }
  set animate(v) {
    this.#animate = v;
  }
  get address() {
    const { handshake } = this.socket;
    const address = handshake.headers["x-real-ip"];
    return (Array.isArray(address) ? address[0] : address) ?? handshake.address;
  }
  startPosition;
  name = "";
  #skin = 0;
  // change for that ↑ ( when is Working )
  get skin() {
    return this.#skin;
  }
  set skin(v) {
    this.#skin = v;
  }
  get effects() {
    return {
      haveShield: ShieldEffect.hasShield(this),
      speed: SpeedEffect.getValue(this),
      crazy: !!CrasyBombEffect.get(this),
      haveMove: !!MovingEffect.get(this)
    };
  }
  get speed() {
    return SpeedEffect.getValue(this);
  }
  wins = 0;
  kills = 0;
  deaths = 0;
  ping = 0;
  lastTestPing = 0;
  reconnect = 0;
  warningPing = 0;
  lastAction = Date.now();
  lastMessage = Date.now() - TIMEOUT_MESSAGE;
  lastNick = Date.now() - TIMEOUT_NICKNAME;
  lastSkin = Date.now() - TIMEOUT_SKIN;
  get lastConnect() {
    return getTime(this.address);
  }
  set lastConnect(v) {
    setTime(this.address, v);
  }
  get posInfo() {
    return pick(
      this,
      [
        "id",
        "x",
        "y",
        "speed",
        "dir",
        "animate"
      ]
    );
  }
  get remainingEffects() {
    var _a, _b, _c;
    const speed = SpeedEffect.get(this);
    const speedValue = speed ? round((speed.remaining ?? 0) / 1e3) : 0;
    return {
      shield: round((((_a = ShieldEffect.get(this)) == null ? void 0 : _a.remaining) ?? 0) / 1e3),
      crazy: round((((_b = CrasyBombEffect.get(this)) == null ? void 0 : _b.remaining) ?? 0) / 1e3),
      sup: speed && speed.value > 1 ? speedValue : 0,
      sdown: speed && speed.value < 1 ? speedValue : 0,
      moving: round((((_c = MovingEffect.get(this)) == null ? void 0 : _c.remaining) ?? 0) / 1e3),
      bombs: BombEffect.count(this) || 0,
      radius: RadiusEffect.count(this) || 0
    };
  }
  get info() {
    return pick(this, [
      "id",
      "name",
      "skin",
      "inGame",
      "isDeath",
      "canJoin",
      "wins",
      "kills",
      "deaths",
      "effects",
      "ping",
      "isAdmin"
    ]);
  }
  get chatInfo() {
    return pick(this, [
      "name",
      "skin",
      "inGame",
      "isDeath"
    ]);
  }
  ban(time) {
    var _a, _b;
    if (!this.inGame)
      return;
    (_b = (_a = this.newMethods).toLeave) == null ? void 0 : _b.call(_a);
    this.lastConnect = Date.now() + time - TIMEOUT_RECONNECT;
    this.game.message(`\u0418\u0433\u0440\u043E\u043A ${this.name} \u0431\u044B\u043B \u0437\u0430\u0431\u0430\u043D\u0435\u043D \u043D\u0430 ${time / 1e3 | 0} \u0441\u0435\u043A`);
  }
  newMethods = {
    setPosition: ({ x, y, dir, animate }) => {
      if (this.isDeath && !this.inGame)
        return;
      const { speed } = this.effects;
      const deltatime = Date.now() - this.lastAction;
      const distance = calcSpeed(deltatime, speed) + 0.2;
      if (this.length(x, y) > distance) {
        this.newApi.setStartPosition(this);
        return;
      }
      this.moved = true;
      x = (x * 16 | 0) / 16;
      y = (y * 16 | 0) / 16;
      this.lastAction = Date.now();
      this.x = x;
      this.y = y;
      this.dir = dir;
      this.animate = animate;
    },
    ping: () => {
      this.ping = Date.now() - this.lastTestPing;
    },
    sendMessage: (message) => {
      message.trim();
      if (!message)
        return;
      if (message[0] === "/") {
        const [cmd, ...args] = message.slice(1).split(/\s+/);
        let output = "";
        switch (cmd) {
          case "ban": {
            if (!this.isAdmin)
              return;
            const [id, time = "30m"] = args;
            if (!id) {
              output += "\u041A\u043E\u0433\u043E \u0437\u0430\u0431\u0430\u043D\u0438\u0442\u044C?\n";
              for (const player of this.game.players) {
                output += `${player.id}) ${player.name} - ${player.address}
`;
              }
            } else {
              const timeValue = FDate.from(time);
              for (const player of this.game.players) {
                if (player.id === +id) {
                  for (const p of this.game.players) {
                    if (p.address === player.address) {
                      player.ban(timeValue);
                    }
                  }
                  break;
                }
              }
            }
            break;
          }
          case "unban": {
            if (!this.isAdmin)
              return;
            const [id] = args;
            if (!id) {
              output += "\u041A\u043E\u0433\u043E \u0440\u0430\u0437\u0431\u0430\u043D\u0438\u0442\u044C?\n";
              for (const player of this.game.players) {
                output += `${player.id}) ${player.name} - ${player.address}
`;
              }
            } else {
              for (const player of this.game.players) {
                if (player.id === +id) {
                  player.lastConnect = Date.now() - TIMEOUT_RECONNECT;
                  this.game.message(`\u0418\u0433\u0440\u043E\u043A ${player.name} \u0431\u044B\u043B \u0440\u0430\u0437\u0431\u0430\u043D\u0435\u043D`);
                  break;
                }
              }
            }
            break;
          }
        }
        if (output)
          this.newApi.onMessage({ message: output, sender: { name: "@cmd" }, isMe: true });
        return;
      }
      const needTime = this.lastMessage + TIMEOUT_MESSAGE;
      const deltaTime = needTime - Date.now();
      if (deltaTime > 0) {
        this.newApi.onMessage({
          message: `\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043C\u043E\u0436\u043D\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0447\u0435\u0440\u0435\u0437 ${deltaTime / 1e3 | 0} \u0441\u0435\u043A.`,
          sender: { name: "@server" },
          isMe: false
        });
        return;
      }
      this.lastMessage = Date.now();
      message = message.slice(0, MESSAGE_LENGTH);
      this.game.message(message, this);
    },
    setSkin: (skin) => {
      if (Date.now() - this.lastSkin < TIMEOUT_SKIN) {
        this.ban(FDate.from("30m"));
        return;
      }
      this.lastSkin = Date.now();
      this.skin = rem(skin | 0, SKINS_COUNT);
    },
    setBomb: () => {
      const { playersCount, livePlayersCount } = this.game;
      if (this.game.waitForRestart !== -1 || this.isDeath || !this.inGame || playersCount > 1 && livePlayersCount < 2)
        return;
      const { bombs, achivments } = this.game;
      const newBomb = new Bomb2(this);
      const { x, y } = newBomb;
      const bombsCount = BombEffect.count(this) + 1;
      const value = this.game.map[x + y * this.game.width];
      if (value === 1 /* WALL */)
        return;
      if (find(bombs, { x, y }))
        return;
      if (find(achivments, { x, y }))
        return;
      if (map(bombs, (e) => e, (e) => e.creator === this).length >= bombsCount)
        return;
      bombs.add(newBomb);
      this.game.players.forEach((player) => {
        player.newApi.playSoundPosition({
          sound: 3 /* putBomb */,
          position: this
        });
      });
    },
    setName: (name) => {
      if (!name)
        return;
      if (name[0] === "@")
        name = name.slice(1);
      if (Date.now() - this.lastNick < TIMEOUT_NICKNAME) {
        this.ban(FDate.from("30m"));
        return;
      }
      this.lastNick = Date.now();
      this.name = name.slice(0, NICK_LENGTH);
    },
    toGame: () => {
      if (!this.canJoin || this.inGame)
        return;
      const needTime = this.lastConnect + TIMEOUT_RECONNECT * this.reconnect;
      const deltaTime = needTime - Date.now();
      if (deltaTime > 0) {
        this.newApi.onMessage({
          message: `\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435\u0441\u044C \u0447\u0435\u0440\u0435\u0437 ${deltaTime / 1e3 | 0} \u0441\u0435\u043A.`,
          sender: { name: "@server" },
          isMe: false
        });
        return;
      }
      this.randomPosition();
      this.isDeath = true;
      this.kills = 0;
      this.deaths = 0;
      this.wins = 0;
      this.inGame = true;
      this.lastConnect = Date.now();
      this.lastAction = Date.now();
      this.game.message(`${this.name ?? "noname"} \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F`);
      PlayerEffect.clearEffets(this);
    },
    toLeave: () => {
      if (!this.inGame)
        return;
      this.releasePosition();
      this.reconnect++;
      this.skin = -1;
      this.inGame = false;
      this.lastConnect = Date.now();
      this.lastAction = Date.now();
      this.game.message(`${this.name ?? "noname"} \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F`);
      PlayerEffect.clearEffets(this);
    }
  };
  reset() {
    const { startPosition } = this;
    this.isDeath = false;
    this.lastAction = Date.now();
    this.randomPosition();
    this.moved = false;
    PlayerEffect.clearEffets(this);
    if (startPosition) {
      this.set(startPosition);
      effectObject(this, "startPosition", [-1, -1], () => {
      });
    }
  }
  death(killer, isFire = false) {
    if (this.isDeath)
      return;
    const isSuicide = killer === this;
    this.reconnect = 0;
    this.isDeath = true;
    this.newApi.playSound(2 /* death */);
    this.game.effects.add(
      new Effect(this.game, this.x, this.y, 0 /* DEATH */, [random() * DEATH_FRAMES.length | 0])
    );
    if (this.game.playersCount > 1) {
      this.deaths++;
      this.game.kills++;
    }
    if (!isSuicide && killer instanceof _Player) {
      killer.kills++;
      killer.newApi.playSound(14 /* kill */);
    }
    const name = this.name ?? "noname";
    const killerName = (killer == null ? void 0 : killer.name) ?? "noname";
    PlayerEffect.clearEffets(this);
    this.releasePosition();
    if (!killer) {
      this.game.message(`${name} \u0437\u0430\u0441\u0442\u0440\u044F\u043B \u0432 \u0441\u0442\u0435\u043D\u0435`);
      return;
    }
    if (isSuicide) {
      this.game.message(`${name} \u0441\u0430\u043C\u043E\u0443\u0431\u0438\u043B\u0441\u044F`);
      return;
    }
    this.game.message(`${killerName} ${isFire ? "\u043F\u043E\u0434\u0436\u0435\u0433" : "\u0443\u0431\u0438\u043B"} ${name}`);
  }
  randomPosition() {
    this.releasePosition();
    this.startPosition = this.game.getFreePosition();
  }
  releasePosition() {
    if (this.startPosition) {
      this.game.releasePosition(this.startPosition);
    }
    delete this.startPosition;
  }
  connect() {
    if (this.unforward) {
      this.unforward();
      delete this.unforward;
    }
    const un2 = gameApi.forward(this.socket, this.newMethods);
    this.unforward = () => {
      un2();
    };
  }
  disconnect() {
    var _a, _b, _c;
    (_b = (_a = this.newMethods).toLeave) == null ? void 0 : _b.call(_a);
    (_c = this.unforward) == null ? void 0 : _c.call(this);
  }
  update() {
    const {
      explodes,
      achivments
    } = this.game;
    const speed = SpeedEffect.getValue(this);
    if (this.inGame && this.ping > 250) {
      this.warningPing++;
    } else {
      this.warningPing = 0;
    }
    effectObject(
      this,
      "kickWarningPing",
      this.warningPing > 200,
      (isKick) => {
        var _a, _b;
        if (isKick) {
          (_b = (_a = this.newMethods).toLeave) == null ? void 0 : _b.call(_a);
          this.newApi.onMessage({
            message: "\u0412\u0430\u0441 \u043A\u0438\u043A\u043D\u0443\u043B\u043E \u0437\u0430 \u0432\u044B\u0441\u043E\u043A\u0438\u0439 \u043F\u0438\u043D\u0433",
            sender: { name: "@server" },
            isMe: false
          });
        }
      }
    );
    if (!this.isDeath && this.inGame) {
      for (const effect of PlayerEffect.effects(this))
        effect.update();
    }
    if (!this.isDeath && this.inGame)
      effectObject(
        this,
        "timeout",
        Date.now() - this.lastAction > PLAYER_TIMEOUT && !this.isDeath && !IS_DEV,
        (result) => {
          var _a, _b;
          if (result)
            (_b = (_a = this.newMethods).toLeave) == null ? void 0 : _b.call(_a);
        }
      );
    if (!this.isDeath && this.inGame && this.moved) {
      const vec = this.clone().round();
      if (vec.x < 0 || vec.y < 0 || vec.x > this.game.map.width - 1 || vec.y > this.game.map.height - 1)
        this.death();
      const value = this.game.map[vec.y * this.game.width + vec.x];
      if (value === 1 /* WALL */ || value === 2 /* BLOCK */)
        this.death();
    }
    if (!this.isDeath && this.inGame) {
      if (speed >= 1) {
        for (const player of this.game.players) {
          if (player === this || !player.inGame || player.isDeath)
            continue;
          if (SpeedEffect.getValue(player) >= 1)
            continue;
          if (this.checkCollision(player, 0.9))
            this.death(player, true);
        }
      }
      let shield = ShieldEffect.get(this);
      for (const explode of explodes) {
        if (this.isDeath || explode.ignore.has(this))
          continue;
        for (const point2 of explode.points) {
          if (this.isDeath)
            continue;
          if (this.checkCollision(point2, 0.6)) {
            if (shield) {
              shield = null;
              ShieldEffect.delete(this);
              explode.ignore.add(this);
              continue;
            }
            this.death(explode.player);
          }
        }
      }
    }
    if (!this.isDeath && this.inGame) {
      for (const achivment of achivments) {
        if (this.checkCollision(achivment, 0.4)) {
          achivment.accept(this);
          achivments.delete(achivment);
        }
      }
    }
    if (this.lastTestPing + 500 < Date.now()) {
      this.lastTestPing = Date.now();
      this.newApi.ping();
    }
  }
  sendInfo() {
    const {
      players,
      infoCache,
      mapCache,
      bombsCache,
      achivmentsCache,
      effectsCache,
      effectsTypeCache,
      explodesCahce
    } = this.game;
    effectObject(
      this,
      "gameInfo",
      infoCache,
      () => {
        this.newApi.updateGameInfo(this.game);
      }
    );
    effectObject(
      this,
      "waitForRestart",
      this.game.waitForRestart > 0 ? (this.game.waitForRestart - Date.now()) / 1e3 | 0 : -1,
      (time) => {
        this.newApi.updateWaitForRestart(time);
      }
    );
    effectObject(
      this,
      "startPosition",
      this.inGame && !this.isDeath ? this.startPosition : void 0,
      (point2) => {
        if (point2) {
          this.set(point2);
          this.newApi.setStartPosition(point2);
          this.newApi.playSound(5 /* newLife */);
        }
      }
    );
    effectObject(
      this,
      "localInfo",
      this.info,
      (localInfo) => {
        this.newApi.updateLocalInfo(localInfo);
      }
    );
    effectObject(
      this,
      "remainingEffects",
      this.remainingEffects,
      (effects) => {
        this.newApi.updateRemainingEffects(effects);
      }
    );
    effectObject(
      this,
      "map",
      mapCache,
      (gameMap) => {
        this.newApi.updateMap(gameMap);
      }
    );
    effectObject(
      this,
      "effects",
      effectsTypeCache,
      () => {
        this.newApi.updateEffects(effectsCache);
      }
    );
    effectObject(
      this,
      "bombs",
      bombsCache,
      (bombs) => {
        this.newApi.updateBombs(bombs);
      }
    );
    effectObject(
      this,
      "explodes",
      explodesCahce,
      (explodes) => {
        this.newApi.updateExplodes(explodes);
      }
    );
    effectObject(
      this,
      "achivments",
      achivmentsCache,
      (achivments) => {
        this.newApi.updateAchivments(achivments);
      }
    );
    effectObject(
      this,
      "players",
      map(players, (e) => e.info, (e, d) => e !== this && e.inGame),
      (players2) => {
        this.newApi.updatePlayers(players2);
      }
    );
    effectObject(
      this,
      "positions",
      map(players, (e) => e.posInfo, (e, d) => e !== this && e.inGame && !e.isDeath),
      (positions) => {
        this.newApi.updatePlayerPositions(positions);
      }
    );
  }
};

// server/class/BombEffect.ts
var BombEffect = class _BombEffect extends PlayerEffect {
  static count(player) {
    return this.getEffects(player, this).length;
  }
  static append(player) {
    const effects = this.effects(player);
    effects.add(new _BombEffect(player));
  }
};

// server/class/Achivment.ts
var STORE = [
  0 /* APPEND_BOMB */,
  1 /* APPEND_EXPO */,
  4 /* APPEND_SHIELD */,
  2 /* APPEND_SPEED */,
  5 /* MOVING_BOMB */,
  6 /* FIRE */,
  7 /* CRAZY_BOMB */
];
var Achivment = class extends Entity {
  constructor(game2, x, y, type = random2([...STORE, 3 /* RANDOM */])) {
    super(game2, x, y);
    this.type = type;
    this.id = game2.achivmentsCounter++;
  }
  id;
  accept(player, type = this.type) {
    switch (type) {
      case 0 /* APPEND_BOMB */: {
        BombEffect.append(player);
        break;
      }
      case 1 /* APPEND_EXPO */: {
        RadiusEffect.append(player);
        break;
      }
      case 4 /* APPEND_SHIELD */: {
        ShieldEffect.append(player);
        break;
      }
      case 2 /* APPEND_SPEED */: {
        SpeedEffect.append(player, 1.5);
        break;
      }
      case 5 /* MOVING_BOMB */: {
        MovingEffect.append(player);
        break;
      }
      case 6 /* FIRE */: {
        SpeedEffect.append(player, 0.7);
        break;
      }
      case 7 /* CRAZY_BOMB */: {
        CrasyBombEffect.append(player);
        break;
      }
      case 3 /* RANDOM */: {
        return this.accept(player, random2(STORE));
      }
      default: {
        console.log("Unknow", type);
      }
    }
    player.newApi.playSound(1 /* bonus */);
  }
  update(dtime, time) {
    const i = this.x + this.y * this.game.width;
    if (this.game.map[i] === 1 /* WALL */)
      this.game.achivments.delete(this);
  }
  get info() {
    return pick(this, [
      "id",
      "x",
      "y",
      "type"
    ]);
  }
};

// server/class/GameMap.ts
import { generatePerlinNoise } from "file:///Users/vic/CodeProjects/openbomber/node_modules/@vicimpa/perlin-noise/dist/index.js";
var GameMap = class extends Uint8Array {
  constructor(game2) {
    const { width, height } = game2;
    super(width * height);
    this.game = game2;
    this.noize = generatePerlinNoise(width, height);
  }
  get width() {
    return this.game.width;
  }
  get height() {
    return this.game.height;
  }
  achivments = /* @__PURE__ */ new Set();
  noize = [];
  limit(n = 0) {
    const { width, height } = this;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = x + y * width;
        if (x < n || y < n || x > width - 1 - n || y > height - 1 - n)
          this[i] = 1 /* WALL */;
      }
    }
  }
  generate(config) {
    const { width } = this;
    const {
      fillAchivments,
      fillBlocks
    } = config;
    const positions = /* @__PURE__ */ new Set();
    this.achivments.clear();
    for (let i = 0; i < this.length; i++) {
      let x = i % width;
      let y = i / width;
      if (x & 1 && y & 1) {
        this[i] = 1 /* WALL */;
      } else {
        const n = this.noize[i];
        this[i] = n < 0.1 ? 3 /* GRAS */ : n < 0.4 ? 4 /* SAND */ : 0 /* CLEAR */;
        positions.add(i);
      }
    }
    for (const { x: X, y: Y } of this.game.startPositions) {
      for (let i = 0; i <= 2; i++) {
        for (const [, dir] of Object.entries(DIRECTIONS)) {
          const { x: dx, y: dy } = dir;
          let x = X + dx * i;
          let y = Y + dy * i;
          positions.delete(x + y * width);
        }
      }
    }
    const blocksCount = fillBlocks % 1 * positions.size;
    const blocksStore = /* @__PURE__ */ new Set();
    for (let i = 0; i < blocksCount; i++) {
      const p = random2([...positions]);
      positions.delete(p);
      blocksStore.add(p);
      this[p] = 2 /* BLOCK */;
    }
    const achivmentsCount = fillAchivments % 1 * blocksStore.size;
    for (let i = 0; i < achivmentsCount; i++) {
      const p = random2([...blocksStore]);
      blocksStore.delete(p);
      this.achivments.add(p);
      this[p] = 2 /* BLOCK */;
    }
  }
};

// server/class/Game.ts
var logger = createLogger("info", { allowClearScreen: true });
var defaultConfig = {
  fillBlocks: 0.5,
  fillAchivments: 0.1,
  startExplodeRadius: 1,
  startBombsCount: 1,
  startLiveCount: 1
};
var defaultStartPositions = [
  point(0, 0),
  point(1, 0),
  point(1, 1),
  point(0, 1)
];
var Game6 = class {
  width = 1;
  height = 1;
  #settings;
  lastLimit = 0;
  time = performance.now();
  map;
  bombs = /* @__PURE__ */ new Set();
  explodes = /* @__PURE__ */ new Set();
  achivments = /* @__PURE__ */ new Set();
  players = /* @__PURE__ */ new Set();
  effects = /* @__PURE__ */ new Set();
  nextSize = new Vec2();
  startPositions = [];
  usedPositions = /* @__PURE__ */ new Set();
  running = false;
  winPlayerId = -1;
  waitForRestart = -1;
  bombsCounter;
  explodesCounter;
  achivmentsCounter;
  effectsCounter;
  slotLimits = MAX_PLAYERS;
  timerLimit = -1;
  limitedMap = 1;
  isHaveWin = false;
  kills = 0;
  infoCache = this.info;
  mapCache = [];
  bombsCache = [];
  explodesCahce = [];
  achivmentsCache = [];
  effectsCache = [];
  effectsTypeCache = [];
  get currentLimited() {
    return this.timerLimit > 0 ? this.limitedMap : -1;
  }
  get info() {
    return pick(this, [
      "width",
      "height",
      "winPlayerId",
      "playersCount",
      "livePlayersCount",
      "spectratorsCount",
      "currentLimited"
    ]);
  }
  getFreePosition() {
    const free = Array.from(this.startPositions).filter((e) => !this.usedPositions.has(e));
    const position = random2(free);
    this.usedPositions.add(position);
    return position;
  }
  releasePosition(position) {
    this.usedPositions.delete(position);
  }
  get spectratorsCount() {
    return map(this.players, (e) => e, (e) => !e.inGame).length;
  }
  get playersCount() {
    return map(this.players, (e) => e, (e) => e.inGame).length;
  }
  get livePlayersCount() {
    return map(this.players, (e) => e, (e) => e.inGame && !e.isDeath).length;
  }
  get settings() {
    return { ...this.#settings };
  }
  constructor(settings) {
    this.#settings = { ...defaultConfig, ...settings };
    this.restart();
  }
  restart() {
    const { size: size2, positions } = calcMap(this.playersCount);
    this.isHaveWin = this.playersCount > 1;
    if (!size2.equal(this.width, this.height)) {
      this.width = size2.x;
      this.height = size2.y;
      this.startPositions = positions;
      this.message("\u0420\u0430\u0437\u043C\u0435\u0440 \u043A\u0430\u0440\u0442\u044B \u0431\u044B\u043B \u0438\u0437\u043C\u0435\u043D\u0435\u043D");
    }
    this.waitForRestart = -1;
    for (const player of this.players) {
      if (!player.inGame)
        continue;
      player.reset();
    }
    this.bombs.clear();
    this.achivments.clear();
    this.explodes.clear();
    this.effects.clear();
    this.map = new GameMap(this);
    this.map.generate(this.settings);
    this.winPlayerId = -1;
    this.bombsCounter = 0;
    this.effectsCounter = 0;
    this.explodesCounter = 0;
    this.achivmentsCounter = 0;
    this.kills = 0;
    this.limitedMap = 1;
    this.timerLimit = -1;
    this.lastLimit = Date.now();
  }
  message(message, sender) {
    if (IS_DEV) {
      const find2 = /(\d+)x(\d+)/.exec(message);
      if (find2) {
        const [, width, height] = find2;
        this.nextSize.set(+width, +height);
        this.waitForRestart = 3e3;
      }
    }
    for (const player of this.players) {
      player.newApi.playSound(6 /* message */);
      player.newApi.onMessage({
        message,
        sender: sender instanceof Player9 ? { name: sender.name } : { name: "@server" },
        isMe: sender === player
      });
    }
  }
  join(socket) {
    let player = find(this.players, { socket });
    if (player)
      return;
    player = new Player9(this, socket);
    player.connect();
    this.players.add(player);
    this.start();
  }
  leave(socket) {
    const player = find(this.players, { socket });
    if (!player)
      return;
    this.players.delete(player);
    player.disconnect();
    if (!this.players.size)
      this.stop();
  }
  start() {
    if (this.running)
      return;
    this.running = true;
    logger.info("Game starting", { timestamp: true });
    this.restart();
    this.loop().catch(console.error);
  }
  stop() {
    if (!this.running)
      return;
    logger.info("Game stoping", { timestamp: true });
    this.running = false;
  }
  async loop() {
    const tick = () => {
      if (this.running) {
        setTimeout(tick, 1e3 / 30);
      }
      const { players, playersCount } = this;
      const time = performance.now();
      const dtime = time - this.time;
      this.time = time;
      effectObject(
        this,
        "playersCount",
        this.playersCount,
        (count) => {
          logger.info("Players count " + count, { timestamp: true });
          if (this.isHaveWin && count < 2 && !this.kills)
            this.isHaveWin = false;
        }
      );
      for (const bomb of this.bombs) {
        bomb.update(dtime, time);
      }
      for (const explode of this.effects) {
        explode.update(dtime, time);
      }
      for (const explode of this.explodes) {
        explode.update(dtime, time);
      }
      for (const achivment of this.achivments) {
        achivment.update(dtime, time);
      }
      for (const player of this.players) {
        player.update(dtime, time);
      }
      this.mapCache = [...this.map];
      this.infoCache = this.info;
      this.bombsCache = [...this.bombs].map((e) => e.info);
      this.achivmentsCache = [...this.achivments];
      this.explodesCahce = [...this.explodes];
      this.effectsCache = [...this.effects];
      this.effectsTypeCache = map(this.effects, (e) => e.infoType);
      for (const player of this.players) {
        player.sendInfo();
      }
      effectObject(
        this,
        "restartGame",
        playersCount && this.livePlayersCount <= +!!(playersCount - 1) && !this.explodes.size && !this.bombs.size,
        (isRestart) => {
          if (isRestart) {
            logger.info("Wait restart", { timestamp: true });
            this.waitForRestart = Date.now() + (IS_DEV || playersCount == 1 ? 0 : 5e3);
          } else {
            if (this.waitForRestart > 0) {
              logger.info("Cancel restart", { timestamp: true });
            }
            this.waitForRestart = -1;
          }
        }
      );
      if (this.isHaveWin && this.livePlayersCount < 2 && !this.explodes.size && !this.bombs.size) {
        const winPlayer = find(this.players, (e) => e.inGame && !e.isDeath);
        if (winPlayer) {
          winPlayer.wins++;
          winPlayer.newApi.playSound(0 /* win */);
          this.winPlayerId = winPlayer.id;
          this.message(`${winPlayer.name} \u043F\u043E\u0431\u0435\u0434\u0438\u043B`);
        } else {
          this.message(`\u041D\u0438\u043A\u0442\u043E \u043D\u0435 \u0432\u044B\u0438\u0433\u0440\u0430\u043B`);
        }
        this.isHaveWin = false;
      }
      if (this.waitForRestart > 0) {
        if (Date.now() > this.waitForRestart + 500) {
          logger.info("Restart", { timestamp: true });
          this.restart();
        }
      }
      effectObject(
        this,
        "clearMap",
        this.map.findIndex((e) => e == 2 /* BLOCK */) == -1 && playersCount <= 1 && this.achivments.size === 0 && this.waitForRestart === -1,
        (value) => {
          logger.info(`Change value ${value}`, { timestamp: true });
          if (value)
            this.waitForRestart = Date.now();
        }
      );
      effectObject(
        this,
        "limitMap",
        this.lastLimit + WAIT_FOR_LIMIT < Date.now() && this.waitForRestart == -1 && this.playersCount > 1 && this.limitedMap < min(this.width, this.height) / 2,
        (value) => {
          if (value && this.timerLimit == -1) {
            this.timerLimit = Date.now() + ZONELIMIT_TIMEOUT;
            this.message(`\u0423\u043C\u0435\u043D\u044C\u0448\u0435\u043D\u0438\u0435 \u0440\u0430\u0437\u043C\u0435\u0440\u0430 \u043A\u0430\u0440\u0442\u044B \u0447\u0435\u0440\u0435\u0437 ${ZONELIMIT_TIMEOUT / 1e3 | 0} \u0441\u0435\u043A`);
          }
          if (!value && this.timerLimit > 0) {
            this.timerLimit = -1;
            this.message(`\u0423\u043C\u0435\u043D\u044C\u0448\u0435\u043D\u0438\u0435 \u0440\u0430\u0437\u043C\u0435\u0440\u0430 \u043A\u0430\u0440\u0442\u044B \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E`);
          }
        }
      );
      effectObject(
        this,
        "limitMapExec",
        this.timerLimit > 0 && this.timerLimit < Date.now(),
        (value) => {
          if (value) {
            this.lastLimit = Date.now();
            this.timerLimit = -1;
            this.map.limit(this.limitedMap++);
          }
        }
      );
    };
    tick();
  }
};

// server/main.ts
var logger2 = createLogger2("info", { allowClearScreen: true });
function game(server) {
  Promise.resolve().then(() => run()).then((func) => {
    if (func instanceof Function) {
      server.once("close", () => {
      });
    }
  }).catch(console.error);
  const socketio = new SocketIO(server);
  const addresses = /* @__PURE__ */ new Map();
  const game2 = new Game6({
    fillAchivments: IS_DEV ? 0.9999 : 0.45,
    fillBlocks: 0.4
  });
  socketio.on("connection", async (socket) => {
    const api = verifyApi.use(socket);
    const nums = makeData();
    const address = socket.handshake.headers["x-real-ip"] ?? socket.handshake.address;
    addresses.set(
      address,
      (addresses.get(address) ?? 0) + 1
    );
    socket.once("disconnect", () => {
      api();
      game2.leave(socket);
      addresses.set(
        address,
        (addresses.get(address) ?? 0) - 1
      );
    });
    if (await api.verify(nums) !== calc(nums))
      return socket.disconnect();
    const count = addresses.get(address) ?? 0;
    if (count > MAX_ADDRESS_CONNECT && !IS_DEV) {
      logger2.info(`Address block ${address}`);
      api.addressBlock(MAX_ADDRESS_CONNECT);
      return;
    }
    game2.join(socket);
  });
}

// server/server.ts
var webSocketServer = () => {
  return {
    name: "WebSocketServer",
    configurePreviewServer(server) {
      return game(server.httpServer);
    },
    configureServer(server) {
      return game(server.httpServer);
    }
  };
};

// vite.config.ts
var vite_config_default = defineConfig({
  base: "./",
  root: "./src",
  publicDir: "../public",
  envDir: "../",
  envPrefix: "APP_",
  build: {
    outDir: "../dist",
    target: "esnext"
  },
  preview: {
    host: "127.0.0.1",
    port: 3e3
  },
  server: {
    host: "0.0.0.0",
    port: 3e3
  },
  plugins: [
    commonjs(),
    glsl(),
    react({ plugins: [], tsDecorators: true }),
    svelte({ configFile: "../svelte.config.js" }),
    paths({ projects: ["../tsconfig.json"] }),
    viteSingleFile(),
    webSocketServer()
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic2VydmVyL21haW4udHMiLCAiY29yZS9tYXRoLnRzIiwgImNvcmUvdmVyaWZ5LnRzIiwgImNvcmUvRGF0YUJ1ZmZlci50cyIsICJjb3JlL1Byb3RvLnRzIiwgImNvcmUvbWFrZVdlYlNvY2tldEFwaS50cyIsICJjb3JlL1ZlYzIudHMiLCAiY29yZS9wb2ludC50cyIsICJzaGFyZWQvdHlwZXMudHMiLCAic2hhcmVkL2FwaS50cyIsICJjb3JlL3RvQ29sLnRzIiwgImNvcmUvRkRhdGUudHMiLCAic2hhcmVkL2NvbmZpZy50cyIsICJjb3JlL0V2ZW50cy50cyIsICJzZXJ2ZXIvYm90L2luZGV4LnRzIiwgInNlcnZlci9jbGFzcy9HYW1lLnRzIiwgImNvcmUvdG9MaW1pdC50cyIsICJjb3JlL2NhbGNNYXAudHMiLCAiY29yZS9tYWtlRWZmZWN0LnRzIiwgImNvcmUvaXNFcXVhbEJ1ZmZlci50cyIsICJjb3JlL2VmZmVjdE9iamVjdC50cyIsICJjb3JlL2ZpbmQudHMiLCAiY29yZS9tYWtlUGlja2VyLnRzIiwgImNvcmUvcGljay50cyIsICJjb3JlL21hcC50cyIsICJjb3JlL3JhbmRvbS50cyIsICJzZXJ2ZXIvZW52LnRzIiwgInNlcnZlci9jbGFzcy9QbGF5ZXIudHMiLCAiY29yZS9jYWxjU3BlZWQudHMiLCAic2VydmVyL2RhdGEvYWRkcmVzc1RpbWUudHMiLCAic2VydmVyL2NsYXNzL1BsYXllckVmZmVjdC50cyIsICJzZXJ2ZXIvY2xhc3MvQ3Jhc3lCb21iRWZmZWN0LnRzIiwgImNvcmUvaXNDb2xpZGUudHMiLCAic2VydmVyL2NsYXNzL0VudGl0eS50cyIsICJzZXJ2ZXIvY2xhc3MvRWZmZWN0LnRzIiwgInNlcnZlci9jbGFzcy9FeHBsb2RlLnRzIiwgInNlcnZlci9jbGFzcy9Nb3ZpbmdFZmZlY3QudHMiLCAic2VydmVyL2NsYXNzL1JhZGl1c0VmZmVjdC50cyIsICJzZXJ2ZXIvY2xhc3MvQm9tYi50cyIsICJzZXJ2ZXIvY2xhc3MvU2hpZWxkRWZmZWN0LnRzIiwgInNlcnZlci9jbGFzcy9TcGVlZEVmZmVjdC50cyIsICJzZXJ2ZXIvY2xhc3MvQm9tYkVmZmVjdC50cyIsICJzZXJ2ZXIvY2xhc3MvQWNoaXZtZW50LnRzIiwgInNlcnZlci9jbGFzcy9HYW1lTWFwLnRzIiwgInNlcnZlci9zZXJ2ZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgXCJkb3RlbnYvY29uZmlnXCI7XG5cbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgY29tbW9uanMgZnJvbSBcInZpdGUtcGx1Z2luLWNvbW1vbmpzXCI7XG5pbXBvcnQgZ2xzbCBmcm9tIFwidml0ZS1wbHVnaW4tZ2xzbFwiO1xuaW1wb3J0IHsgdml0ZVNpbmdsZUZpbGUgfSBmcm9tIFwidml0ZS1wbHVnaW4tc2luZ2xlZmlsZVwiO1xuaW1wb3J0IHBhdGhzIGZyb20gXCJ2aXRlLXRzY29uZmlnLXBhdGhzXCI7XG5cbmltcG9ydCB7IHN2ZWx0ZSB9IGZyb20gXCJAc3ZlbHRlanMvdml0ZS1wbHVnaW4tc3ZlbHRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xuXG5pbXBvcnQgeyB3ZWJTb2NrZXRTZXJ2ZXIgfSBmcm9tIFwiLi9zZXJ2ZXIvc2VydmVyXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIGJhc2U6ICcuLycsXG4gIHJvb3Q6ICcuL3NyYycsXG4gIHB1YmxpY0RpcjogJy4uL3B1YmxpYycsXG4gIGVudkRpcjogJy4uLycsXG4gIGVudlByZWZpeDogXCJBUFBfXCIsXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnLi4vZGlzdCcsXG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgfSxcblxuICBwcmV2aWV3OiB7XG4gICAgaG9zdDogJzEyNy4wLjAuMScsXG4gICAgcG9ydDogMzAwMFxuICB9LFxuXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBwb3J0OiAzMDAwXG4gIH0sXG5cbiAgcGx1Z2luczogW1xuICAgIGNvbW1vbmpzKCksXG4gICAgZ2xzbCgpLFxuICAgIHJlYWN0KHsgcGx1Z2luczogW10sIHRzRGVjb3JhdG9yczogdHJ1ZSB9KSxcbiAgICBzdmVsdGUoeyBjb25maWdGaWxlOiAnLi4vc3ZlbHRlLmNvbmZpZy5qcycgfSksXG4gICAgcGF0aHMoeyBwcm9qZWN0czogWycuLi90c2NvbmZpZy5qc29uJ10gfSksXG4gICAgdml0ZVNpbmdsZUZpbGUoKSxcbiAgICB3ZWJTb2NrZXRTZXJ2ZXIoKVxuICBdLFxufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9tYWluLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL21haW4udHNcIjtpbXBvcnQgeyBTZXJ2ZXIgfSBmcm9tIFwiaHR0cFwiO1xuaW1wb3J0IHsgU2VydmVyIGFzIFNvY2tldElPIH0gZnJvbSBcInNvY2tldC5pb1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9nZ2VyIH0gZnJvbSBcInZpdGVcIjtcblxuaW1wb3J0IHsgY2FsYywgbWFrZURhdGEgfSBmcm9tIFwiLi4vY29yZS92ZXJpZnlcIjtcbmltcG9ydCB7IHZlcmlmeUFwaSB9IGZyb20gXCIuLi9zaGFyZWQvYXBpXCI7XG5pbXBvcnQgeyBNQVhfQUREUkVTU19DT05ORUNUIH0gZnJvbSBcIi4uL3NoYXJlZC9jb25maWdcIjtcbmltcG9ydCAqIGFzIGJvdCBmcm9tIFwiLi9ib3RcIjtcbmltcG9ydCB7IEdhbWUgfSBmcm9tIFwiLi9jbGFzcy9HYW1lXCI7XG5pbXBvcnQgeyBJU19ERVYgfSBmcm9tIFwiLi9lbnZcIjtcblxuY29uc3QgbG9nZ2VyID0gY3JlYXRlTG9nZ2VyKCdpbmZvJywgeyBhbGxvd0NsZWFyU2NyZWVuOiB0cnVlIH0pO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2FtZShzZXJ2ZXI6IFNlcnZlcikge1xuICBQcm9taXNlLnJlc29sdmUoKVxuICAgIC50aGVuKCgpID0+IGJvdC5ydW4oKSlcbiAgICAudGhlbihmdW5jID0+IHtcbiAgICAgIGlmIChmdW5jIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgICAgc2VydmVyLm9uY2UoJ2Nsb3NlJywgKCkgPT4ge1xuXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pXG4gICAgLmNhdGNoKGNvbnNvbGUuZXJyb3IpO1xuXG5cblxuICBjb25zdCBzb2NrZXRpbyA9IG5ldyBTb2NrZXRJTyhzZXJ2ZXIpO1xuICBjb25zdCBhZGRyZXNzZXMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXG4gIGNvbnN0IGdhbWUgPSBuZXcgR2FtZSh7XG4gICAgZmlsbEFjaGl2bWVudHM6IElTX0RFViA/IC45OTk5IDogLjQ1LFxuICAgIGZpbGxCbG9ja3M6IC40XG4gIH0pO1xuXG4gIHNvY2tldGlvLm9uKCdjb25uZWN0aW9uJywgYXN5bmMgc29ja2V0ID0+IHtcbiAgICBjb25zdCBhcGkgPSB2ZXJpZnlBcGkudXNlKHNvY2tldCk7XG4gICAgY29uc3QgbnVtcyA9IG1ha2VEYXRhKCk7XG4gICAgY29uc3QgYWRkcmVzcyA9IChzb2NrZXQuaGFuZHNoYWtlLmhlYWRlcnNbJ3gtcmVhbC1pcCddID8/IHNvY2tldC5oYW5kc2hha2UuYWRkcmVzcykgYXMgc3RyaW5nO1xuXG4gICAgYWRkcmVzc2VzLnNldChcbiAgICAgIGFkZHJlc3MsXG4gICAgICAoYWRkcmVzc2VzLmdldChhZGRyZXNzKSA/PyAwKSArIDFcbiAgICApO1xuXG4gICAgc29ja2V0Lm9uY2UoJ2Rpc2Nvbm5lY3QnLCAoKSA9PiB7XG4gICAgICBhcGkoKTtcbiAgICAgIGdhbWUubGVhdmUoc29ja2V0KTtcbiAgICAgIGFkZHJlc3Nlcy5zZXQoXG4gICAgICAgIGFkZHJlc3MsXG4gICAgICAgIChhZGRyZXNzZXMuZ2V0KGFkZHJlc3MpID8/IDApIC0gMVxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGlmIChhd2FpdCBhcGkudmVyaWZ5KG51bXMpICE9PSBjYWxjKG51bXMpKVxuICAgICAgcmV0dXJuIHNvY2tldC5kaXNjb25uZWN0KCk7XG5cbiAgICBjb25zdCBjb3VudCA9IGFkZHJlc3Nlcy5nZXQoYWRkcmVzcykgPz8gMDtcblxuICAgIGlmIChjb3VudCA+IE1BWF9BRERSRVNTX0NPTk5FQ1QgJiYgIUlTX0RFVikge1xuICAgICAgbG9nZ2VyLmluZm8oYEFkZHJlc3MgYmxvY2sgJHthZGRyZXNzfWApO1xuICAgICAgYXBpLmFkZHJlc3NCbG9jayhNQVhfQUREUkVTU19DT05ORUNUKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBnYW1lLmpvaW4oc29ja2V0KTtcbiAgfSk7XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9tYXRoLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9tYXRoLnRzXCI7ZXhwb3J0IGNvbnN0IHJlbSA9ICh2OiBudW1iZXIsIGE6IG51bWJlcik6IG51bWJlciA9PiB7XG4gIGlmICghaXNGaW5pdGUodikpIHYgPSAwO1xuICBpZiAodiA8IDApIHJldHVybiByZW0odiArIGEsIGEpO1xuICByZXR1cm4gdiAlIGE7XG59O1xuXG5leHBvcnQgY29uc3Qge1xuICBhYnMsXG4gIGFjb3MsXG4gIGFjb3NoLFxuICBhc2luLFxuICBhc2luaCxcbiAgYXRhbixcbiAgYXRhbjIsXG4gIGF0YW5oLFxuICBjYnJ0LFxuICBjZWlsLFxuICBjbHozMixcbiAgY29zLFxuICBjb3NoLFxuICBFLFxuICBleHAsXG4gIGV4cG0xLFxuICBmbG9vcixcbiAgZnJvdW5kLFxuICBoeXBvdCxcbiAgaW11bCxcbiAgbG9nLFxuICBsb2cxMCxcbiAgbG9nMXAsXG4gIGxvZzIsXG4gIExOMTAsXG4gIExOMixcbiAgTE9HMTBFLFxuICBMT0cyRSxcbiAgbWF4LFxuICBtaW4sXG4gIHBvdyxcbiAgUEksXG4gIHJhbmRvbSxcbiAgcm91bmQsXG4gIHNpZ24sXG4gIHNpbixcbiAgc2luaCxcbiAgc3FydCxcbiAgU1FSVDFfMixcbiAgU1FSVDIsXG4gIHRhbixcbiAgdGFuaCxcbiAgdHJ1bmNcbn0gPSBNYXRoOyIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvdmVyaWZ5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS92ZXJpZnkudHNcIjtpbXBvcnQgeyByYW5kb20gfSBmcm9tIFwiLi9tYXRoXCI7XG5cbmV4cG9ydCBjb25zdCBtYWtlRGF0YSA9ICgpID0+IChcbiAgQXJyYXkuZnJvbShcbiAgICB7IGxlbmd0aDogMzIgfSxcbiAgICBfID0+IHJhbmRvbSgpICogMjU1IHwgMFxuICApXG4pO1xuXG5leHBvcnQgY29uc3QgY2FsYyA9IChudW1iZXJzOiBudW1iZXJbXSkgPT4gKFxuICBudW1iZXJzLnJlZHVjZShcbiAgICAoYWNjLCBlLCBpKSA9PiAoXG4gICAgICBpICYgMSAmJiBpICYgMiA/IGFjYyAqIGUgOiBhY2MgKyBlXG4gICAgKSxcbiAgICAwXG4gICkgfCAwXG4pOyIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvRGF0YUJ1ZmZlci50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvRGF0YUJ1ZmZlci50c1wiO2V4cG9ydCBjbGFzcyBEYXRhQnVmZmVyIHtcbiAgI2N1cnNvciA9IDA7XG4gICNlbmQgPSAwO1xuXG4gIG1lbSA9IG5ldyBBcnJheUJ1ZmZlcigxMDI0ICogMTAyNCk7XG4gIGR2ID0gbmV3IERhdGFWaWV3KHRoaXMubWVtKTtcbiAgdWEgPSBuZXcgVWludDhBcnJheSh0aGlzLm1lbSk7XG4gIGVuYyA9IG5ldyBUZXh0RW5jb2RlcigpO1xuICBkZWMgPSBuZXcgVGV4dERlY29kZXIoKTtcblxuICBnZXQgYnl0ZUxlbmd0aCgpIHtcbiAgICByZXR1cm4gdGhpcy4jZW5kICsgMTtcbiAgfVxuXG4gIGdldCBidWZmZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMubWVtLnNsaWNlKDAsIHRoaXMuI2VuZCk7XG4gIH1cblxuXG4gIGdldCBjdXJzb3IoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N1cnNvcjtcbiAgfVxuXG4gIHNldCBjdXJzb3Iodikge1xuICAgIHRoaXMuI2N1cnNvciA9IHY7XG4gICAgaWYgKHYgPiB0aGlzLiNlbmQpXG4gICAgICB0aGlzLiNlbmQgPSB2O1xuICB9XG5cbiAgY29uc3RydWN0b3IoZGF0YTogbnVtYmVyIHwgQXJyYXlCdWZmZXIgPSAwKSB7XG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnbnVtYmVyJykge1xuICAgICAgdGhpcy5jdXJzb3IgPSAwO1xuICAgICAgdGhpcy4jZW5kID0gZGF0YSAtIDE7XG4gICAgfVxuXG4gICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgdGhpcy53cml0ZShkYXRhKTtcbiAgICAgIHRoaXMuY3Vyc29yID0gMDtcbiAgICB9XG4gIH1cblxuICByZXNldCgpIHtcbiAgICB0aGlzLiNjdXJzb3IgPSAwO1xuICAgIHRoaXMuI2VuZCA9IDA7XG4gIH1cblxuICBjbShjdXJzb3I/OiBudW1iZXIsIG1vdmU/OiBudW1iZXIpIHtcbiAgICBpZiAodHlwZW9mIGN1cnNvciA9PT0gJ251bWJlcicpXG4gICAgICB0aGlzLiNjdXJzb3IgPSBjdXJzb3I7XG5cbiAgICBjdXJzb3IgPSB0aGlzLiNjdXJzb3I7XG5cbiAgICBpZiAodHlwZW9mIG1vdmUgPT09ICdudW1iZXInKVxuICAgICAgdGhpcy5jdXJzb3IgKz0gbW92ZTtcblxuICAgIHJldHVybiBjdXJzb3I7XG4gIH1cblxuICAvLyBSZWFkIGJ1ZmZlclxuICByZWFkKGM/OiBudW1iZXIsIG9mZnNldCA9IHRoaXMuYnl0ZUxlbmd0aCAtIChjID8/IHRoaXMuY3Vyc29yKSkge1xuICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5jbShjLCBvZmZzZXQpO1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlci5zbGljZShzdGFydCwgdGhpcy5jdXJzb3IpO1xuICB9XG5cbiAgLy8gUmVhZCBib29sZWFuXG4gIHJlYWRib29sZWFuKGM/OiBudW1iZXIsIG0gPSAxKSB7XG4gICAgcmV0dXJuICEhdGhpcy5yZWFkaW50OChjLCBtKTtcbiAgfVxuXG4gIC8vIFJlYWQgOCBiaXRcbiAgcmVhZGludDgoYz86IG51bWJlciwgbSA9IDEpIHtcbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmNtKGMsIG0pO1xuICAgIHJldHVybiB0aGlzLmR2LmdldEludDgoY3Vyc29yKTtcbiAgfVxuICByZWFkdWludDgoYz86IG51bWJlciwgbSA9IDEpIHtcbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmNtKGMsIG0pO1xuICAgIHJldHVybiB0aGlzLmR2LmdldFVpbnQ4KGN1cnNvcik7XG4gIH1cblxuICAvLyBSZWFkIDE2IGJpdFxuICByZWFkaW50MTYoYz86IG51bWJlciwgbSA9IDIpIHtcbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmNtKGMsIG0pO1xuICAgIHJldHVybiB0aGlzLmR2LmdldEludDE2KGN1cnNvcik7XG4gIH1cbiAgcmVhZHVpbnQxNihjPzogbnVtYmVyLCBtID0gMikge1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuY20oYywgbSk7XG4gICAgcmV0dXJuIHRoaXMuZHYuZ2V0VWludDE2KGN1cnNvcik7XG4gIH1cblxuICAvLyBSZWFkIDMyIGJpdFxuICByZWFkaW50MzIoYz86IG51bWJlciwgbSA9IDQpIHtcbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmNtKGMsIG0pO1xuICAgIHJldHVybiB0aGlzLmR2LmdldEludDMyKGN1cnNvcik7XG4gIH1cbiAgcmVhZHVpbnQzMihjPzogbnVtYmVyLCBtID0gNCkge1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuY20oYywgbSk7XG4gICAgcmV0dXJuIHRoaXMuZHYuZ2V0VWludDMyKGN1cnNvcik7XG4gIH1cblxuICAvLyBSZWFkIGZsb2F0XG4gIHJlYWRmbG9hdDMyKGM/OiBudW1iZXIsIG0gPSA0KSB7XG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5jbShjLCBtKTtcbiAgICByZXR1cm4gdGhpcy5kdi5nZXRGbG9hdDMyKGN1cnNvcik7XG4gIH1cbiAgcmVhZGZsb2F0NjQoYz86IG51bWJlciwgbSA9IDgpIHtcbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmNtKGMsIG0pO1xuICAgIHJldHVybiB0aGlzLmR2LmdldEZsb2F0NjQoY3Vyc29yKTtcbiAgfVxuXG4gIC8vIFJlYWQgYmlnaW50XG4gIHJlYWRiaWdpbnQ2NChjPzogbnVtYmVyLCBtID0gOCkge1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuY20oYywgbSk7XG4gICAgcmV0dXJuIHRoaXMuZHYuZ2V0QmlnSW50NjQoY3Vyc29yKTtcbiAgfVxuICByZWFkYmlndWludDY0KGM/OiBudW1iZXIsIG0gPSA4KSB7XG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5jbShjLCBtKTtcbiAgICByZXR1cm4gdGhpcy5kdi5nZXRCaWdVaW50NjQoY3Vyc29yKTtcbiAgfVxuXG4gIC8vIFJlYWQgc3RyaW5nXG4gIHJlYWRzdHJpbmcoYz86IG51bWJlcikge1xuICAgIGNvbnN0IHNpemUgPSB0aGlzLnJlYWR1aW50MzIoYyk7XG4gICAgcmV0dXJuIHRoaXMuZGVjLmRlY29kZShcbiAgICAgIHRoaXMucmVhZCh1bmRlZmluZWQsIHNpemUpXG4gICAgKTtcbiAgfVxuXG4gIC8vIFdyaXRlIGJ1ZmZlclxuICB3cml0ZSh2YWx1ZTogQXJyYXlCdWZmZXIgfCBVaW50OEFycmF5LCBjPzogbnVtYmVyKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpXG4gICAgICB2YWx1ZSA9IG5ldyBVaW50OEFycmF5KHZhbHVlKTtcblxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgIGlmICh0eXBlb2YgYyA9PT0gJ251bWJlcicpXG4gICAgICAgIHRoaXMuI2N1cnNvciA9IGM7XG5cbiAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy4jY3Vyc29yO1xuICAgICAgdGhpcy5jdXJzb3IgKz0gdmFsdWUubGVuZ3RoO1xuICAgICAgdGhpcy51YS5zZXQodmFsdWUsIHN0YXJ0KTtcbiAgICB9XG4gIH1cblxuICAvLyBXcml0ZSBib29sZWFuXG4gIHdyaXRlYm9vbGVhbih2YWx1ZTogYm9vbGVhbiwgYz86IG51bWJlciwgbSA9IDEpIHtcbiAgICB0aGlzLndyaXRldWludDgoK3ZhbHVlLCBjLCBtKTtcbiAgfVxuXG4gIC8vIFdyaXRlIDggYml0XG4gIHdyaXRlaW50OCh2YWx1ZTogbnVtYmVyLCBjPzogbnVtYmVyLCBtID0gMSkge1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuY20oYywgbSk7XG4gICAgdGhpcy5kdi5zZXRJbnQ4KGN1cnNvciwgdmFsdWUpO1xuICB9XG4gIHdyaXRldWludDgodmFsdWU6IG51bWJlciwgYz86IG51bWJlciwgbSA9IDEpIHtcbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmNtKGMsIG0pO1xuICAgIHRoaXMuZHYuc2V0VWludDgoY3Vyc29yLCB2YWx1ZSk7XG4gIH1cblxuICAvLyBXcml0ZSAxNiBiaXRcbiAgd3JpdGVpbnQxNih2YWx1ZTogbnVtYmVyLCBjPzogbnVtYmVyLCBtID0gMikge1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuY20oYywgbSk7XG4gICAgdGhpcy5kdi5zZXRJbnQxNihjdXJzb3IsIHZhbHVlKTtcbiAgfVxuICB3cml0ZXVpbnQxNih2YWx1ZTogbnVtYmVyLCBjPzogbnVtYmVyLCBtID0gMikge1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuY20oYywgbSk7XG4gICAgdGhpcy5kdi5zZXRVaW50MTYoY3Vyc29yLCB2YWx1ZSk7XG4gIH1cblxuICAvLyBXcml0ZSAzMiBiaXRcbiAgd3JpdGVpbnQzMih2YWx1ZTogbnVtYmVyLCBjPzogbnVtYmVyLCBtID0gNCkge1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuY20oYywgbSk7XG4gICAgdGhpcy5kdi5zZXRJbnQzMihjdXJzb3IsIHZhbHVlKTtcbiAgfVxuICB3cml0ZXVpbnQzMih2YWx1ZTogbnVtYmVyLCBjPzogbnVtYmVyLCBtID0gNCkge1xuICAgIGNvbnN0IGN1cnNvciA9IHRoaXMuY20oYywgbSk7XG4gICAgdGhpcy5kdi5zZXRVaW50MzIoY3Vyc29yLCB2YWx1ZSk7XG4gIH1cblxuICAvLyBXcml0ZSBGbG9hdFxuICB3cml0ZWZsb2F0MzIodmFsdWU6IG51bWJlciwgYz86IG51bWJlciwgbSA9IDQpIHtcbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmNtKGMsIG0pO1xuICAgIHRoaXMuZHYuc2V0RmxvYXQzMihjdXJzb3IsIHZhbHVlKTtcbiAgfVxuICB3cml0ZWZsb2F0NjQodmFsdWU6IG51bWJlciwgYz86IG51bWJlciwgbSA9IDgpIHtcbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLmNtKGMsIG0pO1xuICAgIHRoaXMuZHYuc2V0RmxvYXQ2NChjdXJzb3IsIHZhbHVlKTtcbiAgfVxuXG4gIC8vIFdyaXRlIEJpZ2ludFxuICB3cml0ZWJpZ2ludDY0KHZhbHVlOiBiaWdpbnQsIGM/OiBudW1iZXIsIG0gPSA4KSB7XG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5jbShjLCBtKTtcbiAgICB0aGlzLmR2LnNldEJpZ0ludDY0KGN1cnNvciwgdmFsdWUpO1xuICB9XG4gIHdyaXRlYmlndWludDY0KHZhbHVlOiBiaWdpbnQsIGM/OiBudW1iZXIsIG0gPSA4KSB7XG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5jbShjLCBtKTtcbiAgICB0aGlzLmR2LnNldEJpZ1VpbnQ2NChjdXJzb3IsIHZhbHVlKTtcbiAgfVxuXG4gIC8vIFdyaXRlIHN0cmluZ1xuICB3cml0ZXN0cmluZyh2YWx1ZTogc3RyaW5nLCBjPzogbnVtYmVyKSB7XG4gICAgY29uc3QgYnVmZmVyID0gdGhpcy5lbmMuZW5jb2RlKHZhbHVlKTtcbiAgICB0aGlzLndyaXRldWludDMyKGJ1ZmZlci5sZW5ndGgsIGMpO1xuICAgIHRoaXMud3JpdGUoYnVmZmVyKTtcbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvUHJvdG8udHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL1Byb3RvLnRzXCI7aW1wb3J0IHsgRGF0YUJ1ZmZlciB9IGZyb20gXCIuL0RhdGFCdWZmZXJcIjtcblxuY29uc3QgRlJPTV9TWU1CT0wgPSBTeW1ib2woKTtcbmNvbnN0IFRPX1NZTUJPTCA9IFN5bWJvbCgpO1xuXG5leHBvcnQgdHlwZSBURGF0YUJ1ZmZlciA9IERhdGFCdWZmZXI7XG5cbmV4cG9ydCB0eXBlIFBSSU1JVElWRV9UWVBFUyA9IChcbiAgbmV2ZXJcbiAgfCAnYm9vbGVhbidcbiAgfCAnaW50OCdcbiAgfCAnaW50MTYnXG4gIHwgJ2ludDMyJ1xuICB8ICd1aW50OCdcbiAgfCAndWludDE2J1xuICB8ICd1aW50MzInXG4gIHwgJ2Zsb2F0MzInXG4gIHwgJ2Zsb2F0NjQnXG4gIHwgJ2JpZ2ludDY0J1xuICB8ICdiaWd1aW50NjQnXG4gIHwgJ3N0cmluZydcbik7XG5cbmV4cG9ydCB0eXBlIFRQcmltaXRpdmVWYWx1ZTxUIGV4dGVuZHMgUFJJTUlUSVZFX1RZUEVTPiA9IChcbiAgUmV0dXJuVHlwZTxEYXRhQnVmZmVyW2ByZWFkJHtUfWBdPlxuKTtcblxuZXhwb3J0IHR5cGUgVEN1c3RvbVR5cGU8VD4gPSB7XG4gIFtGUk9NX1NZTUJPTF0oZGI6IERhdGFCdWZmZXIsIHZhbHVlOiBUKTogdm9pZDtcbiAgW1RPX1NZTUJPTF0oZGI6IERhdGFCdWZmZXIpOiBUO1xufTtcblxuZXhwb3J0IHR5cGUgVFByb3RvVHlwZSA9IChcbiAgbmV2ZXJcbiAgfCBQUklNSVRJVkVfVFlQRVNcbiAgfCBUQ3VzdG9tVHlwZTxhbnk+XG4pO1xuXG5leHBvcnQgdHlwZSBUUHJvdG9QYXJhbSA9IChcbiAgbmV2ZXJcbiAgfCBUUHJvdG9UeXBlXG4gIHwgVFByb3RvT2JqZWN0XG4gIHwgW1RQcm90b1R5cGVdXG4gIHwgW1RQcm90b09iamVjdF1cbik7XG5cbmV4cG9ydCB0eXBlIFRQcm90b09iamVjdCA9IHtcbiAgW2tleTogc3RyaW5nXTogVFByb3RvUGFyYW07XG59O1xuXG5leHBvcnQgdHlwZSBUUHJvdG9PdXQ8VCBleHRlbmRzIFRDdXN0b21UeXBlPGFueT4+ID1cbiAgVFt0eXBlb2YgVE9fU1lNQk9MXSBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55ID8gUmV0dXJuVHlwZTxUW3R5cGVvZiBUT19TWU1CT0xdPiA6IG5ldmVyO1xuXG5leHBvcnQgdHlwZSBUUHJvdG9WYWx1ZTxUIGV4dGVuZHMgVFByb3RvUGFyYW0+ID0gKFxuICBUIGV4dGVuZHMgUFJJTUlUSVZFX1RZUEVTID8gKFxuICAgIFRQcmltaXRpdmVWYWx1ZTxUPlxuICApIDogVCBleHRlbmRzIFRDdXN0b21UeXBlPGFueT4gPyAoXG4gICAgUmV0dXJuVHlwZTxUW3R5cGVvZiBUT19TWU1CT0xdPlxuICApIDogVCBleHRlbmRzIFRQcm90b09iamVjdCA/ICh7XG4gICAgW2tleSBpbiBrZXlvZiBUXTogVFByb3RvVmFsdWU8VFtrZXldPlxuICB9KSA6IFQgZXh0ZW5kcyBbYW55XSA/IChcbiAgICBUUHJvdG9WYWx1ZTxUWzBdPltdXG4gICkgOiBuZXZlclxuKTtcblxuZXhwb3J0IGNvbnN0IG1ha2VDdXN0b21UeXBlID0gPFQ+KFxuICBmcm9tOiBUQ3VzdG9tVHlwZTxUPlt0eXBlb2YgRlJPTV9TWU1CT0xdLFxuICB0bzogVEN1c3RvbVR5cGU8VD5bdHlwZW9mIFRPX1NZTUJPTF1cbikgPT4ge1xuICByZXR1cm4ge1xuICAgIFtGUk9NX1NZTUJPTF06IGZyb20sXG4gICAgW1RPX1NZTUJPTF06IHRvLFxuICB9IGFzIFRDdXN0b21UeXBlPFQ+O1xufTtcblxudHlwZSBTdGFuZGFyZEVudW08VD4gPSB7XG4gIFtpZDogc3RyaW5nXTogVCB8IHN0cmluZztcbiAgW251OiBudW1iZXJdOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgY29uc3QgbWFrZUVudW0gPSA8VCBleHRlbmRzIFN0YW5kYXJkRW51bTx1bmtub3duPj4odHlwZTogVCkgPT4ge1xuICByZXR1cm4gbWFrZUN1c3RvbVR5cGU8VFtrZXlvZiBUXT4oXG4gICAgKGRiLCB2YWx1ZSkgPT4ge1xuICAgICAgZGIud3JpdGV1aW50OCh2YWx1ZSBhcyBudW1iZXIpO1xuICAgIH0sXG4gICAgKGRiKSA9PiB7XG4gICAgICByZXR1cm4gZGIucmVhZHVpbnQ4KCkgYXMgVFtrZXlvZiBUXTtcbiAgICB9XG4gICk7XG59O1xuXG5leHBvcnQgY2xhc3MgUHJvdG88VCBleHRlbmRzIFRQcm90b1BhcmFtPiB7XG4gICNwYXJhbTogVDtcbiAgI2RiPzogRGF0YUJ1ZmZlcjtcblxuICBnZXQgZGIoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2RiID8/IChcbiAgICAgIHRoaXMuI2RiID0gbmV3IERhdGFCdWZmZXIoKVxuICAgICk7XG4gIH1cblxuICAjY29udmVydChidWZmZXI6IEFycmF5QnVmZmVyKSB7XG4gICAgaWYgKHR5cGVvZiBCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIGJ1ZmZlciBpbnN0YW5jZW9mIEJ1ZmZlcikge1xuICAgICAgY29uc3Qgb3V0ID0gYnVmZmVyLmJ1ZmZlcjtcbiAgICAgIHJldHVybiBvdXQuc2xpY2Uob3V0LmJ5dGVMZW5ndGggLSBidWZmZXIubGVuZ3RoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9XG5cbiAgY29uc3RydWN0b3IocGFyYW06IFQpIHtcbiAgICB0aGlzLiNwYXJhbSA9IHBhcmFtO1xuICB9XG5cbiAgW0ZST01fU1lNQk9MXShkYjogRGF0YUJ1ZmZlciwgdmFsdWU6IFRQcm90b1ZhbHVlPFQ+KSB7XG4gICAgdGhpcy5mcm9tKHZhbHVlLCB1bmRlZmluZWQsIGRiKTtcbiAgfVxuXG4gIFtUT19TWU1CT0xdKGRiOiBEYXRhQnVmZmVyKSB7XG4gICAgcmV0dXJuIHRoaXMudG8odW5kZWZpbmVkLCB1bmRlZmluZWQsIGRiKTtcbiAgfVxuXG4gIGZyb20odmFsdWU6IFRQcm90b1ZhbHVlPFQ+LCBwYXJhbSA9IHRoaXMuI3BhcmFtLCBkYj86IERhdGFCdWZmZXIpOiBBcnJheUJ1ZmZlciB7XG4gICAgaWYgKCFkYikge1xuICAgICAgZGIgPSB0aGlzLmRiO1xuICAgICAgZGIuY3Vyc29yID0gMDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHBhcmFtID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyYW0pKSB7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWYWx1ZSBpcyBub3QgYXJyYXknKTtcblxuICAgICAgICBkYi53cml0ZXVpbnQzMih2YWx1ZS5sZW5ndGgpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB0aGlzLmZyb20odmFsdWVbaV0gYXMgYW55LCBwYXJhbVswXSBhcyBhbnksIGRiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkYi5idWZmZXI7XG4gICAgICB9XG5cbiAgICAgIGlmIChGUk9NX1NZTUJPTCBpbiBwYXJhbSAmJiBUT19TWU1CT0wgaW4gcGFyYW0pIHtcbiAgICAgICAgKHBhcmFtIGFzIFRDdXN0b21UeXBlPGFueT4pW0ZST01fU1lNQk9MXShkYiwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gZGIuYnVmZmVyO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGtleSBpbiBwYXJhbSkge1xuICAgICAgICB0aGlzLmZyb20oKHZhbHVlIGFzIGFueSlba2V5XSwgcGFyYW1ba2V5XSBhcyBhbnksIGRiKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRiLmJ1ZmZlcjtcbiAgICB9XG5cbiAgICBpZiAoKCd3cml0ZScgKyBwYXJhbSkgaW4gZGIpIHtcbiAgICAgIChkYiBhcyBhbnkpWyd3cml0ZScgKyBwYXJhbV0odmFsdWUpO1xuICAgICAgcmV0dXJuIGRiLmJ1ZmZlcjtcbiAgICB9XG5cbiAgICByZXR1cm4gZGIuYnVmZmVyO1xuICB9XG5cbiAgdG8oYnVmZmVyPzogQXJyYXlCdWZmZXIsIHBhcmFtID0gdGhpcy4jcGFyYW0sIGRiPzogRGF0YUJ1ZmZlcik6IFRQcm90b1ZhbHVlPFQ+IHtcbiAgICBpZiAoIWRiKSB7XG4gICAgICBkYiA9IHRoaXMuZGI7XG4gICAgICBkYi53cml0ZSh0aGlzLiNjb252ZXJ0KGJ1ZmZlciA/PyBuZXcgQXJyYXlCdWZmZXIoMCkpLCAwKTtcbiAgICAgIGRiLmN1cnNvciA9IDA7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBwYXJhbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHBhcmFtKSkge1xuICAgICAgICBjb25zdCBsZW5ndGggPSBkYi5yZWFkdWludDMyKCk7XG4gICAgICAgIHJldHVybiBBcnJheS5mcm9tKHsgbGVuZ3RoIH0sICgpID0+IHRoaXMudG8oYnVmZmVyLCBwYXJhbVswXSBhcyBhbnksIGRiKSkgYXMgYW55O1xuICAgICAgfVxuXG4gICAgICBpZiAoVE9fU1lNQk9MIGluIHBhcmFtICYmIEZST01fU1lNQk9MIGluIHBhcmFtKVxuICAgICAgICByZXR1cm4gKHBhcmFtIGFzIFRDdXN0b21UeXBlPGFueT4pW1RPX1NZTUJPTF0oZGIpO1xuXG4gICAgICBjb25zdCBvYmplY3QgPSB7fSBhcyBhbnk7XG5cbiAgICAgIGZvciAoY29uc3Qga2V5IGluIHBhcmFtKSB7XG4gICAgICAgIG9iamVjdFtrZXldID0gdGhpcy50byhidWZmZXIsIHBhcmFtW2tleV0gYXMgYW55LCBkYik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfVxuXG4gICAgaWYgKCgncmVhZCcgKyBwYXJhbSkgaW4gZGIpXG4gICAgICByZXR1cm4gKGRiIGFzIGFueSlbJ3JlYWQnICsgcGFyYW1dKCk7XG5cbiAgICByZXR1cm4gbnVsbCBhcyBhbnk7XG4gIH1cbn0iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL21ha2VXZWJTb2NrZXRBcGkudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL21ha2VXZWJTb2NrZXRBcGkudHNcIjtpbXBvcnQgeyBEYXRhQnVmZmVyIH0gZnJvbSBcIi4vRGF0YUJ1ZmZlclwiO1xuaW1wb3J0IHsgUHJvdG8gfSBmcm9tIFwiLi9Qcm90b1wiO1xuXG5pbXBvcnQgdHlwZSB7IFRQcm90b1BhcmFtLCBUUHJvdG9WYWx1ZSB9IGZyb20gXCIuL1Byb3RvXCI7XG5cbmxldCBBUElfQ09VTlRFUiA9IDA7XG5cbmV4cG9ydCB0eXBlIFRBcGlQYXJhbSA9IHtcbiAgW2tleTogc3RyaW5nXToge1xuICAgIGlucHV0PzogVFByb3RvUGFyYW07XG4gICAgb3V0cHV0PzogVFByb3RvUGFyYW07XG4gIH07XG59O1xuXG5leHBvcnQgdHlwZSBUQXBpRnVuY3Rpb25JbnB1dDxUIGV4dGVuZHMgVEFwaVBhcmFtW2Ake3N0cmluZ31gXT4gPSAoXG4gIFRbJ2lucHV0J10gZXh0ZW5kcyBUUHJvdG9QYXJhbSA/IFtpbnB1dDogVFByb3RvVmFsdWU8VFsnaW5wdXQnXT5dIDogW11cbik7XG5cbmV4cG9ydCB0eXBlIFRBcGlGdW5jdGlvbk91dHB1dDxUIGV4dGVuZHMgVEFwaVBhcmFtW2Ake3N0cmluZ31gXT4gPSAoXG4gIFRbJ291dHB1dCddIGV4dGVuZHMgVFByb3RvUGFyYW0gPyBUUHJvdG9WYWx1ZTxUWydvdXRwdXQnXT4gOiB2b2lkXG4pO1xuXG5leHBvcnQgdHlwZSBUQXBpUmVzdWx0PFQgZXh0ZW5kcyBUQXBpUGFyYW0+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiAoLi4uYXJnczogVEFwaUZ1bmN0aW9uSW5wdXQ8VFtrZXldPikgPT4gKFxuICAgIFRBcGlGdW5jdGlvbk91dHB1dDxUW2tleV0+XG4gIClcbn07XG5cbmV4cG9ydCB0eXBlIFRBcGlQcm9taXNlUmVzdWx0PFQgZXh0ZW5kcyBUQXBpUGFyYW0+ID0ge1xuICBba2V5IGluIGtleW9mIFRdOiAoLi4uYXJnczogVEFwaUZ1bmN0aW9uSW5wdXQ8VFtrZXldPikgPT4gKFxuICAgIFRBcGlGdW5jdGlvbk91dHB1dDxUW2tleV0+IGV4dGVuZHMgdm9pZCA/IHZvaWQgOiBQcm9taXNlPFRBcGlGdW5jdGlvbk91dHB1dDxUW2tleV0+PlxuICApXG59O1xuXG5leHBvcnQgdHlwZSBUQXBpPFQgZXh0ZW5kcyBUQXBpUGFyYW0+ID0ge1xuICBmb3J3YXJkKHNvY2tldDogVFNvY2tldCwgYXBpOiBQYXJ0aWFsPFRBcGlSZXN1bHQ8VD4+KTogKCkgPT4gdm9pZDtcbiAgdXNlKHNvY2tldDogVFNvY2tldCk6ICgoKSA9PiB2b2lkKSAmIFRBcGlQcm9taXNlUmVzdWx0PFQ+O1xufTtcblxuZXhwb3J0IHR5cGUgVE1ldGhvZHM8VCBleHRlbmRzIFRBcGk8YW55Pj4gPSAoXG4gIFJlcXVpcmVkPFBhcmFtZXRlcnM8VFsnZm9yd2FyZCddPlsxXT5cbik7XG5cbmV4cG9ydCB0eXBlIFRNZXRob2RzT3V0PFQgZXh0ZW5kcyBUQXBpPGFueT4+ID0gKFxuICBSZXF1aXJlZDxSZXR1cm5UeXBlPFRbJ3VzZSddPj5cbik7XG5cbmV4cG9ydCB0eXBlIFRBcGlNZXRob2QgPSB7XG4gIGlkOiBudW1iZXI7XG4gIGtleTogc3RyaW5nO1xuICBpbnB1dD86IFByb3RvPGFueT47XG4gIG91dHB1dD86IFByb3RvPGFueT47XG59O1xuXG5leHBvcnQgdHlwZSBUU29ja2V0ID0ge1xuICBvbihldmVudDogc3RyaW5nLCBjYWxsYmFjazogKGJ1ZmZlcjogQXJyYXlCdWZmZXIpID0+IGFueSk6IGFueTtcbiAgb2ZmKGV2ZW50OiBzdHJpbmcsIGNhbGxiYWNrOiAoYnVmZmVyOiBBcnJheUJ1ZmZlcikgPT4gYW55KTogYW55O1xuICBlbWl0KGV2ZW50OiBzdHJpbmcsIGJ1ZmZlcjogQXJyYXlCdWZmZXIpOiBhbnk7XG59O1xuXG5leHBvcnQgY29uc3QgbWFrZVdlYlNvY2tldEFwaSA9IChcbiAgPFQgZXh0ZW5kcyBUQXBpUGFyYW0+KHBhcmFtOiBUKSA9PiB7XG4gICAgY29uc3QgZGIgPSBuZXcgRGF0YUJ1ZmZlcigpO1xuICAgIGNvbnN0IEFQSV9LRVkgPSBBUElfQ09VTlRFUisrO1xuICAgIGNvbnN0IE1FVEhPRFNfTUFQID0gbmV3IE1hcDxudW1iZXIsIFRBcGlNZXRob2Q+KCk7XG4gICAgY29uc3QgTUVUSE9EU19LRVlfTUFQID0gbmV3IE1hcDxzdHJpbmcsIFRBcGlNZXRob2Q+KCk7XG4gICAgbGV0IE1FVEhPRF9DT1VOVEVSID0gMDtcblxuICAgIGZvciAoY29uc3Qga2V5IGluIHBhcmFtKSB7XG4gICAgICBjb25zdCB7IGlucHV0LCBvdXRwdXQgfSA9IHBhcmFtW2tleV07XG4gICAgICBjb25zdCBNRVRIT0RfS0VZID0gTUVUSE9EX0NPVU5URVIrKztcblxuICAgICAgY29uc3QgbWV0aG9kID0ge1xuICAgICAgICBpZDogTUVUSE9EX0tFWSxcbiAgICAgICAga2V5LFxuICAgICAgICBpbnB1dDogaW5wdXQgPyBuZXcgUHJvdG8oaW5wdXQpIDogdW5kZWZpbmVkLFxuICAgICAgICBvdXRwdXQ6IG91dHB1dCA/IG5ldyBQcm90byhvdXRwdXQpIDogdW5kZWZpbmVkXG4gICAgICB9O1xuXG4gICAgICBNRVRIT0RTX01BUC5zZXQoTUVUSE9EX0tFWSwgbWV0aG9kKTtcbiAgICAgIE1FVEhPRFNfS0VZX01BUC5zZXQoa2V5LCBtZXRob2QpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBmb3J3YXJkKHNvY2tldDogVFNvY2tldCwgYXBpOiBQYXJ0aWFsPFRBcGlSZXN1bHQ8VD4+KSB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmluZyA9IChkYXRhOiBBcnJheUJ1ZmZlcikgPT4ge1xuICAgICAgICAgIGRiLndyaXRlKGRhdGEsIDApO1xuICAgICAgICAgIGRiLmN1cnNvciA9IDA7XG5cbiAgICAgICAgICBpZiAoZGIucmVhZHVpbnQ4KCkgIT09IEFQSV9LRVkpIHJldHVybjtcbiAgICAgICAgICBpZiAoZGIucmVhZHVpbnQ4KCkgIT09IDApIHJldHVybjtcblxuICAgICAgICAgIGNvbnN0IE1FVEhPRF9LRVkgPSBkYi5yZWFkdWludDgoKTtcbiAgICAgICAgICBjb25zdCBSRVRVUk5fS0VZID0gZGIucmVhZGludDgoKTtcbiAgICAgICAgICBjb25zdCBtZXRob2QgPSBNRVRIT0RTX01BUC5nZXQoTUVUSE9EX0tFWSk7XG5cbiAgICAgICAgICBpZiAoIW1ldGhvZCB8fCAhKG1ldGhvZC5rZXkgaW4gYXBpKSkgcmV0dXJuO1xuXG4gICAgICAgICAgY29uc3QgaW5wdXQgPSBtZXRob2QuaW5wdXQgPyBbXG4gICAgICAgICAgICBtZXRob2QuaW5wdXQudG8odW5kZWZpbmVkLCB1bmRlZmluZWQsIGRiKVxuICAgICAgICAgIF0gOiBbXTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSAoYXBpW21ldGhvZC5rZXldIGFzICguLi5hcmdzOiB0eXBlb2YgaW5wdXQpID0+IGFueSkoLi4uaW5wdXQpO1xuICAgICAgICAgICAgZGIucmVzZXQoKTtcblxuICAgICAgICAgICAgaWYgKG1ldGhvZC5vdXRwdXQpIHtcbiAgICAgICAgICAgICAgZGIud3JpdGV1aW50OChBUElfS0VZKTtcbiAgICAgICAgICAgICAgZGIud3JpdGV1aW50OCgxKTtcbiAgICAgICAgICAgICAgZGIud3JpdGV1aW50OChNRVRIT0RfS0VZKTtcbiAgICAgICAgICAgICAgZGIud3JpdGVpbnQ4KFJFVFVSTl9LRVkpO1xuICAgICAgICAgICAgICBtZXRob2Qub3V0cHV0LmZyb20ocmVzdWx0LCB1bmRlZmluZWQsIGRiKTtcbiAgICAgICAgICAgICAgc29ja2V0LmVtaXQoYCR7QVBJX0tFWX1gLCBkYi5idWZmZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHNvY2tldC5vbihgJHtBUElfS0VZfWAsIGxpc3RlbmluZyk7XG5cbiAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICBzb2NrZXQub2ZmKGAke0FQSV9LRVl9YCwgbGlzdGVuaW5nKTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG5cbiAgICAgIHVzZShzb2NrZXQ6IFRTb2NrZXQpOiBUQXBpUHJvbWlzZVJlc3VsdDxUPiAmICgoKSA9PiB2b2lkKSB7XG4gICAgICAgIGNvbnN0IENBbGxCQUNLX01BUCA9IG5ldyBNYXA8bnVtYmVyLCAob3V0OiBhbnkpID0+IGFueT47XG4gICAgICAgIGxldCBDQUxMQkFDS19DT1VOVEVSID0gMDtcblxuICAgICAgICBjb25zdCBsaXN0ZW5lciA9IChkYXRhOiBBcnJheUJ1ZmZlcikgPT4ge1xuICAgICAgICAgIGRiLndyaXRlKGRhdGEsIDApO1xuICAgICAgICAgIGRiLmN1cnNvciA9IDA7XG5cbiAgICAgICAgICBpZiAoZGIucmVhZHVpbnQ4KCkgIT09IEFQSV9LRVkpIHJldHVybjtcbiAgICAgICAgICBpZiAoZGIucmVhZHVpbnQ4KCkgIT09IDEpIHJldHVybjtcbiAgICAgICAgICBjb25zdCBSRVRVUk5fS0VZID0gZGIucmVhZGludDgoKTtcbiAgICAgICAgICBjb25zdCBNRVRIT0RfS0VZID0gZGIucmVhZHVpbnQ4KCk7XG4gICAgICAgICAgY29uc3QgbWV0aG9kID0gTUVUSE9EU19NQVAuZ2V0KE1FVEhPRF9LRVkpO1xuICAgICAgICAgIGNvbnN0IGNhbGxiYWNrID0gQ0FsbEJBQ0tfTUFQLmdldChSRVRVUk5fS0VZKTtcbiAgICAgICAgICBpZiAoIW1ldGhvZCB8fCAhY2FsbGJhY2sgfHwgIW1ldGhvZC5vdXRwdXQpIHJldHVybjtcblxuICAgICAgICAgIGNhbGxiYWNrKFxuICAgICAgICAgICAgbWV0aG9kLm91dHB1dC50byh1bmRlZmluZWQsIHVuZGVmaW5lZCwgZGIpXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIENBbGxCQUNLX01BUC5kZWxldGUoUkVUVVJOX0tFWSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc29ja2V0Lm9uKGAke0FQSV9LRVl9YCwgbGlzdGVuZXIpO1xuXG4gICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIHNvY2tldC5vZmYoYCR7QVBJX0tFWX1gLCBsaXN0ZW5lcik7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBPYmplY3QuZW50cmllcyhwYXJhbSlcbiAgICAgICAgICAgIC5yZWR1Y2UoKGFjYywgW2tleV0pID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbWV0aG9kID0gTUVUSE9EU19LRVlfTUFQLmdldChrZXkpO1xuICAgICAgICAgICAgICBpZiAoIW1ldGhvZCkgcmV0dXJuIGFjYztcbiAgICAgICAgICAgICAgY29uc3QgeyBpZDogTUVUSE9EX0tFWSB9ID0gbWV0aG9kO1xuXG4gICAgICAgICAgICAgIChhY2MgYXMgYW55KVtrZXldID0gKGlucHV0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBSRVRVUk5fS0VZID0gQ0FMTEJBQ0tfQ09VTlRFUisrO1xuICAgICAgICAgICAgICAgIGRiLnJlc2V0KCk7XG4gICAgICAgICAgICAgICAgZGIud3JpdGV1aW50OChBUElfS0VZKTtcbiAgICAgICAgICAgICAgICBkYi53cml0ZXVpbnQ4KDApO1xuICAgICAgICAgICAgICAgIGRiLndyaXRldWludDgoTUVUSE9EX0tFWSk7XG4gICAgICAgICAgICAgICAgZGIud3JpdGV1aW50OChSRVRVUk5fS0VZKTtcblxuICAgICAgICAgICAgICAgIGlmIChtZXRob2QuaW5wdXQpXG4gICAgICAgICAgICAgICAgICBtZXRob2QuaW5wdXQuZnJvbShpbnB1dCwgdW5kZWZpbmVkLCBkYik7XG5cbiAgICAgICAgICAgICAgICBzb2NrZXQuZW1pdChgJHtBUElfS0VZfWAsIGRiLmJ1ZmZlcik7XG5cbiAgICAgICAgICAgICAgICBpZiAobWV0aG9kLm91dHB1dClcbiAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgQ0FsbEJBQ0tfTUFQLnNldChSRVRVUk5fS0VZLCByZXNvbHZlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgfSwge30gYXMgVEFwaVByb21pc2VSZXN1bHQ8VD4pXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBhcyBUQXBpPFQ+O1xuICB9XG4pOyIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvVmVjMi50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvVmVjMi50c1wiO2ltcG9ydCB7IGFicywgY2VpbCwgZmxvb3IsIHBvdywgcmVtLCByb3VuZCwgc3FydCB9IGZyb20gXCIuL21hdGhcIjtcblxuZXhwb3J0IGludGVyZmFjZSBJVmVjMiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB9XG5leHBvcnQgdHlwZSBUVmVjMiA9IFtdIHwgW3h5OiBudW1iZXJdIHwgW3g6IG51bWJlciwgeTogbnVtYmVyXSB8IFt2ZWM6IElWZWMyXTtcbmV4cG9ydCB0eXBlIFRWZWMyQ2FsbGJhY2s8ViBleHRlbmRzIElWZWMyLCBPPiA9ICh4OiBudW1iZXIsIHk6IG51bWJlciwgdmVjOiBWKSA9PiBPO1xuXG5jb25zdCBfcGx1cyA9IDxWIGV4dGVuZHMgSVZlYzI+KHg6IG51bWJlciwgeTogbnVtYmVyLCB2ZWM6IFYpID0+ICh2ZWMueCArPSB4LCB2ZWMueSArPSB5LCB2ZWMpO1xuY29uc3QgX21pbnVzID0gPFYgZXh0ZW5kcyBJVmVjMj4oeDogbnVtYmVyLCB5OiBudW1iZXIsIHZlYzogVikgPT4gKHZlYy54IC09IHgsIHZlYy55IC09IHksIHZlYyk7XG5jb25zdCBfdGltZXMgPSA8ViBleHRlbmRzIElWZWMyPih4OiBudW1iZXIsIHk6IG51bWJlciwgdmVjOiBWKSA9PiAodmVjLnggKj0geCwgdmVjLnkgKj0geSwgdmVjKTtcbmNvbnN0IF9kaXYgPSA8ViBleHRlbmRzIElWZWMyPih4OiBudW1iZXIsIHk6IG51bWJlciwgdmVjOiBWKSA9PiAodmVjLnggLz0geCwgdmVjLnkgLz0geSwgdmVjKTtcbmNvbnN0IF9yZW0gPSA8ViBleHRlbmRzIElWZWMyPih4OiBudW1iZXIsIHk6IG51bWJlciwgdmVjOiBWKSA9PiAodmVjLnggPSByZW0odmVjLngsIHgpLCB2ZWMueSA9IHJlbSh2ZWMueSwgeSksIHZlYyk7XG5jb25zdCBfcG93ID0gPFYgZXh0ZW5kcyBJVmVjMj4oeDogbnVtYmVyLCB5OiBudW1iZXIsIHZlYzogVikgPT4gKHZlYy54ID0gcG93KHZlYy54LCB4KSwgdmVjLnkgPSBwb3codmVjLnksIHkpLCB2ZWMpO1xuY29uc3QgX3NldCA9IDxWIGV4dGVuZHMgSVZlYzI+KHg6IG51bWJlciwgeTogbnVtYmVyLCB2ZWM6IFYpID0+ICh2ZWMueCA9IHgsIHZlYy55ID0geSwgdmVjKTtcbmNvbnN0IF9lcXVhbCA9IDxWIGV4dGVuZHMgSVZlYzI+KHg6IG51bWJlciwgeTogbnVtYmVyLCB2ZWM6IFYpID0+ICh2ZWMueCA9PT0geCAmJiB2ZWMueSA9PT0geSk7XG5jb25zdCBfbG93ZXIgPSA8ViBleHRlbmRzIElWZWMyPih4OiBudW1iZXIsIHk6IG51bWJlciwgdmVjOiBWKSA9PiAodmVjLnggPiB4ICYmIHZlYy55ID4geSk7XG5jb25zdCBfYmlnZ2VyID0gPFYgZXh0ZW5kcyBJVmVjMj4oeDogbnVtYmVyLCB5OiBudW1iZXIsIHZlYzogVikgPT4gKHZlYy54ID4geCAmJiB2ZWMueSA+IHkpO1xuY29uc3QgX21pbkxpbWl0ID0gPFYgZXh0ZW5kcyBJVmVjMj4oeDogbnVtYmVyLCB5OiBudW1iZXIsIHZlYzogVikgPT4gKHZlYy54IDwgeCAmJiAodmVjLnggPSB4KSwgdmVjLnkgPCB5ICYmICh2ZWMueSA9IHkpLCB2ZWMpO1xuY29uc3QgX21heExpbWl0ID0gPFYgZXh0ZW5kcyBJVmVjMj4oeDogbnVtYmVyLCB5OiBudW1iZXIsIHZlYzogVikgPT4gKHZlYy54ID4geCAmJiAodmVjLnggPSB4KSwgdmVjLnkgPiB5ICYmICh2ZWMueSA9IHkpLCB2ZWMpOztcblxuY29uc3QgdmVjMiA9IDxWIGV4dGVuZHMgSVZlYzIsIE8+KFxuICBhcmdzOiBUVmVjMixcbiAgY2FsbGJhY2s6IFRWZWMyQ2FsbGJhY2s8ViwgTz4sXG4gIHZlYzogVixcbik6IE8gPT4ge1xuICBjb25zdCBmaXJzdCA9IGFyZ3MuYXQoMCkgPz8gMDtcblxuICBpZiAodHlwZW9mIHZlYyAhPT0gJ29iamVjdCcpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdOZWVkIG9iamVjdCcpO1xuXG4gIGlmICghKGNhbGxiYWNrIGluc3RhbmNlb2YgRnVuY3Rpb24pKVxuICAgIHRocm93IG5ldyBFcnJvcihcIk5lZWQgY2FsbGJhY2tcIik7XG5cbiAgaWYgKGZpcnN0IGluc3RhbmNlb2YgRnVuY3Rpb24pXG4gICAgcmV0dXJuIGNhbGxiYWNrKDAsIDAsIHZlYyk7XG5cbiAgaWYgKHR5cGVvZiBmaXJzdCA9PT0gJ29iamVjdCcpXG4gICAgcmV0dXJuIGNhbGxiYWNrKGZpcnN0LngsIGZpcnN0LnksIHZlYyk7XG5cbiAgaWYgKHR5cGVvZiBmaXJzdCA9PT0gJ251bWJlcicpIHtcbiAgICBjb25zdCBzZWNvbmQgPSBhcmdzLmF0KDEpO1xuXG4gICAgaWYgKHR5cGVvZiBzZWNvbmQgPT09ICdudW1iZXInKVxuICAgICAgcmV0dXJuIGNhbGxiYWNrKGZpcnN0LCBzZWNvbmQsIHZlYyk7XG5cbiAgICByZXR1cm4gY2FsbGJhY2soZmlyc3QsIGZpcnN0LCB2ZWMpO1xuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3cgYXJndW1lbnRzJyk7XG59O1xuXG5leHBvcnQgY2xhc3MgVmVjMiB7XG4gIHg6IG51bWJlciA9IDA7XG4gIHk6IG51bWJlciA9IDA7XG5cbiAgY29uc3RydWN0b3IoLi4uYXJnczogVFZlYzIpIHtcbiAgICB0aGlzLnNldCguLi5hcmdzKTtcbiAgfVxuXG4gIGxlbmd0aCguLi5hcmdzOiBUVmVjMikge1xuICAgIHJldHVybiAoXG4gICAgICBzcXJ0KFxuICAgICAgICB0aGlzXG4gICAgICAgICAgLmNtaW51cyguLi5hcmdzKVxuICAgICAgICAgIC5wb3coMilcbiAgICAgICAgICAuc3VtKClcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgdG9Mb2coKSB7IHJldHVybiBgVmVjMjx4OiAke3RoaXMueC50b0ZpeGVkKDIpfSwgeTogJHt0aGlzLnkudG9GaXhlZCgyKX0+YDsgfVxuICBbU3ltYm9sLnRvU3RyaW5nVGFnXSgpIHsgcmV0dXJuIHRoaXMudG9Mb2coKTsgfVxuICB0b1N0cmluZygpIHsgcmV0dXJuIHRoaXMudG9Mb2coKTsgfVxuXG4gIHN1bSgpIHsgcmV0dXJuIHRoaXMueCArIHRoaXMueTsgfVxuICBjbG9uZSgpIHsgcmV0dXJuIG5ldyBWZWMyKHRoaXMpOyB9XG5cbiAgbm9ybWFsaXplKCkgeyByZXR1cm4gdGhpcy5kaXYodGhpcy5sZW5ndGgoKSB8fCAxKTsgfVxuICByb3VuZCgpIHsgcmV0dXJuIHRoaXMuc2V0KHJvdW5kKHRoaXMueCksIHJvdW5kKHRoaXMueSkpOyB9XG4gIGZsb29yKCkgeyByZXR1cm4gdGhpcy5zZXQoZmxvb3IodGhpcy54KSwgZmxvb3IodGhpcy55KSk7IH1cbiAgY2VpbCgpIHsgcmV0dXJuIHRoaXMuc2V0KGNlaWwodGhpcy54KSwgY2VpbCh0aGlzLnkpKTsgfVxuICBhYnMoKSB7IHJldHVybiB0aGlzLnNldChhYnModGhpcy54KSwgYWJzKHRoaXMueSkpOyB9XG5cblxuICBjbm9ybWFsaXplKCkgeyByZXR1cm4gdGhpcy5jZGl2KHRoaXMubGVuZ3RoKCkgfHwgMSk7IH1cbiAgY3JvdW5kKCkgeyByZXR1cm4gdGhpcy5jc2V0KHJvdW5kKHRoaXMueCksIHJvdW5kKHRoaXMueSkpOyB9XG4gIGNmbG9vcigpIHsgcmV0dXJuIHRoaXMuY3NldChmbG9vcih0aGlzLngpLCBmbG9vcih0aGlzLnkpKTsgfVxuICBjY2VpbCgpIHsgcmV0dXJuIHRoaXMuY3NldChjZWlsKHRoaXMueCksIGNlaWwodGhpcy55KSk7IH1cbiAgY2FicygpIHsgcmV0dXJuIHRoaXMuY3NldChhYnModGhpcy54KSwgYWJzKHRoaXMueSkpOyB9XG5cbiAgcGx1cyguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfcGx1cywgdGhpcyk7IH1cbiAgbWludXMoLi4uYXJnczogVFZlYzIpIHsgcmV0dXJuIHZlYzIoYXJncywgX21pbnVzLCB0aGlzKTsgfVxuICB0aW1lcyguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfdGltZXMsIHRoaXMpOyB9XG4gIGRpdiguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfZGl2LCB0aGlzKTsgfVxuICByZW0oLi4uYXJnczogVFZlYzIpIHsgcmV0dXJuIHZlYzIoYXJncywgX3JlbSwgdGhpcyk7IH1cbiAgcG93KC4uLmFyZ3M6IFRWZWMyKSB7IHJldHVybiB2ZWMyKGFyZ3MsIF9wb3csIHRoaXMpOyB9XG4gIHNldCguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfc2V0LCB0aGlzKTsgfVxuICBsb3dlciguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfbG93ZXIsIHRoaXMpOyB9XG4gIGJpZ2dlciguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfYmlnZ2VyLCB0aGlzKTsgfVxuICBlcXVhbCguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfZXF1YWwsIHRoaXMpOyB9XG5cbiAgY3BsdXMoLi4uYXJnczogVFZlYzIpIHsgcmV0dXJuIHZlYzIoYXJncywgX3BsdXMsIHRoaXMuY2xvbmUoKSk7IH1cbiAgY21pbnVzKC4uLmFyZ3M6IFRWZWMyKSB7IHJldHVybiB2ZWMyKGFyZ3MsIF9taW51cywgdGhpcy5jbG9uZSgpKTsgfVxuICBjdGltZXMoLi4uYXJnczogVFZlYzIpIHsgcmV0dXJuIHZlYzIoYXJncywgX3RpbWVzLCB0aGlzLmNsb25lKCkpOyB9XG4gIGNkaXYoLi4uYXJnczogVFZlYzIpIHsgcmV0dXJuIHZlYzIoYXJncywgX2RpdiwgdGhpcy5jbG9uZSgpKTsgfVxuICBjcmVtKC4uLmFyZ3M6IFRWZWMyKSB7IHJldHVybiB2ZWMyKGFyZ3MsIF9yZW0sIHRoaXMuY2xvbmUoKSk7IH1cbiAgY3BvdyguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfcG93LCB0aGlzLmNsb25lKCkpOyB9XG4gIGNzZXQoLi4uYXJnczogVFZlYzIpIHsgcmV0dXJuIHZlYzIoYXJncywgX3NldCwgdGhpcy5jbG9uZSgpKTsgfVxuXG4gIG1pbkxpbWl0KC4uLmFyZ3M6IFRWZWMyKSB7IHJldHVybiB2ZWMyKGFyZ3MsIF9taW5MaW1pdCwgdGhpcyk7IH1cbiAgbWF4TGltaXQoLi4uYXJnczogVFZlYzIpIHsgcmV0dXJuIHZlYzIoYXJncywgX21heExpbWl0LCB0aGlzKTsgfVxuXG4gIGNtaW5MaW1pdCguLi5hcmdzOiBUVmVjMikgeyByZXR1cm4gdmVjMihhcmdzLCBfbWluTGltaXQsIHRoaXMuY2xvbmUoKSk7IH1cbiAgY21heExpbWl0KC4uLmFyZ3M6IFRWZWMyKSB7IHJldHVybiB2ZWMyKGFyZ3MsIF9tYXhMaW1pdCwgdGhpcy5jbG9uZSgpKTsgfVxuXG4gIHN0YXRpYyB3aXRoSW5kZXgoaTogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikge1xuICAgIHJldHVybiBuZXcgVmVjMihpICUgd2lkdGgsIGkgLyB3aWR0aCB8IDApO1xuICB9XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9wb2ludC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvcG9pbnQudHNcIjtpbXBvcnQgeyBWZWMyIH0gZnJvbSBcIi4vVmVjMlwiO1xuXG5pbXBvcnQgdHlwZSB7IFRWZWMyIH0gZnJvbSBcIi4vVmVjMlwiO1xuXG5leHBvcnQgY29uc3QgcG9pbnQgPSAoLi4uYXJnczogVFZlYzIpID0+IHtcbiAgcmV0dXJuIG5ldyBWZWMyKC4uLmFyZ3MpO1xufTtcblxuZXhwb3J0IGNvbnN0IHBvaW50cyA9IChpbnB1dDogc3RyaW5nKSA9PiB7XG4gIHJldHVybiBpbnB1dC5zcGxpdCgnOycpLm1hcChpdGVtID0+IHtcbiAgICBjb25zdCBbeCwgeV0gPSBpdGVtLnNwbGl0KCcsJykubWFwKE51bWJlcik7XG4gICAgcmV0dXJuIHBvaW50KHgsIHkpO1xuICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBwbHVzID0gKHBvaW50czogVmVjMltdLCBwbHVzOiBWZWMyLCB0aW1lcyA9IDEpOiBWZWMyW10gPT4ge1xuICBwbHVzID0gcGx1cy5jdGltZXModGltZXMpO1xuICByZXR1cm4gcG9pbnRzLm1hcCh2ZWMgPT4gdmVjLmNwbHVzKHBsdXMpKTtcbn07IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NoYXJlZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zaGFyZWQvdHlwZXMudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zaGFyZWQvdHlwZXMudHNcIjtpbXBvcnQgeyBwb2ludCwgcG9pbnRzIH0gZnJvbSBcIi4uL2NvcmUvcG9pbnRcIjtcblxuZXhwb3J0IHR5cGUgVENoYXRJbmZvID0ge1xuICBuYW1lOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgZW51bSBFTWFwSXRlbSB7XG4gIENMRUFSLFxuICBXQUxMLFxuICBCTE9DSyxcbiAgR1JBUyxcbiAgU0FORCxcbiAgV0FURVIsXG59XG5cbmV4cG9ydCBjb25zdCBERUFUSF9GUkFNRVMgPSBwb2ludHMoJzAsMDswLDE7MCwyOzAsMzswLDQ7MCw1OzAsNjswLDcnKTtcblxuZXhwb3J0IGNvbnN0IE1BUF9JVEVNUyA9IHtcbiAgW0VNYXBJdGVtLkNMRUFSXTogcG9pbnQoMSwgMyksXG4gIFtFTWFwSXRlbS5XQUxMXTogcG9pbnQoMCwgMyksXG4gIFtFTWFwSXRlbS5CTE9DS106IHBvaW50KDAsIDQpLFxuICBbRU1hcEl0ZW0uR1JBU106IHBvaW50KDEsIDEpLFxuICBbRU1hcEl0ZW0uU0FORF06IHBvaW50KDEsIDQpLFxuICBbRU1hcEl0ZW0uV0FURVJdOiBwb2ludCgxLCAxKSxcbn07XG5cbmV4cG9ydCBlbnVtIEVTb3VuZHMge1xuICB3aW4sXG4gIGJvbnVzLFxuICBkZWF0aCxcbiAgcHV0Qm9tYixcbiAgZXhwbG9kZSxcbiAgbmV3TGlmZSxcbiAgbWVzc2FnZSxcbiAgc2hpZWxkLFxuICBjcmF6eSxcbiAgZXhwbG9kZUZhaWwsXG4gIGZpcmVPbixcbiAgZmlyZU9mZixcbiAgc3BlZWRPbixcbiAgc3BlZWRPZmYsXG4gIGtpbGwsXG4gIG1vdmluZyxcbn1cblxuZXhwb3J0IGVudW0gRURpciB7XG4gIFRPUCxcbiAgTEVGVCxcbiAgUklHSFQsXG4gIEJPVFRPTVxufVxuXG5leHBvcnQgZW51bSBFQW5pbWF0ZSB7XG4gIElETEUsXG4gIFJVTk5JTkdcbn1cblxuZXhwb3J0IGNvbnN0IERJUkVDVElPTlMgPSB7XG4gIFtFRGlyLlRPUF06IHBvaW50KDAsIC0xKSxcbiAgW0VEaXIuTEVGVF06IHBvaW50KC0xLCAwKSxcbiAgW0VEaXIuUklHSFRdOiBwb2ludCgxLCAwKSxcbiAgW0VEaXIuQk9UVE9NXTogcG9pbnQoMCwgMSlcbn07XG5cbmV4cG9ydCBlbnVtIEVBY2hpdm1lbnQge1xuICBBUFBFTkRfQk9NQixcbiAgQVBQRU5EX0VYUE8sXG4gIEFQUEVORF9TUEVFRCxcbiAgUkFORE9NLFxuICBBUFBFTkRfU0hJRUxELFxuICBNT1ZJTkdfQk9NQixcbiAgRklSRSxcbiAgQ1JBWllfQk9NQixcbn1cblxuZXhwb3J0IGNvbnN0IEFDSElWTUVOX1BPSU5UUyA9IHtcbiAgW0VBY2hpdm1lbnQuQVBQRU5EX0JPTUJdOiBwb2ludCgwLCAwKSxcbiAgW0VBY2hpdm1lbnQuQVBQRU5EX0VYUE9dOiBwb2ludCgxLCAwKSxcbiAgW0VBY2hpdm1lbnQuQVBQRU5EX1NQRUVEXTogcG9pbnQoMiwgMCksXG4gIFtFQWNoaXZtZW50LlJBTkRPTV06IHBvaW50KDMsIDApLFxuICBbRUFjaGl2bWVudC5BUFBFTkRfU0hJRUxEXTogcG9pbnQoNCwgMCksXG4gIFtFQWNoaXZtZW50Lk1PVklOR19CT01CXTogcG9pbnQoNSwgMCksXG4gIFtFQWNoaXZtZW50LkNSQVpZX0JPTUJdOiBwb2ludCg2LCAwKSxcbiAgW0VBY2hpdm1lbnQuRklSRV06IHBvaW50KDcsIDApLFxufSBhcyBjb25zdDtcblxuZXhwb3J0IGNvbnN0IEFDSElWTUVOX0RFU0NSSVBUSU9OID0ge1xuICBbRUFjaGl2bWVudC5BUFBFTkRfQk9NQl06IFwiXHUwNDE0XHUwNDNFXHUwNDNGXHUwNDNFXHUwNDNCXHUwNDNEXHUwNDM4XHUwNDQyXHUwNDM1XHUwNDNCXHUwNDRDXHUwNDNEXHUwNDMwXHUwNDRGIFx1MDQzMVx1MDQzRVx1MDQzQ1x1MDQzMVx1MDQzMFwiLFxuICBbRUFjaGl2bWVudC5BUFBFTkRfRVhQT106IFwiXHUwNDIzXHUwNDMyXHUwNDM1XHUwNDNCXHUwNDM4XHUwNDQ3XHUwNDM1XHUwNDNEXHUwNDM4XHUwNDM1IFx1MDQ0MFx1MDQzMFx1MDQzNFx1MDQzOFx1MDQ0M1x1MDQ0MVx1MDQzMFwiLFxuICBbRUFjaGl2bWVudC5BUFBFTkRfU1BFRURdOiBcIlx1MDQyM1x1MDQzMlx1MDQzNVx1MDQzQlx1MDQzOFx1MDQ0N1x1MDQzNVx1MDQzRFx1MDQzOFx1MDQzNSBcdTA0NDFcdTA0M0FcdTA0M0VcdTA0NDBcdTA0M0VcdTA0NDFcdTA0NDJcdTA0MzhcIixcbiAgW0VBY2hpdm1lbnQuUkFORE9NXTogXCJcdTA0MjFcdTA0M0JcdTA0NDNcdTA0NDdcdTA0MzBcdTA0MzlcdTA0M0RcdTA0NEJcdTA0MzkgXHUwNDREXHUwNDQ0XHUwNDQ0XHUwNDM1XHUwNDNBXHUwNDQyXCIsXG4gIFtFQWNoaXZtZW50LkFQUEVORF9TSElFTERdOiBcIlx1MDQyOVx1MDQzOFx1MDQ0MiwgXHUwNDM3XHUwNDMwXHUwNDQ5XHUwNDM4XHUwNDQ5XHUwNDMwXHUwNDRFXHUwNDQ5XHUwNDM4XHUwNDM5IFx1MDQzRVx1MDQ0MiBcdTA0MzJcdTA0MzdcdTA0NDBcdTA0NEJcdTA0MzJcdTA0MzBcIixcbiAgW0VBY2hpdm1lbnQuTU9WSU5HX0JPTUJdOiBcIlx1MDQyMlx1MDQzRVx1MDQzQlx1MDQzQVx1MDQzMFx1MDQzRFx1MDQzOFx1MDQzNSBcdTA0MzFcdTA0M0VcdTA0M0NcdTA0MzFcdTA0NEJcIixcbiAgW0VBY2hpdm1lbnQuQ1JBWllfQk9NQl06IFwiXHUwNDI4XHUwNDMwXHUwNDNCXHUwNDRDXHUwNDNEXHUwNDMwXHUwNDRGIChcdTA0NDBcdTA0MzBcdTA0M0RcdTA0MzRcdTA0M0VcdTA0M0NcdTA0M0RcdTA0MzBcdTA0NEYpIFx1MDQzMVx1MDQzRVx1MDQzQ1x1MDQzMVx1MDQzMFwiLFxuICBbRUFjaGl2bWVudC5GSVJFXTogXCJcdTA0MjNcdTA0M0NcdTA0MzVcdTA0M0RcdTA0NENcdTA0NDhcdTA0MzVcdTA0M0RcdTA0MzhcdTA0MzUgXHUwNDQxXHUwNDNBXHUwNDNFXHUwNDQwXHUwNDNFXHUwNDQxXHUwNDQyXHUwNDM4ICsgXHUwNDNFXHUwNDMzXHUwNDNFXHUwNDNEXHUwNDRDXCIsXG59IGFzIGNvbnN0O1xuXG5leHBvcnQgZW51bSBFRWZmZWN0IHtcbiAgREVBVEgsXG4gIEZBS0VfRVhQTE9ERSxcbn1cblxuZXhwb3J0IGVudW0gRUV4cGxvZGVEaXIge1xuICBDRU5URVIsXG4gIFRPUCxcbiAgTEVGVCxcbiAgUklHSFQsXG4gIEJPVFRPTVxufVxuZXhwb3J0IGNvbnN0IEVYUE9ERVJfRElSUyA9IHtcbiAgW0VFeHBsb2RlRGlyLkNFTlRFUl06IHBvaW50KDAsIDApLFxuICBbRUV4cGxvZGVEaXIuVE9QXTogcG9pbnQoMCwgLTEpLFxuICBbRUV4cGxvZGVEaXIuTEVGVF06IHBvaW50KC0xLCAwKSxcbiAgW0VFeHBsb2RlRGlyLlJJR0hUXTogcG9pbnQoMSwgMCksXG4gIFtFRXhwbG9kZURpci5CT1RUT01dOiBwb2ludCgwLCAxKVxufTsiLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2hhcmVkXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NoYXJlZC9hcGkudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zaGFyZWQvYXBpLnRzXCI7aW1wb3J0IHsgbWFrZVdlYlNvY2tldEFwaSB9IGZyb20gXCIuLi9jb3JlL21ha2VXZWJTb2NrZXRBcGlcIjtcbmltcG9ydCB7IG1ha2VDdXN0b21UeXBlLCBtYWtlRW51bSwgUHJvdG8gfSBmcm9tIFwiLi4vY29yZS9Qcm90b1wiO1xuaW1wb3J0IHsgRUFjaGl2bWVudCwgRUFuaW1hdGUsIEVEaXIsIEVFZmZlY3QsIEVFeHBsb2RlRGlyLCBFU291bmRzIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuZXhwb3J0IGNvbnN0IFBPU0lUSU9OID0gbWFrZUN1c3RvbVR5cGU8bnVtYmVyPihcbiAgKGRiLCB2YWx1ZSkgPT4ge1xuICAgIGRiLndyaXRlaW50MzIodmFsdWUgKiAxMDAwKTtcbiAgfSxcbiAgKGRiKSA9PiB7XG4gICAgcmV0dXJuIGRiLnJlYWRpbnQzMigpIC8gMTAwMDtcbiAgfVxuKTtcblxuZXhwb3J0IGNvbnN0IERJUkVDVElPTiA9IG1ha2VFbnVtKEVEaXIpO1xuZXhwb3J0IGNvbnN0IEFOSU1BVElPTiA9IG1ha2VFbnVtKEVBbmltYXRlKTtcbmV4cG9ydCBjb25zdCBTT1VORCA9IG1ha2VFbnVtKEVTb3VuZHMpO1xuZXhwb3J0IGNvbnN0IEVGRkVDVCA9IG1ha2VFbnVtKEVFZmZlY3QpO1xuZXhwb3J0IGNvbnN0IEFDSElWTUVOVCA9IG1ha2VFbnVtKEVBY2hpdm1lbnQpO1xuZXhwb3J0IGNvbnN0IEVYUExPREVESVJFQ1RJT04gPSBtYWtlRW51bShFRXhwbG9kZURpcik7XG5cbmV4cG9ydCBjb25zdCBJTlBVVF9QT1NJVElPTiA9IG5ldyBQcm90byh7XG4gIHg6IFBPU0lUSU9OLFxuICB5OiBQT1NJVElPTixcbiAgZGlyOiBESVJFQ1RJT04sXG4gIGFuaW1hdGU6IEFOSU1BVElPTixcbn0pO1xuXG5leHBvcnQgY29uc3QgTUVTU0FHRV9JTkZPID0gbmV3IFByb3RvKHtcbiAgbWVzc2FnZTogJ3N0cmluZycsXG4gIHNlbmRlcjoge1xuICAgIG5hbWU6ICdzdHJpbmcnXG4gIH0sXG4gIGlzTWU6ICdib29sZWFuJ1xufSk7XG5cbmV4cG9ydCBjb25zdCBFRkZFQ1RfSU5GTyA9IG5ldyBQcm90byh7XG4gIGlkOiAndWludDMyJyxcbiAgeDogUE9TSVRJT04sXG4gIHk6IFBPU0lUSU9OLFxuICB0eXBlOiBFRkZFQ1QsXG4gIGRlbHRhVGltZTogJ2Zsb2F0NjQnLFxuICBtZXRhOiBbJ3VpbnQ4J10sXG59KTtcblxuZXhwb3J0IGNvbnN0IEdBTUVfSU5GTyA9IG5ldyBQcm90byh7XG4gIHdpZHRoOiAndWludDgnLFxuICBoZWlnaHQ6ICd1aW50OCcsXG4gIHdpblBsYXllcklkOiAndWludDMyJyxcbiAgcGxheWVyc0NvdW50OiAndWludDgnLFxuICBsaXZlUGxheWVyc0NvdW50OiAndWludDgnLFxuICBzcGVjdHJhdG9yc0NvdW50OiAndWludDgnLFxuICBjdXJyZW50TGltaXRlZDogJ2ludDE2Jyxcbn0pO1xuXG5leHBvcnQgY29uc3QgUExBWUVSX1BPU0lUSU9OID0gbmV3IFByb3RvKHtcbiAgaWQ6ICd1aW50MzInLFxuICB4OiBQT1NJVElPTixcbiAgeTogUE9TSVRJT04sXG4gIHNwZWVkOiAnZmxvYXQzMicsXG4gIGRpcjogRElSRUNUSU9OLFxuICBhbmltYXRlOiBBTklNQVRJT04sXG59KTtcblxuZXhwb3J0IGNvbnN0IFBMQVlFUl9JTkZPID0gbmV3IFByb3RvKHtcbiAgaWQ6ICd1aW50MzInLFxuICBuYW1lOiAnc3RyaW5nJyxcbiAgc2tpbjogJ3VpbnQ4JyxcbiAgaW5HYW1lOiAnYm9vbGVhbicsXG4gIGlzRGVhdGg6ICdib29sZWFuJyxcbiAgY2FuSm9pbjogJ2Jvb2xlYW4nLFxuICB3aW5zOiAndWludDgnLFxuICBraWxsczogJ3VpbnQ4JyxcbiAgZGVhdGhzOiAndWludDgnLFxuICBpc0FkbWluOiAnYm9vbGVhbicsXG4gIGVmZmVjdHM6IHtcbiAgICBoYXZlU2hpZWxkOiAnYm9vbGVhbicsXG4gICAgc3BlZWQ6ICdmbG9hdDMyJyxcbiAgICBjcmF6eTogJ2Jvb2xlYW4nLFxuICAgIGhhdmVNb3ZlOiAnYm9vbGVhbidcbiAgfSxcbiAgcGluZzogJ3VpbnQxNidcbn0pO1xuXG5leHBvcnQgY29uc3QgQUNISVZNRU5UX0lORk8gPSBuZXcgUHJvdG8oe1xuICBpZDogJ3VpbnQzMicsXG4gIHg6IFBPU0lUSU9OLFxuICB5OiBQT1NJVElPTixcbiAgdHlwZTogQUNISVZNRU5UXG59KTtcblxuZXhwb3J0IGNvbnN0IEVYUExPREVfSU5GTyA9IG5ldyBQcm90byh7XG4gIGlkOiAndWludDMyJyxcbiAgeDogUE9TSVRJT04sXG4gIHk6IFBPU0lUSU9OLFxuICBwb2ludHM6IFt7XG4gICAgeDogUE9TSVRJT04sXG4gICAgeTogUE9TSVRJT04sXG4gICAgZGlyOiBFWFBMT0RFRElSRUNUSU9OLFxuICAgIGlzRmluYWx5OiAnYm9vbGVhbicsXG4gICAgaXNCbG9jazogJ2Jvb2xlYW4nLFxuICB9XVxufSk7XG5cbmV4cG9ydCBjb25zdCBTVEFSVF9QT1NJVElPTiA9IG5ldyBQcm90byh7XG4gIHg6IFBPU0lUSU9OLFxuICB5OiBQT1NJVElPTixcbn0pO1xuXG5leHBvcnQgY29uc3QgQk9NQl9JTkZPID0gbmV3IFByb3RvKHtcbiAgaWQ6ICd1aW50MzInLFxuICB4OiBQT1NJVElPTixcbiAgeTogUE9TSVRJT04sXG4gIHJhZGl1czogJ3VpbnQxNicsXG4gIGlzTW92ZTogJ2Jvb2xlYW4nLFxuICBpc0NyYXp5OiAnYm9vbGVhbicsXG4gIGlzUmFkaW86ICdib29sZWFuJ1xufSk7XG5cbmV4cG9ydCBjb25zdCBQT1NJVElPTl9TT1VORCA9IG5ldyBQcm90byh7XG4gIHBvc2l0aW9uOiB7XG4gICAgeDogUE9TSVRJT04sXG4gICAgeTogUE9TSVRJT05cbiAgfSxcbiAgc291bmQ6IFNPVU5EXG59KTtcblxuZXhwb3J0IGNvbnN0IFJFTUFJTklOR19FRkZFQ1RTID0gbmV3IFByb3RvKHtcbiAgcmFkaXVzOiAndWludDE2JyxcbiAgYm9tYnM6ICd1aW50MTYnLFxuICBzdXA6ICd1aW50MTYnLFxuICBzZG93bjogJ3VpbnQxNicsXG4gIHNoaWVsZDogJ3VpbnQxNicsXG4gIGNyYXp5OiAndWludDE2JyxcbiAgbW92aW5nOiAndWludDE2Jyxcbn0pO1xuXG5leHBvcnQgY29uc3QgZ2FtZUFwaSA9IG1ha2VXZWJTb2NrZXRBcGkoe1xuICBzZXRQb3NpdGlvbjogeyBpbnB1dDogSU5QVVRfUE9TSVRJT04gfSxcbiAgc2V0Qm9tYjoge30sXG4gIHNldE5hbWU6IHsgaW5wdXQ6ICdzdHJpbmcnIH0sXG4gIHRvR2FtZToge30sXG4gIHRvTGVhdmU6IHt9LFxuICBzZW5kTWVzc2FnZTogeyBpbnB1dDogJ3N0cmluZycgfSxcbiAgc2V0U2tpbjogeyBpbnB1dDogJ3VpbnQ4JyB9LFxuICBzZXRDdXN0b21Ta2luOiB7IGlucHV0OiAndWludDgnIH0sXG4gIHBpbmc6IHt9LFxufSk7XG5cbmV4cG9ydCBjb25zdCBwbGF5ZXJBcGkgPSBtYWtlV2ViU29ja2V0QXBpKHtcbiAgc2V0U3RhcnRQb3NpdGlvbjogeyBpbnB1dDogU1RBUlRfUE9TSVRJT04gfSxcbiAgdXBkYXRlTWFwOiB7IGlucHV0OiBbJ3VpbnQ4J10gfSxcbiAgdXBkYXRlQm9tYnM6IHsgaW5wdXQ6IFtCT01CX0lORk9dIH0sXG4gIHVwZGF0ZVBsYXllcnM6IHsgaW5wdXQ6IFtQTEFZRVJfSU5GT10gfSxcbiAgdXBkYXRlRXhwbG9kZXM6IHsgaW5wdXQ6IFtFWFBMT0RFX0lORk9dIH0sXG4gIHVwZGF0ZUFjaGl2bWVudHM6IHsgaW5wdXQ6IFtBQ0hJVk1FTlRfSU5GT10gfSxcbiAgdXBkYXRlTG9jYWxJbmZvOiB7IGlucHV0OiBQTEFZRVJfSU5GTyB9LFxuICB1cGRhdGVQbGF5ZXJQb3NpdGlvbnM6IHsgaW5wdXQ6IFtQTEFZRVJfUE9TSVRJT05dIH0sXG4gIHVwZGF0ZUdhbWVJbmZvOiB7IGlucHV0OiBHQU1FX0lORk8gfSxcbiAgdXBkYXRlUmVtYWluaW5nRWZmZWN0czogeyBpbnB1dDogUkVNQUlOSU5HX0VGRkVDVFMgfSxcbiAgdXBkYXRlV2FpdEZvclJlc3RhcnQ6IHsgaW5wdXQ6ICdpbnQ4JyB9LFxuICB1cGRhdGVFZmZlY3RzOiB7IGlucHV0OiBbRUZGRUNUX0lORk9dIH0sXG4gIHBsYXlTb3VuZDogeyBpbnB1dDogU09VTkQgfSxcbiAgcGxheVNvdW5kUG9zaXRpb246IHsgaW5wdXQ6IFBPU0lUSU9OX1NPVU5EIH0sXG4gIG9uTWVzc2FnZTogeyBpbnB1dDogTUVTU0FHRV9JTkZPIH0sXG4gIHBpbmc6IHt9LFxufSk7XG5cbmV4cG9ydCBjb25zdCB2ZXJpZnlBcGkgPSBtYWtlV2ViU29ja2V0QXBpKHtcbiAgdmVyaWZ5OiB7IGlucHV0OiBbJ3VpbnQ4J10sIG91dHB1dDogJ2ludDMyJyB9LFxuICBhZGRyZXNzQmxvY2s6IHsgaW5wdXQ6ICd1aW50OCcgfVxufSk7IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS90b0NvbC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvdG9Db2wudHNcIjtleHBvcnQgY29uc3QgdG9Db2wgPSAobjogbnVtYmVyLCBjID0gMikgPT4ge1xuICByZXR1cm4gKCcwJy5yZXBlYXQoYykgKyBuKS5zbGljZSgtYyk7XG59OyIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvRkRhdGUudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL0ZEYXRlLnRzXCI7aW1wb3J0IHsgdG9Db2wgfSBmcm9tIFwiLi90b0NvbFwiO1xuXG5jb25zdCBGT1JNQVRfUkUgPSAvKFxcdylcXDEqL2c7XG5jb25zdCBQQVJTRV9SRSA9IC8oXFxkKylcXHMqKFxcdz8pL2c7XG5cbmV4cG9ydCBjbGFzcyBGRGF0ZSBleHRlbmRzIERhdGUge1xuICBnZXQgaCgpIHsgcmV0dXJuIHRoaXMuZ2V0SG91cnMoKTsgfVxuICBnZXQgbSgpIHsgcmV0dXJuIHRoaXMuZ2V0TWludXRlcygpOyB9XG4gIGdldCBzKCkgeyByZXR1cm4gdGhpcy5nZXRTZWNvbmRzKCk7IH1cbiAgZ2V0IG1zKCkgeyByZXR1cm4gdGhpcy5nZXRNaWxsaXNlY29uZHMoKTsgfVxuXG4gIHNldCBoKHYpIHsgdGhpcy5zZXRIb3Vycyh2KTsgfVxuICBzZXQgbSh2KSB7IHRoaXMuc2V0TWludXRlcyh2KTsgfVxuICBzZXQgcyh2KSB7IHRoaXMuc2V0U2Vjb25kcyh2KTsgfVxuICBzZXQgbXModikgeyB0aGlzLnNldE1pbGxpc2Vjb25kcyh2KTsgfVxuXG4gIGdldCBEKCkgeyByZXR1cm4gdGhpcy5nZXREYXRlKCk7IH1cbiAgZ2V0IE0oKSB7IHJldHVybiB0aGlzLmdldE1vbnRoKCkgKyAxOyB9XG4gIGdldCBZKCkgeyByZXR1cm4gdGhpcy5nZXRGdWxsWWVhcigpOyB9XG5cbiAgc2V0IEQodikgeyB0aGlzLnNldERhdGUodik7IH1cbiAgc2V0IE0odikgeyB0aGlzLnNldE1vbnRoKHYgLSAxKTsgfVxuICBzZXQgWSh2KSB7IHRoaXMuc2V0RnVsbFllYXIodik7IH1cblxuICBzdGF0aWMgbWFrZUZvcm1hdChmb3JtYXQ6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmZvcm1hdC5iaW5kKHRoaXMsIGZvcm1hdCk7XG4gIH1cblxuICBzdGF0aWMgZm9ybWF0KGZvcm1hdDogc3RyaW5nLCBkYXRlOiBzdHJpbmcgfCBudW1iZXIgfCBEYXRlIHwgRkRhdGUpIHtcbiAgICBpZiAoIShkYXRlIGluc3RhbmNlb2YgdGhpcykpXG4gICAgICBkYXRlID0gbmV3IHRoaXMoZGF0ZSk7XG5cbiAgICByZXR1cm4gZm9ybWF0LnJlcGxhY2UoRk9STUFUX1JFLCAoc291cmNlKSA9PiB7XG4gICAgICBjb25zdCBkOiBGRGF0ZSA9IGRhdGUgYXMgYW55O1xuICAgICAgY29uc3QgW2tleV0gPSBzb3VyY2U7XG4gICAgICBpZiAoa2V5IGluIGQpXG4gICAgICAgIHJldHVybiB0b0NvbCgoZCBhcyBhbnkpW2tleV0sIHNvdXJjZS5sZW5ndGgpO1xuXG4gICAgICByZXR1cm4gc291cmNlO1xuICAgIH0pO1xuICB9XG5cbiAgc3RhdGljIGZyb20oc3RyaW5nOiBzdHJpbmcpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IHRoaXMoMCk7XG5cbiAgICBzdHJpbmcucmVwbGFjZShQQVJTRV9SRSwgKF8sIG51bSwga2V5KSA9PiB7XG4gICAgICBpZiAoa2V5IGluIGRhdGUpIHtcbiAgICAgICAgKGRhdGUgYXMgYW55KVtrZXldICs9ICtudW07XG4gICAgICB9XG5cbiAgICAgIGlmICgha2V5KVxuICAgICAgICBkYXRlLm1zICs9ICtudW07XG5cbiAgICAgIHJldHVybiAnJztcbiAgICB9KTtcblxuICAgIHJldHVybiArZGF0ZTtcbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zaGFyZWRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2hhcmVkL2NvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NoYXJlZC9jb25maWcudHNcIjtpbXBvcnQgeyBGRGF0ZSB9IGZyb20gXCIuLi9jb3JlL0ZEYXRlXCI7XG5cbmV4cG9ydCBjb25zdCBURVNUX0FETUlOX0lQID0gLygxMjcuMC4wLlxcZCt8MTBcXC4yNDJcXC4zNlxcLlxcZCspLztcbmV4cG9ydCBjb25zdCBNQVhfUExBWUVSUyA9IDE2O1xuZXhwb3J0IGNvbnN0IE5JQ0tfTEVOR1RIID0gMTg7XG5leHBvcnQgY29uc3QgTUVTU0FHRV9MRU5HVEggPSAxMDA7XG5leHBvcnQgY29uc3QgUExBWUVSX1RJTUVPVVQgPSBGRGF0ZS5mcm9tKCcxbScpO1xuZXhwb3J0IGNvbnN0IFNISUVMRF9USU1FID0gRkRhdGUuZnJvbSgnNTBzJyk7XG5leHBvcnQgY29uc3QgU1BFRURfVElNRSA9IEZEYXRlLmZyb20oJzI1cycpO1xuZXhwb3J0IGNvbnN0IENSQVpZX0JPTUJfVElNRSA9IEZEYXRlLmZyb20oJzMwcycpO1xuZXhwb3J0IGNvbnN0IE1PVklOR19USU1FID0gRkRhdGUuZnJvbSgnMzVzJyk7XG5leHBvcnQgY29uc3QgQk9NQl9USU1FID0gRkRhdGUuZnJvbSgnMnMnKTtcbmV4cG9ydCBjb25zdCBDUkFaWV9CT01CX01JTiA9IEZEYXRlLmZyb20oJzFzJyk7XG5leHBvcnQgY29uc3QgQ1JBWllfQk9NQl9NQVggPSBGRGF0ZS5mcm9tKCc1cycpO1xuZXhwb3J0IGNvbnN0IENSQVpZX0JPTUJfQk9PU1QgPSA1O1xuZXhwb3J0IGNvbnN0IFNLSU5TX0NPVU5UID0gMTE7Ly81MjtcbmV4cG9ydCBjb25zdCBDVVNUT01fU0tJTlNfQ09VTlQgPSAwO1xuZXhwb3J0IGNvbnN0IFRJTUVPVVRfTUVTU0FHRSA9IEZEYXRlLmZyb20oJzJzJyk7XG5leHBvcnQgY29uc3QgVElNRU9VVF9OSUNLTkFNRSA9IEZEYXRlLmZyb20oJzUwMCcpO1xuZXhwb3J0IGNvbnN0IFRJTUVPVVRfU0tJTiA9IEZEYXRlLmZyb20oJzUwMCcpO1xuZXhwb3J0IGNvbnN0IFRJTUVPVVRfUkVDT05ORUNUID0gRkRhdGUuZnJvbSgnMTBzJyk7XG5leHBvcnQgY29uc3QgV0FJVF9GT1JfTElNSVQgPSBGRGF0ZS5mcm9tKCcxNXMnKTtcbmV4cG9ydCBjb25zdCBaT05FTElNSVRfVElNRU9VVCA9IEZEYXRlLmZyb20oJzE1cycpO1xuZXhwb3J0IGNvbnN0IE1BWF9BRERSRVNTX0NPTk5FQ1QgPSA1OyIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvRXZlbnRzLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9FdmVudHMudHNcIjtleHBvcnQgaW50ZXJmYWNlIElFdmVudHNNYXAge1xuICBba2V5OiBzdHJpbmddOiBhbnk7XG59XG5cbmV4cG9ydCB0eXBlIFRDdXN0b21FdmVudExpc3RlbmVyPE0gZXh0ZW5kcyBJRXZlbnRzTWFwLCBLIGV4dGVuZHMga2V5b2YgTT4gPSAoXG4gIChldmVudDogQ3VzdG9tRXZlbnQ8TSwgSz4pID0+IGFueVxuKTtcblxuZXhwb3J0IGNsYXNzIEN1c3RvbUV2ZW50PE0gZXh0ZW5kcyBJRXZlbnRzTWFwLCBLIGV4dGVuZHMga2V5b2YgTT4gZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKHR5cGU6IEssIHB1YmxpYyBkYXRhOiBNW0tdKSB7XG4gICAgc3VwZXIodHlwZSBhcyBzdHJpbmcpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFdmVudHM8TSBleHRlbmRzIElFdmVudHNNYXA+IHtcbiAgI3RhcmdldCA9IG5ldyBFdmVudFRhcmdldCgpO1xuICAjcmVncyA9IG5ldyBNYXA8a2V5b2YgTSwgU2V0PFRDdXN0b21FdmVudExpc3RlbmVyPE0sIGFueT4+PigpO1xuXG4gICNnZXRSZWdzPEsgZXh0ZW5kcyBrZXlvZiBNPihrZXk6IEspIHtcbiAgICByZXR1cm4gdGhpcy4jcmVncy5nZXQoa2V5KSA/PyAoXG4gICAgICB0aGlzLiNyZWdzLnNldChrZXksIG5ldyBTZXQoKSksXG4gICAgICB0aGlzLiNyZWdzLmdldChrZXkpIVxuICAgICk7XG4gIH1cblxuICBhZGRFdmVudExpc3RlbmVyPEsgZXh0ZW5kcyBrZXlvZiBNPihcbiAgICB0eXBlOiBLLFxuICAgIGNhbGxiYWNrOiBUQ3VzdG9tRXZlbnRMaXN0ZW5lcjxNLCBLPiB8IG51bGwsXG4gICAgb3B0aW9ucz86IGJvb2xlYW4gfCBBZGRFdmVudExpc3RlbmVyT3B0aW9ucyB8IHVuZGVmaW5lZFxuICApOiB2b2lkIHtcbiAgICB0aGlzLiN0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcih0eXBlIGFzIHN0cmluZywgY2FsbGJhY2sgYXMgYW55LCBvcHRpb25zKTtcbiAgfVxuXG4gIG9uPEsgZXh0ZW5kcyBrZXlvZiBNPih0eXBlOiBLLCBjYWxsYmFjazogVEN1c3RvbUV2ZW50TGlzdGVuZXI8TSwgSz4pIHtcbiAgICB0aGlzLiNnZXRSZWdzKHR5cGUpLmFkZChjYWxsYmFjayk7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIG9uY2U8SyBleHRlbmRzIGtleW9mIE0+KHR5cGU6IEssIGNhbGxiYWNrOiBUQ3VzdG9tRXZlbnRMaXN0ZW5lcjxNLCBLPikge1xuICAgIGNvbnN0IHJlbW92ZSA9ICgpID0+IHtcbiAgICAgIHRoaXMuI2dldFJlZ3ModHlwZSkuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIHRoaXMuI2dldFJlZ3ModHlwZSkuZGVsZXRlKHJlbW92ZSk7XG4gICAgfTtcblxuICAgIHRoaXMuI2dldFJlZ3ModHlwZSkuYWRkKGNhbGxiYWNrKTtcbiAgICB0aGlzLiNnZXRSZWdzKHR5cGUpLmFkZChyZW1vdmUpO1xuXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrLCB7IG9uY2U6IHRydWUgfSk7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKHR5cGUsIHJlbW92ZSwgeyBvbmNlOiBmYWxzZSB9KTtcbiAgfVxuXG4gIG9mZjxLIGV4dGVuZHMga2V5b2YgTT4odHlwZTogSywgY2FsbGJhY2s/OiBUQ3VzdG9tRXZlbnRMaXN0ZW5lcjxNLCBLPikge1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGNvbnN0IHJlZ3MgPSB0aGlzLiNnZXRSZWdzKHR5cGUpO1xuXG4gICAgICBmb3IgKGNvbnN0IHJlZyBvZiByZWdzKVxuICAgICAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgcmVnKTtcblxuICAgICAgcmV0dXJuIHJlZ3MuY2xlYXIoKTtcbiAgICB9XG5cbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgY2FsbGJhY2spO1xuICB9XG5cbiAgZW1pdDxLIGV4dGVuZHMga2V5b2YgTT4odHlwZTogSywgZGF0YTogTVtLXSkge1xuICAgIHRoaXMuZGlzcGF0Y2hFdmVudCh0eXBlLCBkYXRhKTtcbiAgfVxuXG4gIHJlbW92ZUV2ZW50TGlzdGVuZXI8SyBleHRlbmRzIGtleW9mIE0+KFxuICAgIHR5cGU6IEssXG4gICAgY2FsbGJhY2s6IFRDdXN0b21FdmVudExpc3RlbmVyPE0sIEs+IHwgbnVsbCxcbiAgICBvcHRpb25zPzogYm9vbGVhbiB8IEFkZEV2ZW50TGlzdGVuZXJPcHRpb25zIHwgdW5kZWZpbmVkXG4gICk6IHZvaWQge1xuICAgIHRoaXMuI3RhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUgYXMgc3RyaW5nLCBjYWxsYmFjayBhcyBhbnksIG9wdGlvbnMpO1xuICB9XG5cbiAgZGlzcGF0Y2hFdmVudDxLIGV4dGVuZHMga2V5b2YgTT4odHlwZTogSywgZGF0YTogTVtLXSkge1xuICAgIHRoaXMuI3RhcmdldC5kaXNwYXRjaEV2ZW50KFxuICAgICAgbmV3IEN1c3RvbUV2ZW50PE0sIEs+KHR5cGUsIGRhdGEpXG4gICAgKTtcbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvYm90XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9ib3QvaW5kZXgudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvYm90L2luZGV4LnRzXCI7aW1wb3J0IHsgRXZlbnRzIH0gZnJvbSBcIi4uLy4uL2NvcmUvRXZlbnRzXCI7XG5cbmltcG9ydCB0eXBlIHsgSUV2ZW50c01hcCB9IGZyb20gXCIuLi8uLi9jb3JlL0V2ZW50c1wiO1xuXG5jb25zdCBpc0VuYWJsZSA9IHByb2Nlc3MuZW52LkRJU0NPUkRfSU5GTyA9PT0gJ2VuYWJsZSc7XG5jb25zdCBkaXNjb3JkQ2hhbm5lbCA9IHByb2Nlc3MuZW52LkRJU0NPUkRfQ0hBTk5FTCA/PyBudWxsO1xuY29uc3QgZGlzY29yZFRva2VuID0gcHJvY2Vzcy5lbnYuRElTQ09SRF9UT0tFTiA/PyBudWxsO1xuXG5pbnRlcmZhY2UgSURpc2NvcmRFdmVudHMgZXh0ZW5kcyBJRXZlbnRzTWFwIHtcbiAgY2hhbmdlOiB7XG4gICAgdHlwZTogJ2luJyB8ICdvdXQnLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICB0b3RhbENvdW50OiBudW1iZXI7XG4gIH07XG59XG5cbmV4cG9ydCBjb25zdCBldmVudHMgPSBuZXcgRXZlbnRzPElEaXNjb3JkRXZlbnRzPigpO1xuXG5ldmVudHMub24oJ2NoYW5nZScsICh0eXBlKSA9PiB7XG4gIHR5cGUuZGF0YS5uYW1lO1xufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW4oKSB7XG5cbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL0dhbWUudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvR2FtZS50c1wiO2ltcG9ydCB7IFNvY2tldCB9IGZyb20gXCJzb2NrZXQuaW9cIjtcbmltcG9ydCB7IGNyZWF0ZUxvZ2dlciB9IGZyb20gXCJ2aXRlXCI7XG5cbmltcG9ydCB7IGNhbGNNYXAgfSBmcm9tIFwiLi4vLi4vY29yZS9jYWxjTWFwXCI7XG5pbXBvcnQgeyBlZmZlY3RPYmplY3QgfSBmcm9tIFwiLi4vLi4vY29yZS9lZmZlY3RPYmplY3RcIjtcbmltcG9ydCB7IGZpbmQgfSBmcm9tIFwiLi4vLi4vY29yZS9maW5kXCI7XG5pbXBvcnQgeyBtYXAgfSBmcm9tIFwiLi4vLi4vY29yZS9tYXBcIjtcbmltcG9ydCB7IG1pbiB9IGZyb20gXCIuLi8uLi9jb3JlL21hdGhcIjtcbmltcG9ydCB7IHBpY2sgfSBmcm9tIFwiLi4vLi4vY29yZS9waWNrXCI7XG5pbXBvcnQgeyBwb2ludCB9IGZyb20gXCIuLi8uLi9jb3JlL3BvaW50XCI7XG5pbXBvcnQgeyByYW5kb20gfSBmcm9tIFwiLi4vLi4vY29yZS9yYW5kb21cIjtcbmltcG9ydCB7IFZlYzIgfSBmcm9tIFwiLi4vLi4vY29yZS9WZWMyXCI7XG5pbXBvcnQgeyBNQVhfUExBWUVSUywgV0FJVF9GT1JfTElNSVQsIFpPTkVMSU1JVF9USU1FT1VUIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC9jb25maWdcIjtcbmltcG9ydCB7IEVNYXBJdGVtLCBFU291bmRzIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgSVNfREVWIH0gZnJvbSBcIi4uL2VudlwiO1xuaW1wb3J0IHsgQWNoaXZtZW50IH0gZnJvbSBcIi4vQWNoaXZtZW50XCI7XG5pbXBvcnQgeyBCb21iIH0gZnJvbSBcIi4vQm9tYlwiO1xuaW1wb3J0IHsgRWZmZWN0IH0gZnJvbSBcIi4vRWZmZWN0XCI7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tIFwiLi9FbnRpdHlcIjtcbmltcG9ydCB7IEV4cGxvZGUgfSBmcm9tIFwiLi9FeHBsb2RlXCI7XG5pbXBvcnQgeyBHYW1lTWFwIH0gZnJvbSBcIi4vR2FtZU1hcFwiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vUGxheWVyXCI7XG5cbmNvbnN0IGxvZ2dlciA9IGNyZWF0ZUxvZ2dlcignaW5mbycsIHsgYWxsb3dDbGVhclNjcmVlbjogdHJ1ZSB9KTtcblxuZXhwb3J0IGNvbnN0IGRlZmF1bHRDb25maWcgPSB7XG4gIGZpbGxCbG9ja3M6IC41LFxuICBmaWxsQWNoaXZtZW50czogLjEsXG4gIHN0YXJ0RXhwbG9kZVJhZGl1czogMSxcbiAgc3RhcnRCb21ic0NvdW50OiAxLFxuICBzdGFydExpdmVDb3VudDogMSxcbn07XG5cbmV4cG9ydCBjb25zdCBkZWZhdWx0U3RhcnRQb3NpdGlvbnM6IFZlYzJbXSA9IFtcbiAgcG9pbnQoMCwgMCksXG4gIHBvaW50KDEsIDApLFxuICBwb2ludCgxLCAxKSxcbiAgcG9pbnQoMCwgMSlcbl07XG5cbmV4cG9ydCB0eXBlIFRDb25maWcgPSB0eXBlb2YgZGVmYXVsdENvbmZpZztcblxuZXhwb3J0IGNsYXNzIEdhbWUge1xuICB3aWR0aCA9IDE7XG4gIGhlaWdodCA9IDE7XG5cbiAgI3NldHRpbmdzOiBUQ29uZmlnO1xuICBsYXN0TGltaXQgPSAwO1xuICB0aW1lID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cbiAgbWFwITogR2FtZU1hcDtcbiAgYm9tYnMgPSBuZXcgU2V0PEJvbWI+KCk7XG4gIGV4cGxvZGVzID0gbmV3IFNldDxFeHBsb2RlPigpO1xuICBhY2hpdm1lbnRzID0gbmV3IFNldDxBY2hpdm1lbnQ+KCk7XG4gIHBsYXllcnMgPSBuZXcgU2V0PFBsYXllcj4oKTtcbiAgZWZmZWN0cyA9IG5ldyBTZXQ8RWZmZWN0PigpO1xuICBuZXh0U2l6ZSA9IG5ldyBWZWMyKCk7XG5cbiAgc3RhcnRQb3NpdGlvbnM6IFZlYzJbXSA9IFtdO1xuICB1c2VkUG9zaXRpb25zID0gbmV3IFNldDxWZWMyPigpO1xuXG4gIHJ1bm5pbmcgPSBmYWxzZTtcbiAgd2luUGxheWVySWQ6IFBsYXllclsnaWQnXSA9IC0xO1xuXG4gIHdhaXRGb3JSZXN0YXJ0ID0gLTE7XG5cbiAgYm9tYnNDb3VudGVyITogbnVtYmVyO1xuICBleHBsb2Rlc0NvdW50ZXIhOiBudW1iZXI7XG4gIGFjaGl2bWVudHNDb3VudGVyITogbnVtYmVyO1xuICBlZmZlY3RzQ291bnRlciE6IG51bWJlcjtcbiAgc2xvdExpbWl0cyA9IE1BWF9QTEFZRVJTO1xuXG4gIHRpbWVyTGltaXQgPSAtMTtcbiAgbGltaXRlZE1hcCA9IDE7XG5cbiAgaXNIYXZlV2luID0gZmFsc2U7XG4gIGtpbGxzID0gMDtcblxuICBpbmZvQ2FjaGU6IEdhbWVbJ2luZm8nXSA9IHRoaXMuaW5mbztcbiAgbWFwQ2FjaGU6IG51bWJlcltdID0gW107XG4gIGJvbWJzQ2FjaGU6IEJvbWJbJ2luZm8nXVtdID0gW107XG4gIGV4cGxvZGVzQ2FoY2U6IEV4cGxvZGVbJ2luZm8nXVtdID0gW107XG4gIGFjaGl2bWVudHNDYWNoZTogQWNoaXZtZW50WydpbmZvJ11bXSA9IFtdO1xuICBlZmZlY3RzQ2FjaGU6IEVmZmVjdFsnaW5mbyddW10gPSBbXTtcbiAgZWZmZWN0c1R5cGVDYWNoZTogRWZmZWN0WydpbmZvVHlwZSddW10gPSBbXTtcblxuICBnZXQgY3VycmVudExpbWl0ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMudGltZXJMaW1pdCA+IDAgPyB0aGlzLmxpbWl0ZWRNYXAgOiAtMTtcbiAgfVxuXG4gIGdldCBpbmZvKCkge1xuICAgIHJldHVybiBwaWNrKHRoaXMsIFtcbiAgICAgICd3aWR0aCcsXG4gICAgICAnaGVpZ2h0JyxcbiAgICAgICd3aW5QbGF5ZXJJZCcsXG4gICAgICAncGxheWVyc0NvdW50JyxcbiAgICAgICdsaXZlUGxheWVyc0NvdW50JyxcbiAgICAgICdzcGVjdHJhdG9yc0NvdW50JyxcbiAgICAgICdjdXJyZW50TGltaXRlZCcsXG4gICAgXSk7XG4gIH1cblxuICBnZXRGcmVlUG9zaXRpb24oKSB7XG4gICAgY29uc3QgZnJlZSA9IEFycmF5LmZyb20odGhpcy5zdGFydFBvc2l0aW9ucylcbiAgICAgIC5maWx0ZXIoZSA9PiAhdGhpcy51c2VkUG9zaXRpb25zLmhhcyhlKSk7XG4gICAgY29uc3QgcG9zaXRpb24gPSByYW5kb20oZnJlZSk7XG4gICAgdGhpcy51c2VkUG9zaXRpb25zLmFkZChwb3NpdGlvbik7XG4gICAgcmV0dXJuIHBvc2l0aW9uO1xuICB9XG5cbiAgcmVsZWFzZVBvc2l0aW9uKHBvc2l0aW9uOiBWZWMyKSB7XG4gICAgdGhpcy51c2VkUG9zaXRpb25zLmRlbGV0ZShwb3NpdGlvbik7XG4gIH1cblxuICBnZXQgc3BlY3RyYXRvcnNDb3VudCgpIHsgcmV0dXJuIG1hcCh0aGlzLnBsYXllcnMsIGUgPT4gZSwgZSA9PiAhZS5pbkdhbWUpLmxlbmd0aDsgfVxuICBnZXQgcGxheWVyc0NvdW50KCkgeyByZXR1cm4gbWFwKHRoaXMucGxheWVycywgZSA9PiBlLCBlID0+IGUuaW5HYW1lKS5sZW5ndGg7IH1cbiAgZ2V0IGxpdmVQbGF5ZXJzQ291bnQoKSB7IHJldHVybiBtYXAodGhpcy5wbGF5ZXJzLCBlID0+IGUsIGUgPT4gZS5pbkdhbWUgJiYgIWUuaXNEZWF0aCkubGVuZ3RoOyB9XG5cbiAgZ2V0IHNldHRpbmdzKCkge1xuICAgIHJldHVybiB7IC4uLnRoaXMuI3NldHRpbmdzIH07XG4gIH1cblxuICBjb25zdHJ1Y3RvcihcbiAgICBzZXR0aW5ncz86IFBhcnRpYWw8VENvbmZpZz5cbiAgKSB7XG4gICAgdGhpcy4jc2V0dGluZ3MgPSB7IC4uLmRlZmF1bHRDb25maWcsIC4uLnNldHRpbmdzIH07XG4gICAgdGhpcy5yZXN0YXJ0KCk7XG4gIH1cblxuICByZXN0YXJ0KCkge1xuICAgIGNvbnN0IHsgc2l6ZSwgcG9zaXRpb25zIH0gPSBjYWxjTWFwKHRoaXMucGxheWVyc0NvdW50KTtcblxuICAgIHRoaXMuaXNIYXZlV2luID0gdGhpcy5wbGF5ZXJzQ291bnQgPiAxO1xuXG4gICAgaWYgKCFzaXplLmVxdWFsKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KSkge1xuICAgICAgdGhpcy53aWR0aCA9IHNpemUueDtcbiAgICAgIHRoaXMuaGVpZ2h0ID0gc2l6ZS55O1xuICAgICAgdGhpcy5zdGFydFBvc2l0aW9ucyA9IHBvc2l0aW9ucztcbiAgICAgIHRoaXMubWVzc2FnZSgnXHUwNDIwXHUwNDMwXHUwNDM3XHUwNDNDXHUwNDM1XHUwNDQwIFx1MDQzQVx1MDQzMFx1MDQ0MFx1MDQ0Mlx1MDQ0QiBcdTA0MzFcdTA0NEJcdTA0M0IgXHUwNDM4XHUwNDM3XHUwNDNDXHUwNDM1XHUwNDNEXHUwNDM1XHUwNDNEJyk7XG4gICAgfVxuXG4gICAgdGhpcy53YWl0Rm9yUmVzdGFydCA9IC0xO1xuXG4gICAgZm9yIChjb25zdCBwbGF5ZXIgb2YgdGhpcy5wbGF5ZXJzKSB7XG4gICAgICBpZiAoIXBsYXllci5pbkdhbWUpIGNvbnRpbnVlO1xuICAgICAgcGxheWVyLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgdGhpcy5ib21icy5jbGVhcigpO1xuICAgIHRoaXMuYWNoaXZtZW50cy5jbGVhcigpO1xuICAgIHRoaXMuZXhwbG9kZXMuY2xlYXIoKTtcbiAgICB0aGlzLmVmZmVjdHMuY2xlYXIoKTtcbiAgICB0aGlzLm1hcCA9IG5ldyBHYW1lTWFwKHRoaXMpO1xuICAgIHRoaXMubWFwLmdlbmVyYXRlKHRoaXMuc2V0dGluZ3MpO1xuXG4gICAgdGhpcy53aW5QbGF5ZXJJZCA9IC0xO1xuICAgIHRoaXMuYm9tYnNDb3VudGVyID0gMDtcbiAgICB0aGlzLmVmZmVjdHNDb3VudGVyID0gMDtcbiAgICB0aGlzLmV4cGxvZGVzQ291bnRlciA9IDA7XG4gICAgdGhpcy5hY2hpdm1lbnRzQ291bnRlciA9IDA7XG4gICAgdGhpcy5raWxscyA9IDA7XG4gICAgdGhpcy5saW1pdGVkTWFwID0gMTtcbiAgICB0aGlzLnRpbWVyTGltaXQgPSAtMTtcbiAgICB0aGlzLmxhc3RMaW1pdCA9IERhdGUubm93KCk7XG4gIH1cblxuICBtZXNzYWdlKG1lc3NhZ2U6IHN0cmluZywgc2VuZGVyPzogUGxheWVyKSB7XG4gICAgaWYgKElTX0RFVikge1xuICAgICAgY29uc3QgZmluZCA9IC8oXFxkKyl4KFxcZCspLy5leGVjKG1lc3NhZ2UpO1xuICAgICAgaWYgKGZpbmQpIHtcbiAgICAgICAgY29uc3QgWywgd2lkdGgsIGhlaWdodF0gPSBmaW5kO1xuICAgICAgICB0aGlzLm5leHRTaXplLnNldCgrd2lkdGgsICtoZWlnaHQpO1xuICAgICAgICB0aGlzLndhaXRGb3JSZXN0YXJ0ID0gMzAwMDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHBsYXllciBvZiB0aGlzLnBsYXllcnMpIHtcbiAgICAgIHBsYXllci5uZXdBcGkucGxheVNvdW5kKEVTb3VuZHMubWVzc2FnZSk7XG5cbiAgICAgIHBsYXllci5uZXdBcGkub25NZXNzYWdlKHtcbiAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgc2VuZGVyOiBzZW5kZXIgaW5zdGFuY2VvZiBQbGF5ZXIgPyAoeyBuYW1lOiBzZW5kZXIubmFtZSB9KSA6ICh7IG5hbWU6ICdAc2VydmVyJyB9KSxcbiAgICAgICAgaXNNZTogc2VuZGVyID09PSBwbGF5ZXJcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGpvaW4oc29ja2V0OiBTb2NrZXQpIHtcbiAgICBsZXQgcGxheWVyID0gZmluZCh0aGlzLnBsYXllcnMsIHsgc29ja2V0IH0pO1xuICAgIGlmIChwbGF5ZXIpIHJldHVybjtcbiAgICBwbGF5ZXIgPSBuZXcgUGxheWVyKHRoaXMsIHNvY2tldCk7XG4gICAgcGxheWVyLmNvbm5lY3QoKTtcbiAgICB0aGlzLnBsYXllcnMuYWRkKHBsYXllcik7XG4gICAgdGhpcy5zdGFydCgpO1xuICB9XG5cbiAgbGVhdmUoc29ja2V0OiBTb2NrZXQpIHtcbiAgICBjb25zdCBwbGF5ZXIgPSBmaW5kKHRoaXMucGxheWVycywgeyBzb2NrZXQgfSk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcbiAgICB0aGlzLnBsYXllcnMuZGVsZXRlKHBsYXllcik7XG4gICAgcGxheWVyLmRpc2Nvbm5lY3QoKTtcbiAgICBpZiAoIXRoaXMucGxheWVycy5zaXplKVxuICAgICAgdGhpcy5zdG9wKCk7XG4gIH1cblxuICBzdGFydCgpIHtcbiAgICBpZiAodGhpcy5ydW5uaW5nKSByZXR1cm47XG4gICAgdGhpcy5ydW5uaW5nID0gdHJ1ZTtcbiAgICBsb2dnZXIuaW5mbygnR2FtZSBzdGFydGluZycsIHsgdGltZXN0YW1wOiB0cnVlIH0pO1xuICAgIHRoaXMucmVzdGFydCgpO1xuICAgIHRoaXMubG9vcCgpXG4gICAgICAuY2F0Y2goY29uc29sZS5lcnJvcik7XG4gIH1cblxuICBzdG9wKCkge1xuICAgIGlmICghdGhpcy5ydW5uaW5nKSByZXR1cm47XG4gICAgbG9nZ2VyLmluZm8oJ0dhbWUgc3RvcGluZycsIHsgdGltZXN0YW1wOiB0cnVlIH0pO1xuICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICB9XG5cbiAgYXN5bmMgbG9vcCgpIHtcbiAgICBjb25zdCB0aWNrID0gKCkgPT4ge1xuICAgICAgaWYgKHRoaXMucnVubmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KHRpY2ssIDEwMDAgLyAzMCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgcGxheWVycywgcGxheWVyc0NvdW50IH0gPSB0aGlzO1xuICAgICAgY29uc3QgdGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgY29uc3QgZHRpbWUgPSB0aW1lIC0gdGhpcy50aW1lO1xuICAgICAgdGhpcy50aW1lID0gdGltZTtcblxuICAgICAgZWZmZWN0T2JqZWN0KFxuICAgICAgICB0aGlzLFxuICAgICAgICAncGxheWVyc0NvdW50JyxcbiAgICAgICAgdGhpcy5wbGF5ZXJzQ291bnQsXG4gICAgICAgIGNvdW50ID0+IHtcbiAgICAgICAgICBsb2dnZXIuaW5mbygnUGxheWVycyBjb3VudCAnICsgY291bnQsIHsgdGltZXN0YW1wOiB0cnVlIH0pO1xuXG4gICAgICAgICAgaWYgKHRoaXMuaXNIYXZlV2luICYmIGNvdW50IDwgMiAmJiAhdGhpcy5raWxscylcbiAgICAgICAgICAgIHRoaXMuaXNIYXZlV2luID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIGZvciAoY29uc3QgYm9tYiBvZiB0aGlzLmJvbWJzIGFzIFNldDxFbnRpdHk+KSB7XG4gICAgICAgIGJvbWIudXBkYXRlKGR0aW1lLCB0aW1lKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBleHBsb2RlIG9mIHRoaXMuZWZmZWN0cyBhcyBTZXQ8RW50aXR5Pikge1xuICAgICAgICBleHBsb2RlLnVwZGF0ZShkdGltZSwgdGltZSk7XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgZXhwbG9kZSBvZiB0aGlzLmV4cGxvZGVzIGFzIFNldDxFbnRpdHk+KSB7XG4gICAgICAgIGV4cGxvZGUudXBkYXRlKGR0aW1lLCB0aW1lKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBhY2hpdm1lbnQgb2YgdGhpcy5hY2hpdm1lbnRzIGFzIFNldDxFbnRpdHk+KSB7XG4gICAgICAgIGFjaGl2bWVudC51cGRhdGUoZHRpbWUsIHRpbWUpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IHBsYXllciBvZiB0aGlzLnBsYXllcnMgYXMgU2V0PEVudGl0eT4pIHtcbiAgICAgICAgcGxheWVyLnVwZGF0ZShkdGltZSwgdGltZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMubWFwQ2FjaGUgPSBbLi4udGhpcy5tYXBdO1xuICAgICAgdGhpcy5pbmZvQ2FjaGUgPSB0aGlzLmluZm87XG4gICAgICB0aGlzLmJvbWJzQ2FjaGUgPSBbLi4udGhpcy5ib21ic10ubWFwKGUgPT4gZS5pbmZvKTtcbiAgICAgIHRoaXMuYWNoaXZtZW50c0NhY2hlID0gWy4uLnRoaXMuYWNoaXZtZW50c107XG4gICAgICB0aGlzLmV4cGxvZGVzQ2FoY2UgPSBbLi4udGhpcy5leHBsb2Rlc107XG4gICAgICB0aGlzLmVmZmVjdHNDYWNoZSA9IFsuLi50aGlzLmVmZmVjdHNdO1xuICAgICAgdGhpcy5lZmZlY3RzVHlwZUNhY2hlID0gbWFwKHRoaXMuZWZmZWN0cywgZSA9PiBlLmluZm9UeXBlKTtcblxuICAgICAgZm9yIChjb25zdCBwbGF5ZXIgb2YgdGhpcy5wbGF5ZXJzKSB7XG4gICAgICAgIHBsYXllci5zZW5kSW5mbygpO1xuICAgICAgfVxuXG4gICAgICBlZmZlY3RPYmplY3QoXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdyZXN0YXJ0R2FtZScsXG4gICAgICAgIHBsYXllcnNDb3VudCAmJiB0aGlzLmxpdmVQbGF5ZXJzQ291bnQgPD0gKyEhKHBsYXllcnNDb3VudCAtIDEpICYmICF0aGlzLmV4cGxvZGVzLnNpemUgJiYgIXRoaXMuYm9tYnMuc2l6ZSxcbiAgICAgICAgKGlzUmVzdGFydCkgPT4ge1xuICAgICAgICAgIGlmIChpc1Jlc3RhcnQpIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKFwiV2FpdCByZXN0YXJ0XCIsIHsgdGltZXN0YW1wOiB0cnVlIH0pO1xuICAgICAgICAgICAgdGhpcy53YWl0Rm9yUmVzdGFydCA9IERhdGUubm93KCkgKyAoSVNfREVWIHx8IHBsYXllcnNDb3VudCA9PSAxID8gMCA6IDUwMDApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy53YWl0Rm9yUmVzdGFydCA+IDApIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oXCJDYW5jZWwgcmVzdGFydFwiLCB7IHRpbWVzdGFtcDogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMud2FpdEZvclJlc3RhcnQgPSAtMTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIGlmICh0aGlzLmlzSGF2ZVdpbiAmJiB0aGlzLmxpdmVQbGF5ZXJzQ291bnQgPCAyICYmICF0aGlzLmV4cGxvZGVzLnNpemUgJiYgIXRoaXMuYm9tYnMuc2l6ZSkge1xuICAgICAgICBjb25zdCB3aW5QbGF5ZXIgPSBmaW5kKHRoaXMucGxheWVycywgZSA9PiBlLmluR2FtZSAmJiAhZS5pc0RlYXRoKTtcbiAgICAgICAgaWYgKHdpblBsYXllcikge1xuICAgICAgICAgIHdpblBsYXllci53aW5zKys7XG4gICAgICAgICAgd2luUGxheWVyLm5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy53aW4pO1xuICAgICAgICAgIHRoaXMud2luUGxheWVySWQgPSB3aW5QbGF5ZXIuaWQ7XG4gICAgICAgICAgdGhpcy5tZXNzYWdlKGAke3dpblBsYXllci5uYW1lfSBcdTA0M0ZcdTA0M0VcdTA0MzFcdTA0MzVcdTA0MzRcdTA0MzhcdTA0M0JgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm1lc3NhZ2UoYFx1MDQxRFx1MDQzOFx1MDQzQVx1MDQ0Mlx1MDQzRSBcdTA0M0RcdTA0MzUgXHUwNDMyXHUwNDRCXHUwNDM4XHUwNDMzXHUwNDQwXHUwNDMwXHUwNDNCYCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pc0hhdmVXaW4gPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMud2FpdEZvclJlc3RhcnQgPiAwKSB7XG4gICAgICAgIGlmIChEYXRlLm5vdygpID4gdGhpcy53YWl0Rm9yUmVzdGFydCArIDUwMCkge1xuICAgICAgICAgIGxvZ2dlci5pbmZvKFwiUmVzdGFydFwiLCB7IHRpbWVzdGFtcDogdHJ1ZSB9KTtcbiAgICAgICAgICB0aGlzLnJlc3RhcnQoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBlZmZlY3RPYmplY3QoXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdjbGVhck1hcCcsXG4gICAgICAgIHRoaXMubWFwLmZpbmRJbmRleChlID0+IGUgPT0gRU1hcEl0ZW0uQkxPQ0spID09IC0xICYmIHBsYXllcnNDb3VudCA8PSAxICYmIHRoaXMuYWNoaXZtZW50cy5zaXplID09PSAwICYmIHRoaXMud2FpdEZvclJlc3RhcnQgPT09IC0xLFxuICAgICAgICAodmFsdWUpID0+IHtcbiAgICAgICAgICBsb2dnZXIuaW5mbyhgQ2hhbmdlIHZhbHVlICR7dmFsdWV9YCwgeyB0aW1lc3RhbXA6IHRydWUgfSk7XG4gICAgICAgICAgaWYgKHZhbHVlKVxuICAgICAgICAgICAgdGhpcy53YWl0Rm9yUmVzdGFydCA9IERhdGUubm93KCk7XG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIGVmZmVjdE9iamVjdChcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ2xpbWl0TWFwJyxcbiAgICAgICAgKFxuICAgICAgICAgIHRydWVcbiAgICAgICAgICAmJiB0aGlzLmxhc3RMaW1pdCArIFdBSVRfRk9SX0xJTUlUIDwgRGF0ZS5ub3coKVxuICAgICAgICAgICYmIHRoaXMud2FpdEZvclJlc3RhcnQgPT0gLTFcbiAgICAgICAgICAmJiB0aGlzLnBsYXllcnNDb3VudCA+IDFcbiAgICAgICAgICAmJiB0aGlzLmxpbWl0ZWRNYXAgPCAobWluKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KSAvIDIpXG4gICAgICAgICksXG4gICAgICAgICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIGlmICh2YWx1ZSAmJiB0aGlzLnRpbWVyTGltaXQgPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMudGltZXJMaW1pdCA9IERhdGUubm93KCkgKyBaT05FTElNSVRfVElNRU9VVDtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZShgXHUwNDIzXHUwNDNDXHUwNDM1XHUwNDNEXHUwNDRDXHUwNDQ4XHUwNDM1XHUwNDNEXHUwNDM4XHUwNDM1IFx1MDQ0MFx1MDQzMFx1MDQzN1x1MDQzQ1x1MDQzNVx1MDQ0MFx1MDQzMCBcdTA0M0FcdTA0MzBcdTA0NDBcdTA0NDJcdTA0NEIgXHUwNDQ3XHUwNDM1XHUwNDQwXHUwNDM1XHUwNDM3ICR7Wk9ORUxJTUlUX1RJTUVPVVQgLyAxMDAwIHwgMH0gXHUwNDQxXHUwNDM1XHUwNDNBYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghdmFsdWUgJiYgdGhpcy50aW1lckxpbWl0ID4gMCkge1xuICAgICAgICAgICAgdGhpcy50aW1lckxpbWl0ID0gLTE7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2UoYFx1MDQyM1x1MDQzQ1x1MDQzNVx1MDQzRFx1MDQ0Q1x1MDQ0OFx1MDQzNVx1MDQzRFx1MDQzOFx1MDQzNSBcdTA0NDBcdTA0MzBcdTA0MzdcdTA0M0NcdTA0MzVcdTA0NDBcdTA0MzAgXHUwNDNBXHUwNDMwXHUwNDQwXHUwNDQyXHUwNDRCIFx1MDQzRVx1MDQ0Mlx1MDQzQ1x1MDQzNVx1MDQzRFx1MDQzNVx1MDQzRFx1MDQzRWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgZWZmZWN0T2JqZWN0KFxuICAgICAgICB0aGlzLFxuICAgICAgICAnbGltaXRNYXBFeGVjJyxcbiAgICAgICAgdGhpcy50aW1lckxpbWl0ID4gMCAmJiB0aGlzLnRpbWVyTGltaXQgPCBEYXRlLm5vdygpLFxuICAgICAgICAodmFsdWUpID0+IHtcbiAgICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMubGFzdExpbWl0ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgIHRoaXMudGltZXJMaW1pdCA9IC0xO1xuICAgICAgICAgICAgdGhpcy5tYXAubGltaXQodGhpcy5saW1pdGVkTWFwKyspO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgdGljaygpO1xuICB9XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS90b0xpbWl0LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS90b0xpbWl0LnRzXCI7ZXhwb3J0IGNvbnN0IHRvTGltaXQgPSAobjogbnVtYmVyLCBtaW4gPSAtSW5maW5pdHksIG1heCA9IEluZmluaXR5KSA9PiB7XG4gIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChuLCBtaW4pLCBtYXgpO1xufTsiLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL2NhbGNNYXAudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL2NhbGNNYXAudHNcIjtpbXBvcnQgeyBjZWlsLCBmbG9vciB9IGZyb20gXCIuL21hdGhcIjtcbmltcG9ydCB7IHBvaW50IH0gZnJvbSBcIi4vcG9pbnRcIjtcbmltcG9ydCB7IHRvTGltaXQgfSBmcm9tIFwiLi90b0xpbWl0XCI7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSBcIi4vVmVjMlwiO1xuXG5jb25zdCBQQURESU5HID0gNjtcbmNvbnN0IE1BUkdJTiA9IDg7XG5cbmV4cG9ydCBjb25zdCBjYWxjTWFwID0gKHBsYXllcnMgPSAwKSA9PiB7XG4gIHBsYXllcnMgPSB0b0xpbWl0KHBsYXllcnMsIDEpO1xuXG4gIGxldCB3aWR0aCA9IDA7XG4gIGxldCBoZWlnaHQgPSAwO1xuICBsZXQgaW50ZXJuYWwgPSAwO1xuXG4gIGNvbnN0IHBvc2l0aW9uczogVmVjMltdID0gW107XG5cbiAgZG8ge1xuICAgIGludGVybmFsICs9IC41O1xuICAgIHdpZHRoID0gY2VpbChpbnRlcm5hbCk7XG4gICAgaGVpZ2h0ID0gZmxvb3IoaW50ZXJuYWwpO1xuICB9IHdoaWxlICh3aWR0aCAqIGhlaWdodCA8IHBsYXllcnMpO1xuXG4gIGxldCBweCA9IFBBRERJTkc7XG4gIGxldCBweSA9IFBBRERJTkc7XG5cbiAgaWYgKHBsYXllcnMgPiAxKSBweCA9IDI7XG4gIGlmIChwbGF5ZXJzID4gMikgcHkgPSAyO1xuXG4gIGxldCBtID0gTUFSR0lOICsgUEFERElORztcblxuICBmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7XG4gICAgZm9yIChsZXQgeCA9IDA7IHggPCB3aWR0aDsgeCsrKSB7XG4gICAgICBwb3NpdGlvbnMucHVzaChcbiAgICAgICAgcG9pbnQoXG4gICAgICAgICAgcHggKyBtICogeCxcbiAgICAgICAgICBweSArIG0gKiB5XG4gICAgICAgIClcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzaXplOiBwb2ludChcbiAgICAgIDIgKiBweCArIG0gKiAod2lkdGggLSAxKSArIDEsXG4gICAgICAyICogcHkgKyBtICogKGhlaWdodCAtIDEpICsgMSxcbiAgICApLFxuICAgIHBvc2l0aW9uc1xuICB9O1xufTsiLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL21ha2VFZmZlY3QudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL21ha2VFZmZlY3QudHNcIjtpbXBvcnQgZXF1YWwgZnJvbSBcImZhc3QtZGVlcC1lcXVhbFwiO1xuXG5pbXBvcnQgeyBpc0VxdWFsQnVmZmVyIH0gZnJvbSBcIi4vaXNFcXVhbEJ1ZmZlclwiO1xuXG5leHBvcnQgY29uc3QgbWFrZUVmZmVjdCA9IDxUPigpID0+IHtcbiAgbGV0IHByZXZpZXdWYWx1ZTogVCB8IG51bGwgPSBudWxsO1xuXG4gIHJldHVybiAobmV3VmFsdWU6IFQsIGNhbGxiYWNrOiAodmFsdWU6IFQsIHByZXZpZXdWYWx1ZTogVCB8IG51bGwpID0+IGFueSkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciAmJiBwcmV2aWV3VmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgICBpZiAoaXNFcXVhbEJ1ZmZlcihwcmV2aWV3VmFsdWUsIG5ld1ZhbHVlKSlcbiAgICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoZXF1YWwocHJldmlld1ZhbHVlLCBuZXdWYWx1ZSkpXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcblxuICAgICAgY2FsbGJhY2sobmV3VmFsdWUsIHByZXZpZXdWYWx1ZSk7XG4gICAgICBwcmV2aWV3VmFsdWUgPSBuZXdWYWx1ZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhuZXdWYWx1ZSwgcHJldmlld1ZhbHVlKTtcbiAgICBwcmV2aWV3VmFsdWUgPSBuZXdWYWx1ZTtcbiAgfTtcbn07IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9pc0VxdWFsQnVmZmVyLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9pc0VxdWFsQnVmZmVyLnRzXCI7ZXhwb3J0IGNvbnN0IGlzRXF1YWxCdWZmZXIgPSAoYnVmZmVyMTogQXJyYXlCdWZmZXIsIGJ1ZmZlcjI6IEFycmF5QnVmZmVyKSA9PiB7XG4gIGNvbnN0IGRhdGExID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyMSk7XG4gIGNvbnN0IGRhdGEyID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyMik7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhMS5sZW5ndGg7IGkrKylcbiAgICBpZiAoZGF0YTFbaV0gIT09IGRhdGEyW2ldKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gIHJldHVybiB0cnVlO1xufTsgIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9lZmZlY3RPYmplY3QudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL2VmZmVjdE9iamVjdC50c1wiO2ltcG9ydCB7IG1ha2VFZmZlY3QgfSBmcm9tIFwiLi9tYWtlRWZmZWN0XCI7XG5cbmNvbnN0IFNZTUJPTFNfTUFQID0gbmV3IE1hcDxzdHJpbmcsIHN5bWJvbD47XG5cbmZ1bmN0aW9uIGdldFN5bWJvbChrZXk6IHN0cmluZyk6IHN5bWJvbCB7XG4gIHJldHVybiBTWU1CT0xTX01BUC5nZXQoa2V5KSA/PyAoXG4gICAgU1lNQk9MU19NQVAuc2V0KGtleSwgU3ltYm9sKGtleSkpLFxuICAgIFNZTUJPTFNfTUFQLmdldChrZXkpIVxuICApO1xufVxuXG5leHBvcnQgY29uc3QgZWZmZWN0T2JqZWN0ID0gPFQ+KFxuICB0YXJnZXQ6IGFueSxcbiAga2V5OiBzdHJpbmcsXG4gIG5ld1ZhbHVlOiBULFxuICBjYWxsYmFjazogKHZhbHVlOiBUKSA9PiBhbnlcbikgPT4ge1xuICBjb25zdCBzeW1ib2wgPSBnZXRTeW1ib2woa2V5KTtcbiAgY29uc3QgZWZmZWN0OiBSZXR1cm5UeXBlPHR5cGVvZiBtYWtlRWZmZWN0PFQ+PiA9IChcbiAgICB0YXJnZXRbc3ltYm9sXSA/PyAoXG4gICAgICB0YXJnZXRbc3ltYm9sXSA9IG1ha2VFZmZlY3QoKVxuICAgIClcbiAgKTtcbiAgZWZmZWN0KG5ld1ZhbHVlLCBjYWxsYmFjayk7XG59OyIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvZmluZC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvZmluZC50c1wiO2V4cG9ydCBmdW5jdGlvbiBmaW5kPFQgZXh0ZW5kcyBvYmplY3Q+KGNvbGxlY3Q6IFNldDxUPiB8IFRbXSwgY29uZGl0aW9uOiBQYXJ0aWFsPFQ+IHwgKCh2OiBULCBpOiBudW1iZXIpID0+IGJvb2xlYW4pKSB7XG4gIGlmICh0eXBlb2YgY29uZGl0aW9uID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IGRhdGEgPSBjb25kaXRpb247XG5cbiAgICBjb25kaXRpb24gPSAob2JqZWN0KSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGtleSBpbiBkYXRhKSB7XG4gICAgICAgIGlmIChkYXRhW2tleV0gIT09IG9iamVjdFtrZXldKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbiAgfVxuXG4gIGxldCBpID0gMDtcblxuICBmb3IgKGNvbnN0IGYgb2YgY29sbGVjdCkge1xuICAgIGlmIChjb25kaXRpb24oZiwgaSsrKSlcbiAgICAgIHJldHVybiBmO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9tYWtlUGlja2VyLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9tYWtlUGlja2VyLnRzXCI7ZXhwb3J0IGNvbnN0IG1ha2VQaWNrZXIgPSA8VCBleHRlbmRzIG9iamVjdCwgSyBleHRlbmRzIGtleW9mIFQgPSBrZXlvZiBUPihcbiAga2V5czogS1tdXG4pID0+IHtcbiAgcmV0dXJuIG5ldyBGdW5jdGlvbihcbiAgICAnb2JqJyxcbiAgICAncmV0dXJuIHsnICtcbiAgICBrZXlzLm1hcChrZXkgPT4gKFxuICAgICAgYCR7a2V5LnRvU3RyaW5nKCl9OiBvYmpbJyR7a2V5LnRvU3RyaW5nKCl9J11gXG4gICAgKSkuam9pbignLCAnKSArXG4gICAgJ307J1xuICApIGFzICgob2JqOiBUKSA9PiBQaWNrPFQsIEs+KTtcbn07IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9waWNrLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9waWNrLnRzXCI7aW1wb3J0IHsgbWFrZVBpY2tlciB9IGZyb20gXCIuL21ha2VQaWNrZXJcIjtcblxuY29uc3QgQ0FDSEUgPSBuZXcgTWFwPHN0cmluZywgRnVuY3Rpb24+O1xuXG5leHBvcnQgY29uc3QgcGljayA9IDxUIGV4dGVuZHMgb2JqZWN0LCBTIGV4dGVuZHMga2V5b2YgVD4oXG4gIHRhcmdldDogVCxcbiAga2V5czogU1tdXG4pOiBQaWNrPFQsIFM+ID0+IHtcbiAgY29uc3QgS0VZID0ga2V5cy5qb2luKCcsJyk7XG4gIGxldCBwaWNrZXIgPSBDQUNIRS5nZXQoS0VZKTtcblxuICBpZiAoIXBpY2tlcikge1xuICAgIHBpY2tlciA9IG1ha2VQaWNrZXI8VD4oa2V5cyk7XG4gICAgQ0FDSEUuc2V0KEtFWSwgcGlja2VyKTtcbiAgfVxuXG4gIHJldHVybiBwaWNrZXIodGFyZ2V0KTtcbn07IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9tYXAudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL21hcC50c1wiO2ltcG9ydCB7IHBpY2sgfSBmcm9tIFwiLi9waWNrXCI7XG5cbmV4cG9ydCBjb25zdCBtYXAgPSA8VCBleHRlbmRzIG9iamVjdCwgUyBleHRlbmRzIGtleW9mIFQsIEQgPSBQaWNrPFQsIFM+PihcbiAgY29sbGVjdDogVFtdIHwgU2V0PFQ+LFxuICBmdW5jOiAoKHY6IFQsIGk6IG51bWJlcikgPT4gRCkgfCAoU1tdKSxcbiAgZmlsdGVyPzogKHNvdXJjZTogVCwgdGFyZ2V0OiBEKSA9PiBhbnlcbikgPT4ge1xuICBjb25zdCBvdXRwdXQ6IERbXSA9IFtdO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KGZ1bmMpKSB7XG4gICAgY29uc3Qga2V5cyA9IGZ1bmM7XG5cbiAgICBmdW5jID0gcGljazxULCBTPiBhcyAodjogVCkgPT4gRDtcbiAgfVxuXG4gIGxldCBpbmRleCA9IDA7XG5cbiAgZm9yIChjb25zdCBpdGVtIG9mIGNvbGxlY3QpIHtcbiAgICBjb25zdCB0YXJnZXQgPSBmdW5jKGl0ZW0sIGluZGV4KyspO1xuXG4gICAgaWYgKCFmaWx0ZXIgfHwgZmlsdGVyKGl0ZW0sIHRhcmdldCkpXG4gICAgICBvdXRwdXQucHVzaCh0YXJnZXQpO1xuICB9XG5cbiAgcmV0dXJuIG91dHB1dDtcbn07IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9yYW5kb20udHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlL3JhbmRvbS50c1wiO2V4cG9ydCBjb25zdCByYW5kb20gPSA8VD4oY29sbGVjdDogVFtdKSA9PiB7XG4gIHJldHVybiBjb2xsZWN0W2NvbGxlY3QubGVuZ3RoICogTWF0aC5yYW5kb20oKSB8IDBdO1xufTsiLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9lbnYudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvZW52LnRzXCI7ZXhwb3J0IGNvbnN0IElTX0RFViA9IHByb2Nlc3MuZW52WyducG1fbGlmZWN5Y2xlX2V2ZW50J10gPT09ICdkZXYnOyIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL1BsYXllci50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9QbGF5ZXIudHNcIjtpbXBvcnQgeyBTb2NrZXQgfSBmcm9tIFwic29ja2V0LmlvXCI7XG5cbmltcG9ydCB7IGNhbGNTcGVlZCB9IGZyb20gXCIuLi8uLi9jb3JlL2NhbGNTcGVlZFwiO1xuaW1wb3J0IHsgZWZmZWN0T2JqZWN0IH0gZnJvbSBcIi4uLy4uL2NvcmUvZWZmZWN0T2JqZWN0XCI7XG5pbXBvcnQgeyBGRGF0ZSB9IGZyb20gXCIuLi8uLi9jb3JlL0ZEYXRlXCI7XG5pbXBvcnQgeyBmaW5kIH0gZnJvbSBcIi4uLy4uL2NvcmUvZmluZFwiO1xuaW1wb3J0IHsgbWFwIH0gZnJvbSBcIi4uLy4uL2NvcmUvbWFwXCI7XG5pbXBvcnQgeyByYW5kb20sIHJlbSwgcm91bmQgfSBmcm9tIFwiLi4vLi4vY29yZS9tYXRoXCI7XG5pbXBvcnQgeyBwaWNrIH0gZnJvbSBcIi4uLy4uL2NvcmUvcGlja1wiO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gXCIuLi8uLi9jb3JlL1ZlYzJcIjtcbmltcG9ydCB7IGdhbWVBcGksIHBsYXllckFwaSB9IGZyb20gXCIuLi8uLi9zaGFyZWQvYXBpXCI7XG5pbXBvcnQge1xuICBDVVNUT01fU0tJTlNfQ09VTlQsIE1FU1NBR0VfTEVOR1RILCBOSUNLX0xFTkdUSCwgUExBWUVSX1RJTUVPVVQsIFNLSU5TX0NPVU5ULCBURVNUX0FETUlOX0lQLFxuICBUSU1FT1VUX01FU1NBR0UsIFRJTUVPVVRfTklDS05BTUUsIFRJTUVPVVRfUkVDT05ORUNULCBUSU1FT1VUX1NLSU5cbn0gZnJvbSBcIi4uLy4uL3NoYXJlZC9jb25maWdcIjtcbmltcG9ydCB7IERFQVRIX0ZSQU1FUywgRUFuaW1hdGUsIEVEaXIsIEVFZmZlY3QsIEVNYXBJdGVtLCBFU291bmRzIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgZ2V0VGltZSwgc2V0VGltZSB9IGZyb20gXCIuLi9kYXRhL2FkZHJlc3NUaW1lXCI7XG5pbXBvcnQgeyBJU19ERVYgfSBmcm9tIFwiLi4vZW52XCI7XG5pbXBvcnQgeyBCb21iIH0gZnJvbSBcIi4vQm9tYlwiO1xuaW1wb3J0IHsgQm9tYkVmZmVjdCB9IGZyb20gXCIuL0JvbWJFZmZlY3RcIjtcbmltcG9ydCB7IENyYXN5Qm9tYkVmZmVjdCB9IGZyb20gXCIuL0NyYXN5Qm9tYkVmZmVjdFwiO1xuaW1wb3J0IHsgRWZmZWN0IH0gZnJvbSBcIi4vRWZmZWN0XCI7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tIFwiLi9FbnRpdHlcIjtcbmltcG9ydCB7IEdhbWUgfSBmcm9tIFwiLi9HYW1lXCI7XG5pbXBvcnQgeyBNb3ZpbmdFZmZlY3QgfSBmcm9tIFwiLi9Nb3ZpbmdFZmZlY3RcIjtcbmltcG9ydCB7IE5wYyB9IGZyb20gXCIuL05wY1wiO1xuaW1wb3J0IHsgUGxheWVyRWZmZWN0IH0gZnJvbSBcIi4vUGxheWVyRWZmZWN0XCI7XG5pbXBvcnQgeyBSYWRpdXNFZmZlY3QgfSBmcm9tIFwiLi9SYWRpdXNFZmZlY3RcIjtcbmltcG9ydCB7IFNoaWVsZEVmZmVjdCB9IGZyb20gXCIuL1NoaWVsZEVmZmVjdFwiO1xuaW1wb3J0IHsgU3BlZWRFZmZlY3QgfSBmcm9tIFwiLi9TcGVlZEVmZmVjdFwiO1xuXG5pbXBvcnQgdHlwZSB7IFRNZXRob2RzT3V0IH0gZnJvbSBcIi4uLy4uL2NvcmUvbWFrZVdlYlNvY2tldEFwaVwiO1xubGV0IFBMQVlFUl9DT1VOVEVSID0gMDtcblxuZXhwb3J0IGNsYXNzIFBsYXllciBleHRlbmRzIEVudGl0eSB7XG4gIHJlYWRvbmx5ICNpZCA9IFBMQVlFUl9DT1VOVEVSKys7XG4gIG5ld0FwaSE6IFRNZXRob2RzT3V0PHR5cGVvZiBwbGF5ZXJBcGk+O1xuICB1bmZvcndhcmQ/OiAoKSA9PiBhbnk7XG5cbiAgaXNEZWF0aCA9IGZhbHNlO1xuXG4gIGRpciA9IEVEaXIuQk9UVE9NO1xuICBpbkdhbWUgPSBmYWxzZTtcbiAgaXNBZG1pbiA9IGZhbHNlO1xuICAjYW5pbWF0ZSA9IEVBbmltYXRlLklETEU7XG4gIG1vdmVkID0gZmFsc2U7XG5cbiAgZ2V0IGlkKCkgeyByZXR1cm4gdGhpcy4jaWQ7IH1cbiAgZ2V0IGNhbkpvaW4oKSB7IHJldHVybiB0aGlzLmdhbWUuc2xvdExpbWl0cyA+IHRoaXMuZ2FtZS5wbGF5ZXJzQ291bnQ7IH1cbiAgZ2V0IGFuaW1hdGUoKSB7IHJldHVybiB0aGlzLiNhbmltYXRlOyB9XG4gIHNldCBhbmltYXRlKHYpIHsgdGhpcy4jYW5pbWF0ZSA9IHY7IH1cblxuICBnZXQgYWRkcmVzcygpOiBzdHJpbmcge1xuICAgIGNvbnN0IHsgaGFuZHNoYWtlIH0gPSB0aGlzLnNvY2tldDtcbiAgICBjb25zdCBhZGRyZXNzID0gaGFuZHNoYWtlLmhlYWRlcnNbJ3gtcmVhbC1pcCddO1xuICAgIHJldHVybiAoQXJyYXkuaXNBcnJheShhZGRyZXNzKSA/IGFkZHJlc3NbMF0gOiBhZGRyZXNzKSA/PyBoYW5kc2hha2UuYWRkcmVzcztcbiAgfVxuXG4gIHN0YXJ0UG9zaXRpb24/OiBWZWMyIHwgdW5kZWZpbmVkO1xuXG4gIG5hbWUgPSAnJztcbiAgI3NraW4gPSAwO1xuXG4gIC8vIGNoYW5nZSBmb3IgdGhhdCBcdTIxOTEgKCB3aGVuIGlzIFdvcmtpbmcgKVxuICBnZXQgc2tpbigpIHsgcmV0dXJuIHRoaXMuI3NraW47IH1cbiAgc2V0IHNraW4odikgeyB0aGlzLiNza2luID0gdjsgfVxuXG4gIGdldCBlZmZlY3RzKCkge1xuICAgIHJldHVybiB7XG4gICAgICBoYXZlU2hpZWxkOiBTaGllbGRFZmZlY3QuaGFzU2hpZWxkKHRoaXMpLFxuICAgICAgc3BlZWQ6IFNwZWVkRWZmZWN0LmdldFZhbHVlKHRoaXMpLFxuICAgICAgY3Jhenk6ICEhQ3Jhc3lCb21iRWZmZWN0LmdldCh0aGlzKSxcbiAgICAgIGhhdmVNb3ZlOiAhIU1vdmluZ0VmZmVjdC5nZXQodGhpcylcbiAgICB9O1xuICB9XG5cbiAgZ2V0IHNwZWVkKCkge1xuICAgIHJldHVybiBTcGVlZEVmZmVjdC5nZXRWYWx1ZSh0aGlzKTtcbiAgfVxuXG4gIHdpbnMgPSAwO1xuICBraWxscyA9IDA7XG4gIGRlYXRocyA9IDA7XG5cbiAgcGluZyA9IDA7XG4gIGxhc3RUZXN0UGluZyA9IDA7XG4gIHJlY29ubmVjdCA9IDA7XG4gIHdhcm5pbmdQaW5nID0gMDtcblxuICBsYXN0QWN0aW9uID0gRGF0ZS5ub3coKTtcbiAgbGFzdE1lc3NhZ2UgPSBEYXRlLm5vdygpIC0gVElNRU9VVF9NRVNTQUdFO1xuICBsYXN0TmljayA9IERhdGUubm93KCkgLSBUSU1FT1VUX05JQ0tOQU1FO1xuICBsYXN0U2tpbiA9IERhdGUubm93KCkgLSBUSU1FT1VUX1NLSU47XG5cbiAgZ2V0IGxhc3RDb25uZWN0KCkge1xuICAgIHJldHVybiBnZXRUaW1lKHRoaXMuYWRkcmVzcyk7XG4gIH1cblxuICBzZXQgbGFzdENvbm5lY3Qodikge1xuICAgIHNldFRpbWUodGhpcy5hZGRyZXNzLCB2KTtcbiAgfVxuXG4gIGdldCBwb3NJbmZvKCkge1xuICAgIHJldHVybiBwaWNrKFxuICAgICAgdGhpcyxcbiAgICAgIFtcbiAgICAgICAgJ2lkJyxcbiAgICAgICAgJ3gnLFxuICAgICAgICAneScsXG4gICAgICAgICdzcGVlZCcsXG4gICAgICAgICdkaXInLFxuICAgICAgICAnYW5pbWF0ZScsXG4gICAgICBdXG4gICAgKTtcbiAgfVxuXG4gIGdldCByZW1haW5pbmdFZmZlY3RzKCkge1xuICAgIGNvbnN0IHNwZWVkID0gU3BlZWRFZmZlY3QuZ2V0KHRoaXMpO1xuICAgIGNvbnN0IHNwZWVkVmFsdWUgPSBzcGVlZCA/IHJvdW5kKChzcGVlZC5yZW1haW5pbmcgPz8gMCkgLyAxMDAwKSA6IDA7XG4gICAgcmV0dXJuIHtcbiAgICAgIHNoaWVsZDogcm91bmQoKFNoaWVsZEVmZmVjdC5nZXQodGhpcyk/LnJlbWFpbmluZyA/PyAwKSAvIDEwMDApLFxuICAgICAgY3Jhenk6IHJvdW5kKChDcmFzeUJvbWJFZmZlY3QuZ2V0KHRoaXMpPy5yZW1haW5pbmcgPz8gMCkgLyAxMDAwKSxcbiAgICAgIHN1cDogc3BlZWQgJiYgc3BlZWQudmFsdWUgPiAxID8gc3BlZWRWYWx1ZSA6IDAsXG4gICAgICBzZG93bjogc3BlZWQgJiYgc3BlZWQudmFsdWUgPCAxID8gc3BlZWRWYWx1ZSA6IDAsXG4gICAgICBtb3Zpbmc6IHJvdW5kKChNb3ZpbmdFZmZlY3QuZ2V0KHRoaXMpPy5yZW1haW5pbmcgPz8gMCkgLyAxMDAwKSxcbiAgICAgIGJvbWJzOiBCb21iRWZmZWN0LmNvdW50KHRoaXMpIHx8IDAsXG4gICAgICByYWRpdXM6IFJhZGl1c0VmZmVjdC5jb3VudCh0aGlzKSB8fCAwLFxuICAgIH07XG4gIH1cblxuICBnZXQgaW5mbygpIHtcbiAgICByZXR1cm4gcGljayh0aGlzLCBbXG4gICAgICAnaWQnLFxuICAgICAgJ25hbWUnLFxuICAgICAgJ3NraW4nLFxuICAgICAgJ2luR2FtZScsXG4gICAgICAnaXNEZWF0aCcsXG4gICAgICAnY2FuSm9pbicsXG4gICAgICAnd2lucycsXG4gICAgICAna2lsbHMnLFxuICAgICAgJ2RlYXRocycsXG4gICAgICAnZWZmZWN0cycsXG4gICAgICAncGluZycsXG4gICAgICAnaXNBZG1pbicsXG4gICAgXSk7XG4gIH1cblxuICBnZXQgY2hhdEluZm8oKSB7XG4gICAgcmV0dXJuIHBpY2sodGhpcywgW1xuICAgICAgJ25hbWUnLFxuICAgICAgJ3NraW4nLFxuICAgICAgJ2luR2FtZScsXG4gICAgICAnaXNEZWF0aCdcbiAgICBdKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGdhbWU6IEdhbWUsXG4gICAgcHVibGljIHNvY2tldDogU29ja2V0XG4gICkge1xuICAgIHN1cGVyKGdhbWUsIDAsIDApO1xuICAgIHRoaXMubmV3QXBpID0gcGxheWVyQXBpLnVzZShzb2NrZXQpO1xuICAgIHRoaXMuaXNBZG1pbiA9IFRFU1RfQURNSU5fSVAudGVzdCh0aGlzLmFkZHJlc3MpO1xuXG4gICAgaWYgKElTX0RFVilcbiAgICAgIHRoaXMubmV3TWV0aG9kcy50b0dhbWU/LigpO1xuICB9XG5cbiAgYmFuKHRpbWU6IG51bWJlcikge1xuICAgIGlmICghdGhpcy5pbkdhbWUpXG4gICAgICByZXR1cm47XG4gICAgdGhpcy5uZXdNZXRob2RzLnRvTGVhdmU/LigpO1xuICAgIHRoaXMubGFzdENvbm5lY3QgPSBEYXRlLm5vdygpICsgdGltZSAtIFRJTUVPVVRfUkVDT05ORUNUO1xuICAgIHRoaXMuZ2FtZS5tZXNzYWdlKGBcdTA0MThcdTA0MzNcdTA0NDBcdTA0M0VcdTA0M0EgJHt0aGlzLm5hbWV9IFx1MDQzMVx1MDQ0Qlx1MDQzQiBcdTA0MzdcdTA0MzBcdTA0MzFcdTA0MzBcdTA0M0RcdTA0MzVcdTA0M0QgXHUwNDNEXHUwNDMwICR7dGltZSAvIDEwMDAgfCAwfSBcdTA0NDFcdTA0MzVcdTA0M0FgKTtcbiAgfVxuXG4gIG5ld01ldGhvZHM6IFBhcmFtZXRlcnM8dHlwZW9mIGdhbWVBcGlbJ2ZvcndhcmQnXT5bMV0gPSB7XG4gICAgc2V0UG9zaXRpb246ICh7IHgsIHksIGRpciwgYW5pbWF0ZSB9KSA9PiB7XG4gICAgICBpZiAodGhpcy5pc0RlYXRoICYmICF0aGlzLmluR2FtZSkgcmV0dXJuO1xuICAgICAgY29uc3QgeyBzcGVlZCB9ID0gdGhpcy5lZmZlY3RzO1xuICAgICAgY29uc3QgZGVsdGF0aW1lID0gRGF0ZS5ub3coKSAtIHRoaXMubGFzdEFjdGlvbjtcbiAgICAgIGNvbnN0IGRpc3RhbmNlID0gY2FsY1NwZWVkKGRlbHRhdGltZSwgc3BlZWQpICsgLjI7XG5cbiAgICAgIGlmICh0aGlzLmxlbmd0aCh4LCB5KSA+IGRpc3RhbmNlKSB7XG4gICAgICAgIHRoaXMubmV3QXBpLnNldFN0YXJ0UG9zaXRpb24odGhpcyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5tb3ZlZCA9IHRydWU7XG5cbiAgICAgIHggPSAoeCAqIDE2IHwgMCkgLyAxNjtcbiAgICAgIHkgPSAoeSAqIDE2IHwgMCkgLyAxNjtcblxuICAgICAgdGhpcy5sYXN0QWN0aW9uID0gRGF0ZS5ub3coKTtcbiAgICAgIHRoaXMueCA9IHg7XG4gICAgICB0aGlzLnkgPSB5O1xuICAgICAgdGhpcy5kaXIgPSBkaXI7XG4gICAgICB0aGlzLmFuaW1hdGUgPSBhbmltYXRlO1xuICAgIH0sXG5cbiAgICBwaW5nOiAoKSA9PiB7XG4gICAgICB0aGlzLnBpbmcgPSBEYXRlLm5vdygpIC0gdGhpcy5sYXN0VGVzdFBpbmc7XG4gICAgfSxcbiAgICBzZW5kTWVzc2FnZTogKG1lc3NhZ2UpID0+IHtcbiAgICAgIG1lc3NhZ2UudHJpbSgpO1xuICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm47XG4gICAgICBpZiAobWVzc2FnZVswXSA9PT0gJy8nKSB7XG4gICAgICAgIGNvbnN0IFtjbWQsIC4uLmFyZ3NdID0gbWVzc2FnZS5zbGljZSgxKS5zcGxpdCgvXFxzKy8pO1xuXG4gICAgICAgIGxldCBvdXRwdXQgPSAnJztcblxuICAgICAgICBzd2l0Y2ggKGNtZCkge1xuICAgICAgICAgIGNhc2UgJ2Jhbic6IHtcbiAgICAgICAgICAgIGlmICghdGhpcy5pc0FkbWluKSByZXR1cm47XG5cbiAgICAgICAgICAgIGNvbnN0IFtpZCwgdGltZSA9ICczMG0nXSA9IGFyZ3M7XG4gICAgICAgICAgICBpZiAoIWlkKSB7XG4gICAgICAgICAgICAgIG91dHB1dCArPSAnXHUwNDFBXHUwNDNFXHUwNDMzXHUwNDNFIFx1MDQzN1x1MDQzMFx1MDQzMVx1MDQzMFx1MDQzRFx1MDQzOFx1MDQ0Mlx1MDQ0Qz9cXG4nO1xuXG4gICAgICAgICAgICAgIGZvciAoY29uc3QgcGxheWVyIG9mIHRoaXMuZ2FtZS5wbGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ICs9IGAke3BsYXllci5pZH0pICR7cGxheWVyLm5hbWV9IC0gJHtwbGF5ZXIuYWRkcmVzc31cXG5gO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCB0aW1lVmFsdWUgPSBGRGF0ZS5mcm9tKHRpbWUpO1xuXG4gICAgICAgICAgICAgIGZvciAoY29uc3QgcGxheWVyIG9mIHRoaXMuZ2FtZS5wbGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHBsYXllci5pZCA9PT0gK2lkKSB7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHAgb2YgdGhpcy5nYW1lLnBsYXllcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHAuYWRkcmVzcyA9PT0gcGxheWVyLmFkZHJlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICBwbGF5ZXIuYmFuKHRpbWVWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNhc2UgJ3VuYmFuJzoge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmlzQWRtaW4pIHJldHVybjtcblxuICAgICAgICAgICAgY29uc3QgW2lkXSA9IGFyZ3M7XG4gICAgICAgICAgICBpZiAoIWlkKSB7XG4gICAgICAgICAgICAgIG91dHB1dCArPSAnXHUwNDFBXHUwNDNFXHUwNDMzXHUwNDNFIFx1MDQ0MFx1MDQzMFx1MDQzN1x1MDQzMVx1MDQzMFx1MDQzRFx1MDQzOFx1MDQ0Mlx1MDQ0Qz9cXG4nO1xuXG4gICAgICAgICAgICAgIGZvciAoY29uc3QgcGxheWVyIG9mIHRoaXMuZ2FtZS5wbGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0ICs9IGAke3BsYXllci5pZH0pICR7cGxheWVyLm5hbWV9IC0gJHtwbGF5ZXIuYWRkcmVzc31cXG5gO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgIGZvciAoY29uc3QgcGxheWVyIG9mIHRoaXMuZ2FtZS5wbGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHBsYXllci5pZCA9PT0gK2lkKSB7XG4gICAgICAgICAgICAgICAgICBwbGF5ZXIubGFzdENvbm5lY3QgPSBEYXRlLm5vdygpIC0gVElNRU9VVF9SRUNPTk5FQ1Q7XG4gICAgICAgICAgICAgICAgICB0aGlzLmdhbWUubWVzc2FnZShgXHUwNDE4XHUwNDMzXHUwNDQwXHUwNDNFXHUwNDNBICR7cGxheWVyLm5hbWV9IFx1MDQzMVx1MDQ0Qlx1MDQzQiBcdTA0NDBcdTA0MzBcdTA0MzdcdTA0MzFcdTA0MzBcdTA0M0RcdTA0MzVcdTA0M0RgKTtcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvdXRwdXQpXG4gICAgICAgICAgdGhpcy5uZXdBcGkub25NZXNzYWdlKHsgbWVzc2FnZTogb3V0cHV0LCBzZW5kZXI6IHsgbmFtZTogJ0BjbWQnIH0sIGlzTWU6IHRydWUgfSk7XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgbmVlZFRpbWUgPSB0aGlzLmxhc3RNZXNzYWdlICsgVElNRU9VVF9NRVNTQUdFO1xuICAgICAgY29uc3QgZGVsdGFUaW1lID0gbmVlZFRpbWUgLSBEYXRlLm5vdygpO1xuICAgICAgaWYgKGRlbHRhVGltZSA+IDApIHtcbiAgICAgICAgdGhpcy5uZXdBcGkub25NZXNzYWdlKHtcbiAgICAgICAgICBtZXNzYWdlOiBgXHUwNDIxXHUwNDNFXHUwNDNFXHUwNDMxXHUwNDQ5XHUwNDM1XHUwNDNEXHUwNDM4XHUwNDM1IFx1MDQzQ1x1MDQzRVx1MDQzNlx1MDQzRFx1MDQzRSBcdTA0M0VcdTA0NDJcdTA0M0ZcdTA0NDBcdTA0MzBcdTA0MzJcdTA0MzhcdTA0NDJcdTA0NEMgXHUwNDQ3XHUwNDM1XHUwNDQwXHUwNDM1XHUwNDM3ICR7ZGVsdGFUaW1lIC8gMTAwMCB8IDB9IFx1MDQ0MVx1MDQzNVx1MDQzQS5gLFxuICAgICAgICAgIHNlbmRlcjogeyBuYW1lOiAnQHNlcnZlcicgfSxcbiAgICAgICAgICBpc01lOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5sYXN0TWVzc2FnZSA9IERhdGUubm93KCk7XG4gICAgICBtZXNzYWdlID0gbWVzc2FnZS5zbGljZSgwLCBNRVNTQUdFX0xFTkdUSCk7XG4gICAgICB0aGlzLmdhbWUubWVzc2FnZShtZXNzYWdlLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgc2V0U2tpbjogKHNraW4pID0+IHtcbiAgICAgIGlmIChEYXRlLm5vdygpIC0gdGhpcy5sYXN0U2tpbiA8IFRJTUVPVVRfU0tJTikge1xuICAgICAgICB0aGlzLmJhbihGRGF0ZS5mcm9tKCczMG0nKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRoaXMubGFzdFNraW4gPSBEYXRlLm5vdygpO1xuICAgICAgdGhpcy5za2luID0gcmVtKHNraW4gfCAwLCBTS0lOU19DT1VOVCk7XG4gICAgfSxcblxuICAgIHNldEJvbWI6ICgpID0+IHtcbiAgICAgIGNvbnN0IHsgcGxheWVyc0NvdW50LCBsaXZlUGxheWVyc0NvdW50IH0gPSB0aGlzLmdhbWU7XG4gICAgICBpZiAoZmFsc2VcbiAgICAgICAgfHwgdGhpcy5nYW1lLndhaXRGb3JSZXN0YXJ0ICE9PSAtMVxuICAgICAgICB8fCB0aGlzLmlzRGVhdGhcbiAgICAgICAgfHwgIXRoaXMuaW5HYW1lXG4gICAgICAgIHx8IChwbGF5ZXJzQ291bnQgPiAxICYmIGxpdmVQbGF5ZXJzQ291bnQgPCAyKVxuICAgICAgKSByZXR1cm47XG5cbiAgICAgIGNvbnN0IHsgYm9tYnMsIGFjaGl2bWVudHMgfSA9IHRoaXMuZ2FtZTtcbiAgICAgIGNvbnN0IG5ld0JvbWIgPSBuZXcgQm9tYih0aGlzKTtcbiAgICAgIGNvbnN0IHsgeCwgeSB9ID0gbmV3Qm9tYjtcbiAgICAgIGNvbnN0IGJvbWJzQ291bnQgPSBCb21iRWZmZWN0LmNvdW50KHRoaXMpICsgMTtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5nYW1lLm1hcFt4ICsgeSAqIHRoaXMuZ2FtZS53aWR0aF07XG5cbiAgICAgIGlmICh2YWx1ZSA9PT0gRU1hcEl0ZW0uV0FMTClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoZmluZChib21icywgeyB4LCB5IH0pKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChmaW5kKGFjaGl2bWVudHMsIHsgeCwgeSB9KSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAobWFwKGJvbWJzLCBlID0+IGUsIGUgPT4gZS5jcmVhdG9yID09PSB0aGlzKS5sZW5ndGggPj0gYm9tYnNDb3VudClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBib21icy5hZGQobmV3Qm9tYik7XG5cbiAgICAgIHRoaXMuZ2FtZS5wbGF5ZXJzLmZvckVhY2gocGxheWVyID0+IHtcbiAgICAgICAgcGxheWVyLm5ld0FwaS5wbGF5U291bmRQb3NpdGlvbih7XG4gICAgICAgICAgc291bmQ6IEVTb3VuZHMucHV0Qm9tYixcbiAgICAgICAgICBwb3NpdGlvbjogdGhpc1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBzZXROYW1lOiAobmFtZTogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAoIW5hbWUpIHJldHVybjtcbiAgICAgIGlmIChuYW1lWzBdID09PSAnQCcpXG4gICAgICAgIG5hbWUgPSBuYW1lLnNsaWNlKDEpO1xuXG4gICAgICBpZiAoRGF0ZS5ub3coKSAtIHRoaXMubGFzdE5pY2sgPCBUSU1FT1VUX05JQ0tOQU1FKSB7XG4gICAgICAgIHRoaXMuYmFuKEZEYXRlLmZyb20oJzMwbScpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5sYXN0TmljayA9IERhdGUubm93KCk7XG4gICAgICB0aGlzLm5hbWUgPSBuYW1lLnNsaWNlKDAsIE5JQ0tfTEVOR1RIKTtcbiAgICB9LFxuXG4gICAgdG9HYW1lOiAoKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuY2FuSm9pbiB8fCB0aGlzLmluR2FtZSkgcmV0dXJuO1xuXG4gICAgICBjb25zdCBuZWVkVGltZSA9IHRoaXMubGFzdENvbm5lY3QgKyBUSU1FT1VUX1JFQ09OTkVDVCAqIHRoaXMucmVjb25uZWN0O1xuICAgICAgY29uc3QgZGVsdGFUaW1lID0gbmVlZFRpbWUgLSBEYXRlLm5vdygpO1xuXG4gICAgICBpZiAoZGVsdGFUaW1lID4gMCkge1xuICAgICAgICB0aGlzLm5ld0FwaS5vbk1lc3NhZ2Uoe1xuICAgICAgICAgIG1lc3NhZ2U6IGBcdTA0MUZcdTA0M0VcdTA0MzRcdTA0M0FcdTA0M0JcdTA0NEVcdTA0NDdcdTA0MzhcdTA0NDJcdTA0MzVcdTA0NDFcdTA0NEMgXHUwNDQ3XHUwNDM1XHUwNDQwXHUwNDM1XHUwNDM3ICR7ZGVsdGFUaW1lIC8gMTAwMCB8IDB9IFx1MDQ0MVx1MDQzNVx1MDQzQS5gLFxuICAgICAgICAgIHNlbmRlcjogeyBuYW1lOiAnQHNlcnZlcicgfSxcbiAgICAgICAgICBpc01lOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnJhbmRvbVBvc2l0aW9uKCk7XG4gICAgICB0aGlzLmlzRGVhdGggPSB0cnVlO1xuICAgICAgdGhpcy5raWxscyA9IDA7XG4gICAgICB0aGlzLmRlYXRocyA9IDA7XG4gICAgICB0aGlzLndpbnMgPSAwO1xuICAgICAgdGhpcy5pbkdhbWUgPSB0cnVlO1xuICAgICAgdGhpcy5sYXN0Q29ubmVjdCA9IERhdGUubm93KCk7XG4gICAgICB0aGlzLmxhc3RBY3Rpb24gPSBEYXRlLm5vdygpO1xuICAgICAgdGhpcy5nYW1lLm1lc3NhZ2UoYCR7dGhpcy5uYW1lID8/ICdub25hbWUnfSBcdTA0M0ZcdTA0M0VcdTA0MzRcdTA0M0FcdTA0M0JcdTA0NEVcdTA0NDdcdTA0MzhcdTA0M0JcdTA0NDFcdTA0NEZgKTtcbiAgICAgIFBsYXllckVmZmVjdC5jbGVhckVmZmV0cyh0aGlzKTtcbiAgICB9LFxuXG4gICAgdG9MZWF2ZTogKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLmluR2FtZSkgcmV0dXJuO1xuICAgICAgdGhpcy5yZWxlYXNlUG9zaXRpb24oKTtcbiAgICAgIHRoaXMucmVjb25uZWN0Kys7XG4gICAgICB0aGlzLnNraW4gPSAtMTtcbiAgICAgIHRoaXMuaW5HYW1lID0gZmFsc2U7XG4gICAgICB0aGlzLmxhc3RDb25uZWN0ID0gRGF0ZS5ub3coKTtcbiAgICAgIHRoaXMubGFzdEFjdGlvbiA9IERhdGUubm93KCk7XG4gICAgICB0aGlzLmdhbWUubWVzc2FnZShgJHt0aGlzLm5hbWUgPz8gJ25vbmFtZSd9IFx1MDQzRVx1MDQ0Mlx1MDQzQVx1MDQzQlx1MDQ0RVx1MDQ0N1x1MDQzOFx1MDQzQlx1MDQ0MVx1MDQ0RmApO1xuICAgICAgUGxheWVyRWZmZWN0LmNsZWFyRWZmZXRzKHRoaXMpO1xuICAgIH1cbiAgfTtcblxuICByZXNldCgpIHtcbiAgICBjb25zdCB7IHN0YXJ0UG9zaXRpb24gfSA9IHRoaXM7XG4gICAgdGhpcy5pc0RlYXRoID0gZmFsc2U7XG4gICAgdGhpcy5sYXN0QWN0aW9uID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnJhbmRvbVBvc2l0aW9uKCk7XG4gICAgdGhpcy5tb3ZlZCA9IGZhbHNlO1xuICAgIFBsYXllckVmZmVjdC5jbGVhckVmZmV0cyh0aGlzKTtcblxuICAgIGlmIChzdGFydFBvc2l0aW9uKSB7XG4gICAgICB0aGlzLnNldChzdGFydFBvc2l0aW9uKTtcbiAgICAgIGVmZmVjdE9iamVjdCh0aGlzLCAnc3RhcnRQb3NpdGlvbicsIFstMSwgLTFdLCAoKSA9PiB7IH0pO1xuICAgIH1cbiAgfVxuXG5cbiAgZGVhdGgoa2lsbGVyPzogUGxheWVyIHwgTnBjLCBpc0ZpcmUgPSBmYWxzZSkge1xuICAgIGlmICh0aGlzLmlzRGVhdGgpIHJldHVybjtcbiAgICBjb25zdCBpc1N1aWNpZGUgPSBraWxsZXIgPT09IHRoaXM7XG4gICAgdGhpcy5yZWNvbm5lY3QgPSAwO1xuXG4gICAgdGhpcy5pc0RlYXRoID0gdHJ1ZTtcbiAgICB0aGlzLm5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy5kZWF0aCk7XG5cbiAgICB0aGlzLmdhbWUuZWZmZWN0cy5hZGQoXG4gICAgICBuZXcgRWZmZWN0KHRoaXMuZ2FtZSwgdGhpcy54LCB0aGlzLnksIEVFZmZlY3QuREVBVEgsIFtyYW5kb20oKSAqIERFQVRIX0ZSQU1FUy5sZW5ndGggfCAwXSlcbiAgICApO1xuXG4gICAgaWYgKHRoaXMuZ2FtZS5wbGF5ZXJzQ291bnQgPiAxKSB7XG4gICAgICB0aGlzLmRlYXRocysrO1xuICAgICAgdGhpcy5nYW1lLmtpbGxzKys7XG4gICAgfVxuXG4gICAgaWYgKCFpc1N1aWNpZGUgJiYga2lsbGVyIGluc3RhbmNlb2YgUGxheWVyKSB7XG4gICAgICBraWxsZXIua2lsbHMrKztcbiAgICAgIGtpbGxlci5uZXdBcGkucGxheVNvdW5kKEVTb3VuZHMua2lsbCk7XG4gICAgfVxuXG4gICAgY29uc3QgbmFtZSA9IHRoaXMubmFtZSA/PyAnbm9uYW1lJztcbiAgICBjb25zdCBraWxsZXJOYW1lID0ga2lsbGVyPy5uYW1lID8/ICdub25hbWUnO1xuXG4gICAgUGxheWVyRWZmZWN0LmNsZWFyRWZmZXRzKHRoaXMpO1xuICAgIHRoaXMucmVsZWFzZVBvc2l0aW9uKCk7XG5cbiAgICBpZiAoIWtpbGxlcikge1xuICAgICAgdGhpcy5nYW1lLm1lc3NhZ2UoYCR7bmFtZX0gXHUwNDM3XHUwNDMwXHUwNDQxXHUwNDQyXHUwNDQwXHUwNDRGXHUwNDNCIFx1MDQzMiBcdTA0NDFcdTA0NDJcdTA0MzVcdTA0M0RcdTA0MzVgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNTdWljaWRlKSB7XG4gICAgICB0aGlzLmdhbWUubWVzc2FnZShgJHtuYW1lfSBcdTA0NDFcdTA0MzBcdTA0M0NcdTA0M0VcdTA0NDNcdTA0MzFcdTA0MzhcdTA0M0JcdTA0NDFcdTA0NEZgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmdhbWUubWVzc2FnZShgJHtraWxsZXJOYW1lfSAke2lzRmlyZSA/ICdcdTA0M0ZcdTA0M0VcdTA0MzRcdTA0MzZcdTA0MzVcdTA0MzMnIDogJ1x1MDQ0M1x1MDQzMVx1MDQzOFx1MDQzQid9ICR7bmFtZX1gKTtcbiAgfVxuXG4gIHJhbmRvbVBvc2l0aW9uKCkge1xuICAgIHRoaXMucmVsZWFzZVBvc2l0aW9uKCk7XG4gICAgdGhpcy5zdGFydFBvc2l0aW9uID0gdGhpcy5nYW1lLmdldEZyZWVQb3NpdGlvbigpO1xuICB9XG5cbiAgcmVsZWFzZVBvc2l0aW9uKCkge1xuICAgIGlmICh0aGlzLnN0YXJ0UG9zaXRpb24pIHtcbiAgICAgIHRoaXMuZ2FtZS5yZWxlYXNlUG9zaXRpb24odGhpcy5zdGFydFBvc2l0aW9uKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuc3RhcnRQb3NpdGlvbjtcbiAgfVxuXG4gIGNvbm5lY3QoKSB7XG4gICAgaWYgKHRoaXMudW5mb3J3YXJkKSB7XG4gICAgICB0aGlzLnVuZm9yd2FyZCgpO1xuICAgICAgZGVsZXRlIHRoaXMudW5mb3J3YXJkO1xuICAgIH1cblxuICAgIGNvbnN0IHVuMiA9IGdhbWVBcGkuZm9yd2FyZCh0aGlzLnNvY2tldCwgdGhpcy5uZXdNZXRob2RzKTtcblxuICAgIHRoaXMudW5mb3J3YXJkID0gKCkgPT4ge1xuICAgICAgdW4yKCk7XG4gICAgfTtcbiAgfVxuXG4gIGRpc2Nvbm5lY3QoKSB7XG4gICAgdGhpcy5uZXdNZXRob2RzLnRvTGVhdmU/LigpO1xuICAgIHRoaXMudW5mb3J3YXJkPy4oKTtcbiAgfVxuXG4gIHVwZGF0ZSgpIHtcbiAgICBjb25zdCB7XG4gICAgICBleHBsb2RlcyxcbiAgICAgIGFjaGl2bWVudHNcbiAgICB9ID0gdGhpcy5nYW1lO1xuXG4gICAgY29uc3Qgc3BlZWQgPSBTcGVlZEVmZmVjdC5nZXRWYWx1ZSh0aGlzKTtcblxuICAgIGlmICh0aGlzLmluR2FtZSAmJiB0aGlzLnBpbmcgPiAyNTApIHtcbiAgICAgIHRoaXMud2FybmluZ1BpbmcrKztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy53YXJuaW5nUGluZyA9IDA7XG4gICAgfVxuXG4gICAgZWZmZWN0T2JqZWN0KFxuICAgICAgdGhpcyxcbiAgICAgICdraWNrV2FybmluZ1BpbmcnLFxuICAgICAgdGhpcy53YXJuaW5nUGluZyA+IDIwMCxcbiAgICAgIChpc0tpY2spID0+IHtcbiAgICAgICAgaWYgKGlzS2ljaykge1xuICAgICAgICAgIHRoaXMubmV3TWV0aG9kcy50b0xlYXZlPy4oKTtcbiAgICAgICAgICB0aGlzLm5ld0FwaS5vbk1lc3NhZ2Uoe1xuICAgICAgICAgICAgbWVzc2FnZTogJ1x1MDQxMlx1MDQzMFx1MDQ0MSBcdTA0M0FcdTA0MzhcdTA0M0FcdTA0M0RcdTA0NDNcdTA0M0JcdTA0M0UgXHUwNDM3XHUwNDMwIFx1MDQzMlx1MDQ0Qlx1MDQ0MVx1MDQzRVx1MDQzQVx1MDQzOFx1MDQzOSBcdTA0M0ZcdTA0MzhcdTA0M0RcdTA0MzMnLFxuICAgICAgICAgICAgc2VuZGVyOiB7IG5hbWU6ICdAc2VydmVyJyB9LFxuICAgICAgICAgICAgaXNNZTogZmFsc2VcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICk7XG5cbiAgICBpZiAoIXRoaXMuaXNEZWF0aCAmJiB0aGlzLmluR2FtZSkge1xuICAgICAgZm9yIChjb25zdCBlZmZlY3Qgb2YgUGxheWVyRWZmZWN0LmVmZmVjdHModGhpcykpXG4gICAgICAgIGVmZmVjdC51cGRhdGUoKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNEZWF0aCAmJiB0aGlzLmluR2FtZSlcbiAgICAgIGVmZmVjdE9iamVjdChcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ3RpbWVvdXQnLFxuICAgICAgICBEYXRlLm5vdygpIC0gdGhpcy5sYXN0QWN0aW9uID4gUExBWUVSX1RJTUVPVVQgJiYgIXRoaXMuaXNEZWF0aCAmJiAhSVNfREVWLFxuICAgICAgICAocmVzdWx0KSA9PiB7XG4gICAgICAgICAgaWYgKHJlc3VsdClcbiAgICAgICAgICAgIHRoaXMubmV3TWV0aG9kcy50b0xlYXZlPy4oKTtcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgIGlmICghdGhpcy5pc0RlYXRoICYmIHRoaXMuaW5HYW1lICYmIHRoaXMubW92ZWQpIHtcbiAgICAgIGNvbnN0IHZlYyA9IHRoaXMuY2xvbmUoKS5yb3VuZCgpO1xuXG4gICAgICBpZiAodmVjLnggPCAwIHx8IHZlYy55IDwgMCB8fCB2ZWMueCA+IHRoaXMuZ2FtZS5tYXAud2lkdGggLSAxIHx8IHZlYy55ID4gdGhpcy5nYW1lLm1hcC5oZWlnaHQgLSAxKVxuICAgICAgICB0aGlzLmRlYXRoKCk7XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5nYW1lLm1hcFt2ZWMueSAqIHRoaXMuZ2FtZS53aWR0aCArIHZlYy54XTtcbiAgICAgIGlmICh2YWx1ZSA9PT0gRU1hcEl0ZW0uV0FMTCB8fCB2YWx1ZSA9PT0gRU1hcEl0ZW0uQkxPQ0spXG4gICAgICAgIHRoaXMuZGVhdGgoKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNEZWF0aCAmJiB0aGlzLmluR2FtZSkge1xuICAgICAgaWYgKHNwZWVkID49IDEpIHtcbiAgICAgICAgZm9yIChjb25zdCBwbGF5ZXIgb2YgdGhpcy5nYW1lLnBsYXllcnMpIHtcbiAgICAgICAgICBpZiAocGxheWVyID09PSB0aGlzIHx8ICFwbGF5ZXIuaW5HYW1lIHx8IHBsYXllci5pc0RlYXRoKVxuICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICBpZiAoU3BlZWRFZmZlY3QuZ2V0VmFsdWUocGxheWVyKSA+PSAxKVxuICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICBpZiAodGhpcy5jaGVja0NvbGxpc2lvbihwbGF5ZXIsIC45KSlcbiAgICAgICAgICAgIHRoaXMuZGVhdGgocGxheWVyLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsZXQgc2hpZWxkID0gU2hpZWxkRWZmZWN0LmdldCh0aGlzKTtcblxuICAgICAgZm9yIChjb25zdCBleHBsb2RlIG9mIGV4cGxvZGVzKSB7XG4gICAgICAgIGlmICh0aGlzLmlzRGVhdGggfHwgZXhwbG9kZS5pZ25vcmUuaGFzKHRoaXMpKVxuICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgIGZvciAoY29uc3QgcG9pbnQgb2YgZXhwbG9kZS5wb2ludHMpIHtcbiAgICAgICAgICBpZiAodGhpcy5pc0RlYXRoKSBjb250aW51ZTtcblxuICAgICAgICAgIGlmICh0aGlzLmNoZWNrQ29sbGlzaW9uKHBvaW50LCAuNikpIHtcbiAgICAgICAgICAgIGlmIChzaGllbGQpIHtcbiAgICAgICAgICAgICAgc2hpZWxkID0gbnVsbDtcbiAgICAgICAgICAgICAgU2hpZWxkRWZmZWN0LmRlbGV0ZSh0aGlzKTtcbiAgICAgICAgICAgICAgZXhwbG9kZS5pZ25vcmUuYWRkKHRoaXMpO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5kZWF0aChleHBsb2RlLnBsYXllcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzRGVhdGggJiYgdGhpcy5pbkdhbWUpIHtcbiAgICAgIGZvciAoY29uc3QgYWNoaXZtZW50IG9mIGFjaGl2bWVudHMpIHtcbiAgICAgICAgaWYgKHRoaXMuY2hlY2tDb2xsaXNpb24oYWNoaXZtZW50LCAuNCkpIHtcbiAgICAgICAgICBhY2hpdm1lbnQuYWNjZXB0KHRoaXMpO1xuICAgICAgICAgIGFjaGl2bWVudHMuZGVsZXRlKGFjaGl2bWVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5sYXN0VGVzdFBpbmcgKyA1MDAgPCBEYXRlLm5vdygpKSB7XG4gICAgICB0aGlzLmxhc3RUZXN0UGluZyA9IERhdGUubm93KCk7XG4gICAgICB0aGlzLm5ld0FwaS5waW5nKCk7XG4gICAgfVxuICB9XG5cbiAgc2VuZEluZm8oKSB7XG4gICAgY29uc3Qge1xuICAgICAgcGxheWVycyxcbiAgICAgIGluZm9DYWNoZSxcbiAgICAgIG1hcENhY2hlLFxuICAgICAgYm9tYnNDYWNoZSxcbiAgICAgIGFjaGl2bWVudHNDYWNoZSxcbiAgICAgIGVmZmVjdHNDYWNoZSxcbiAgICAgIGVmZmVjdHNUeXBlQ2FjaGUsXG4gICAgICBleHBsb2Rlc0NhaGNlXG4gICAgfSA9IHRoaXMuZ2FtZTtcblxuICAgIGVmZmVjdE9iamVjdChcbiAgICAgIHRoaXMsXG4gICAgICAnZ2FtZUluZm8nLFxuICAgICAgaW5mb0NhY2hlLFxuICAgICAgKCkgPT4ge1xuICAgICAgICB0aGlzLm5ld0FwaS51cGRhdGVHYW1lSW5mbyh0aGlzLmdhbWUpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBlZmZlY3RPYmplY3QoXG4gICAgICB0aGlzLFxuICAgICAgJ3dhaXRGb3JSZXN0YXJ0JyxcbiAgICAgIHRoaXMuZ2FtZS53YWl0Rm9yUmVzdGFydCA+IDAgPyAodGhpcy5nYW1lLndhaXRGb3JSZXN0YXJ0IC0gRGF0ZS5ub3coKSkgLyAxMDAwIHwgMCA6IC0xLFxuICAgICAgdGltZSA9PiB7XG4gICAgICAgIHRoaXMubmV3QXBpLnVwZGF0ZVdhaXRGb3JSZXN0YXJ0KHRpbWUpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBlZmZlY3RPYmplY3QoXG4gICAgICB0aGlzLFxuICAgICAgJ3N0YXJ0UG9zaXRpb24nLFxuICAgICAgdGhpcy5pbkdhbWUgJiYgIXRoaXMuaXNEZWF0aCA/IHRoaXMuc3RhcnRQb3NpdGlvbiA6IHVuZGVmaW5lZCxcbiAgICAgIChwb2ludCkgPT4ge1xuICAgICAgICBpZiAocG9pbnQpIHtcbiAgICAgICAgICB0aGlzLnNldChwb2ludCk7XG4gICAgICAgICAgdGhpcy5uZXdBcGkuc2V0U3RhcnRQb3NpdGlvbihwb2ludCk7XG4gICAgICAgICAgdGhpcy5uZXdBcGkucGxheVNvdW5kKEVTb3VuZHMubmV3TGlmZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuXG4gICAgZWZmZWN0T2JqZWN0KFxuICAgICAgdGhpcyxcbiAgICAgICdsb2NhbEluZm8nLFxuICAgICAgdGhpcy5pbmZvLFxuICAgICAgbG9jYWxJbmZvID0+IHtcbiAgICAgICAgdGhpcy5uZXdBcGkudXBkYXRlTG9jYWxJbmZvKGxvY2FsSW5mbyk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGVmZmVjdE9iamVjdChcbiAgICAgIHRoaXMsXG4gICAgICAncmVtYWluaW5nRWZmZWN0cycsXG4gICAgICB0aGlzLnJlbWFpbmluZ0VmZmVjdHMsXG4gICAgICBlZmZlY3RzID0+IHtcbiAgICAgICAgdGhpcy5uZXdBcGkudXBkYXRlUmVtYWluaW5nRWZmZWN0cyhlZmZlY3RzKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZWZmZWN0T2JqZWN0KFxuICAgICAgdGhpcyxcbiAgICAgICdtYXAnLFxuICAgICAgbWFwQ2FjaGUsXG4gICAgICAoZ2FtZU1hcCkgPT4ge1xuICAgICAgICB0aGlzLm5ld0FwaS51cGRhdGVNYXAoZ2FtZU1hcCk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGVmZmVjdE9iamVjdChcbiAgICAgIHRoaXMsXG4gICAgICAnZWZmZWN0cycsXG4gICAgICBlZmZlY3RzVHlwZUNhY2hlLFxuICAgICAgKCkgPT4ge1xuICAgICAgICB0aGlzLm5ld0FwaS51cGRhdGVFZmZlY3RzKGVmZmVjdHNDYWNoZSk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIGVmZmVjdE9iamVjdChcbiAgICAgIHRoaXMsXG4gICAgICAnYm9tYnMnLFxuICAgICAgYm9tYnNDYWNoZSxcbiAgICAgIGJvbWJzID0+IHtcbiAgICAgICAgdGhpcy5uZXdBcGkudXBkYXRlQm9tYnMoYm9tYnMpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBlZmZlY3RPYmplY3QoXG4gICAgICB0aGlzLFxuICAgICAgJ2V4cGxvZGVzJyxcbiAgICAgIGV4cGxvZGVzQ2FoY2UsXG4gICAgICBleHBsb2RlcyA9PiB7XG4gICAgICAgIHRoaXMubmV3QXBpLnVwZGF0ZUV4cGxvZGVzKGV4cGxvZGVzKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZWZmZWN0T2JqZWN0KFxuICAgICAgdGhpcyxcbiAgICAgICdhY2hpdm1lbnRzJyxcbiAgICAgIGFjaGl2bWVudHNDYWNoZSxcbiAgICAgIGFjaGl2bWVudHMgPT4ge1xuICAgICAgICB0aGlzLm5ld0FwaS51cGRhdGVBY2hpdm1lbnRzKGFjaGl2bWVudHMpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBlZmZlY3RPYmplY3QoXG4gICAgICB0aGlzLFxuICAgICAgJ3BsYXllcnMnLFxuICAgICAgbWFwKHBsYXllcnMsIGUgPT4gZS5pbmZvLCAoZSwgZCkgPT4gZSAhPT0gdGhpcyAmJiBlLmluR2FtZSksXG4gICAgICBwbGF5ZXJzID0+IHtcbiAgICAgICAgdGhpcy5uZXdBcGkudXBkYXRlUGxheWVycyhwbGF5ZXJzKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZWZmZWN0T2JqZWN0KFxuICAgICAgdGhpcyxcbiAgICAgICdwb3NpdGlvbnMnLFxuICAgICAgbWFwKHBsYXllcnMsIGUgPT4gZS5wb3NJbmZvLCAoZSwgZCkgPT4gZSAhPT0gdGhpcyAmJiBlLmluR2FtZSAmJiAhZS5pc0RlYXRoKSxcbiAgICAgIChwb3NpdGlvbnMpID0+IHtcbiAgICAgICAgdGhpcy5uZXdBcGkudXBkYXRlUGxheWVyUG9zaXRpb25zKHBvc2l0aW9ucyk7XG4gICAgICB9XG4gICAgKTtcbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9jb3JlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvY2FsY1NwZWVkLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9jYWxjU3BlZWQudHNcIjtleHBvcnQgY29uc3QgY2FsY1NwZWVkID0gKGR0aW1lID0gMCwgbXVsdGkgPSAwKSA9PiAwLjAwMyAqIGR0aW1lICogbXVsdGk7IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9kYXRhXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9kYXRhL2FkZHJlc3NUaW1lLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2RhdGEvYWRkcmVzc1RpbWUudHNcIjtpbXBvcnQgeyBUSU1FT1VUX1JFQ09OTkVDVCB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29uZmlnXCI7XG5cbmV4cG9ydCBjb25zdCBBRERSRVNTX1NUT1JFID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblxuZXhwb3J0IGNvbnN0IGdldFRpbWUgPSAoYWRkcmVzczogc3RyaW5nKSA9PiB7XG4gIHJldHVybiBBRERSRVNTX1NUT1JFLmdldChhZGRyZXNzKSA/PyAoXG4gICAgQUREUkVTU19TVE9SRS5zZXQoYWRkcmVzcywgRGF0ZS5ub3coKSAtIFRJTUVPVVRfUkVDT05ORUNUKSxcbiAgICBBRERSRVNTX1NUT1JFLmdldChhZGRyZXNzKSFcbiAgKTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZXRUaW1lID0gKGFkZHJlc3M6IHN0cmluZywgdmFsdWU6IG51bWJlcikgPT4ge1xuICBBRERSRVNTX1NUT1JFLnNldChhZGRyZXNzLCB2YWx1ZSk7XG59OyIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL1BsYXllckVmZmVjdC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9QbGF5ZXJFZmZlY3QudHNcIjtpbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9QbGF5ZXJcIjtcblxuY29uc3QgRUZGRUNUU19TWU1CT0wgPSBTeW1ib2woJ2VmZmVjdHMnKTtcblxuZXhwb3J0IGNsYXNzIFBsYXllckVmZmVjdCB7XG4gIGlzQ3JlYXRlZCA9IGZhbHNlO1xuXG4gIGNyZWF0ZWQgPSBEYXRlLm5vdygpO1xuICBsaWZldGltZSA9IEluZmluaXR5O1xuXG4gIGdldCByZW1haW5pbmcoKSB7IHJldHVybiB0aGlzLmNyZWF0ZWQgKyB0aGlzLmxpZmV0aW1lIC0gRGF0ZS5ub3coKTsgfVxuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBwbGF5ZXI6IFBsYXllcikgeyB9XG5cbiAgYXBwZW5kVGltZSh0aW1lID0gMCkge1xuICAgIGlmICghaXNGaW5pdGUodGhpcy5saWZldGltZSkpXG4gICAgICB0aGlzLmxpZmV0aW1lID0gMDtcblxuICAgIHRoaXMubGlmZXRpbWUgKz0gdGltZTtcbiAgfVxuXG4gIHVwZGF0ZSgpIHtcbiAgICBpZiAoIXRoaXMuaXNDcmVhdGVkKSB7XG4gICAgICB0aGlzLmlzQ3JlYXRlZCA9IHRydWU7XG4gICAgICB0aGlzLm9uQ3JlYXRlKCk7XG4gICAgfVxuXG4gICAgaWYgKCFpc0Zpbml0ZSh0aGlzLmxpZmV0aW1lKSkgcmV0dXJuO1xuICAgIGlmICh0aGlzLnJlbWFpbmluZyA+IDApIHJldHVybjtcbiAgICB0aGlzLmRlbGV0ZSgpO1xuICB9XG5cbiAgZGVsZXRlKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IFBsYXllckVmZmVjdC5lZmZlY3RzKHRoaXMucGxheWVyKS5kZWxldGUodGhpcyk7XG5cbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICB0aGlzLm9uRGVsZXRlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIG9uQ3JlYXRlKCkgeyB9XG4gIG9uRGVsZXRlKCkgeyB9XG5cbiAgc3RhdGljIGVmZmVjdHM8VCBleHRlbmRzIFBsYXllckVmZmVjdD4ocGxheWVyOiBQbGF5ZXIgJiB7IFtFRkZFQ1RTX1NZTUJPTF0/OiBTZXQ8VD47IH0pIHtcbiAgICByZXR1cm4gcGxheWVyW0VGRkVDVFNfU1lNQk9MXSA/PyAoXG4gICAgICBwbGF5ZXJbRUZGRUNUU19TWU1CT0xdID0gbmV3IFNldCgpXG4gICAgKTtcbiAgfVxuXG4gIHN0YXRpYyBnZXRFZmZlY3RzPFQgZXh0ZW5kcyBQbGF5ZXJFZmZlY3Q+KFxuICAgIHBsYXllcjogUGxheWVyLFxuICAgIHR5cGU/OiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUXG4gICk6IFRbXSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLmVmZmVjdHM8VD4ocGxheWVyKV0uZmlsdGVyKGUgPT4gIXR5cGUgfHwgZSBpbnN0YW5jZW9mIHR5cGUpO1xuICB9XG5cbiAgc3RhdGljIGNsZWFyRWZmZXRzPFQgZXh0ZW5kcyBQbGF5ZXJFZmZlY3QsIEQgZXh0ZW5kcyBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUPihcbiAgICBwbGF5ZXI6IFBsYXllcixcbiAgICB0eXBlPzogRFxuICApIHtcbiAgICBjb25zdCBlZmZlY3RzID0gdGhpcy5lZmZlY3RzKHBsYXllcik7XG4gICAgZm9yIChjb25zdCBlZmZlY3Qgb2YgdGhpcy5nZXRFZmZlY3RzKHBsYXllciwgdHlwZSkpIHtcbiAgICAgIGVmZmVjdHMuZGVsZXRlKGVmZmVjdCk7XG4gICAgfVxuICB9XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvQ3Jhc3lCb21iRWZmZWN0LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL0NyYXN5Qm9tYkVmZmVjdC50c1wiO2ltcG9ydCB7IENSQVpZX0JPTUJfVElNRSB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29uZmlnXCI7XG5pbXBvcnQgeyBFU291bmRzIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vUGxheWVyXCI7XG5pbXBvcnQgeyBQbGF5ZXJFZmZlY3QgfSBmcm9tIFwiLi9QbGF5ZXJFZmZlY3RcIjtcblxuZXhwb3J0IGNsYXNzIENyYXN5Qm9tYkVmZmVjdCBleHRlbmRzIFBsYXllckVmZmVjdCB7XG4gIG9uQ3JlYXRlKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgcGxheWVyOiB7IG5ld0FwaSB9IH0gPSB0aGlzO1xuICAgIG5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy5jcmF6eSk7XG4gIH1cblxuICBvbkRlbGV0ZSgpOiB2b2lkIHtcbiAgICBjb25zdCB7IHBsYXllcjogeyBuZXdBcGkgfSB9ID0gdGhpcztcbiAgICBuZXdBcGkucGxheVNvdW5kKEVTb3VuZHMuY3JhenkpO1xuICB9XG5cbiAgc3RhdGljIGdldChwbGF5ZXI6IFBsYXllcik6IENyYXN5Qm9tYkVmZmVjdCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmdldEVmZmVjdHMocGxheWVyLCB0aGlzKVswXTtcbiAgfVxuXG4gIHN0YXRpYyBoYXNDcmFzeUJvbWIocGxheWVyOiBQbGF5ZXIpIHtcbiAgICByZXR1cm4gISF0aGlzLmdldChwbGF5ZXIpO1xuICB9XG5cbiAgc3RhdGljIGRlbGV0ZShwbGF5ZXI6IFBsYXllcikge1xuICAgIHRoaXMuZ2V0KHBsYXllcik/LmRlbGV0ZSgpO1xuICB9XG5cbiAgc3RhdGljIGFwcGVuZChwbGF5ZXI6IFBsYXllcikge1xuICAgIGNvbnN0IGVmZmV0cyA9IHRoaXMuZWZmZWN0cyhwbGF5ZXIpO1xuICAgIGNvbnN0IGN1cnJlbnRFZmZlY3QgPSB0aGlzLmdldChwbGF5ZXIpID8/IG5ldyB0aGlzKHBsYXllcik7XG5cbiAgICBjdXJyZW50RWZmZWN0LmFwcGVuZFRpbWUoQ1JBWllfQk9NQl9USU1FKTtcbiAgICBlZmZldHMuYWRkKGN1cnJlbnRFZmZlY3QpO1xuICB9XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvY29yZS9pc0NvbGlkZS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL2NvcmUvaXNDb2xpZGUudHNcIjtpbXBvcnQgdHlwZSB7IFZlYzIgfSBmcm9tIFwiLi9WZWMyXCI7XG5cbmV4cG9ydCBjb25zdCBpc0NvbGlkZSA9IChhOiBWZWMyLCBiOiBWZWMyLCBzYTogVmVjMiwgc2I6IFZlYzIpID0+IHtcbiAgaWYgKFxuICAgIGZhbHNlXG4gICAgfHwgKFxuICAgICAgdHJ1ZVxuICAgICAgJiYgYS54ID49IGIueCAtIHNiLnhcbiAgICAgICYmIGEueSA+PSBiLnkgLSBzYi55XG4gICAgICAmJiBhLnggPD0gYi54XG4gICAgICAmJiBhLnkgPD0gYi55XG4gICAgKVxuICAgIHx8IChcbiAgICAgIHRydWVcbiAgICAgICYmIGEueCArIHNhLnggPj0gYi54XG4gICAgICAmJiBhLnkgKyBzYS55ID49IGIueVxuICAgICAgJiYgYS54IDw9IGIueCArIHNiLnhcbiAgICAgICYmIGEueSA8PSBiLnkgKyBzYi55XG4gICAgKVxuICApIHJldHVybiB0cnVlO1xuXG4gIHJldHVybiBmYWxzZTtcbn07IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvRW50aXR5LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL0VudGl0eS50c1wiO2ltcG9ydCB7IGlzQ29saWRlIH0gZnJvbSBcIi4uLy4uL2NvcmUvaXNDb2xpZGVcIjtcbmltcG9ydCB7IHBvaW50IH0gZnJvbSBcIi4uLy4uL2NvcmUvcG9pbnRcIjtcbmltcG9ydCB7IFZlYzIgfSBmcm9tIFwiLi4vLi4vY29yZS9WZWMyXCI7XG5pbXBvcnQgeyBHYW1lIH0gZnJvbSBcIi4vR2FtZVwiO1xuXG5jb25zdCBtZSA9IHBvaW50KCk7XG5jb25zdCBzaXplID0gcG9pbnQoKTtcbmNvbnN0IHBvcyA9IHBvaW50KCk7XG5jb25zdCBvYmogPSBwb2ludCgpO1xuXG5leHBvcnQgY2xhc3MgRW50aXR5IGV4dGVuZHMgVmVjMiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBnYW1lOiBHYW1lLFxuICAgIHg6IG51bWJlcixcbiAgICB5OiBudW1iZXJcbiAgKSB7XG4gICAgc3VwZXIoeCwgeSk7XG4gIH1cblxuICBjaGVja0NvbGxpc2lvbihvOiBWZWMyLCBvdmVyID0gMSkge1xuICAgIGNvbnN0IHMgPSAxIC0gb3ZlcjtcblxuICAgIG1lLnNldCh0aGlzKS5wbHVzKHMgLyAyKTtcbiAgICBwb3Muc2V0KG8pLnBsdXMocyAvIDIpO1xuICAgIHNpemUuc2V0KG92ZXIpO1xuICAgIG9iai5zZXQob3Zlcik7XG5cbiAgICByZXR1cm4gaXNDb2xpZGUobWUsIHBvcywgc2l6ZSwgb2JqKTtcbiAgfVxuXG4gIHVwZGF0ZShkdGltZTogbnVtYmVyLCB0aW1lOiBudW1iZXIpOiB2b2lkIHsgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL0VmZmVjdC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9FZmZlY3QudHNcIjtpbXBvcnQgeyBwaWNrIH0gZnJvbSBcIi4uLy4uL2NvcmUvcGlja1wiO1xuaW1wb3J0IHsgRUVmZmVjdCwgRU1hcEl0ZW0gfSBmcm9tIFwiLi4vLi4vc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tIFwiLi9FbnRpdHlcIjtcbmltcG9ydCB7IEdhbWUgfSBmcm9tIFwiLi9HYW1lXCI7XG5cbmV4cG9ydCBjbGFzcyBFZmZlY3QgZXh0ZW5kcyBFbnRpdHkge1xuICBpZCE6IG51bWJlcjtcbiAgdHlwZTogRUVmZmVjdDtcbiAgdGltZSA9IERhdGUubm93KCk7XG4gIG1ldGE6IG51bWJlcltdID0gW107XG5cbiAgZ2V0IGRlbHRhVGltZSgpIHsgcmV0dXJuIERhdGUubm93KCkgLSB0aGlzLnRpbWU7IH1cblxuICBjb25zdHJ1Y3RvcihnYW1lOiBHYW1lLCB4OiBudW1iZXIsIHk6IG51bWJlciwgdHlwZTogRUVmZmVjdCwgbWV0YTogbnVtYmVyW10gPSBbXSkge1xuICAgIHN1cGVyKGdhbWUsIHgsIHkpO1xuICAgIHRoaXMuaWQgPSBnYW1lLmVmZmVjdHNDb3VudGVyKys7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB0aGlzLm1ldGEgPSBtZXRhO1xuICB9XG5cbiAgdXBkYXRlKGR0aW1lOiBudW1iZXIsIHRpbWU6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHsgeCwgeSB9ID0gdGhpcy5jcm91bmQoKTtcbiAgICBjb25zdCB7IG1hcCwgd2lkdGggfSA9IHRoaXMuZ2FtZTtcbiAgICBjb25zdCB2YWx1ZSA9IG1hcFt3aWR0aCAqIHkgKyB4XTtcblxuICAgIGlmICh2YWx1ZSA9PT0gRU1hcEl0ZW0uV0FMTCB8fCB2YWx1ZSA9PT0gRU1hcEl0ZW0uQkxPQ0spXG4gICAgICB0aGlzLmdhbWUuZWZmZWN0cy5kZWxldGUodGhpcyk7XG4gIH1cblxuICBnZXQgaW5mbygpIHtcbiAgICByZXR1cm4gcGljayhcbiAgICAgIHRoaXMsXG4gICAgICBbXG4gICAgICAgICdpZCcsXG4gICAgICAgICd4JyxcbiAgICAgICAgJ3knLFxuICAgICAgICAndHlwZScsXG4gICAgICAgICdkZWx0YVRpbWUnLFxuICAgICAgICAnbWV0YSdcbiAgICAgIF1cbiAgICApO1xuICB9XG5cbiAgZ2V0IGluZm9UeXBlKCkge1xuICAgIHJldHVybiBwaWNrKFxuICAgICAgdGhpcyxcbiAgICAgIFtcbiAgICAgICAgJ3R5cGUnXG4gICAgICBdXG4gICAgKTtcbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL0V4cGxvZGUudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvRXhwbG9kZS50c1wiO2ltcG9ydCB7IHBpY2sgfSBmcm9tIFwiLi4vLi4vY29yZS9waWNrXCI7XG5pbXBvcnQgeyBwb2ludCB9IGZyb20gXCIuLi8uLi9jb3JlL3BvaW50XCI7XG5pbXBvcnQgeyBFRXhwbG9kZURpciwgRU1hcEl0ZW0sIEVTb3VuZHMsIEVYUE9ERVJfRElSUyB9IGZyb20gXCIuLi8uLi9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7IEFjaGl2bWVudCB9IGZyb20gXCIuL0FjaGl2bWVudFwiO1xuaW1wb3J0IHsgQm9tYiB9IGZyb20gXCIuL0JvbWJcIjtcbmltcG9ydCB7IEVudGl0eSB9IGZyb20gXCIuL0VudGl0eVwiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vUGxheWVyXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4cGxvZGVQb2luIHtcbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIGRpcjogRUV4cGxvZGVEaXI7XG4gIGlzRmluYWx5OiBib29sZWFuO1xuICBpc0Jsb2NrOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgRXhwbG9kZVBvaW50IGV4dGVuZHMgRW50aXR5IHtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgZXhwbG9kZTogRXhwbG9kZSxcbiAgICB4OiBudW1iZXIsXG4gICAgeTogbnVtYmVyLFxuICAgIHB1YmxpYyBkaXI6IEVFeHBsb2RlRGlyLFxuICAgIHB1YmxpYyBpc0ZpbmFseTogYm9vbGVhbiA9IGZhbHNlLFxuICAgIHB1YmxpYyBpc0Jsb2NrOiBib29sZWFuID0gZmFsc2VcbiAgKSB7IHN1cGVyKGV4cGxvZGUuZ2FtZSwgeCwgeSk7IH1cblxuICB1cGRhdGUoZHRpbWU6IG51bWJlciwgdGltZTogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgeyBib21icywgYWNoaXZtZW50cyB9ID0gdGhpcy5nYW1lO1xuXG4gICAgZm9yIChjb25zdCBib21iIG9mIGJvbWJzKSB7XG4gICAgICBpZiAoYm9tYi5jaGVja0NvbGxpc2lvbih0aGlzLCAuNykpIHtcbiAgICAgICAgYm9tYi5wbGF5ZXIgPSB0aGlzLmV4cGxvZGUucGxheWVyO1xuICAgICAgICBFeHBsb2RlLnJ1bihib21iKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNCbG9jaykge1xuICAgICAgZm9yIChjb25zdCBhY2hpdm1lbnQgb2YgYWNoaXZtZW50cykge1xuICAgICAgICBpZiAoYWNoaXZtZW50LmNoZWNrQ29sbGlzaW9uKHRoaXMsIC45KSlcbiAgICAgICAgICBhY2hpdm1lbnRzLmRlbGV0ZShhY2hpdm1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRXhwbG9kZSBleHRlbmRzIEVudGl0eSB7XG4gIGlkITogbnVtYmVyO1xuICAjcG9pbnRzOiBFeHBsb2RlUG9pbnRbXSA9IFtdO1xuICBjcmVhdGVkID0gRGF0ZS5ub3coKTtcbiAgbGl2ZVRpbWUgPSA1MDA7XG4gIHJhZGl1cyA9IDE7XG4gIHBsYXllcjogUGxheWVyO1xuXG4gIGlnbm9yZSA9IG5ldyBTZXQ8UGxheWVyPigpO1xuXG4gIGNvbnN0cnVjdG9yKGJvbWI6IEJvbWIpIHtcbiAgICBzdXBlcihib21iLmdhbWUsIGJvbWIueCwgYm9tYi55KTtcbiAgICB0aGlzLmlkID0gYm9tYi5nYW1lLmV4cGxvZGVzQ291bnRlcisrO1xuICAgIHRoaXMucmFkaXVzID0gYm9tYi5yYWRpdXM7XG4gICAgdGhpcy5wbGF5ZXIgPSBib21iLnBsYXllcjtcbiAgICB0aGlzLmV4cGxvZGUoKTtcbiAgfVxuXG4gIHN0YXRpYyBydW4oYm9tYjogQm9tYikge1xuICAgIGNvbnN0IHsgYm9tYnMsIGV4cGxvZGVzLCBwbGF5ZXJzIH0gPSBib21iLmdhbWU7XG5cbiAgICBwbGF5ZXJzLmZvckVhY2gocGxheWVyID0+IHtcbiAgICAgIHBsYXllci5uZXdBcGkucGxheVNvdW5kUG9zaXRpb24oe1xuICAgICAgICBzb3VuZDogRVNvdW5kcy5leHBsb2RlLFxuICAgICAgICBwb3NpdGlvbjogYm9tYlxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpZiAoYm9tYnMuZGVsZXRlKGJvbWIpKSB7XG4gICAgICBib21iLnJvdW5kKCk7XG4gICAgICBleHBsb2Rlcy5hZGQobmV3IEV4cGxvZGUoYm9tYikpO1xuICAgIH1cbiAgfVxuXG4gIGV4cGxvZGUoKSB7XG4gICAgY29uc3QgcG9pbnRzID0gdGhpcy4jcG9pbnRzO1xuICAgIGNvbnN0IHtcbiAgICAgIHgsXG4gICAgICB5LFxuICAgICAgcmFkaXVzLFxuICAgICAgZ2FtZVxuICAgIH0gPSB0aGlzO1xuXG4gICAgY29uc3Qge1xuICAgICAgd2lkdGgsXG4gICAgICBoZWlnaHQsXG4gICAgICBtYXBcbiAgICB9ID0gZ2FtZTtcblxuICAgIGNvbnN0IHZlYyA9IHBvaW50KCk7XG5cbiAgICBmb3IgKGNvbnN0IFtfaWQsIGRpcmVjdGlvbl0gb2YgT2JqZWN0LmVudHJpZXMoRVhQT0RFUl9ESVJTKSkge1xuICAgICAgY29uc3QgeyB4OiBkeCwgeTogZHkgfSA9IGRpcmVjdGlvbjtcbiAgICAgIGNvbnN0IGRpcjogRUV4cGxvZGVEaXIgPSArX2lkIGFzIGFueTtcblxuICAgICAgZm9yIChsZXQgaSA9ICtfaWQgPyAxIDogMDsgaSA8PSByYWRpdXM7IGkrKykge1xuICAgICAgICBjb25zdCB4ID0gaSAqIGR4ICsgdGhpcy54O1xuICAgICAgICBjb25zdCB5ID0gaSAqIGR5ICsgdGhpcy55O1xuICAgICAgICBjb25zdCBpbmRleCA9IHggKyB5ICogd2lkdGg7XG5cbiAgICAgICAgdmVjLnNldCh4LCB5KTtcblxuICAgICAgICBpZiAoeCA8IDAgfHwgeCA+IHdpZHRoIC0gMSB8fCB5IDwgMCB8fCB5ID4gaGVpZ2h0IC0gMSlcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBpZiAobWFwW2luZGV4XSA9PT0gRU1hcEl0ZW0uV0FMTCB8fCBtYXBbaW5kZXhdID09PSBFTWFwSXRlbS5CTE9DSykge1xuICAgICAgICAgIGlmIChtYXBbaW5kZXhdID09IEVNYXBJdGVtLkJMT0NLKSB7XG4gICAgICAgICAgICBtYXBbaW5kZXhdID0gRU1hcEl0ZW0uQ0xFQVI7XG5cbiAgICAgICAgICAgIGlmIChtYXAuYWNoaXZtZW50cy5kZWxldGUoaW5kZXgpKSB7XG4gICAgICAgICAgICAgIHRoaXMuZ2FtZS5hY2hpdm1lbnRzLmFkZChcbiAgICAgICAgICAgICAgICBuZXcgQWNoaXZtZW50KHRoaXMuZ2FtZSwgeCwgeSlcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcG9pbnRzLnB1c2gobmV3IEV4cGxvZGVQb2ludCh0aGlzLCB4LCB5LCBkaXIsIHRydWUsIHRydWUpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBsYXN0ID0gcG9pbnRzLnNsaWNlKC0xKVswXTtcbiAgICAgICAgICBpZiAobGFzdClcbiAgICAgICAgICAgIGxhc3QuaXNGaW5hbHkgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcG9pbnRzLnB1c2gobmV3IEV4cGxvZGVQb2ludCh0aGlzLCB4LCB5LCBkaXIsIHJhZGl1cyA9PT0gaSkpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IHsgeCwgeSB9IG9mIHBvaW50cykge1xuICAgICAgICBjb25zdCBpbmRleCA9IHkgKiB3aWR0aCArIHg7XG4gICAgICAgIGlmIChtYXBbaW5kZXhdID09PSBFTWFwSXRlbS5DTEVBUilcbiAgICAgICAgICBtYXBbaW5kZXhdID0gRU1hcEl0ZW0uR1JBUztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB1cGRhdGUoZHRpbWU6IG51bWJlciwgdGltZTogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgeyBleHBsb2RlcyB9ID0gdGhpcy5nYW1lO1xuICAgIGNvbnN0IHsgY3JlYXRlZCwgbGl2ZVRpbWUgfSA9IHRoaXM7XG5cbiAgICBpZiAoRGF0ZS5ub3coKSA+IGNyZWF0ZWQgKyBsaXZlVGltZSkge1xuICAgICAgZXhwbG9kZXMuZGVsZXRlKHRoaXMpO1xuICAgICAgdGhpcy5pZ25vcmUuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHBvaW50IG9mIHRoaXMucG9pbnRzIGFzIEVudGl0eVtdKSB7XG4gICAgICBwb2ludC51cGRhdGUoZHRpbWUsIHRpbWUpO1xuICAgIH1cbiAgfVxuXG4gIGdldCBwb2ludHMoKSB7XG4gICAgcmV0dXJuIChbXSBhcyBFeHBsb2RlUG9pbnRbXSkuY29uY2F0KHRoaXMuI3BvaW50cyk7XG4gIH1cblxuICBnZXQgaW5mbygpIHtcbiAgICByZXR1cm4gcGljayh0aGlzLCBbXG4gICAgICAnaWQnLFxuICAgICAgJ3gnLFxuICAgICAgJ3knLFxuICAgICAgJ3BvaW50cydcbiAgICBdKTtcbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL01vdmluZ0VmZmVjdC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9Nb3ZpbmdFZmZlY3QudHNcIjtpbXBvcnQgeyBNT1ZJTkdfVElNRSB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29uZmlnXCI7XG5pbXBvcnQgeyBFU291bmRzIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vUGxheWVyXCI7XG5pbXBvcnQgeyBQbGF5ZXJFZmZlY3QgfSBmcm9tIFwiLi9QbGF5ZXJFZmZlY3RcIjtcblxuZXhwb3J0IGNsYXNzIE1vdmluZ0VmZmVjdCBleHRlbmRzIFBsYXllckVmZmVjdCB7XG4gIG9uQ3JlYXRlKCk6IHZvaWQge1xuICAgIHRoaXMucGxheWVyLm5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy5tb3ZpbmcpO1xuICB9XG4gIG9uRGVsZXRlKCk6IHZvaWQge1xuICAgIHRoaXMucGxheWVyLm5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy5tb3ZpbmcpO1xuICB9XG5cbiAgc3RhdGljIGdldChwbGF5ZXI6IFBsYXllcik6IE1vdmluZ0VmZmVjdCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmdldEVmZmVjdHMocGxheWVyLCB0aGlzKVswXTtcbiAgfVxuXG4gIHN0YXRpYyBoYXNTaGllbGQocGxheWVyOiBQbGF5ZXIpIHtcbiAgICByZXR1cm4gISF0aGlzLmdldChwbGF5ZXIpO1xuICB9XG5cbiAgc3RhdGljIGRlbGV0ZShwbGF5ZXI6IFBsYXllcikge1xuICAgIHRoaXMuZ2V0KHBsYXllcik/LmRlbGV0ZSgpO1xuICB9XG5cbiAgc3RhdGljIGFwcGVuZChwbGF5ZXI6IFBsYXllcikge1xuICAgIGNvbnN0IGVmZmV0cyA9IHRoaXMuZWZmZWN0cyhwbGF5ZXIpO1xuICAgIGNvbnN0IGN1cnJlbnRFZmZlY3QgPSB0aGlzLmdldChwbGF5ZXIpID8/IG5ldyB0aGlzKHBsYXllcik7XG4gICAgY3VycmVudEVmZmVjdC5hcHBlbmRUaW1lKE1PVklOR19USU1FKTtcbiAgICBlZmZldHMuYWRkKGN1cnJlbnRFZmZlY3QpO1xuICB9XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvUmFkaXVzRWZmZWN0LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL1JhZGl1c0VmZmVjdC50c1wiO2ltcG9ydCB7IFBsYXllciB9IGZyb20gXCIuL1BsYXllclwiO1xuaW1wb3J0IHsgUGxheWVyRWZmZWN0IH0gZnJvbSBcIi4vUGxheWVyRWZmZWN0XCI7XG5cbmV4cG9ydCBjbGFzcyBSYWRpdXNFZmZlY3QgZXh0ZW5kcyBQbGF5ZXJFZmZlY3Qge1xuICBzdGF0aWMgY291bnQocGxheWVyOiBQbGF5ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRFZmZlY3RzKHBsYXllciwgdGhpcykubGVuZ3RoO1xuICB9XG5cbiAgc3RhdGljIGFwcGVuZChwbGF5ZXI6IFBsYXllcikge1xuICAgIGNvbnN0IGVmZmVjdHMgPSB0aGlzLmVmZmVjdHMocGxheWVyKTtcbiAgICBlZmZlY3RzLmFkZChuZXcgUmFkaXVzRWZmZWN0KHBsYXllcikpO1xuICB9XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvQm9tYi50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9Cb21iLnRzXCI7aW1wb3J0IHsgcGljayB9IGZyb20gXCIuLi8uLi9jb3JlL3BpY2tcIjtcbmltcG9ydCB7IHBvaW50IH0gZnJvbSBcIi4uLy4uL2NvcmUvcG9pbnRcIjtcbmltcG9ydCB7IFZlYzIgfSBmcm9tIFwiLi4vLi4vY29yZS9WZWMyXCI7XG5pbXBvcnQgeyBCT01CX1RJTUUsIENSQVpZX0JPTUJfQk9PU1QsIENSQVpZX0JPTUJfTUFYLCBDUkFaWV9CT01CX01JTiB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29uZmlnXCI7XG5pbXBvcnQgeyBESVJFQ1RJT05TLCBFQW5pbWF0ZSwgRUVmZmVjdCwgRU1hcEl0ZW0sIEVTb3VuZHMgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBDcmFzeUJvbWJFZmZlY3QgfSBmcm9tIFwiLi9DcmFzeUJvbWJFZmZlY3RcIjtcbmltcG9ydCB7IEVmZmVjdCB9IGZyb20gXCIuL0VmZmVjdFwiO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSBcIi4vRW50aXR5XCI7XG5pbXBvcnQgeyBFeHBsb2RlIH0gZnJvbSBcIi4vRXhwbG9kZVwiO1xuaW1wb3J0IHsgTW92aW5nRWZmZWN0IH0gZnJvbSBcIi4vTW92aW5nRWZmZWN0XCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9QbGF5ZXJcIjtcbmltcG9ydCB7IFJhZGl1c0VmZmVjdCB9IGZyb20gXCIuL1JhZGl1c0VmZmVjdFwiO1xuXG5leHBvcnQgY2xhc3MgQm9tYiBleHRlbmRzIEVudGl0eSB7XG4gIGlkITogbnVtYmVyO1xuICBjcmVhdG9yITogUGxheWVyO1xuXG4gIHRpbWUgPSBEYXRlLm5vdygpO1xuICBsaXZlVGltZSA9IEJPTUJfVElNRTtcbiAgZGlyPzogVmVjMjtcblxuICBpc0Zha2UgPSBmYWxzZTtcbiAgcmFkaXVzID0gMTtcblxuICBtYWtlZCA9IHRydWU7XG5cbiAgaXNDcmF6eSA9IGZhbHNlO1xuICBpc1JhZGlvID0gZmFsc2U7XG4gIGdldCBpc01vdmUoKSB7IHJldHVybiAhIXRoaXMuZGlyOyB9XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHBsYXllcjogUGxheWVyXG4gICkge1xuICAgIGNvbnN0IHggPSBNYXRoLnJvdW5kKHBsYXllci54KTtcbiAgICBjb25zdCB5ID0gTWF0aC5yb3VuZChwbGF5ZXIueSk7XG4gICAgc3VwZXIocGxheWVyLmdhbWUsIHgsIHkpO1xuICAgIHRoaXMuY3JlYXRvciA9IHBsYXllcjtcbiAgICB0aGlzLmlkID0gcGxheWVyLmdhbWUuYm9tYnNDb3VudGVyKys7XG4gICAgdGhpcy5yYWRpdXMgPSBSYWRpdXNFZmZlY3QuY291bnQocGxheWVyKSArIDE7XG4gICAgdGhpcy5pc0NyYXp5ID0gISFDcmFzeUJvbWJFZmZlY3QuZ2V0KHBsYXllcik7XG5cbiAgICBpZiAodGhpcy5pc0NyYXp5KSB7XG4gICAgICB0aGlzLmlzRmFrZSA9IE1hdGgucmFuZG9tKCkgPCAuMSA/IHRydWUgOiBmYWxzZTtcblxuICAgICAgdGhpcy5saXZlVGltZSA9IENSQVpZX0JPTUJfTUlOICsgKFxuICAgICAgICBNYXRoLnJhbmRvbSgpICogKENSQVpZX0JPTUJfTUFYIC0gQ1JBWllfQk9NQl9NSU4pXG4gICAgICApO1xuXG4gICAgICB0aGlzLnJhZGl1cyA9IHRoaXMucmFkaXVzICsgKFxuICAgICAgICBNYXRoLnJhbmRvbSgpICogKHRoaXMucmFkaXVzICogQ1JBWllfQk9NQl9CT09TVCAtIHRoaXMucmFkaXVzKVxuICAgICAgKSB8IDA7XG4gICAgfVxuICB9XG5cbiAgZ2V0IGluZm8oKSB7XG4gICAgcmV0dXJuIHBpY2sodGhpcywgW1xuICAgICAgJ2lkJyxcbiAgICAgICd4JyxcbiAgICAgICd5JyxcbiAgICAgICdpc01vdmUnLFxuICAgICAgJ3JhZGl1cycsXG4gICAgICAnaXNDcmF6eScsXG4gICAgICAnaXNSYWRpbycsXG4gICAgXSk7XG4gIH1cblxuICB1cGRhdGUoZHRpbWU6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHsgdGltZSwgbGl2ZVRpbWUsIGdhbWU6IHsgd2FpdEZvclJlc3RhcnQsIHBsYXllcnMsIGJvbWJzLCBtYXAsIGFjaGl2bWVudHMgfSwgcGxheWVyIH0gPSB0aGlzO1xuXG4gICAgaWYgKCF0aGlzLmRpcikge1xuICAgICAgY29uc3QgbWFwVmFsdWUgPSB0aGlzLmdhbWUubWFwW3RoaXMuY2Zsb29yKCkudGltZXMoMSwgdGhpcy5nYW1lLndpZHRoKS5zdW0oKV07XG5cbiAgICAgIGlmIChtYXBWYWx1ZSA9PT0gRU1hcEl0ZW0uV0FMTCB8fCBtYXBWYWx1ZSA9PT0gRU1hcEl0ZW0uQkxPQ0spIHtcbiAgICAgICAgdGhpcy5nYW1lLmJvbWJzLmRlbGV0ZSh0aGlzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghcGxheWVyLmNoZWNrQ29sbGlzaW9uKHRoaXMsIC41KSAmJiB0aGlzLm1ha2VkKSB7XG4gICAgICB0aGlzLm1ha2VkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLm1ha2VkICYmICF0aGlzLmRpcikge1xuICAgICAgZm9yIChjb25zdCBwbGF5ZXIgb2YgcGxheWVycykge1xuICAgICAgICBpZiAocGxheWVyLmFuaW1hdGUgPT09IEVBbmltYXRlLklETEUpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoIU1vdmluZ0VmZmVjdC5nZXQocGxheWVyKSkgY29udGludWU7XG4gICAgICAgIGlmIChwbGF5ZXIuaXNEZWF0aCB8fCAhcGxheWVyLmluR2FtZSkgY29udGludWU7XG4gICAgICAgIGlmIChwbGF5ZXIuY2hlY2tDb2xsaXNpb24odGhpcykgJiYgIXRoaXMuZGlyKSB7XG4gICAgICAgICAgY29uc3QgZGlyID0gdGhpcy5jbWludXMocGxheWVyKS5yb3VuZCgpO1xuICAgICAgICAgIGlmIChkaXIuZXF1YWwoRElSRUNUSU9OU1twbGF5ZXIuZGlyXSkpIHtcbiAgICAgICAgICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICAgICAgICAgICAgdGhpcy5kaXIgPSBkaXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZGlyICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG1vdmUgPSB0aGlzLmRpcjtcbiAgICAgIGNvbnN0IG5ld1NldCA9IHRoaXMuY3BsdXMobW92ZS5jdGltZXMoLjMpKTtcbiAgICAgIGxldCBoYXZlQ29saWRlID0gZmFsc2U7XG5cbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBib21icykge1xuICAgICAgICBpZiAoaGF2ZUNvbGlkZSkgY29udGludWU7XG4gICAgICAgIGlmICh0aGlzID09PSBpdGVtKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGl0ZW0uY2hlY2tDb2xsaXNpb24obmV3U2V0LCAuOCkpIGhhdmVDb2xpZGUgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcGxheWVycykge1xuICAgICAgICBpZiAoaGF2ZUNvbGlkZSkgY29udGludWU7XG4gICAgICAgIGlmIChpdGVtLmlzRGVhdGggfHwgIWl0ZW0uaW5HYW1lKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGl0ZW0uY2hlY2tDb2xsaXNpb24obmV3U2V0LCAuOCkpIGhhdmVDb2xpZGUgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgYWNoaXZtZW50cykge1xuICAgICAgICBpZiAoaGF2ZUNvbGlkZSkgY29udGludWU7XG4gICAgICAgIGlmIChpdGVtLmNoZWNrQ29sbGlzaW9uKG5ld1NldCwgLjgpKSBoYXZlQ29saWRlID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdmVjID0gcG9pbnQoKTtcblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXAubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGhhdmVDb2xpZGUpIGNvbnRpbnVlO1xuICAgICAgICBpZiAobWFwW2ldID09PSBFTWFwSXRlbS5CTE9DSyB8fCBtYXBbaV0gPT09IEVNYXBJdGVtLldBTEwpIHtcblxuICAgICAgICAgIHZlYy5zZXQoaSAlIG1hcC53aWR0aCwgaSAvIG1hcC53aWR0aCB8IDApO1xuICAgICAgICAgIGlmIChFbnRpdHkucHJvdG90eXBlLmNoZWNrQ29sbGlzaW9uLmNhbGwodmVjLCBuZXdTZXQsIC44KSkgaGF2ZUNvbGlkZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG5ld1NldC54IDwgMCB8fCBuZXdTZXQueSA8IDAgfHwgbmV3U2V0LnggPiBtYXAud2lkdGggLSAxIHx8IG5ld1NldC55ID4gbWFwLmhlaWdodCAtIDEpXG4gICAgICAgIGhhdmVDb2xpZGUgPSB0cnVlO1xuXG4gICAgICBpZiAoaGF2ZUNvbGlkZSkge1xuICAgICAgICB0aGlzLnJvdW5kKCk7XG4gICAgICAgIHRoaXMuZGlyID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wbHVzKG1vdmUuY3RpbWVzKGR0aW1lICogLjAxKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKERhdGUubm93KCkgPiB0aW1lICsgbGl2ZVRpbWUgJiYgd2FpdEZvclJlc3RhcnQgPCAwKSB7XG4gICAgICBpZiAodGhpcy5pc0Zha2UpIHtcbiAgICAgICAgdGhpcy5nYW1lLmJvbWJzLmRlbGV0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5nYW1lLmVmZmVjdHMuYWRkKFxuICAgICAgICAgIG5ldyBFZmZlY3QodGhpcy5nYW1lLCB0aGlzLngsIHRoaXMueSwgRUVmZmVjdC5GQUtFX0VYUExPREUpXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMucGxheWVyLmdhbWUucGxheWVycy5mb3JFYWNoKHBsYXllciA9PiB7XG4gICAgICAgICAgcGxheWVyLm5ld0FwaS5wbGF5U291bmRQb3NpdGlvbih7XG4gICAgICAgICAgICBzb3VuZDogRVNvdW5kcy5leHBsb2RlRmFpbCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB0aGlzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIEV4cGxvZGUucnVuKHRoaXMpO1xuICAgIH1cbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL1NoaWVsZEVmZmVjdC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9TaGllbGRFZmZlY3QudHNcIjtpbXBvcnQgeyBTSElFTERfVElNRSB9IGZyb20gXCIuLi8uLi9zaGFyZWQvY29uZmlnXCI7XG5pbXBvcnQgeyBFU291bmRzIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vUGxheWVyXCI7XG5pbXBvcnQgeyBQbGF5ZXJFZmZlY3QgfSBmcm9tIFwiLi9QbGF5ZXJFZmZlY3RcIjtcblxuZXhwb3J0IGNsYXNzIFNoaWVsZEVmZmVjdCBleHRlbmRzIFBsYXllckVmZmVjdCB7XG4gIG9uQ3JlYXRlKCk6IHZvaWQge1xuICAgIHRoaXMucGxheWVyLm5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy5zaGllbGQpO1xuICB9XG4gIG9uRGVsZXRlKCk6IHZvaWQge1xuICAgIHRoaXMucGxheWVyLm5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy5zaGllbGQpO1xuICB9XG5cbiAgc3RhdGljIGdldChwbGF5ZXI6IFBsYXllcik6IFNoaWVsZEVmZmVjdCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmdldEVmZmVjdHMocGxheWVyLCB0aGlzKVswXTtcbiAgfVxuXG4gIHN0YXRpYyBoYXNTaGllbGQocGxheWVyOiBQbGF5ZXIpIHtcbiAgICByZXR1cm4gISF0aGlzLmdldChwbGF5ZXIpO1xuICB9XG5cbiAgc3RhdGljIGRlbGV0ZShwbGF5ZXI6IFBsYXllcikge1xuICAgIHRoaXMuZ2V0KHBsYXllcik/LmRlbGV0ZSgpO1xuICB9XG5cbiAgc3RhdGljIGFwcGVuZChwbGF5ZXI6IFBsYXllcikge1xuICAgIGNvbnN0IGVmZmV0cyA9IHRoaXMuZWZmZWN0cyhwbGF5ZXIpO1xuICAgIGNvbnN0IGN1cnJlbnRFZmZlY3QgPSB0aGlzLmdldChwbGF5ZXIpID8/IG5ldyB0aGlzKHBsYXllcik7XG4gICAgY3VycmVudEVmZmVjdC5hcHBlbmRUaW1lKFNISUVMRF9USU1FKTtcbiAgICBlZmZldHMuYWRkKGN1cnJlbnRFZmZlY3QpO1xuICB9XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvU3BlZWRFZmZlY3QudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvU3BlZWRFZmZlY3QudHNcIjtpbXBvcnQgeyBTUEVFRF9USU1FIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC9jb25maWdcIjtcbmltcG9ydCB7IEVTb3VuZHMgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL3R5cGVzXCI7XG5pbXBvcnQgeyBQbGF5ZXIgfSBmcm9tIFwiLi9QbGF5ZXJcIjtcbmltcG9ydCB7IFBsYXllckVmZmVjdCB9IGZyb20gXCIuL1BsYXllckVmZmVjdFwiO1xuXG5leHBvcnQgY2xhc3MgU3BlZWRFZmZlY3QgZXh0ZW5kcyBQbGF5ZXJFZmZlY3Qge1xuICB2YWx1ZSA9IDE7XG5cbiAgb25DcmVhdGUoKTogdm9pZCB7XG4gICAgY29uc3QgeyB2YWx1ZSwgcGxheWVyOiB7IG5ld0FwaSB9IH0gPSB0aGlzO1xuXG4gICAgaWYgKHZhbHVlID4gMSlcbiAgICAgIG5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy5zcGVlZE9uKTtcblxuICAgIGlmICh2YWx1ZSA8IDEpXG4gICAgICBuZXdBcGkucGxheVNvdW5kKEVTb3VuZHMuZmlyZU9uKTtcbiAgfVxuXG4gIG9uRGVsZXRlKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgdmFsdWUsIHBsYXllcjogeyBuZXdBcGkgfSB9ID0gdGhpcztcblxuICAgIGlmICh2YWx1ZSA+IDEpXG4gICAgICBuZXdBcGkucGxheVNvdW5kKEVTb3VuZHMuc3BlZWRPZmYpO1xuXG4gICAgaWYgKHZhbHVlIDwgMSlcbiAgICAgIG5ld0FwaS5wbGF5U291bmQoRVNvdW5kcy5maXJlT2ZmKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHBsYXllcjogUGxheWVyLCB2YWx1ZSA9IDEpIHtcbiAgICBzdXBlcihwbGF5ZXIpO1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIHN0YXRpYyBnZXQocGxheWVyOiBQbGF5ZXIpOiBTcGVlZEVmZmVjdCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmdldEVmZmVjdHMocGxheWVyLCB0aGlzKVswXTtcbiAgfVxuXG4gIHN0YXRpYyBnZXRWYWx1ZShwbGF5ZXI6IFBsYXllcikge1xuICAgIHJldHVybiB0aGlzLmdldChwbGF5ZXIpPy52YWx1ZSA/PyAxO1xuICB9XG5cbiAgc3RhdGljIGRlbGV0ZShwbGF5ZXI6IFBsYXllcikge1xuICAgIHRoaXMuZ2V0KHBsYXllcik/LmRlbGV0ZSgpO1xuICB9XG5cbiAgc3RhdGljIGFwcGVuZChwbGF5ZXI6IFBsYXllciwgdmFsdWUgPSAxKSB7XG4gICAgY29uc3QgZWZmZXRzID0gdGhpcy5lZmZlY3RzKHBsYXllcik7XG4gICAgY29uc3QgY3VycmVudEVmZmVjdCA9IHRoaXMuZ2V0KHBsYXllcikgPz8gbmV3IHRoaXMocGxheWVyLCB2YWx1ZSk7XG5cbiAgICBpZiAodmFsdWUgIT09IGN1cnJlbnRFZmZlY3QudmFsdWUpIHtcbiAgICAgIGN1cnJlbnRFZmZlY3QuYXBwZW5kVGltZSgtU1BFRURfVElNRSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY3VycmVudEVmZmVjdC52YWx1ZSA9IHZhbHVlO1xuICAgIGN1cnJlbnRFZmZlY3QuYXBwZW5kVGltZShTUEVFRF9USU1FKTtcbiAgICBlZmZldHMuYWRkKGN1cnJlbnRFZmZlY3QpO1xuICB9XG59IiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3MvQm9tYkVmZmVjdC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9Cb21iRWZmZWN0LnRzXCI7aW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vUGxheWVyXCI7XG5pbXBvcnQgeyBQbGF5ZXJFZmZlY3QgfSBmcm9tIFwiLi9QbGF5ZXJFZmZlY3RcIjtcblxuZXhwb3J0IGNsYXNzIEJvbWJFZmZlY3QgZXh0ZW5kcyBQbGF5ZXJFZmZlY3Qge1xuICBzdGF0aWMgY291bnQocGxheWVyOiBQbGF5ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRFZmZlY3RzKHBsYXllciwgdGhpcykubGVuZ3RoO1xuICB9XG5cbiAgc3RhdGljIGFwcGVuZChwbGF5ZXI6IFBsYXllcikge1xuICAgIGNvbnN0IGVmZmVjdHMgPSB0aGlzLmVmZmVjdHMocGxheWVyKTtcbiAgICBlZmZlY3RzLmFkZChuZXcgQm9tYkVmZmVjdChwbGF5ZXIpKTtcbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXIvY2xhc3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL0FjaGl2bWVudC50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9BY2hpdm1lbnQudHNcIjtpbXBvcnQgeyBwaWNrIH0gZnJvbSBcIi4uLy4uL2NvcmUvcGlja1wiO1xuaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSBcIi4uLy4uL2NvcmUvcmFuZG9tXCI7XG5pbXBvcnQgeyBFQWNoaXZtZW50LCBFTWFwSXRlbSwgRVNvdW5kcyB9IGZyb20gXCIuLi8uLi9zaGFyZWQvdHlwZXNcIjtcbmltcG9ydCB7IEJvbWJFZmZlY3QgfSBmcm9tIFwiLi9Cb21iRWZmZWN0XCI7XG5pbXBvcnQgeyBDcmFzeUJvbWJFZmZlY3QgfSBmcm9tIFwiLi9DcmFzeUJvbWJFZmZlY3RcIjtcbmltcG9ydCB7IEVudGl0eSB9IGZyb20gXCIuL0VudGl0eVwiO1xuaW1wb3J0IHsgR2FtZSB9IGZyb20gXCIuL0dhbWVcIjtcbmltcG9ydCB7IE1vdmluZ0VmZmVjdCB9IGZyb20gXCIuL01vdmluZ0VmZmVjdFwiO1xuaW1wb3J0IHsgUGxheWVyIH0gZnJvbSBcIi4vUGxheWVyXCI7XG5pbXBvcnQgeyBSYWRpdXNFZmZlY3QgfSBmcm9tIFwiLi9SYWRpdXNFZmZlY3RcIjtcbmltcG9ydCB7IFNoaWVsZEVmZmVjdCB9IGZyb20gXCIuL1NoaWVsZEVmZmVjdFwiO1xuaW1wb3J0IHsgU3BlZWRFZmZlY3QgfSBmcm9tIFwiLi9TcGVlZEVmZmVjdFwiO1xuXG5jb25zdCBTVE9SRSA9IFtcbiAgRUFjaGl2bWVudC5BUFBFTkRfQk9NQixcbiAgRUFjaGl2bWVudC5BUFBFTkRfRVhQTyxcbiAgRUFjaGl2bWVudC5BUFBFTkRfU0hJRUxELFxuICBFQWNoaXZtZW50LkFQUEVORF9TUEVFRCxcbiAgRUFjaGl2bWVudC5NT1ZJTkdfQk9NQixcbiAgRUFjaGl2bWVudC5GSVJFLFxuICBFQWNoaXZtZW50LkNSQVpZX0JPTUIsXG5dO1xuXG5leHBvcnQgY2xhc3MgQWNoaXZtZW50IGV4dGVuZHMgRW50aXR5IHtcbiAgaWQhOiBudW1iZXI7XG4gIGNvbnN0cnVjdG9yKFxuICAgIGdhbWU6IEdhbWUsXG4gICAgeDogbnVtYmVyLFxuICAgIHk6IG51bWJlcixcbiAgICBwdWJsaWMgdHlwZTogRUFjaGl2bWVudCA9IHJhbmRvbShbLi4uU1RPUkUsIEVBY2hpdm1lbnQuUkFORE9NXSlcbiAgKSB7XG4gICAgc3VwZXIoZ2FtZSwgeCwgeSk7XG4gICAgdGhpcy5pZCA9IGdhbWUuYWNoaXZtZW50c0NvdW50ZXIrKztcbiAgfVxuXG4gIGFjY2VwdChwbGF5ZXI6IFBsYXllciwgdHlwZSA9IHRoaXMudHlwZSk6IHZvaWQge1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSBFQWNoaXZtZW50LkFQUEVORF9CT01COiB7XG4gICAgICAgIEJvbWJFZmZlY3QuYXBwZW5kKHBsYXllcik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIEVBY2hpdm1lbnQuQVBQRU5EX0VYUE86IHtcbiAgICAgICAgUmFkaXVzRWZmZWN0LmFwcGVuZChwbGF5ZXIpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2FzZSBFQWNoaXZtZW50LkFQUEVORF9TSElFTEQ6IHtcbiAgICAgICAgU2hpZWxkRWZmZWN0LmFwcGVuZChwbGF5ZXIpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2FzZSBFQWNoaXZtZW50LkFQUEVORF9TUEVFRDoge1xuICAgICAgICBTcGVlZEVmZmVjdC5hcHBlbmQocGxheWVyLCAxLjUpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY2FzZSBFQWNoaXZtZW50Lk1PVklOR19CT01COiB7XG4gICAgICAgIE1vdmluZ0VmZmVjdC5hcHBlbmQocGxheWVyKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNhc2UgRUFjaGl2bWVudC5GSVJFOiB7XG4gICAgICAgIFNwZWVkRWZmZWN0LmFwcGVuZChwbGF5ZXIsIDAuNyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIEVBY2hpdm1lbnQuQ1JBWllfQk9NQjoge1xuICAgICAgICBDcmFzeUJvbWJFZmZlY3QuYXBwZW5kKHBsYXllcik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIEVBY2hpdm1lbnQuUkFORE9NOiB7XG4gICAgICAgIHJldHVybiB0aGlzLmFjY2VwdChwbGF5ZXIsIHJhbmRvbShTVE9SRSkpO1xuICAgICAgfVxuXG4gICAgICBkZWZhdWx0OiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdVbmtub3cnLCB0eXBlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBwbGF5ZXIubmV3QXBpLnBsYXlTb3VuZChFU291bmRzLmJvbnVzKTtcbiAgfVxuXG4gIHVwZGF0ZShkdGltZTogbnVtYmVyLCB0aW1lOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCBpID0gdGhpcy54ICsgdGhpcy55ICogdGhpcy5nYW1lLndpZHRoO1xuICAgIGlmICh0aGlzLmdhbWUubWFwW2ldID09PSBFTWFwSXRlbS5XQUxMKVxuICAgICAgdGhpcy5nYW1lLmFjaGl2bWVudHMuZGVsZXRlKHRoaXMpO1xuICB9XG5cblxuICBnZXQgaW5mbygpIHtcbiAgICByZXR1cm4gcGljayh0aGlzLCBbXG4gICAgICAnaWQnLFxuICAgICAgJ3gnLFxuICAgICAgJ3knLFxuICAgICAgJ3R5cGUnXG4gICAgXSk7XG4gIH1cbn0iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9jbGFzcy9HYW1lTWFwLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL2NsYXNzL0dhbWVNYXAudHNcIjtpbXBvcnQgeyBnZW5lcmF0ZVBlcmxpbk5vaXNlIH0gZnJvbSBcIkB2aWNpbXBhL3Blcmxpbi1ub2lzZVwiO1xuXG5pbXBvcnQgeyByYW5kb20gfSBmcm9tIFwiLi4vLi4vY29yZS9yYW5kb21cIjtcbmltcG9ydCB7IERJUkVDVElPTlMsIEVNYXBJdGVtIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC90eXBlc1wiO1xuaW1wb3J0IHsgR2FtZSB9IGZyb20gXCIuL0dhbWVcIjtcblxuaW1wb3J0IHR5cGUgeyBUQ29uZmlnIH0gZnJvbSBcIi4vR2FtZVwiO1xuXG5leHBvcnQgY2xhc3MgR2FtZU1hcCBleHRlbmRzIFVpbnQ4QXJyYXkge1xuICBnZXQgd2lkdGgoKSB7IHJldHVybiB0aGlzLmdhbWUud2lkdGg7IH07XG4gIGdldCBoZWlnaHQoKSB7IHJldHVybiB0aGlzLmdhbWUuaGVpZ2h0OyB9O1xuXG4gIGFjaGl2bWVudHMgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgbm9pemU6IG51bWJlcltdID0gW107XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIGdhbWU6IEdhbWVcbiAgKSB7XG4gICAgY29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnYW1lO1xuICAgIHN1cGVyKHdpZHRoICogaGVpZ2h0KTtcbiAgICB0aGlzLm5vaXplID0gZ2VuZXJhdGVQZXJsaW5Ob2lzZSh3aWR0aCwgaGVpZ2h0KTtcbiAgfVxuXG5cbiAgbGltaXQobiA9IDApIHtcbiAgICBjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IHRoaXM7XG4gICAgZm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKykge1xuICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCB3aWR0aDsgeCsrKSB7XG4gICAgICAgIGNvbnN0IGkgPSB4ICsgeSAqIHdpZHRoO1xuXG4gICAgICAgIGlmICh4IDwgbiB8fCB5IDwgbiB8fCB4ID4gd2lkdGggLSAxIC0gbiB8fCB5ID4gaGVpZ2h0IC0gMSAtIG4pXG4gICAgICAgICAgdGhpc1tpXSA9IEVNYXBJdGVtLldBTEw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGUoY29uZmlnOiBUQ29uZmlnKSB7XG4gICAgY29uc3QgeyB3aWR0aCwgfSA9IHRoaXM7XG5cbiAgICBjb25zdCB7XG4gICAgICBmaWxsQWNoaXZtZW50cyxcbiAgICAgIGZpbGxCbG9ja3MsXG4gICAgfSA9IGNvbmZpZztcblxuICAgIGNvbnN0IHBvc2l0aW9ucyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXG4gICAgdGhpcy5hY2hpdm1lbnRzLmNsZWFyKCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCB4ID0gaSAlIHdpZHRoO1xuICAgICAgbGV0IHkgPSBpIC8gd2lkdGg7XG5cbiAgICAgIGlmICh4ICYgMSAmJiB5ICYgMSkge1xuICAgICAgICB0aGlzW2ldID0gRU1hcEl0ZW0uV0FMTDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG4gPSB0aGlzLm5vaXplW2ldO1xuICAgICAgICB0aGlzW2ldID0gbiA8IC4xID8gRU1hcEl0ZW0uR1JBUyA6IG4gPCAuNCA/IEVNYXBJdGVtLlNBTkQgOiBFTWFwSXRlbS5DTEVBUjtcbiAgICAgICAgcG9zaXRpb25zLmFkZChpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHsgeDogWCwgeTogWSB9IG9mIHRoaXMuZ2FtZS5zdGFydFBvc2l0aW9ucykge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPD0gMjsgaSsrKSB7XG4gICAgICAgIGZvciAoY29uc3QgWywgZGlyXSBvZiBPYmplY3QuZW50cmllcyhESVJFQ1RJT05TKSkge1xuICAgICAgICAgIGNvbnN0IHsgeDogZHgsIHk6IGR5IH0gPSBkaXI7XG4gICAgICAgICAgbGV0IHggPSBYICsgZHggKiBpO1xuICAgICAgICAgIGxldCB5ID0gWSArIGR5ICogaTtcbiAgICAgICAgICBwb3NpdGlvbnMuZGVsZXRlKHggKyB5ICogd2lkdGgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYmxvY2tzQ291bnQgPSAoZmlsbEJsb2NrcyAlIDEpICogcG9zaXRpb25zLnNpemU7XG4gICAgY29uc3QgYmxvY2tzU3RvcmUgPSBuZXcgU2V0PG51bWJlcj4oKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmxvY2tzQ291bnQ7IGkrKykge1xuICAgICAgY29uc3QgcCA9IHJhbmRvbShbLi4ucG9zaXRpb25zXSk7XG4gICAgICBwb3NpdGlvbnMuZGVsZXRlKHApO1xuICAgICAgYmxvY2tzU3RvcmUuYWRkKHApO1xuICAgICAgdGhpc1twXSA9IEVNYXBJdGVtLkJMT0NLO1xuICAgIH1cblxuICAgIGNvbnN0IGFjaGl2bWVudHNDb3VudCA9IChmaWxsQWNoaXZtZW50cyAlIDEpICogYmxvY2tzU3RvcmUuc2l6ZTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWNoaXZtZW50c0NvdW50OyBpKyspIHtcbiAgICAgIGNvbnN0IHAgPSByYW5kb20oWy4uLmJsb2Nrc1N0b3JlXSk7XG4gICAgICBibG9ja3NTdG9yZS5kZWxldGUocCk7XG4gICAgICB0aGlzLmFjaGl2bWVudHMuYWRkKHApO1xuICAgICAgdGhpc1twXSA9IEVNYXBJdGVtLkJMT0NLO1xuICAgIH1cbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL3ZpYy9Db2RlUHJvamVjdHMvb3BlbmJvbWJlci9zZXJ2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy92aWMvQ29kZVByb2plY3RzL29wZW5ib21iZXIvc2VydmVyL3NlcnZlci50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvdmljL0NvZGVQcm9qZWN0cy9vcGVuYm9tYmVyL3NlcnZlci9zZXJ2ZXIudHNcIjtpbXBvcnQgeyBnYW1lIH0gZnJvbSBcIi4vbWFpblwiO1xuXG5pbXBvcnQgdHlwZSB7IFBsdWdpbk9wdGlvbiB9IGZyb20gXCJ2aXRlXCI7XG5cbmV4cG9ydCBjb25zdCB3ZWJTb2NrZXRTZXJ2ZXIgPSAoKTogUGx1Z2luT3B0aW9uID0+IHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcIldlYlNvY2tldFNlcnZlclwiLFxuICAgIGNvbmZpZ3VyZVByZXZpZXdTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZXR1cm4gZ2FtZShzZXJ2ZXIuaHR0cFNlcnZlcik7XG4gICAgfSxcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICByZXR1cm4gZ2FtZShzZXJ2ZXIuaHR0cFNlcnZlciEpO1xuICAgIH0sXG4gIH07XG59OyJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1IsT0FBTztBQUUvUixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLGNBQWM7QUFDckIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsc0JBQXNCO0FBQy9CLE9BQU8sV0FBVztBQUVsQixTQUFTLGNBQWM7QUFDdkIsT0FBTyxXQUFXOzs7QUNSbEIsU0FBUyxVQUFVLGdC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Z0IsUUFBUTtBQUN0QixhQUFPLEtBQUssT0FBTyxVQUFXO0FBQUEsSUFDaEM7QUFBQSxFQUNGO0FBQ0Y7OztBN0NEQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsRUFDTixNQUFNO0FBQUEsRUFDTixXQUFXO0FBQUEsRUFDWCxRQUFRO0FBQUEsRUFDUixXQUFXO0FBQUEsRUFDWCxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsRUFDVjtBQUFBLEVBRUEsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUVBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDUCxTQUFTO0FBQUEsSUFDVCxLQUFLO0FBQUEsSUFDTCxNQUFNLEVBQUUsU0FBUyxDQUFDLEdBQUcsY0FBYyxLQUFLLENBQUM7QUFBQSxJQUN6QyxPQUFPLEVBQUUsWUFBWSxzQkFBc0IsQ0FBQztBQUFBLElBQzVDLE1BQU0sRUFBRSxVQUFVLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztBQUFBLElBQ3hDLGVBQWU7QUFBQSxJQUNmLGdCQUFnQjtBQUFBLEVBQ2xCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsiY3JlYXRlTG9nZ2VyIiwgInNpemUiLCAiRVNvdW5kcyIsICJFRGlyIiwgIkVBbmltYXRlIiwgIkVBY2hpdm1lbnQiLCAiRUVmZmVjdCIsICJFRXhwbG9kZURpciIsICJtaW4iLCAibWF4IiwgInJhbmRvbSIsICJnYW1lIiwgImdhbWUiLCAibWFwIiwgInBvaW50cyIsICJnYW1lIiwgIm1hcCIsICJ4IiwgInkiLCAicG9pbnQiLCAiQm9tYiIsICJtYXAiLCAicGxheWVyIiwgIlBsYXllciIsICJnYW1lIiwgIkJvbWIiLCAicG9pbnQiLCAicGxheWVycyIsICJnYW1lIiwgInJhbmRvbSIsICJnYW1lIiwgInJhbmRvbSIsICJHYW1lIiwgInJhbmRvbSIsICJzaXplIiwgImZpbmQiLCAiUGxheWVyIiwgImxvZ2dlciIsICJjcmVhdGVMb2dnZXIiLCAiZ2FtZSIsICJHYW1lIl0KfQo=
