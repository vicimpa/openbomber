import { describe, expect, test } from 'bun:test';
import {
  BOMB_FUSE,
  CHAIN_DELAY,
  COUNTDOWN_TIME,
  CRAZY_FUSE_MAX,
  CRAZY_FUSE_MIN,
  REMOTE_BOMB_MAX_FUSE,
  RESPAWN_DELAY,
  ROUND_OVER_TIME,
  ROUND_TIME,
  STUN_TIME,
} from '../contract/constants';
import { Button } from '../contract/protocol';
import { Ability, BombKind, BombMotion, Curse, Dir, FlameShape, Phase, PickupType, Tile } from '../contract/types';
import { Simulation } from './Simulation';
import { Harness, ev } from './testkit';
import { tileAt } from './world';
import { predictMovement } from './movement';
import { mergeShape } from './flames';
import { clonePlayer, cloneWorld } from './world';

const OPEN = ['.........', '.........', '.........'];
const PILLARS = ['.......', '.#.#.#.', '.......', '.#.#.#.', '.......'];

const onlyBomb = (h: Harness) => [...h.state.bombs.values()][0]!;

describe('movement & collision', () => {
  test('slides along the map edge with diagonal input', () => {
    const h = new Harness(PILLARS, [['a', 0, 0]]);
    h.set('a', 0.7071, -0.7071);
    h.step(30);
    const p = h.p('a');
    expect(p.y).toBeCloseTo(-0.25, 5);
    expect(p.x).toBeGreaterThan(0.9);
  });

  test('pillars block', () => {
    const h = new Harness(PILLARS, [['a', 0, 1]]);
    h.set('a', 1, 0);
    h.step(40);
    expect(h.p('a').x).toBeLessThanOrEqual(0.25 + 1e-9);
    expect(h.p('a').y).toBeCloseTo(1, 5);
  });

  test('corner assist turns into the next lane when slightly off-centre', () => {
    const h = new Harness(PILLARS, [['a', 0, 1.3]]);
    h.set('a', 1, 0);
    h.step(45);
    const p = h.p('a');
    expect(Math.abs(p.y - 2)).toBeLessThan(0.02);
    expect(p.x).toBeGreaterThan(1.5);
  });

  test('corner assist centres in an open lane instead of snagging on a pillar corner', () => {
    const h = new Harness(PILLARS, [['a', 0, 1.72]]);
    h.set('a', 1, 0);
    h.step(40);
    const p = h.p('a');
    expect(p.x).toBeGreaterThan(1.8);
    expect(Math.abs(p.y - 2)).toBeLessThan(0.03);
  });

  test('predictMovement matches the authoritative sim exactly', () => {
    const h = new Harness(PILLARS, [['a', 0, 1.3]]);
    const ghost = clonePlayer(h.p('a'));
    const world = cloneWorld(h.state);
    for (let i = 0; i < 60; i++) {
      const dx = i < 30 ? 1 : 0;
      const dy = i < 30 ? 0 : 1;
      h.set('a', dx, dy);
      h.step();
      predictMovement(world, ghost, { seq: i, dx, dy, buttons: 0 });
      expect(ghost.x).toBe(h.p('a').x);
      expect(ghost.y).toBe(h.p('a').y);
    }
  });

  test('reverse curse inverts controls, stun freezes', () => {
    const h = new Harness(OPEN, [['a', 4, 1]]);
    h.p('a').curse = Curse.Reverse;
    h.p('a').effects.curse = 600;
    h.set('a', 1, 0);
    h.step(10);
    expect(h.p('a').x).toBeLessThan(4);
    h.p('a').effects.stun = 20;
    const x = h.p('a').x;
    h.step(20);
    expect(h.p('a').x).toBe(x);
    h.step(1);
    expect(h.p('a').x).toBeLessThan(x);
  });
});

