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
export type TInfo<T extends {
    info: any;
}> = T['info'];
export declare enum EDir {
    TOP = 0,
    LEFT = 1,
    RIGHT = 2,
    BOTTOM = 3
}
export declare enum EAnimate {
    IDLE = 0,
    RUNNING = 1,
    DEATH = 2
}
export declare const DIRECTIONS: {
    0: TPoint;
    1: TPoint;
    2: TPoint;
    3: TPoint;
};
export declare enum EAchivment {
    APPEND_BOMB = 0,
    APPEND_EXPO = 1,
    ROLLERS = 2,
    APPEND_SPEED = 3,
    APPEND_LIVE = 4,
    MOVING_BOMB = 5,
    FIRE = 6,
    RANDOM = 7
}
export type TPoint = [x: number, y: number];
export declare enum EExplodeDir {
    CENTER = 0,
    TOP = 1,
    LEFT = 2,
    RIGHT = 3,
    BOTTOM = 4
}
export declare const EXPODER_DIRS: {
    0: TPoint;
    1: TPoint;
    2: TPoint;
    3: TPoint;
    4: TPoint;
};
export type { Bomb, Player, Achivment, Explode, Game, Room };
