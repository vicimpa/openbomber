import { describe, expect, test } from 'bun:test';
import { BOMB_FUSE, TICK_RATE } from '../contract/constants';
import { Button } from '../contract/protocol';
import { Phase, type WorldState } from '../contract/types';
import { Simulation } from '../sim/Simulation';
import { Harness, ev } from '../sim/testkit';
import { Bot, type BotDifficulty } from './Bot';
import { analyze, INF } from './danger';

const DIFFS: BotDifficulty[] = ['easy', 'normal', 'hard'];

interface SoakStats {
  rounds: number;
  deaths: number;
  ownBomb: number;
  /** Own-bomb deaths with no enemy bomb placed nearby shortly before (not a trap). */
  pure: number;
  bombs: number;
  maxThinkMs: number;
}

function soak(players: number, minutes: number, seed: number): SoakStats {
  const sim = new Simulation({ minPlayers: players, seed });
  const bots: Bot[] = [];
  for (let i = 0; i < players; i++) {
    sim.addPlayer({ id: `bot${i}`, name: `Bot ${i}`, skin: i, isBot: true });
    bots.push(new Bot(`bot${i}`, DIFFS[i % 3]));
  }
  const s: SoakStats = { rounds: 0, deaths: 0, ownBomb: 0, pure: 0, bombs: 0, maxThinkMs: 0 };
  const recent: { t: number; x: number; y: number; owner: string }[] = [];
  for (let t = 0; t < minutes * 60 * TICK_RATE; t++) {
    const t0 = performance.now();
    for (const b of bots) sim.pushInput(b.id, b.think(sim.state));
    s.maxThinkMs = Math.max(s.maxThinkMs, performance.now() - t0);
    for (const e of sim.step()) {
      if (e.type === 'roundOver') s.rounds++;
      if (e.type === 'bombPlaced') {
        s.bombs++;
        recent.push({ t: sim.state.tick, x: e.x, y: e.y, owner: e.owner });
      }
      if (e.type !== 'playerDied') continue;
      s.deaths++;
      if (e.killer !== e.player) continue;
      s.ownBomb++;
      const trapped = recent.some(
        (b) => b.owner !== e.player && sim.state.tick - b.t < 150 && Math.abs(b.x - e.x) + Math.abs(b.y - e.y) <= 4,
      );
      if (!trapped) s.pure++;
    }
    while (recent.length && sim.state.tick - recent[0]!.t > 200) recent.shift();
  }
  return s;
}

describe('bots', () => {
  test('soak: 6 mixed bots play ~4 minutes, rounds finish, few suicides', () => {
    const s = soak(6, 4, 2024);
    const rate = s.ownBomb / Math.max(1, s.deaths);
    console.log(
      `[bot soak] rounds=${s.rounds} deaths=${s.deaths} ownBomb=${s.ownBomb} (${(rate * 100).toFixed(0)}%) ` +
        `pureSuicides=${s.pure} bombs=${s.bombs} maxThink(6 bots)=${s.maxThinkMs.toFixed(2)}ms`,
    );
    expect(s.rounds).toBeGreaterThanOrEqual(1);
    expect(s.bombs).toBeGreaterThan(100); // they actually play
    expect(rate).toBeLessThan(0.5);
    expect(s.pure).toBeLessThanOrEqual(3);
  });

  test('soak: 8 bots on a bigger map', () => {
    const s = soak(8, 3, 7);
    console.log(`[bot soak 8] rounds=${s.rounds} deaths=${s.deaths} ownBomb=${s.ownBomb} pure=${s.pure} bombs=${s.bombs}`);
    expect(s.deaths).toBeGreaterThan(0);
    expect(s.ownBomb / Math.max(1, s.deaths)).toBeLessThan(0.5);
  });

  test('flees from its own bomb and survives', () => {
    const h = new Harness(['.........', '.#.#.#.#.', '.........'], [['bot', 0, 0], ['z', 8, 2]]);
    const bot = new Bot('bot', 'normal');
    const drive = (n: number) => {
      for (let i = 0; i < n; i++) {
        const f = bot.think(h.state);
        h.set('bot', f.dx, f.dy, f.buttons);
        h.set('z', 0, 0, 0);
        h.step();
      }
    };
    h.tap('bot', Button.Bomb);
    drive(BOMB_FUSE + 40);
    expect(ev(h.events, 'explosion').length).toBe(1);
    expect(h.p('bot').alive).toBe(true);
    expect(ev(h.events, 'playerDied').length).toBe(0);
  });

  test('danger map predicts chain reactions', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 1, 1]]);
    const a = h.p('a');
    a.bombs = 2;
    a.radius = 2;
    h.tap('a', Button.Bomb);
    a.x = 3;
    h.step(60);
    h.tap('a', Button.Bomb);
    a.x = 8;
    a.y = 0;
    const d = analyze(h.state as WorldState);
    const W = h.state.width;
    const first = d.dStart[1 * W + 1]!;
    // the second bomb (placed ~60 ticks later) goes off CHAIN_DELAY after the first
    expect(d.dStart[1 * W + 5]).toBe(first + 3);
    expect(d.dStart[0 * W + 8]).toBe(INF);
  });

  test('bots are cheap: 15 bots think in well under a millisecond on average', () => {
    const sim = new Simulation({ minPlayers: 15, seed: 99 });
    const bots: Bot[] = [];
    for (let i = 0; i < 15; i++) {
      sim.addPlayer({ id: `b${i}`, name: '', skin: 0, isBot: true });
      bots.push(new Bot(`b${i}`, DIFFS[i % 3]));
    }
    let think = 0;
    const ticks = 3600;
    for (let t = 0; t < ticks; t++) {
      const t0 = performance.now();
      for (const b of bots) sim.pushInput(b.id, b.think(sim.state));
      think += performance.now() - t0;
      sim.step();
    }
    const avg = think / ticks;
    console.log(`[bot perf] 15 bots: ${(avg * 1000).toFixed(1)}us per tick (all bots), phase=${Phase[sim.state.phase]}`);
    expect(avg).toBeLessThan(1);
  });
});