describe('bombs', () => {
  test('placement, passers and limits', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    expect(ev(h.tap('a', Button.Bomb), 'bombPlaced').length).toBe(1);
    h.tap('a', Button.Bomb);
    expect(h.state.bombs.size).toBe(1);
    // walk off the bomb (allowed: we're a passer), then try again: limit reached
    h.set('a', 1, 0);
    h.step(25);
    h.set('a', 0, 0);
    expect(onlyBomb(h).passers).not.toContain('a');
    h.tap('a', Button.Bomb);
    expect(h.state.bombs.size).toBe(1);
    // walking back into the bomb is now blocked
    h.set('a', -1, 0);
    h.step(20);
    expect(h.p('a').x).toBeGreaterThanOrEqual(1.625 - 1e-9);
    h.set('a', 0, 0);
    // BombUp raises the limit
    h.sim.spawnPickup(2, 1, PickupType.BombUp);
    h.step();
    expect(h.p('a').bombs).toBe(2);
    h.tap('a', Button.Bomb);
    expect(h.state.bombs.size).toBe(2);
  });

  test('constipation blocks bombs, diarrhea drops them', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    h.p('a').curse = Curse.Constipation;
    h.p('a').effects.curse = 100;
    h.tap('a', Button.Bomb);
    expect(h.state.bombs.size).toBe(0);
    h.p('a').curse = Curse.Diarrhea;
    h.step();
    expect(h.state.bombs.size).toBe(1);
  });

  test('explosion shapes and blocking', () => {
    const h = new Harness(['.........', '.........', '..#...B..', '.........', '.........'], [['a', 4, 2]]);
    h.p('a').radius = 3;
    h.tap('a', Button.Bomb);
    h.p('a').x = 8;
    h.p('a').y = 4;
    const t = h.until((e) => ev(e, 'explosion').length > 0, BOMB_FUSE + 5);
    expect(t).toBeGreaterThan(0);
    const ex = ev(h.events, 'explosion')[0]!;
    const shape = new Map(ex.cells.map((c) => [`${c.x},${c.y}`, c.shape]));
    expect(shape.get('4,2')).toBe(FlameShape.Center);
    expect(shape.get('3,2')).toBe(FlameShape.EndLeft); // wall at (2,2) stops it
    expect(shape.has('2,2')).toBe(false);
    expect(shape.get('5,2')).toBe(FlameShape.Horizontal);
    expect(shape.get('6,2')).toBe(FlameShape.EndRight); // brick burns, flame stops
    expect(shape.has('7,2')).toBe(false);
    expect(shape.get('4,1')).toBe(FlameShape.Vertical);
    expect(shape.get('4,0')).toBe(FlameShape.EndUp); // map edge
    expect(shape.get('4,4')).toBe(FlameShape.EndDown);
    expect(ex.cells.length).toBe(8);
    expect(tileAt(h.state, 6, 2)).toBe(Tile.Floor);
    expect(ev(h.events, 'brickDestroyed')).toEqual([{ type: 'brickDestroyed', x: 6, y: 2 }]);
    expect(h.state.flames.size).toBe(8);
    expect(h.p('a').alive).toBe(true);
  });

  test('hidden pickups pop out protected; exposed pickups burn', () => {
    const h = new Harness(['.....', '..B..', '.....'], [['a', 0, 0]]);
    h.sim.hidePickup(2, 1, PickupType.FireUp);
    h.sim.spawnPickup(4, 1, PickupType.BombUp);
    expect([...h.state.pickups.values()].length).toBe(1); // hidden one is not in WorldState
    h.p('a').radius = 2;
    h.p('a').x = 2;
    h.p('a').y = 2;
    h.tap('a', Button.Bomb);
    h.p('a').x = 0;
    h.p('a').y = 0;
    h.until((e) => ev(e, 'explosion').length > 0, BOMB_FUSE + 5);
    expect(ev(h.events, 'pickupSpawned').some((e) => e.kind === PickupType.FireUp)).toBe(true);
    expect(ev(h.events, 'pickupBurned').length).toBe(0); // protect window
    // a second blast from (4,2) reaches the unprotected BombUp at (4,1)
    h.step(40); // let the flames die down
    h.p('a').x = 4;
    h.p('a').y = 2;
    h.tap('a', Button.Bomb);
    h.p('a').x = 0;
    h.p('a').y = 0;
    h.until((e) => ev(e, 'explosion').length > 0, BOMB_FUSE + 5);
    expect(ev(h.events, 'pickupBurned').length).toBe(1);
  });

  test('chain reaction with CHAIN_DELAY', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 2, 1]]);
    h.p('a').radius = 2;
    h.p('a').bombs = 2;
    h.tap('a', Button.Bomb);
    h.p('a').x = 4;
    h.step(10);
    h.tap('a', Button.Bomb);
    h.p('a').x = 8;
    h.p('a').y = 2;
    const times: number[] = [];
    for (let i = 0; i < BOMB_FUSE + 20; i++) if (ev(h.step(), 'explosion').length) times.push(h.state.tick);
    expect(times.length).toBe(2);
    expect(times[1]! - times[0]!).toBe(CHAIN_DELAY);
  });

  test('kick: bomb slides until a wall', () => {
    const h = new Harness(['.........', '.......#.', '.........'], [['a', 3, 1]]);
    h.p('a').abilities |= Ability.Kick;
    h.tap('a', Button.Bomb);
    h.p('a').x = 1;
    h.set('a', 1, 0);
    const t = h.until((e) => ev(e, 'bombKicked').length > 0, 60);
    expect(t).toBeGreaterThan(0);
    h.set('a', 0, 0);
    h.until((e) => ev(e, 'bombStopped').length > 0, 60);
    const b = onlyBomb(h);
    expect(b.motion).toBe(BombMotion.Idle);
    expect([b.x, b.y]).toEqual([6, 1]);
  });

  test('kick: sliding bomb stops in front of a player', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 3, 1], ['b', 7, 1]]);
    h.p('a').abilities |= Ability.Kick;
    h.tap('a', Button.Bomb);
    h.p('a').x = 1;
    h.set('a', 1, 0);
    h.until((e) => ev(e, 'bombKicked').length > 0, 60);
    h.set('a', 0, 0);
    h.until((e) => ev(e, 'bombStopped').length > 0, 60);
    expect([onlyBomb(h).x, onlyBomb(h).y]).toEqual([6, 1]);
  });

  test('glove: grab, fuse paused while held, throw over a wall, bounce off a brick', () => {
    const h = new Harness(['.........', '...#B....', '.........'], [['a', 1, 1]]);
    const a = h.p('a');
    a.abilities |= Ability.Glove;
    h.tap('a', Button.Bomb);
    a.dir = Dir.Right;
    h.set('a', 0, 0, Button.Action);
    expect(ev(h.step(), 'bombGrabbed').length).toBe(1);
    expect(a.carrying).toBe(onlyBomb(h).id);
    h.step(BOMB_FUSE + 30);
    expect(h.state.bombs.size).toBe(1); // still held, not exploded
    h.set('a', 0, 0, 0);
    const thrown = ev(h.step(), 'bombThrown')[0]!;
    expect([thrown.toX, thrown.toY]).toEqual([4, 1]);
    h.until((e) => ev(e, 'bombLanded').length > 0, 120);
    expect(ev(h.events, 'bombBounced')[0]).toMatchObject({ x: 4, y: 1 });
    expect([onlyBomb(h).x, onlyBomb(h).y]).toEqual([5, 1]);
    expect(onlyBomb(h).motion).toBe(BombMotion.Idle);
  });

  test('glove: throws wrap around the map edge and stun on landing', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 7, 1], ['b', 1, 1]]);
    const a = h.p('a');
    a.abilities |= Ability.Glove;
    h.tap('a', Button.Bomb);
    a.dir = Dir.Right;
    h.set('a', 0, 0, Button.Action);
    h.step();
    h.set('a', 0, 0, 0);
    const thrown = ev(h.step(), 'bombThrown')[0]!;
    expect([thrown.toX, thrown.toY]).toEqual([1, 1]); // 7 + 3 = 10 -> wraps to 1
    h.until((e) => ev(e, 'bombLanded').length > 0, 120);
    expect(ev(h.events, 'playerStunned')).toEqual([{ type: 'playerStunned', player: 'b' }]);
    expect(h.p('b').effects.stun).toBeGreaterThan(STUN_TIME - 20);
    expect([onlyBomb(h).x, onlyBomb(h).y]).toEqual([2, 1]); // bounced off b's head
  });

  test('punch: adjacent bomb flies 3 tiles', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 2, 1]]);
    const a = h.p('a');
    a.abilities |= Ability.Punch;
    h.tap('a', Button.Bomb);
    a.x = 1;
    a.dir = Dir.Right;
    h.step(); // leave passer state
    const punched = ev(h.tap('a', Button.Action), 'bombPunched')[0]!;
    expect([punched.toX, punched.toY]).toEqual([5, 1]);
    h.until((e) => ev(e, 'bombLanded').length > 0, 120);
    expect([onlyBomb(h).x, onlyBomb(h).y]).toEqual([5, 1]);
  });

  test('remote: waits for Action, oldest first, auto after max fuse', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 1, 1]]);
    const a = h.p('a');
    a.abilities |= Ability.Remote;
    a.bombs = 2;
    h.tap('a', Button.Bomb);
    a.x = 4;
    h.step();
    h.tap('a', Button.Bomb);
    const [first, second] = [...h.state.bombs.values()];
    expect(first!.kind).toBe(BombKind.Remote);
    expect(first!.fuse).toBeLessThan(0);
    a.x = 8;
    a.y = 0;
    h.step(BOMB_FUSE + 10);
    expect(h.state.bombs.size).toBe(2);
    const e1 = ev(h.tap('a', Button.Action), 'explosion');
    expect(e1.map((e) => e.bomb)).toEqual([first!.id]);
    expect(h.state.bombs.has(second!.id)).toBe(true);
    const t = h.until((e) => ev(e, 'explosion').length > 0, REMOTE_BOMB_MAX_FUSE);
    expect(t).toBeGreaterThan(REMOTE_BOMB_MAX_FUSE - BOMB_FUSE - 40);
  });

  test('line bomb lays a row of bombs in the facing direction', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 1, 1]]);
    const a = h.p('a');
    a.abilities |= Ability.LineBomb;
    a.bombs = 4;
    a.dir = Dir.Right;
    h.tap('a', Button.Bomb);
    h.tap('a', Button.Bomb);
    const xs = [...h.state.bombs.values()].map((b) => `${b.x},${b.y}`);
    expect(xs).toEqual(['1,1', '2,1', '3,1', '4,1']);
  });

  test('pierce flames go through bricks', () => {
    for (const pierce of [false, true]) {
      const h = new Harness(['.........', '..BBB....', '.........'], [['a', 1, 1]]);
      const a = h.p('a');
      a.radius = 3;
      if (pierce) a.abilities |= Ability.Pierce;
      h.tap('a', Button.Bomb);
      a.x = 8;
      a.y = 2;
      h.until((e) => ev(e, 'explosion').length > 0, BOMB_FUSE + 5);
      expect(ev(h.events, 'brickDestroyed').length).toBe(pierce ? 3 : 1);
    }
  });

  test('crazy bombs roll fuse and radius', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 1, 1]]);
    const a = h.p('a');
    a.effects.crazy = 1000;
    a.radius = 2;
    h.tap('a', Button.Bomb);
    const b = onlyBomb(h);
    expect(b.kind).toBe(BombKind.Crazy);
    expect(b.fuse).toBeGreaterThanOrEqual(CRAZY_FUSE_MIN - 2);
    expect(b.fuse).toBeLessThanOrEqual(CRAZY_FUSE_MAX);
    expect(b.radius).toBeGreaterThanOrEqual(2);
    expect(b.radius).toBeLessThanOrEqual(6);
  });
});

