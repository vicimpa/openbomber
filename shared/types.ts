import { point } from "../core/point";

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

export const MAP_ITEMS = {
  [EMapItem.CLEAR]: point(0, 0),
  [EMapItem.WALL]: point(2, 0),
  [EMapItem.BLOCK]: point(2, 1),
  [EMapItem.GRAS]: point(0, 1),
  [EMapItem.SAND]: point(1, 0),
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
  ROLLERS,
  APPEND_SPEED,
  APPEND_SHIELD,
  MOVING_BOMB,
  FIRE,
  RANDOM,
  CRAZY_BOMB,
}

export const ACHIVMEN_DESCRIPTION = {
  [EAchivment.APPEND_BOMB]: "Дополнительная бомба",
  [EAchivment.APPEND_EXPO]: "Увеличение радиуса",
  [EAchivment.ROLLERS]: "Эффект \"ролики\"",
  [EAchivment.APPEND_SPEED]: "Увеличение скорости",
  [EAchivment.APPEND_SHIELD]: "Щит, защищающий от взрыва",
  [EAchivment.MOVING_BOMB]: "Толкание бомбы",
  [EAchivment.FIRE]: "Уменьшение скорости + огонь",
  [EAchivment.RANDOM]: "Случайный эффект",
  [EAchivment.CRAZY_BOMB]: "Шальная (рандомная) бомба"
};

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