import { SPEED_TIME } from "shared/config";
import { ESounds } from "shared/types";

import { Player } from "./Player";
import { PlayerEffect } from "./PlayerEffect";

export class SpeedEffect extends PlayerEffect {
  value = 1;

  onCreate(): void {
    const { value, player: { newApi } } = this;

    if (value > 1)
      newApi.playSound(ESounds.speedOn);

    if (value < 1)
      newApi.playSound(ESounds.fireOn);
  }

  onDelete(): void {
    const { value, player: { newApi } } = this;

    if (value > 1)
      newApi.playSound(ESounds.speedOff);

    if (value < 1)
      newApi.playSound(ESounds.fireOff);
  }

  constructor(player: Player, value = 1) {
    super(player);
    this.value = value;
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
      currentEffect.appendTime(-SPEED_TIME);
      return;
    }

    currentEffect.value = value;
    currentEffect.appendTime(SPEED_TIME);
    effets.add(currentEffect);
  }
}