describe('players & effects', () => {
  test('flames kill; kill credit goes to the bomb owner', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['b', 3, 1], ['c', 8, 2]], { playing: true });
    h.p('a').radius = 3;
    h.tap('a', Button.Bomb);
    h.p('a').x = 8;
    h.p('a').y = 0;
    h.until((e) => ev(e, 'playerDied').length > 0, BOMB_FUSE + 5);
    expect(ev(h.events, 'playerDied')[0]).toMatchObject({ player: 'b', killer: 'a' });
    expect(h.p('a').kills).toBe(1);
    expect(h.p('b').deaths).toBe(1);
  });

  test('shield blocks one explosion', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['z', 8, 2]], { playing: true });
    const a = h.p('a');
    a.effects.shield = 10000;
    h.tap('a', Button.Bomb);
    h.until((e) => ev(e, 'explosion').length > 0, BOMB_FUSE + 5);
    h.step(40);
    expect(ev(h.events, 'shieldBlocked').length).toBe(1);
    expect(a.alive).toBe(true);
    expect(a.effects.shield).toBe(0);
    h.tap('a', Button.Bomb);
    h.until((e) => ev(e, 'playerDied').length > 0, BOMB_FUSE + 5);
    expect(a.alive).toBe(false);
  });

  test('heart: respawn after RESPAWN_DELAY with invulnerability', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['z', 8, 2]], { playing: true });
    const a = h.p('a');
    h.sim.spawnPickup(1, 1, PickupType.Heart);
    h.step();
    expect(a.lives).toBe(1);
    h.tap('a', Button.Bomb);
    h.until((e) => ev(e, 'playerDied').length > 0, BOMB_FUSE + 5);
    expect(a.lives).toBe(0);
    expect(a.respawnIn).toBeGreaterThanOrEqual(RESPAWN_DELAY - 1);
    const t = h.until((e) => ev(e, 'playerRespawned').length > 0, RESPAWN_DELAY + 5);
    expect(t).toBe(RESPAWN_DELAY - 1);
    expect(a.alive).toBe(true);
    expect(a.effects.invulnerable).toBeGreaterThan(0);
    expect(h.state.phase).toBe(Phase.Playing);
  });

  test('curses spread on touch', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['b', 3, 1]]);
    h.p('a').curse = Curse.Slow;
    h.p('a').effects.curse = 600;
    h.set('b', -1, 0);
    h.until((e) => ev(e, 'curseApplied').length > 0, 60);
    expect(h.p('b').curse).toBe(Curse.Slow);
    expect(ev(h.events, 'curseApplied')[0]).toMatchObject({ player: 'b', from: 'a', curse: Curse.Slow });
  });

  test('skull applies a random curse; curse ends with effectEnded', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    h.sim.spawnPickup(1, 1, PickupType.Skull);
    h.step();
    expect(h.p('a').curse).not.toBe(Curse.None);
    h.p('a').effects.curse = 2;
    h.step(2);
    expect(h.p('a').curse).toBe(Curse.None);
    expect(ev(h.events, 'effectEnded')).toEqual([{ type: 'effectEnded', player: 'a', effect: 'curse' }]);
  });

  test('ghost walks through bricks and is pushed out when it ends', () => {
    const h = new Harness(['.........', '.BBBB....', '.........'], [['a', 0, 1]]);
    const a = h.p('a');
    a.effects.ghost = 40;
    h.set('a', 1, 0);
    h.step(39);
    expect(a.x).toBeGreaterThan(1.5);
    expect(tileAt(h.state, Math.round(a.x), Math.round(a.y))).toBe(Tile.Brick);
    h.set('a', 0, 0);
    h.step(1);
    expect(ev(h.events, 'effectEnded')[0]).toMatchObject({ effect: 'ghost' });
    expect(tileAt(h.state, Math.round(a.x), Math.round(a.y))).toBe(Tile.Floor);
    expect(Math.abs(a.x - Math.round(a.x)) + Math.abs(a.y - Math.round(a.y))).toBe(0);
  });

  test('fire: touching kills other players', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['b', 2, 1], ['z', 8, 2]], { playing: true });
    h.p('a').effects.fire = 600;
    h.set('a', 1, 0);
    h.until((e) => ev(e, 'playerDied').length > 0, 30);
    expect(ev(h.events, 'playerDied')[0]).toMatchObject({ player: 'b', killer: 'a' });
  });

  test('eliminated players scatter their pickups', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['z', 8, 2], ['y', 8, 0]], { playing: true });
    for (const t of [PickupType.BombUp, PickupType.FireUp, PickupType.Kick]) {
      h.sim.spawnPickup(1, 1, t);
      h.step();
    }
    h.tap('a', Button.Bomb);
    h.until((e) => ev(e, 'playerDied').length > 0, BOMB_FUSE + 5);
    expect(ev(h.events, 'pickupSpawned').length).toBe(3);
  });
});

