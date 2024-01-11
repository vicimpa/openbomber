import { CRAZY_BOMB_TIME } from "@shared/config";
import { ESounds } from "@shared/types";

import { Player } from "./Player";
import { PlayerEffect } from "./PlayerEffect";

export class CrasyBombEffect extends PlayerEffect {
  onCreate(): void {
    const { player: { newApi } } = this;
    newApi.playSound(ESounds.crazy);
  }

  onDelete(): void {
    const { player: { newApi } } = this;
    newApi.playSound(ESounds.crazy);
  }

  static get(player: Player): CrasyBombEffect | null {
    return this.getEffects(player, this)[0];
  }

  static hasCrasyBomb(player: Player) {
    return !!this.get(player);
  }

  static delete(player: Player) {
    this.get(player)?.delete();
  }

  static append(player: Player) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player);

    currentEffect.appendTime(CRAZY_BOMB_TIME);
    effets.add(currentEffect);
  }
}