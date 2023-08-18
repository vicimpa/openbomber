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