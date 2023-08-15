import { point } from "./core/point";

import type { Bomb } from "./server/class/Bomb";
import type { Explode } from "./server/class/Explode";
import type { Game } from "./server/class/Game";
import type { Player } from "./server/class/Player";
import type { Achivment } from "./server/class/Achivment";
import type { Effect } from "./server/class/Effect";

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

export type TPlayer = {
  setStartPosition(x: number, y: number): void;
  updateMap(arrayBuffer: ArrayBuffer): void;
  updateBombs(bombs: Bomb['info'][]): void;
  updatePlayers(players: Player['info'][]): void;
  updateExplodes(explodes: Explode['info'][]): void;
  updateAchivments(achivments: Achivment['info'][]): void;
  updateLocalInfo(localInfo: Player['info']): void;
  updatePlayerPositions(positions: ArrayBuffer): void;
  updateGameInfo(info: Game['info']): void;
  updateWaitForRestart(count: number): void;
  updateEffects(effects: Effect['info'][]): void;
  playSound(sound: ESounds): void;
  onMessage(message: string, player: TChatInfo, isMe: boolean): void;
  ping(): void;
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
}

export type TServer = {
  setPosition(x: number, y: number, dir: EDir, animate: EAnimate): void;
  setBomb(): void;
  setName(name: string): void;
  toGame(): void;
  toLeave(): void;
  sendMessage(message: string): void;
  randomColor(): void;
  ping(): void;
};

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