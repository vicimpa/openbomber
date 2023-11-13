import { point, points } from "../core/point";

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
  [EMapItem.CLEAR]: point(1, 3),
  [EMapItem.WALL]: point(0, 3),
  [EMapItem.BLOCK]: point(0, 4),
  [EMapItem.GRAS]: point(1, 1),
  [EMapItem.SAND]: point(1, 4),
  [EMapItem.WATER]: point(1, 1),
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
  [EDir.TOP]: point(0, -1),
  [EDir.LEFT]: point(-1, 0),
  [EDir.RIGHT]: point(1, 0),
  [EDir.BOTTOM]: point(0, 1)
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
  [EAchivment.APPEND_BOMB]: point(0, 0),
  [EAchivment.APPEND_EXPO]: point(1, 0),
  [EAchivment.APPEND_SPEED]: point(2, 0),
  [EAchivment.RANDOM]: point(3, 0),
  [EAchivment.APPEND_SHIELD]: point(4, 0),
  [EAchivment.MOVING_BOMB]: point(5, 0),
  [EAchivment.CRAZY_BOMB]: point(6, 0),
  [EAchivment.FIRE]: point(7, 0),
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
  [EExplodeDir.CENTER]: point(0, 0),
  [EExplodeDir.TOP]: point(0, -1),
  [EExplodeDir.LEFT]: point(-1, 0),
  [EExplodeDir.RIGHT]: point(1, 0),
  [EExplodeDir.BOTTOM]: point(0, 1)
};