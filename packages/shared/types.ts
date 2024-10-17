import { Vec2 } from "@vicimpa/lib-vec2";
import { points } from "@ob/core/point";

export type TChatInfo = {
  name: string;
};

export enum EMapItem {
  CLEAR,
  WALL,
  BLOCK,
  GRAS,
  SAND,
  WATER,
}

export const DEATH_FRAMES = points('0,0;0,1;0,2;0,3;0,4;0,5;0,6;0,7');

export const MAP_ITEMS = {
  [EMapItem.CLEAR]: new Vec2(1, 3),
  [EMapItem.WALL]: new Vec2(0, 3),
  [EMapItem.BLOCK]: new Vec2(0, 4),
  [EMapItem.GRAS]: new Vec2(1, 1),
  [EMapItem.SAND]: new Vec2(1, 4),
  [EMapItem.WATER]: new Vec2(1, 1),
};

export enum ESounds {
  win,
  bonus,
  death,
  putBomb,
  explode,
  newLife,
  message,
  shield,
  crazy,
  explodeFail,
  fireOn,
  fireOff,
  speedOn,
  speedOff,
  kill,
  moving,
}

export enum EDir {
  TOP,
  LEFT,
  RIGHT,
  BOTTOM
}

export enum EAnimate {
  IDLE,
  RUNNING
}

export const DIRECTIONS = {
  [EDir.TOP]: new Vec2(0, -1),
  [EDir.LEFT]: new Vec2(-1, 0),
  [EDir.RIGHT]: new Vec2(1, 0),
  [EDir.BOTTOM]: new Vec2(0, 1)
};

export enum EAchivment {
  APPEND_BOMB,
  APPEND_EXPO,
  APPEND_SPEED,
  RANDOM,
  APPEND_SHIELD,
  MOVING_BOMB,
  FIRE,
  CRAZY_BOMB,
}

export const ACHIVMEN_POINTS = {
  [EAchivment.APPEND_BOMB]: new Vec2(0, 0),
  [EAchivment.APPEND_EXPO]: new Vec2(1, 0),
  [EAchivment.APPEND_SPEED]: new Vec2(2, 0),
  [EAchivment.RANDOM]: new Vec2(3, 0),
  [EAchivment.APPEND_SHIELD]: new Vec2(4, 0),
  [EAchivment.MOVING_BOMB]: new Vec2(5, 0),
  [EAchivment.CRAZY_BOMB]: new Vec2(6, 0),
  [EAchivment.FIRE]: new Vec2(7, 0),
} as const;

export const ACHIVMEN_DESCRIPTION = {
  [EAchivment.APPEND_BOMB]: "Дополнительная бомба",
  [EAchivment.APPEND_EXPO]: "Увеличение радиуса",
  [EAchivment.APPEND_SPEED]: "Увеличение скорости",
  [EAchivment.RANDOM]: "Случайный эффект",
  [EAchivment.APPEND_SHIELD]: "Щит, защищающий от взрыва",
  [EAchivment.MOVING_BOMB]: "Толкание бомбы",
  [EAchivment.CRAZY_BOMB]: "Шальная (рандомная) бомба",
  [EAchivment.FIRE]: "Уменьшение скорости + огонь",
} as const;

export enum EEffect {
  DEATH,
  FAKE_EXPLODE,
}

export enum EExplodeDir {
  CENTER,
  TOP,
  LEFT,
  RIGHT,
  BOTTOM
}
export const EXPODER_DIRS = {
  [EExplodeDir.CENTER]: new Vec2(0, 0),
  [EExplodeDir.TOP]: new Vec2(0, -1),
  [EExplodeDir.LEFT]: new Vec2(-1, 0),
  [EExplodeDir.RIGHT]: new Vec2(1, 0),
  [EExplodeDir.BOTTOM]: new Vec2(0, 1)
};