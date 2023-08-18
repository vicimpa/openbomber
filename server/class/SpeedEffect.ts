import { SPEED_TIME } from "../../shared/config";
import { ESounds } from "../../shared/types";
import { Player } from "./Player";
import { PlayerEffect } from "./PlayerEffect";

export class SpeedEffect extends PlayerEffect {
  #created = Date.now();
  shieldTime = 0;
  value = 1;

  constructor(player: Player, value = 1) {
    super(player);
    this.value = value;
  }

  appendTime() {
    this.shieldTime += SPEED_TIME;
  }

  update(): void {
    if (Date.now() > this.#created + this.shieldTime)
      this.delete();
  }

  delete(): boolean {
    if (this.value > 1)
      this.player.newApi.playSound(ESounds.speedOff);

    if (this.value < 1)
      this.player.newApi.playSound(ESounds.fireOff);

    return super.delete();
  }

  static get(player: Player): SpeedEffect | null {
    return this.getEffects(player, this)[0];
  }

  static getValue(player: Player) {
    return this.get(player)?.value ?? 1;
  }

  static delete(player: Player) {
    this.get(player)?.delete();
  }

  static append(player: Player, value = 1) {
    const effets = this.effects(player);
    const currentEffect = this.get(player) ?? new this(player, value);

    if (value !== currentEffect.value) {
      currentEffect.shieldTime -= SPEED_TIME;
      return;
    }

    if (!effets.has(currentEffect)) {
      if (currentEffect.value > 1)
        player.newApi.playSound(ESounds.speedOn);

      if (currentEffect.value < 1)
        player.newApi.playSound(ESounds.fireOn);
    }

    currentEffect.value = value;
    currentEffect.appendTime();
    effets.add(currentEffect);
  }
}