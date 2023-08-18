import { CRAZY_BOMB_TIME } from "../../shared/config";
import { ESounds } from "../../shared/types";
import { Player } from "./Player";
import { PlayerEffect } from "./PlayerEffect";

export class CrasyBombEffect extends PlayerEffect {
  #created = Date.now();
  shieldTime = 0;

  appendTime() {
    this.shieldTime += CRAZY_BOMB_TIME;
  }

  update(): void {
    if (Date.now() > this.#created + this.shieldTime)
      this.delete();
  }

  static get(player: Player): CrasyBombEffect | null {
    return this.getEffects(player, this)[0];
  }

  static hasCrasyBomb(player: Player) {
    return !!this.get(player);
  }

  static delete(player: Player) {
    this.get(player)?.delete();
    player.newApi.playSound(ESounds.crazy);
  }

  static append(player: Player) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player);

    if (!effets.has(currentEffect)) {
      player.newApi.playSound(ESounds.crazy);
    }

    currentEffect.appendTime();
    effets.add(currentEffect);
  }
}