describe('round flow', () => {
  test('waiting -> countdown -> playing -> round over with winner -> next round', () => {
    const sim = new Simulation({ minPlayers: 2, seed: 7 });
    sim.addPlayer({ id: 'a', name: 'A', skin: 0 });
    expect(sim.state.phase).toBe(Phase.Waiting);
    sim.step();
    expect(sim.state.phase).toBe(Phase.Waiting);
    sim.addPlayer({ id: 'b', name: 'B', skin: 0 });
    const e0 = sim.step();
    expect(sim.state.phase).toBe(Phase.Countdown);
    expect(e0).toContainEqual({ type: 'countdown', seconds: 3 });
    const startTiles = sim.state.tiles.slice();
    let started = false;
    for (let i = 0; i < COUNTDOWN_TIME; i++) {
      const before = { ...sim.state.players.get('a')! };
      if (sim.step().some((e) => e.type === 'roundStart')) started = true;
      if (!started) expect(sim.state.players.get('a')!.x).toBe(before.x);
    }
    expect(started).toBe(true);
    expect(sim.state.phase).toBe(Phase.Playing);
    // a spectator joins mid round
    const c = sim.addPlayer({ id: 'c', name: 'C', skin: 0 });
    expect(c.inRound).toBe(false);
    // b sits on its own bomb
    sim.pushInput('b', { seq: 1, dx: 0, dy: 0, buttons: Button.Bomb });
    let over = null;
    for (let i = 0; i < BOMB_FUSE + 10 && !over; i++) over = sim.step().find((e) => e.type === 'roundOver') ?? null;
    expect(over).toEqual({ type: 'roundOver', winner: 'a' });
    expect(sim.state.phase).toBe(Phase.RoundOver);
    expect(sim.state.winner).toBe('a');
    expect(sim.state.players.get('a')!.wins).toBe(1);
    expect(sim.state.players.get('b')!.deaths).toBe(1);
    for (let i = 0; i < ROUND_OVER_TIME; i++) sim.step();
    expect(sim.state.phase).toBe(Phase.Countdown);
    expect(sim.state.round).toBe(2);
    expect(sim.state.players.get('c')!.inRound).toBe(true);
    expect(sim.state.width).toBe(15);
    expect(Buffer.from(sim.state.tiles).equals(Buffer.from(startTiles))).toBe(false);
  });

  test('sudden death drops blocks in a spiral with warnings', () => {
    const sim = new Simulation({ minPlayers: 2, seed: 3 });
    sim.addPlayer({ id: 'a', name: 'A', skin: 0 });
    sim.addPlayer({ id: 'b', name: 'B', skin: 0 });
    while (sim.state.phase !== Phase.Playing) sim.step();
    sim.state.phaseTicks = ROUND_TIME - 1;
    expect(sim.step()).toContainEqual({ type: 'suddenDeath' });
    sim.step();
    expect(sim.state.falling.length).toBe(1);
    expect(sim.state.falling[0]).toMatchObject({ x: 0, y: 0 });
    const fell: unknown[] = [];
    let died = 0;
    const phase = () => sim.state.phase as Phase;
    for (let i = 0; i < 600 && phase() === Phase.SuddenDeath; i++) {
      for (const e of sim.step()) {
        if (e.type === 'blockFell') fell.push(e);
        if (e.type === 'playerDied') died++;
      }
    }
    expect(fell[0]).toEqual({ type: 'blockFell', x: 0, y: 0 });
    expect(tileAt(sim.state, 0, 0)).toBe(Tile.Wall);
    // corner spawns get crushed: the round ends
    expect(died).toBeGreaterThan(0);
    expect(phase()).toBe(Phase.RoundOver);
  });

  test('map size follows player count, hidden pickups stay out of WorldState', () => {
    const sim = new Simulation({ minPlayers: 6, seed: 11 });
    for (let i = 0; i < 6; i++) sim.addPlayer({ id: `p${i}`, name: '', skin: 0 });
    sim.step();
    expect([sim.state.width, sim.state.height]).toEqual([19, 15]);
    expect(sim.state.pickups.size).toBe(0);
    let hidden = 0;
    let bricks = 0;
    for (let i = 0; i < sim.state.tiles.length; i++) {
      if (sim.state.tiles[i] === Tile.Brick) bricks++;
      if (sim.ctx.hidden[i]! >= 0) hidden++;
    }
    expect(bricks).toBeGreaterThan(50);
    expect(hidden).toBe(Math.round(bricks * 0.3));
    // every spawn has its free L-zone
    for (const p of sim.state.players.values()) {
      expect(tileAt(sim.state, p.x, p.y)).toBe(Tile.Floor);
    }
  });
});

