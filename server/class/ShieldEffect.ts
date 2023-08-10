import { SHIELD_TIME } from "../../src/config";
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
    this.get(player)?.delete();
  }

  static append(player: Player) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player);

    currentEffect.appendTime();
    effets.add(currentEffect);
  }
}