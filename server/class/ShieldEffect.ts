import { SHIELD_TIME } from "shared/config";
import { ESounds } from "shared/types";

import { Player } from "./Player";
import { PlayerEffect } from "./PlayerEffect";

export class ShieldEffect extends PlayerEffect {
  onCreate(): void {
    this.player.newApi.playSound(ESounds.shield);
  }
  onDelete(): void {
    this.player.newApi.playSound(ESounds.shield);
  }

  static get(player: Player): ShieldEffect | null {
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
    currentEffect.appendTime(SHIELD_TIME);
    effets.add(currentEffect);
  }
}