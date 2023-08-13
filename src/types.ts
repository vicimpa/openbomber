import type { Game } from "../server/class/Game";
import type { Player } from "../server/class/Player";
import type { Bomb } from "../server/class/Bomb";
import type { Achivment } from "../server/class/Achivment";
import type { Explode } from "../server/class/Explode";
import type { Effect } from "../server/class/Effect";

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
  updateExposes(exposes: Explode['info'][]): void;
  updateAchivments(achivments: Achivment['info'][]): void;
  updateLocalInfo(localInfo: Player['info']): void;
  updatePlayerPositions(positions: ArrayBuffer): void;
  updateGameInfo(info: Game['info']): void;
  updateWaitForRestart(count: number): void;
  updateEffects(effects: Effect['info'][]): void;
  playSound(sound: ESounds): void;
  onMessage(message: string, player: TChatInfo, isMe: boolean): void;
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
};

export enum EDir {
  TOP,
  LEFT,
  RIGHT,
  BOTTOM
}

export enum EAnimate {
  IDLE,
  RUNNING,
  DEATH
}

export const DIRECTIONS = {
  [EDir.TOP]: [0, -1] as TPoint,
  [EDir.LEFT]: [-1, 0] as TPoint,
  [EDir.RIGHT]: [1, 0] as TPoint,
  [EDir.BOTTOM]: [0, 1] as TPoint
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

export type TPoint = [x: number, y: number];

export enum EExplodeDir {
  CENTER,
  TOP,
  LEFT,
  RIGHT,
  BOTTOM
}
export const EXPODER_DIRS = {
  [EExplodeDir.CENTER]: [0, 0] as TPoint,
  [EExplodeDir.TOP]: [0, -1] as TPoint,
  [EExplodeDir.LEFT]: [-1, 0] as TPoint,
  [EExplodeDir.RIGHT]: [1, 0] as TPoint,
  [EExplodeDir.BOTTOM]: [0, 1] as TPoint
};