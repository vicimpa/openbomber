import { ESounds } from "@ob/shared/types";
import { MOVING_TIME } from "@ob/shared/config";
import { Player } from "./Player";
import { PlayerEffect } from "./PlayerEffect";

export class MovingEffect extends PlayerEffect {
  onCreate(): void {
    this.player.newApi.playSound(ESounds.moving);
  }
  onDelete(): void {
    this.player.newApi.playSound(ESounds.moving);
  }

  static get(player: Player): MovingEffect | null {
    return this.getEffects(player, this)[0];
  }

  static hasShield(player: Player) {
    return !!this.get(player);
  }

  static delete(player: Player) {
    this.get(player)?.delete();
  }

  static append(player: Player) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player);
    currentEffect.appendTime(MOVING_TIME);
    effets.add(currentEffect);
  }
}