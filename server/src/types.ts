import type { Socket } from "socket.io";
import type { TPlayer, EAnimate, EDir } from "~client";

export type TServer = {
  setPosition(x: number, y: number, dir: EDir, animate: EAnimate): void;
  setBomb(): void;
  setBlock(): void;
  getTestInfo(): string;
  setName(name: string): void;
};

export type TPoint = [x: number, y: number];

export interface IAchivment {
  x: number;
  y: number;
  value: number;
}

export interface IBomb {
  x: number;
  y: number;
  exp: number;
  time: number;
}

export interface IExplode {
  time: number;
  points: [
    x: number,
    y: number,
    bomb: number,
    dir: number,
    last?: number
  ][];
}

export interface IPlayer {
  socket: Socket;
  api: TPlayer,
  bombs: IBomb[],
  data: {
    name: string;
    color: number;
    x: number;
    y: number;
    exp: number;
    bombs: number;
    dir: EDir;
    animate: EAnimate;
    isDeath?: boolean;
  };
}

export type { TPlayer, EAnimate, EDir };