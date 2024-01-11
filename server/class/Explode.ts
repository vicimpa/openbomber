import { pick } from "@core/pick";
import { point } from "@core/point";
import { EExplodeDir, EMapItem, ESounds, EXPODER_DIRS } from "@shared/types";

import { Achivment } from "./Achivment";
import { Bomb } from "./Bomb";
import { Entity } from "./Entity";
import { Player } from "./Player";

export interface IExplodePoin {
  x: number;
  y: number;
  dir: EExplodeDir;
  isFinaly: boolean;
  isBlock: boolean;
}

export class ExplodePoint extends Entity {

  constructor(
    public explode: Explode,
    x: number,
    y: number,
    public dir: EExplodeDir,
    public isFinaly: boolean = false,
    public isBlock: boolean = false
  ) { super(explode.game, x, y); }

  update(dtime: number, time: number): void {
    const { bombs, achivments } = this.game;

    for (const bomb of bombs) {
      if (bomb.checkCollision(this, .7)) {
        bomb.player = this.explode.player;
        Explode.run(bomb);
      }
    }

    if (!this.isBlock) {
      for (const achivment of achivments) {
        if (achivment.checkCollision(this, .9))
          achivments.delete(achivment);
      }
    }
  }
}

export class Explode extends Entity {
  id!: number;
  #points: ExplodePoint[] = [];
  created = Date.now();
  liveTime = 500;
  radius = 1;
  player: Player;

  ignore = new Set<Player>();

  constructor(bomb: Bomb) {
    super(bomb.game, bomb.x, bomb.y);
    this.id = bomb.game.explodesCounter++;
    this.radius = bomb.radius;
    this.player = bomb.player;
    this.explode();
  }

  static run(bomb: Bomb) {
    const { bombs, explodes, players } = bomb.game;

    players.forEach(player => {
      player.newApi.playSoundPosition({
        sound: ESounds.explode,
        position: bomb
      });
    });

    if (bombs.delete(bomb)) {
      bomb.round();
      explodes.add(new Explode(bomb));
    }
  }

  explode() {
    const points = this.#points;
    const {
      x,
      y,
      radius,
      game
    } = this;

    const {
      width,
      height,
      map
    } = game;

    const vec = point();

    for (const [_id, direction] of Object.entries(EXPODER_DIRS)) {
      const { x: dx, y: dy } = direction;
      const dir: EExplodeDir = +_id as any;

      for (let i = +_id ? 1 : 0; i <= radius; i++) {
        const x = i * dx + this.x;
        const y = i * dy + this.y;
        const index = x + y * width;

        vec.set(x, y);

        if (x < 0 || x > width - 1 || y < 0 || y > height - 1)
          break;

        if (map[index] === EMapItem.WALL || map[index] === EMapItem.BLOCK) {
          if (map[index] == EMapItem.BLOCK) {
            map[index] = EMapItem.CLEAR;

            if (map.achivments.delete(index)) {
              this.game.achivments.add(
                new Achivment(this.game, x, y)
              );
            }

            points.push(new ExplodePoint(this, x, y, dir, true, true));
          }

          const last = points.slice(-1)[0];
          if (last)
            last.isFinaly = true;
          break;
        }

        points.push(new ExplodePoint(this, x, y, dir, radius === i));
      }

      for (const { x, y } of points) {
        const index = y * width + x;
        if (map[index] === EMapItem.CLEAR)
          map[index] = EMapItem.GRAS;
      }
    }
  }

  update(dtime: number, time: number): void {
    const { explodes } = this.game;
    const { created, liveTime } = this;

    if (Date.now() > created + liveTime) {
      explodes.delete(this);
      this.ignore.clear();
    }

    for (const point of this.points as Entity[]) {
      point.update(dtime, time);
    }
  }

  get points() {
    return ([] as ExplodePoint[]).concat(this.#points);
  }

  get info() {
    return pick(this, [
      'id',
      'x',
      'y',
      'points'
    ]);
  }
}