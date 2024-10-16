import { Player } from "./Player";

const EFFECTS_SYMBOL = Symbol('effects');

export class PlayerEffect {
  isCreated = false;

  created = Date.now();
  lifetime = Infinity;

  get remaining() { return this.created + this.lifetime - Date.now(); }

  constructor(public player: Player) { }

  appendTime(time = 0) {
    if (!isFinite(this.lifetime))
      this.lifetime = 0;

    this.lifetime += time;
  }

  update() {
    if (!this.isCreated) {
      this.isCreated = true;
      this.onCreate();
    }

    if (!isFinite(this.lifetime)) return;
    if (this.remaining > 0) return;
    this.delete();
  }

  delete() {
    const result = PlayerEffect.effects(this.player).delete(this);

    if (result) {
      this.onDelete();
    }

    return result;
  }

  onCreate() { }
  onDelete() { }

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