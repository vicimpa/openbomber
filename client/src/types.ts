import type { IAchivment, IBomb, IExplode, IPlayer } from "~server";

export type TPlayer = {
  updateMap(map: Uint8Array): void;
  updateBombs(bombs: IBomb[]): void;
  updatePlayers(players: IPlayer['data'][]): void;
  updateExposes(exposes: IExplode[]): void;
  updateAchivments(achivments: IAchivment[]): void;
  setGameInfo(width: number, height: number): void;
  setInfo(info: Omit<IPlayer['data'], 'x' | 'y'>): void;
  setPosition(pos: Pick<IPlayer['data'], 'x' | 'y'>): void;
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