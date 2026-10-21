import { describe, expect, test } from 'bun:test';
import { BOMB_FUSE, CHAIN_DELAY, CRAZY_FUSE_MAX, CRAZY_FUSE_MIN, DROP_FALL_TIME, SKY_BOMB_FUSE, TICK_RATE, sec } from '../contract/constants';
import { Button, type GameEvent } from '../contract/protocol';
import { Curse, DropKind, Phase, PickupType, Tile, type WorldState } from '../contract/types';
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

// ---------------------------------------------------------------- abilities

/** Run `bot` for n ticks; everybody else stands still. Returns the events. */
function drive(h: Harness, bots: Bot[], n: number, each?: () => boolean | void) {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    for (const b of bots) {
      const f = b.think(h.state);
      h.set(b.id, f.dx, f.dy, f.buttons);
    }
    out.push(...h.step());
    if (each?.()) break;
  }
  return out;
}

describe('bots use what they hold', () => {
  const sealed = ['.....', 'BBBBB', 'BBBBB', 'BBBBB', '.....'];

  test('ghost: walks through bricks to a pickup it could not reach otherwise', () => {
    for (const ghost of [true, false]) {
      const h = new Harness(sealed, [['bot', 2, 0]]);
      if (ghost) h.give('bot', ['ghost'], sec(20));
      h.sim.spawnPickup(2, 4, PickupType.BombUp);
      const bot = new Bot('bot', 'hard');
      drive(h, [bot], 200, () => h.p('bot').bombs > 1);
      expect(h.p('bot').bombs).toBe(ghost ? 2 : 1);
      expect(h.p('bot').alive).toBe(true);
    }
  });

  test('ghost: never still inside a brick when the timer runs out', () => {
    const rows = ['.........', 'BBBBBBBBB', 'BBBBBBBBB', 'BBBBBBBBB', 'BBBBBBBBB', 'BBBBBBBBB', '.........'];
    const W = rows[0]!.length;
    let checked = 0;
    for (const diff of DIFFS) {
      for (const [x, y, ticks] of [[4, 0, 90], [4, 0, 200], [3, 2, 110], [5, 3, 140], [2, 4, 75], [6, 1, 300]] as const) {
        const h = new Harness(rows, [['bot', x, y]]);
        h.give('bot', ['ghost'], ticks);
        h.p('bot').effects.invulnerable = 0;
        h.sim.spawnPickup(4, 6, PickupType.Heart); // a lure deep behind the bricks
        h.sim.spawnPickup(0, 6, PickupType.BombUp);
        const bot = new Bot('bot', diff);
        drive(h, [bot], ticks + 5, () => {
          const p = h.p('bot');
          if (p.effects.ghost !== 1) return false;
          checked++;
          expect(h.state.tiles[Math.round(p.y) * W + Math.round(p.x)]).toBe(Tile.Floor);
          return true;
        });
      }
    }
    expect(checked).toBe(18);
  });

  test('bombPass: walks through a row of bombs', () => {
    const rows = ['#########', '.........', '#########', '.........'];
    for (const pass of [true, false]) {
      const h = new Harness(rows, [['bot', 0, 1], ['z', 2, 1]]);
      const z = h.p('z');
      z.bombs = 2;
      h.give('z', ['remote']); // they wait for z, who never presses
      h.tap('z', Button.Bomb);
      z.x = 3;
      h.step(2);
      h.tap('z', Button.Bomb);
      z.x = 0;
      z.y = 3;
      h.step(2);
      expect(h.state.bombs.size).toBe(2);
      if (pass) h.give('bot', ['bombPass']);
      h.sim.spawnPickup(8, 1, PickupType.BombUp);
      const bot = new Bot('bot', 'hard');
      drive(h, [bot], 240, () => h.p('bot').bombs > 1);
      expect(h.p('bot').bombs).toBe(pass ? 2 : 1);
    }
  });

  test('remote: sets the bomb off once an enemy stands in the blast, never on itself', () => {
    const h = new Harness(['.........', '.........', '.........', '.........', '.........'], [['bot', 4, 2], ['z', 8, 4]]);
    const bot = new Bot('bot', 'hard');
    h.give('bot', ['remote']);
    h.p('bot').radius = 2;
    h.tap('bot', Button.Bomb);
    h.p('bot').x = 0;
    h.p('bot').y = 0;
    drive(h, [bot], 30);
    expect(h.state.bombs.size).toBe(1); // nobody in reach: it waits
    h.p('z').x = 4; // walks into the blast
    const events = drive(h, [bot], 30, () => !h.p('z').alive);
    expect(ev(events, 'explosion').length).toBe(1);
    expect(h.p('z').alive).toBe(false);
    expect(h.p('bot').alive).toBe(true);
  });

  test('remote: a bomb with nobody to catch does not lie around forever', () => {
    const h = new Harness(['.........', '.........', '.........'], [['bot', 4, 1], ['z', 8, 2]]);
    const bot = new Bot('bot', 'normal');
    h.give('bot', ['remote']);
    h.tap('bot', Button.Bomb);
    const events = drive(h, [bot], sec(6), () => h.state.bombs.size === 0);
    expect(ev(events, 'explosion').length).toBe(1);
    expect(h.p('bot').alive).toBe(true);
  });

  test('glove: throws a bomb over a wall at an enemy', () => {
    const h = new Harness(['..#....', '..#....', '..#....'], [['bot', 1, 1], ['z', 4, 1]]);
    const bot = new Bot('bot', 'hard');
    h.give('bot', ['glove']);
    h.tap('bot', Button.Bomb);
    const events = drive(h, [bot], BOMB_FUSE + 60, () => !h.p('z').alive);
    expect(ev(events, 'bombThrown').length).toBe(1);
    expect(ev(events, 'playerStunned').length).toBe(1);
    expect(h.p('z').alive).toBe(false);
    expect(h.p('bot').alive).toBe(true);
  });

  test('kick: kicks a bomb down the lane at an enemy', () => {
    const h = new Harness(['#########', '.........', '#########'], [['bot', 2, 1], ['z', 7, 1]]);
    const bot = new Bot('bot', 'hard');
    h.give('bot', ['kick']);
    h.tap('bot', Button.Bomb);
    h.p('bot').x = 1;
    h.step();
    const events = drive(h, [bot], BOMB_FUSE + 30, () => !h.p('z').alive);
    expect(ev(events, 'bombKicked').length).toBe(1);
    expect(h.p('z').alive).toBe(false);
    expect(h.p('bot').alive).toBe(true);
  });

  test('punch: punches an adjacent bomb at an enemy', () => {
    const h = new Harness(['#########', '.........', '#########'], [['bot', 2, 1], ['z', 5, 1]]);
    const bot = new Bot('bot', 'hard');
    h.give('bot', ['punch']);
    h.tap('bot', Button.Bomb);
    h.p('bot').x = 1;
    h.step();
    const events = drive(h, [bot], BOMB_FUSE + 30, () => !h.p('z').alive);
    expect(ev(events, 'bombPunched').length).toBe(1);
    expect(h.p('z').alive).toBe(false);
    expect(h.p('bot').alive).toBe(true);
  });

  test('fire: chases an enemy down and touches them', () => {
    const h = new Harness(['.........', '.#.#.#.#.', '.........', '.#.#.#.#.', '.........'], [['bot', 0, 0], ['z', 8, 4]]);
    const bot = new Bot('bot', 'normal');
    h.give('bot', ['fire']);
    h.p('bot').effects.invulnerable = 0;
    const events = drive(h, [bot], sec(10), () => !h.p('z').alive);
    const died = ev(events, 'playerDied');
    expect(died.length).toBe(1);
    expect(died[0]!.killer).toBe('bot');
    expect(ev(events, 'explosion').length).toBe(0); // by touch, not by bomb
  });

  test('line bomb: lays a line down a corridor at an enemy and gets away', () => {
    const h = new Harness(['#########', '.........', '###.#####', '###.#####'], [['bot', 3, 1], ['z', 8, 1]]);
    const bot = new Bot('bot', 'hard');
    h.give('bot', ['lineBomb']);
    h.p('bot').bombs = 4;
    h.p('bot').radius = 2;
    const events = drive(h, [bot], sec(5), () => !h.p('z').alive);
    expect(ev(events, 'bombPlaced').length).toBeGreaterThanOrEqual(3);
    expect(h.p('z').alive).toBe(false);
    expect(h.p('bot').alive).toBe(true);
  });

  test('reverse curse: still flees its own bomb', () => {
    const h = new Harness(['.........', '.#.#.#.#.', '.........'], [['bot', 0, 0], ['z', 8, 2]]);
    const bot = new Bot('bot', 'normal');
    h.p('bot').curse = Curse.Reverse;
    h.p('bot').effects.curse = 100000;
    h.tap('bot', Button.Bomb);
    drive(h, [bot], BOMB_FUSE + 40);
    expect(ev(h.events, 'explosion').length).toBe(1);
    expect(h.p('bot').alive).toBe(true);
  });

  test('pierce: danger is predicted through bricks, whatever the bomb kind', () => {
    const W = 9;
    for (const remote of [false, true]) {
      const h = new Harness(['.BBB.....', '.........'], [['a', 0, 0]]);
      h.p('a').radius = 5;
      h.give('a', remote ? ['pierce', 'remote'] : ['pierce']);
      h.tap('a', Button.Bomb);
      h.p('a').y = 1;
      h.p('a').x = 8;
      const d = analyze(h.state as WorldState);
      for (const x of [1, 2, 3, 4, 5]) {
        if (remote) expect(d.soft[x]).toBe(1);
        else expect(d.dStart[x]).toBeLessThan(INF);
      }
      expect(remote ? d.soft[6] : d.dStart[6] < INF ? 1 : 0).toBe(0);
      expect(d.dStart[1 * W + 8]).toBe(INF);
    }
  });

  test('crazy bombs count with the shortest fuse and the biggest blast', () => {
    const h = new Harness(['...........', '...........'], [['a', 0, 0]]);
    h.give('a', ['crazy']);
    h.tap('a', Button.Bomb);
    h.p('a').y = 1;
    const d = analyze(h.state as WorldState);
    expect(d.dStart[5]).toBeLessThanOrEqual(CRAZY_FUSE_MIN); // radius 1 x CRAZY_RADIUS_MULT
    expect(d.dStart[6]).toBe(INF);
    expect(d.dEnd[5]).toBeGreaterThan(CRAZY_FUSE_MAX - 10);
  });

  test('overtime: steps off a sky-bomb shadow and out of its cross before it blows', () => {
    for (const diff of DIFFS) {
      const h = new Harness(['.........', '.#.#.#.#.', '.........'], [['bot', 4, 0], ['z', 0, 2]]);
      h.state.drops.push({ id: h.state.nextId++, x: 4, y: 0, kind: DropKind.Bomb, pickup: 0, ttl: DROP_FALL_TIME });
      const bot = new Bot('bot', diff);
      const events = drive(h, [bot], DROP_FALL_TIME + SKY_BOMB_FUSE + 30);
      expect(ev(events, 'explosion').length).toBe(1);
      expect(h.p('bot').alive).toBe(true);
    }
  });

  test('overtime: walks to a pickup falling from the sky', () => {
    const h = new Harness(['.........', '.#.#.#.#.', '.........'], [['bot', 0, 0], ['z', 0, 2]]);
    h.state.drops.push({ id: h.state.nextId++, x: 6, y: 0, kind: DropKind.Pickup, pickup: PickupType.BombUp, ttl: DROP_FALL_TIME });
    const bot = new Bot('bot', 'hard');
    drive(h, [bot], DROP_FALL_TIME + 120, () => h.p('bot').bombs > 1);
    expect(h.p('bot').bombs).toBe(2);
  });

  test('zone: goes for a pickup on the ring that is about to close while there is time, and is out when it closes', () => {
    const h = new Harness(['.........', '.#.#.#.#.', '.........', '.#.#.#.#.', '.........'], [['bot', 4, 2], ['z', 4, 4]]);
    h.sim.spawnPickup(0, 2, PickupType.BombUp);
    h.state.zoneIn = sec(9); // the outer ring (0) closes in 9 s
    const bot = new Bot('bot', 'hard');
    drive(h, [bot], sec(6), () => h.p('bot').bombs > 1);
    expect(h.p('bot').bombs).toBe(2);
    // and then it leaves the ring before it is too late
    drive(h, [bot], h.state.zoneIn);
    const p = h.p('bot'), x = Math.round(p.x), y = Math.round(p.y);
    expect(x === 0 || y === 0 || x === 8 || y === 4).toBe(false);
  });

  test('zone: when the closing ring is all that is left, bots keep fighting instead of freezing', () => {
    // only the outer ring (0) is still open around a walled-in middle: nothing deeper to run to
    const h = new Harness(['.......', '.#####.', '.#####.', '.#####.', '.......'], [['bot', 0, 0], ['z', 6, 4]]);
    h.state.zoneIn = sec(3);
    const bot = new Bot('bot', 'hard');
    const out = drive(h, [bot], sec(4));
    expect(ev(out, 'bombPlaced').length).toBeGreaterThan(0); // it goes on bombing at the enemy
  });

  test('trapped: walled into a pocket, a bot with a spare life blows up and comes back; without one it waits', () => {
    for (const lives of [1, 0]) {
      const h = new Harness(['..#......', '###......', '.........'], [['bot', 0, 0], ['z', 8, 2]]);
      h.p('bot').lives = lives;
      const bot = new Bot('bot', 'normal');
      const ev2 = drive(h, [bot], sec(8), () => ev(h.events, 'playerRespawned').length > 0);
      expect(ev(ev2, 'playerDied').length).toBe(lives);
      if (lives) expect(ev(ev2, 'playerRespawned')[0]).toMatchObject({ player: 'bot' });
    }
  });

  test('teleport: trapped between two bombs, a bot with charges jumps out; without charges it never presses', () => {
    const rows = ['#########', '##...####', '#########', '.........', '.........'];
    for (const charges of [2, 0]) {
      const h = new Harness(rows, [['bot', 3, 1], ['z', 0, 4]]);
      const z = h.p('z');
      z.bombs = 2;
      z.x = 2;
      z.y = 1;
      h.tap('z', Button.Bomb);
      z.x = 4;
      h.step(2);
      h.tap('z', Button.Bomb);
      z.x = 0;
      z.y = 4;
      h.step(2);
      expect(h.state.bombs.size).toBe(2);
      h.p('bot').teleports = charges;
      const bot = new Bot('bot', 'hard');
      let pressed = 0;
      const events: GameEvent[] = [];
      for (let i = 0; i < BOMB_FUSE + 30; i++) {
        const f = bot.think(h.state);
        if (f.buttons & Button.Teleport) pressed++;
        h.set('bot', f.dx, f.dy, f.buttons);
        h.set('z', 0, 0, 0);
        events.push(...h.step());
      }
      expect(ev(events, 'explosion').length).toBe(2);
      if (charges) {
        expect(ev(events, 'playerTeleported').length).toBe(1);
        expect(h.p('bot').teleports).toBe(charges - 1);
        expect(h.p('bot').alive).toBe(true);
      } else {
        expect(pressed).toBe(0);
        expect(h.p('bot').alive).toBe(false);
      }
    }
  });

  test('teleport: not wasted when there is a way out', () => {
    const h = new Harness(['.........', '.#.#.#.#.', '.........'], [['bot', 0, 0], ['z', 8, 2]]);
    const bot = new Bot('bot', 'hard');
    h.p('bot').teleports = 3;
    h.tap('bot', Button.Bomb);
    const events = drive(h, [bot], BOMB_FUSE + 40);
    expect(ev(events, 'playerTeleported').length).toBe(0);
    expect(h.p('bot').alive).toBe(true);
  });
});
