import { pick } from "../lib/pick";
import { Entity } from "./Entity";
import { Explode } from "./Explode";
import { Player } from "./Player";

export class Bomb extends Entity {
  time = Date.now();
  liveTime = 2000;

  public radius = 1;

  constructor(
    public player: Player
  ) {
    const x = Math.round(player.x);
    const y = Math.round(player.y);

    super(player.game, x, y);
    this.radius = player.radius;
  }

  get info() {
    return pick(this, [
      'x',
      'y',
      'radius'
    ]);
  }

  update(): void {
    const { time, liveTime } = this;

    if (Date.now() > time + liveTime) {
      Explode.run(this);
    }
  }
}