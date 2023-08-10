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
    this.radius = player.effects.radius;
  }

  get info() {
    return pick(this, [
      'x',
      'y',
      'radius'
    ]);
  }

  update(): void {
    const { time, liveTime, game: { waitForRestart } } = this;

    if (Date.now() > time + liveTime && waitForRestart < 0) {
      Explode.run(this);
    }
  }
}