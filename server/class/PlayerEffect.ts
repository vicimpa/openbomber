import { Player } from "./Player";

const EFFECTS_SYMBOL = Symbol('effects');

export class PlayerEffect {
  constructor(public player: Player) { }

  update() { }
  delete() {
    return PlayerEffect.effects(this.player).delete(this);
  }

  static effects<T extends PlayerEffect>(player: Player & { [EFFECTS_SYMBOL]?: Set<T>; }) {
    return player[EFFECTS_SYMBOL] ?? (
      player[EFFECTS_SYMBOL] = new Set()
    );
  }

  static getEffects<T extends PlayerEffect>(
    player: Player,
    type?: new (...args: any[]) => T
  ): T[] {
    return [...this.effects<T>(player)].filter(e => !type || e instanceof type);
  }

  static clearEffets<T extends PlayerEffect, D extends new (...args: any[]) => T>(
    player: Player,
    type?: D
  ) {
    const effects = this.effects(player);
    for (const effect of this.getEffects(player, type)) {
      effects.delete(effect);
    }
  }
}