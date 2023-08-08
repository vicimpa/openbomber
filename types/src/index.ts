import type { Game } from "@root/server/src/class/Game";
import type { Player } from "@root/server/src/class/Player";
import type { Bomb } from "@root/server/src/class/Bomb";
import type { Achivment } from "@root/server/src/class/Achivment";
import type { Room } from "@root/server/src/class/Room";
import type { Explode } from "@root/server/src/class/Explode";

export type TPlayer = {
  setStartPosition(x: number, y: number): void;
  updateMap(map: number[]): void;
  updateBombs(bombs: TInfo<Bomb>[]): void;
  updatePlayers(players: TInfo<Player>[]): void;
  updateExposes(exposes: TInfo<Explode>[]): void;
  updateAchivments(achivments: TInfo<Achivment>[]): void;
  updateLocalInfo(localInfo: Player['localInfo']): void;
  updateGameInfo(info: TInfo<Game>): void;
  updateWaitForRestart(count: number): void;
};


export type TServer = {
  setPosition(x: number, y: number, dir: EDir, animate: EAnimate): void;
  setBomb(): void;
  setBlock(): void;
  setName(name: string): void;
};

export type TInfo<T extends { info: any; }> = T['info'];

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
  APPEND_LIVE,
  MOVING_BOMB,
  FIRE,
  RANDOM,
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

export type { Bomb, Player, Achivment, Explode, Game, Room };