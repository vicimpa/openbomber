import { describe, expect, test } from 'bun:test';
import { BOMB_FUSE, CHAIN_DELAY, TICK_RATE } from '../contract/constants';
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
  avgThinkUs: number;
  avgStepUs: number;
  width: number;
}

function soak(players: number, minutes: number, seed: number): SoakStats {
  const sim = new Simulation({ seed });
  const bots: Bot[] = [];
  for (let i = 0; i < players; i++) {
    sim.addPlayer({ id: `bot${i}`, name: `Bot ${i}`, skin: i, isBot: true });
    bots.push(new Bot(`bot${i}`, DIFFS[i % 3]));
  }
  const s: SoakStats = { rounds: 0, deaths: 0, ownBomb: 0, pure: 0, bombs: 0, maxThinkMs: 0, avgThinkUs: 0, avgStepUs: 0, width: 0 };
  let think = 0;
  let stepT = 0;
  const ticks = minutes * 60 * TICK_RATE;
  const recent: { t: number; x: number; y: number; owner: string }[] = [];
  for (let t = 0; t < ticks; t++) {
    const t0 = performance.now();
    for (const b of bots) sim.pushInput(b.id, b.think(sim.state));
    const t1 = performance.now();
    const events = sim.step();
    stepT += performance.now() - t1;
    think += t1 - t0;
    if (t > 300) s.maxThinkMs = Math.max(s.maxThinkMs, t1 - t0); // skip JIT warm-up
    s.width = Math.max(s.width, sim.state.width);
    for (const e of events) {
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
  s.avgThinkUs = (think / ticks) * 1000;
  s.avgStepUs = (stepT / ticks) * 1000;
  return s;
}

describe('bots', () => {
  test('soak: 4 mixed bots, the zone closes in and rounds finish, few suicides', () => {
    const s = soak(4, 5, 2024);
    const rate = s.ownBomb / Math.max(1, s.deaths);
    console.log(
      `[bot soak 4] ${s.width}x map, rounds=${s.rounds} deaths=${s.deaths} ownBomb=${s.ownBomb} (${(rate * 100).toFixed(0)}%) ` +
        `pureSuicides=${s.pure} bombs=${s.bombs}`,
    );
    expect(s.rounds).toBeGreaterThanOrEqual(1);
    expect(s.bombs).toBeGreaterThan(100); // they actually play
    expect(rate).toBeLessThan(0.5);
    expect(s.pure).toBeLessThanOrEqual(3);
  });

  test('soak: 32 bots on the 75x75 map', () => {
    const s = soak(32, 2, 7);
    const rate = s.ownBomb / Math.max(1, s.deaths);
    console.log(
      `[bot soak 32] ${s.width}x map, rounds=${s.rounds} deaths=${s.deaths} ownBomb=${s.ownBomb} (${(rate * 100).toFixed(0)}%) ` +
        `pure=${s.pure} bombs=${s.bombs} think=${s.avgThinkUs.toFixed(0)}us/tick (max ${s.maxThinkMs.toFixed(1)}ms) step=${s.avgStepUs.toFixed(1)}us`,
    );
    expect(s.width).toBe(75);
    expect(s.deaths).toBeGreaterThan(0);
    expect(s.bombs).toBeGreaterThan(300);
    expect(rate).toBeLessThan(0.5);
    expect(s.avgThinkUs).toBeLessThan(1000); // all 32 bots together
    expect(s.avgStepUs).toBeLessThan(500);
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
    expect(d.dStart[1 * W + 5]).toBe(first + CHAIN_DELAY);
    expect(d.dStart[0 * W + 8]).toBe(INF);
  });

  test('bots are cheap: 32 bots think in well under a millisecond on average', () => {
    const sim = new Simulation({ seed: 99 });
    const bots: Bot[] = [];
    for (let i = 0; i < 32; i++) {
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
    console.log(`[bot perf] 32 bots: ${(avg * 1000).toFixed(1)}us per tick (all bots), phase=${Phase[sim.state.phase]}`);
    expect(avg).toBeLessThan(1);
  });
});
