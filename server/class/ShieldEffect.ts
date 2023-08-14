import { SHIELD_TIME } from "../../config";
import { ESounds } from "../../types";
import { Player } from "./Player";
import { PlayerEffect } from "./PlayerEffect";

export class ShieldEffect extends PlayerEffect {
  #created = Date.now();
  shieldTime = 0;

  appendTime() {
    this.shieldTime += SHIELD_TIME;
  }

  update(): void {
    if (Date.now() > this.#created + this.shieldTime)
      this.delete();
  }

  delete(): boolean {
    const result = super.delete();
    if (result) {
      this.player.game.message(`${this.player.name} потерял щит`);
    }
    return result;
  }

  static get(player: Player): ShieldEffect | null {
    return this.getEffects(player, this)[0];
  }

  static hasShield(player: Player) {
    return !!this.get(player);
  }

  static delete(player: Player) {
    const currentEffect = this.get(player);

    if (currentEffect) {
      player.api.playSound(ESounds.shield);

      currentEffect.delete();
    }
  }

  static append(player: Player) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player);

    if (!effets.has(currentEffect)) {
      player.api.playSound(ESounds.shield);
    }

    currentEffect.appendTime();
    effets.add(currentEffect);
  }
}