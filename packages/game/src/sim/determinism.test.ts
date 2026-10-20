import { describe, expect, test } from 'bun:test';
import { MAX_PLAYERS, TICK_RATE } from '../contract/constants';
import type { GameEvent } from '../contract/protocol';
import type { WorldState } from '../contract/types';
import { Bot } from '../bot/Bot';
import { Simulation } from './Simulation';
import { Rng } from './rng';

function serialize(w: WorldState, sim: Simulation): string {
  return JSON.stringify({
    ...w,
    tiles: Array.from(w.tiles),
    players: [...w.players.values()],
    bombs: [...w.bombs.values()],
    flames: [...w.flames.values()],
    pickups: [...w.pickups.values()],
    hidden: Array.from(sim.ctx.hidden),
  });
}

/** Players driven by a seeded random "human" (held directions, button mashing). */
function run(seed: number, ticks: number): { state: string; events: GameEvent[] } {
  const sim = new Simulation({ minPlayers: 4, seed });
  const rng = new Rng(seed ^ 0x5eed);
  const ids = ['a', 'b', 'c', 'd'];
  for (const id of ids) sim.addPlayer({ id, name: id, skin: 0 });
  const held = ids.map(() => ({ dx: 0, dy: 0, buttons: 0 }));
  const events: GameEvent[] = [];
  for (let t = 1; t <= ticks; t++) {
    ids.forEach((id, i) => {
      const h = held[i]!;
      if (rng.chance(0.05)) {
        const d = rng.int(5);
        h.dx = d === 1 ? 1 : d === 2 ? -1 : 0;
        h.dy = d === 3 ? 1 : d === 4 ? -1 : 0;
      }
      h.buttons = rng.chance(0.03) ? 1 : rng.chance(0.02) ? 2 : 0;
      sim.pushInput(id, { seq: t, ...h });
    });
    events.push(...sim.step());
  }
  return { state: serialize(sim.state, sim), events };
}

describe('determinism', () => {
  test('same seed + inputs -> identical state and events', () => {
    const a = run(1234, 4000);
    const b = run(1234, 4000);
    expect(a.state).toBe(b.state);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.events.some((e) => e.type === 'explosion')).toBe(true);
  });

  test('different seed -> different world', () => {
    expect(run(1, 10).state).not.toBe(run(2, 10).state);
  });

  test('bot games are deterministic too', () => {
    const play = () => {
      const sim = new Simulation({ minPlayers: 5, seed: 77 });
      const bots = [0, 1, 2, 3, 4].map((i) => {
        sim.addPlayer({ id: `b${i}`, name: '', skin: 0, isBot: true });
        return new Bot(`b${i}`, (['easy', 'normal', 'hard'] as const)[i % 3]);
      });
      for (let t = 0; t < 3000; t++) {
        for (const b of bots) sim.pushInput(b.id, b.think(sim.state));
        sim.step();
      }
      return serialize(sim.state, sim);
    };
    expect(play()).toBe(play());
  });
});

describe('performance', () => {
  test('step() stays fast with 8 and 16 players', () => {
    for (const n of [8, MAX_PLAYERS]) {
      const sim = new Simulation({ minPlayers: n, seed: 5 });
      const bots: Bot[] = [];
      for (let i = 0; i < n; i++) {
        sim.addPlayer({ id: `p${i}`, name: '', skin: 0, isBot: true });
        bots.push(new Bot(`p${i}`, 'hard'));
      }
      let stepMs = 0;
      let maxBombs = 0;
      const ticks = 90 * TICK_RATE;
      for (let t = 0; t < ticks; t++) {
        for (const b of bots) sim.pushInput(b.id, b.think(sim.state));
        const t0 = performance.now();
        sim.step();
        stepMs += performance.now() - t0;
        maxBombs = Math.max(maxBombs, sim.state.bombs.size);
      }
      const avg = stepMs / ticks;
      console.log(`[sim perf] ${n} players: ${(avg * 1000).toFixed(1)}us per step (max ${maxBombs} bombs)`);
      expect(avg).toBeLessThan(n <= 8 ? 0.2 : 0.5);
    }
  });
});