describe('input handling', () => {
  test('one queued input per step, last input repeats, ackSeq, held buttons edge-detected', () => {
    const sim = new Simulation({ minPlayers: 99, seed: 1 });
    sim.addPlayer({ id: 'a', name: 'a', skin: 0 });
    const p = sim.state.players.get('a')!;
    for (let s = 1; s <= 3; s++) sim.pushInput('a', { seq: s, dx: 0, dy: 0, buttons: Button.Bomb });
    sim.pushInput('a', { seq: 2, dx: 1, dy: 0, buttons: 0 }); // stale: ignored
    sim.step();
    expect(p.ackSeq).toBe(1);
    expect(sim.state.bombs.size).toBe(1);
    sim.step();
    sim.step();
    sim.step(); // queue empty: frame 3 repeats
    expect(p.ackSeq).toBe(3);
    expect(sim.state.bombs.size).toBe(1); // Bomb held the whole time -> one press
    for (let s = 4; s <= 20; s++) sim.pushInput('a', { seq: s, dx: 0, dy: 0, buttons: 0 });
    sim.step();
    expect(p.ackSeq).toBe(15); // only the newest 6 are kept
  });

  test('crossing flames merge into a Center piece', () => {
    expect(mergeShape(FlameShape.Horizontal, FlameShape.Vertical)).toBe(FlameShape.Center);
    expect(mergeShape(FlameShape.EndLeft, FlameShape.EndRight)).toBe(FlameShape.Horizontal);
    expect(mergeShape(FlameShape.EndUp, FlameShape.Vertical)).toBe(FlameShape.Vertical);
    expect(mergeShape(FlameShape.EndUp, FlameShape.EndLeft)).toBe(FlameShape.Center);
  });

  test('a duel ends when the opponent leaves', () => {
    const sim = new Simulation({ minPlayers: 2, seed: 1 });
    sim.addPlayer({ id: 'a', name: 'a', skin: 0 });
    sim.addPlayer({ id: 'b', name: 'b', skin: 0 });
    while (sim.state.phase !== Phase.Playing) sim.step();
    sim.removePlayer('b');
    expect(sim.step()).toContainEqual({ type: 'roundOver', winner: 'a' });
  });
});
