import { Player } from "./Player";
import { PlayerEffect } from "./PlayerEffect";

export class BombEffect extends PlayerEffect {
  static count(player: Player) {
    return this.getEffects(player, this).length;
  }

  static append(player: Player) {
    const effects = this.effects(player);
    effects.add(new BombEffect(player));
  }
}