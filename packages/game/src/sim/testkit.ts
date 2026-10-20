// Scenario harness for tests and tooling: an ASCII arena, players at fixed tiles,
// held inputs re-sent every tick (like a real client).

import type { GameEvent, InputFrame } from '../contract/protocol';
import { Phase, type PlayerState } from '../contract/types';
import { Simulation } from './Simulation';

export interface HarnessOptions {
  /** Run the scenario inside a real round (Playing) instead of free-roam Waiting. */
  playing?: boolean;
  seed?: number;
}

export class Harness {
  readonly sim: Simulation;
  readonly events: GameEvent[] = [];
  private held = new Map<string, InputFrame>();
  private seq = 0;

  constructor(rows: string[], players: [id: string, x: number, y: number][], opts: HarnessOptions = {}) {
    this.sim = new Simulation({ minPlayers: opts.playing ? players.length : 99, seed: opts.seed ?? 1 });
    for (const [id] of players) this.sim.addPlayer({ id, name: id, skin: 0 });
    if (opts.playing) {
      for (let i = 0; i < 1000 && this.sim.state.phase !== Phase.Playing; i++) this.sim.step();
    }
    this.sim.loadMap(rows);
    for (const [id, x, y] of players) {
      const p = this.p(id);
      p.x = x;
      p.y = y;
      p.alive = true;
      p.inRound = true;
      p.effects.invulnerable = 0;
      this.held.set(id, { seq: 0, dx: 0, dy: 0, buttons: 0 });
    }
  }

  get state() {
    return this.sim.state;
  }

  p(id: string): PlayerState {
    return this.sim.state.players.get(id)!;
  }

  /** Set the held input for a player (kept until changed). */
  set(id: string, dx: number, dy: number, buttons = 0) {
    this.held.set(id, { seq: 0, dx, dy, buttons });
  }

  /** Advance n ticks; returns the events of those ticks. */
  step(n = 1): GameEvent[] {
    const out: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      this.seq++;
      for (const [id, f] of this.held) this.sim.pushInput(id, { ...f, seq: this.seq });
      const ev = this.sim.step();
      out.push(...ev);
    }
    this.events.push(...out);
    return out;
  }

  /** Press a button for one tick (then release it for one tick). */
  tap(id: string, button: number): GameEvent[] {
    const f = this.held.get(id)!;
    this.held.set(id, { ...f, buttons: f.buttons | button });
    const a = this.step();
    this.held.set(id, { ...f, buttons: f.buttons & ~button });
    return a.concat(this.step());
  }

  /** Step until `pred` holds (or `max` ticks pass); returns ticks taken or -1. */
  until(pred: (ev: GameEvent[]) => boolean, max = 600): number {
    for (let i = 1; i <= max; i++) if (pred(this.step())) return i;
    return -1;
  }
}

export const ev = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
