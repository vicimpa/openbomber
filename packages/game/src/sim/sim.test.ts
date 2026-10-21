import { DROP_FALL_TIME, MAX_TELEPORTS, OVERTIME_EVERY, OVERTIME_MAX_TIME, OVERTIME_MIN_TIME, PLAYER_RADIUS, TELEPORT_CHARGES, TICK_RATE } from '../contract/constants';
import { describe, expect, test } from 'bun:test';
import {
  BOMB_FUSE,
  CHAIN_DELAY,
  BASE_SPEED,
  COUNTDOWN_TIME,
  CRAZY_FUSE_MAX,
  CRAZY_FUSE_MIN,
  FALL_TIME,
  FIRE_TIME,
  KICK_TIME,
  PICKUP_FILL,
  REMOTE_BOMB_MAX_FUSE,
  RESPAWN_DELAY,
  ROUND_OVER_TIME,
  SOLO_RESTART_TIME,
  SPEED_MULT,
  STUN_TIME,
  WAIT_FOR_LIMIT,
  ZONE_LIMIT_TIMEOUT,
} from '../contract/constants';
import { Button, type GameEvent } from '../contract/protocol';
import { generateMap, mapSizeFor, ringTiles, spawnPoints } from './map';
import { Ability, BombKind, BombMotion, Curse, Dir, DropKind, FlameShape, Phase, PickupType, Tile } from '../contract/types';
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
    // slid into lane y=2 just enough to clear the pillar, but not snapped to its centre
    expect(p.x).toBeGreaterThan(1.5);
    expect(p.y).toBeGreaterThanOrEqual(1.75 - 1e-6);
    expect(p.y).toBeLessThan(1.9);
  });

  test('an open lane never pulls the hero to its centre', () => {
    const h = new Harness(PILLARS, [['a', 0, 1.8]]);
    h.set('a', 1, 0);
    h.step(40);
    const p = h.p('a');
    expect(p.x).toBeGreaterThan(1.8);
    expect(Math.abs(p.y - 1.8)).toBeLessThan(1e-6);
  });

  test('rounding a pillar corner does not snag', () => {
    const h = new Harness(PILLARS, [['a', 0, 1.72]]);
    h.set('a', 1, 0);
    h.step(40);
    const p = h.p('a');
    expect(p.x).toBeGreaterThan(1.8);
    expect(p.y).toBeGreaterThanOrEqual(1.75 - 1e-6);
  });

  test('walking into another hero pushes them along', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['b', 1.6, 1]]);
    h.set('a', 1, 0);
    h.step(30);
    const a = h.p('a'), b = h.p('b');
    expect(b.x).toBeGreaterThan(2);
    expect(b.x - a.x).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS - 0.01);
    expect(Math.abs(b.y - 1)).toBeLessThan(1e-6);
  });

  test('a hero cannot be shoved through the map edge', () => {
    const h = new Harness(OPEN, [['a', 7, 1], ['b', 7.6, 1]]);
    h.set('a', 1, 0);
    h.step(60);
    expect(h.p('b').x).toBeLessThanOrEqual(8.5 - PLAYER_RADIUS + 1e-6); // last tile's outer edge
    expect(h.p('a').x).toBeLessThan(h.p('b').x);
  });

  test('dead heroes do not block or push', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['b', 1.6, 1]]);
    h.p('b').alive = false;
    h.set('a', 1, 0);
    h.step(30);
    expect(h.p('b').x).toBe(1.6);
    expect(h.p('a').x).toBeGreaterThan(2);
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

describe('hidden information', () => {
  test('pickups in bricks come from the secret generator, not the visible layout', () => {
    const spawns = spawnPoints(4);
    const [width, height] = mapSizeFor(4);
    const a = generateMap({ seed: 42 }, width, height, spawns, { seed: 1 });
    const b = generateMap({ seed: 42 }, width, height, spawns, { seed: 2 });
    expect([...a.tiles]).toEqual([...b.tiles]);    // identical bricks...
    expect([...a.hidden]).not.toEqual([...b.hidden]); // ...different loot
  });

  test('server entropy reshuffles every map', () => {
    let n = 0;
    const entropy = () => (n = (n * 1103515245 + 12345) >>> 0);
    const s1 = new Simulation({ seed: 7, entropy });
    const s2 = new Simulation({ seed: 7 });
    for (const s of [s1, s2]) { s.addPlayer({ id: 'a', name: 'a', skin: 0 }); s.addPlayer({ id: 'b', name: 'b', skin: 0 }); s.step(); }
    expect([...s1.state.tiles]).not.toEqual([...s2.state.tiles]);
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

  test('a burning pickup lets the flame through', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    h.sim.spawnPickup(3, 1, PickupType.BombUp);
    h.p('a').radius = 4;
    h.tap('a', Button.Bomb);
    h.p('a').x = 8;
    h.p('a').y = 0;
    h.until((e) => ev(e, 'explosion').length > 0, BOMB_FUSE + 5);
    const cells = new Map(ev(h.events, 'explosion')[0]!.cells.map((c) => [`${c.x},${c.y}`, c.shape]));
    expect(ev(h.events, 'pickupBurned').length).toBe(1);
    expect(cells.get('4,1')).toBe(FlameShape.Horizontal);
    expect(cells.get('5,1')).toBe(FlameShape.EndRight);
  });

  test('a player takes the blast and shields whoever stands behind; pierce goes through', () => {
    for (const pierce of [false, true]) {
      const h = new Harness(OPEN, [['a', 1, 1], ['b', 3, 1], ['c', 5, 1]]);
      h.p('a').radius = 5;
      if (pierce) h.p('a').abilities |= Ability.Pierce;
      h.tap('a', Button.Bomb);
      h.p('a').x = 8;
      h.p('a').y = 0;
      h.until((e) => ev(e, 'explosion').length > 0, BOMB_FUSE + 5);
      const cells = new Map(ev(h.events, 'explosion')[0]!.cells.map((c) => [`${c.x},${c.y}`, c.shape]));
      h.step();
      expect(h.p('b').alive).toBe(false);
      if (pierce) {
        expect(cells.get('6,1')).toBe(FlameShape.EndRight);
        expect(h.p('c').alive).toBe(false);
      } else {
        expect(cells.get('3,1')).toBe(FlameShape.EndRight);
        expect(cells.has('4,1')).toBe(false);
        expect(h.p('c').alive).toBe(true);
      }
    }
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
    h.give('a', ['kick']);
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
    h.give('a', ['kick']);
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
    h.give('a', ['glove']);
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

  test('glove: a bomb thrown across a blast drops into the fire and goes off there', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 1, 1]]);
    const a = h.p('a');
    h.give('a', ['glove']);
    h.tap('a', Button.Bomb);
    // fire burning on the bomb's way (as if another blast just went off there)
    const fid = h.state.nextId++;
    h.state.flames.set(fid, { id: fid, x: 2, y: 1, shape: FlameShape.Center, owner: 'z', ttl: 120 });
    h.sim.ctx.flameGrid[1 * h.state.width + 2] = fid;
    a.dir = Dir.Right;
    h.set('a', 0, 0, Button.Action);
    h.step();
    h.set('a', 0, 0, 0);
    expect(ev(h.step(), 'bombThrown')[0]).toMatchObject({ toX: 4, toY: 1 });
    h.until((e) => ev(e, 'explosion').length > 0, 60);
    expect(ev(h.events, 'explosion')[0]).toMatchObject({ x: 2, y: 1 });
  });

  test('glove: a bomb thrown off the map evaporates without a blast', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 7, 1]]);
    const a = h.p('a');
    h.give('a', ['glove']);
    h.tap('a', Button.Bomb);
    a.dir = Dir.Right;
    h.set('a', 0, 0, Button.Action);
    h.step();
    h.set('a', 0, 0, 0);
    const thrown = ev(h.step(), 'bombThrown')[0]!;
    expect([thrown.toX, thrown.toY]).toEqual([10, 1]); // 7 + 3, past the right edge
    h.until((e) => ev(e, 'bombVanished').length > 0, 120);
    expect(ev(h.events, 'bombVanished')[0]).toMatchObject({ x: 10, y: 1 });
    expect(ev(h.events, 'explosion')).toEqual([]);
    expect(h.state.bombs.size).toBe(0);
    h.tap('a', Button.Bomb); // the bomb slot is free again
    expect(h.state.bombs.size).toBe(1);
  });

  test('glove: a bomb landing on a head stuns and bounces on', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 1, 1], ['b', 4, 1]]);
    const a = h.p('a');
    h.give('a', ['glove']);
    h.tap('a', Button.Bomb);
    a.dir = Dir.Right;
    h.set('a', 0, 0, Button.Action);
    h.step();
    h.set('a', 0, 0, 0);
    h.step();
    h.until((e) => ev(e, 'bombLanded').length > 0, 120);
    expect(ev(h.events, 'playerStunned')).toEqual([{ type: 'playerStunned', player: 'b' }]);
    expect(h.p('b').effects.stun).toBeGreaterThan(STUN_TIME - 20);
    expect([onlyBomb(h).x, onlyBomb(h).y]).toEqual([5, 1]); // bounced off b's head
  });

  test('punch: adjacent bomb flies 3 tiles', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 2, 1]]);
    const a = h.p('a');
    h.give('a', ['punch']);
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
    h.give('a', ['remote']);
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
    h.give('a', ['lineBomb']);
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
      if (pierce) h.give('a', ['pierce']);
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
    expect(b.radius).toBeLessThanOrEqual(10); // up to x CRAZY_RADIUS_MULT
  });

  test('crazy + remote: still a remote bomb that waits for the button, with a crazy blast', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 1, 1]]);
    const a = h.p('a');
    a.effects.crazy = 1000;
    h.give('a', ['remote']);
    a.radius = 2;
    h.tap('a', Button.Bomb);
    const b = onlyBomb(h);
    expect(b.kind).toBe(BombKind.Remote);
    expect(b.fuse).toBeLessThan(0); // waits for Action
    expect(b.dud).toBe(false);
    expect(b.radius).toBeGreaterThanOrEqual(2);
    h.step(CRAZY_FUSE_MAX + 5);
    expect(h.state.bombs.size).toBe(1); // a crazy fuse would have gone off by now
    h.tap('a', Button.Action);
    h.until((e) => ev(e, 'explosion').length > 0, 30);
    expect(ev(h.events, 'explosion').length).toBe(1);
  });
});

describe('players & effects', () => {
  test('flames kill; kill credit goes to the bomb owner', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['b', 3, 1], ['c', 8, 2]]);
    h.p('a').radius = 3;
    h.tap('a', Button.Bomb);
    h.p('a').x = 8;
    h.p('a').y = 0;
    h.until((e) => ev(e, 'playerDied').length > 0, BOMB_FUSE + 5);
    expect(ev(h.events, 'playerDied')[0]).toMatchObject({ player: 'b', killer: 'a', cause: 'blast' });
    expect(h.p('a').kills).toBe(1);
    expect(h.p('b').deaths).toBe(1);
  });

  test('shield blocks one explosion', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['z', 8, 2]]);
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
    const h = new Harness(OPEN, [['a', 1, 1], ['z', 8, 2]]);
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
    const h = new Harness(OPEN, [['a', 1, 1], ['b', 2, 1], ['z', 8, 2]]);
    h.p('a').effects.fire = 600;
    h.set('a', 1, 0);
    h.until((e) => ev(e, 'playerDied').length > 0, 30);
    expect(ev(h.events, 'playerDied')[0]).toMatchObject({ player: 'b', killer: 'a', cause: 'fire' });
  });

  test('teleport: a pickup gives charges, R jumps to a random free tile', () => {
    const h = new Harness(PILLARS, [['a', 0, 0], ['b', 6, 4]]);
    const a = h.p('a');
    h.sim.spawnPickup(0, 0, PickupType.Teleport);
    h.step();
    expect(a.teleports).toBe(TELEPORT_CHARGES);
    for (let i = 0; i < 3; i++) { h.sim.spawnPickup(0, 0, PickupType.Teleport); h.step(); }
    expect(a.teleports).toBe(MAX_TELEPORTS);
    h.tap('a', Button.Teleport);
    const e = ev(h.events, 'playerTeleported')[0]!;
    expect(e).toMatchObject({ player: 'a', fromX: 0, fromY: 0 });
    expect(a.x === e.x && a.y === e.y).toBe(true);
    expect(e.x !== 0 || e.y !== 0).toBe(true);
    expect(tileAt(h.state, e.x, e.y)).toBe(Tile.Floor);
    expect(Math.abs(e.x - 6) >= 1.5 || Math.abs(e.y - 4) >= 1.5).toBe(true); // never next to another hero
    expect(a.teleports).toBe(MAX_TELEPORTS - 1);
  });

  test('teleport: no charges, no jump', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['z', 8, 2]]);
    h.tap('a', Button.Teleport);
    expect(ev(h.events, 'playerTeleported').length).toBe(0);
    expect(h.p('a').x).toBe(1);
    h.p('a').teleports = 2;
    h.tap('a', Button.Teleport);
    expect(ev(h.events, 'playerTeleported').length).toBe(1);
  });

  test('eliminated players scatter their pickups', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['z', 8, 2], ['y', 8, 0]]);
    for (const t of [PickupType.BombUp, PickupType.FireUp, PickupType.Kick]) {
      h.sim.spawnPickup(1, 1, t);
      h.step();
    }
    h.tap('a', Button.Bomb);
    h.until((e) => ev(e, 'playerDied').length > 0, BOMB_FUSE + 5);
    expect(ev(h.events, 'pickupSpawned').length).toBe(3);
  });
});

const run = (sim: Simulation, n: number) => {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...sim.step());
  return out;
};
const until = (sim: Simulation, pred: (e: GameEvent[]) => boolean, max = 5000) => {
  const out: GameEvent[] = [];
  for (let i = 0; i < max; i++) {
    const e = sim.step();
    out.push(...e);
    if (pred(e)) return out;
  }
  throw new Error('condition never met');
};
const phaseOf = (sim: Simulation) => sim.state.phase as Phase;

describe('round flow (canon: continuous, no lobby)', () => {
  test('a round runs as soon as someone is there; joiners spectate until the restart; winner on restart', () => {
    const sim = new Simulation({ seed: 7 });
    expect(phaseOf(sim)).toBe(Phase.Waiting);
    sim.addPlayer({ id: 'a', name: 'A', skin: 0 });
    expect(sim.step()).toContainEqual({ type: 'countdown', seconds: Math.ceil(COUNTDOWN_TIME / TICK_RATE) });
    expect(phaseOf(sim)).toBe(Phase.Countdown);
    expect([sim.state.width, sim.state.height]).toEqual([13, 13]);
    const a = sim.state.players.get('a')!;
    const x0 = a.x;
    sim.pushInput('a', { seq: 1, dx: 1, dy: 0, buttons: 0 });
    const started = until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    const ticks = started.filter((e) => e.type === 'countdown');
    expect(ticks[ticks.length - 1]).toEqual({ type: 'countdown', seconds: 1 });
    expect(a.x).toBe(x0); // frozen during the countdown
    sim.pushInput('a', { seq: 2, dx: 0, dy: 0, buttons: 0 });

    // a second player joins mid-round: spectator; with 2 players and 1 alive the round is decided
    const b = sim.addPlayer({ id: 'b', name: 'B', skin: 0 });
    expect(b.inRound).toBe(false);
    const over = until(sim, (e) => e.some((x) => x.type === 'roundOver'), 10);
    expect(over).toContainEqual({ type: 'roundOver', winner: '' }); // practice round: nobody wins
    expect(sim.state.phaseTicks).toBe(ROUND_OVER_TIME - 1 + 1);
    run(sim, ROUND_OVER_TIME);
    expect(phaseOf(sim)).toBe(Phase.Countdown);
    expect(sim.state.round).toBe(2);
    expect([sim.state.width, sim.state.height]).toEqual([19, 13]); // resized for 2 players
    expect(b.inRound && b.alive).toBe(true);

    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    sim.pushInput('b', { seq: 1, dx: 0, dy: 0, buttons: Button.Bomb }); // b sits on its own bomb
    const end = until(sim, (e) => e.some((x) => x.type === 'roundOver'), BOMB_FUSE + 60);
    expect(end).toContainEqual({ type: 'roundOver', winner: 'a' });
    // decided only once bombs and flames are gone
    const died = end.findIndex((e) => e.type === 'playerDied');
    expect(end.length - died).toBeGreaterThan(1);
    expect(sim.state.flames.size).toBe(0);
    expect(a.wins).toBe(1);
    expect(b.deaths).toBe(1);
    run(sim, ROUND_OVER_TIME);
    expect(sim.state.round).toBe(3);
  });

  test('practice mode: a lone player restarts when bricks and pickups run out, or on death', () => {
    const sim = new Simulation({ seed: 3 });
    sim.addPlayer({ id: 'a', name: 'A', skin: 0 });
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    sim.step();
    expect(phaseOf(sim)).toBe(Phase.Playing); // bricks left
    sim.loadMap(['.....', '.....', '.....']); // cleared arena
    expect(sim.step()).toContainEqual({ type: 'roundOver', winner: '' });
    expect(sim.state.phaseTicks).toBe(SOLO_RESTART_TIME);
    run(sim, SOLO_RESTART_TIME);
    expect(phaseOf(sim)).toBe(Phase.Countdown);
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    sim.pushInput('a', { seq: 1, dx: 0, dy: 0, buttons: Button.Bomb });
    const e = until(sim, (ev) => ev.some((x) => x.type === 'roundOver'), BOMB_FUSE + 60);
    expect(e.some((x) => x.type === 'playerDied')).toBe(true);
    expect(sim.state.players.get('a')!.deaths).toBe(0); // deaths count only with company
  });

  test('zone: warning after WAIT_FOR_LIMIT, ring closes ZONE_LIMIT_TIMEOUT later with falling blocks', () => {
    const sim = new Simulation({ seed: 5 });
    for (const id of ['a', 'b', 'c']) sim.addPlayer({ id, name: id, skin: 0 });
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    const w = sim.state;
    expect([w.width, w.height]).toEqual([19, 19]);
    const warn = until(sim, (e) => e.some((x) => x.type === 'zoneWarning'), WAIT_FOR_LIMIT + 5);
    expect(warn).toContainEqual({ type: 'zoneWarning', seconds: 15 });
    expect(w.zoneIn).toBe(ZONE_LIMIT_TIMEOUT);
    // c stands on the outer ring when it closes
    const c = w.players.get('c')!;
    c.x = 0;
    c.y = 0;
    const shrink = until(sim, (e) => e.some((x) => x.type === 'zoneShrink'), ZONE_LIMIT_TIMEOUT + 5);
    expect(shrink).toContainEqual({ type: 'zoneShrink', ring: 1 });
    expect(shrink).toContainEqual({ type: 'suddenDeath' });
    expect(phaseOf(sim)).toBe(Phase.SuddenDeath);
    expect(w.zoneRing).toBe(1);
    const ring = ringTiles(w.width, w.height, 0);
    expect(w.falling.length).toBe(ring.length); // the outer ring is all floor / bricks
    expect(w.falling[0]!.ttl).toBeGreaterThanOrEqual(FALL_TIME);
    const fell = run(sim, FALL_TIME + 40);
    expect(fell.filter((e) => e.type === 'blockFell').length).toBe(ring.length);
    expect(ring.every((i) => w.tiles[i] === Tile.Wall)).toBe(true);
    expect(fell).toContainEqual({ type: 'playerDied', player: 'c', killer: '', x: 0, y: 0, cause: 'crushed' });
    expect(w.players.get('a')!.alive && w.players.get('b')!.alive).toBe(true);
    // the next warning comes WAIT_FOR_LIMIT after the shrink
    const next = until(sim, (e) => e.some((x) => x.type === 'zoneWarning'), WAIT_FOR_LIMIT + 5);
    expect(next.length).toBeGreaterThan(0);
  });

  test('zone: two heroes buried by one ring both lose, the first one crushed does not hand the win over', () => {
    const sim = new Simulation({ seed: 9, overtime: false });
    for (const id of ['a', 'b']) sim.addPlayer({ id, name: id, skin: 0 });
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    const w = sim.state;
    // both on the outer ring, at opposite ends of its sweep
    const pa = w.players.get('a')!, pb = w.players.get('b')!;
    pa.x = 0; pa.y = 0; pb.x = w.width - 1; pb.y = w.height - 1;
    for (const [x, y] of [[0, 0], [w.width - 1, w.height - 1]]) w.tiles[y * w.width + x] = Tile.Floor;
    const out = until(sim, (e) => e.some((x) => x.type === 'roundOver'), WAIT_FOR_LIMIT + ZONE_LIMIT_TIMEOUT + FALL_TIME + 200);
    const deaths = out.filter((x) => x.type === 'playerDied');
    expect(deaths.length).toBe(2);
    expect(out).toContainEqual({ type: 'roundOver', winner: '' });
  });

  test('zone: closes all the way, so walled-off survivors cannot stall a round', () => {
    const sim = new Simulation({ seed: 9 });
    for (const id of ['a', 'b']) sim.addPlayer({ id, name: id, skin: 0 });
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    const w = sim.state;
    const rings = Math.ceil(Math.min(w.width, w.height) / 2);
    // both idle in the very middle, which the legacy zone (stopping at min / 2) never closed
    const cy = (w.height - 1) / 2;
    const pa = w.players.get('a')!, pb = w.players.get('b')!;
    pa.x = cy + 2; pa.y = cy; pb.x = cy + 4; pb.y = cy;
    const over = until(sim, (e) => e.some((x) => x.type === 'roundOver'), 60 * 60 * 10);
    expect(over.some((x) => x.type === 'roundOver')).toBe(true);
    expect(w.zoneRing).toBe(rings);
  });

  test('overtime: once most bricks are gone, pickups then bombs rain from the sky', () => {
    const sim = new Simulation({ seed: 21 });
    for (const id of ['a', 'b']) sim.addPlayer({ id, name: id, skin: 0 });
    sim.holdRound = false;
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    const w = sim.state;
    // nobody broke anything: no rain before OVERTIME_MAX_TIME
    for (let i = 0; i < OVERTIME_MIN_TIME + 5; i++) expect(sim.step().some((x) => x.type === 'skyRain')).toBe(false);
    // wreck the map: past OVERTIME_DESTROYED the first rain (pickups) comes within a second
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === Tile.Brick) w.tiles[i] = Tile.Floor;
    const first = until(sim, (e) => e.some((x) => x.type === 'skyRain'), TICK_RATE + 2);
    expect(first.find((x) => x.type === 'skyRain')).toMatchObject({ kind: 'pickups' });
    expect(w.drops.length).toBeGreaterThan(0);
    const landed = until(sim, (e) => e.some((x) => x.type === 'dropLanded'), DROP_FALL_TIME + TICK_RATE);
    expect(landed.some((x) => x.type === 'pickupSpawned')).toBe(true);
    const second = until(sim, (e) => e.some((x) => x.type === 'skyRain'), OVERTIME_EVERY + 2);
    expect(second.find((x) => x.type === 'skyRain')).toMatchObject({ kind: 'bombs' });
    until(sim, (e) => e.some((x) => x.type === 'dropLanded' && x.kind === DropKind.Bomb), DROP_FALL_TIME + TICK_RATE);
    expect([...w.bombs.values()].some((b) => b.owner === '')).toBe(true);
  });

  test('overtime: off in the room settings means no rain', () => {
    const sim = new Simulation({ seed: 21, overtime: false });
    for (const id of ['a', 'b']) sim.addPlayer({ id, name: id, skin: 0 });
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    const w = sim.state;
    for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === Tile.Brick) w.tiles[i] = Tile.Floor;
    for (let i = 0; i < OVERTIME_MAX_TIME + 5; i++) expect(sim.step().some((x) => x.type === 'skyRain')).toBe(false);
  });

  test('zone: pending shrink is cancelled when fewer than 2 players remain', () => {
    const sim = new Simulation({ seed: 5 });
    for (const id of ['a', 'b']) sim.addPlayer({ id, name: id, skin: 0 });
    until(sim, (e) => e.some((x) => x.type === 'zoneWarning'), COUNTDOWN_TIME + WAIT_FOR_LIMIT + 5);
    sim.removePlayer('b');
    expect(sim.step()).toContainEqual({ type: 'zoneCancel' });
    expect(sim.state.zoneIn).toBe(0);
    // left alone before anyone died: practice, no win
    expect(sim.state.phase).toBe(Phase.Playing);
  });

  test('map size and spawns follow legacy calcMap', () => {
    expect(mapSizeFor(1)).toEqual([13, 13]);
    expect(mapSizeFor(2)).toEqual([19, 13]);
    expect(mapSizeFor(3)).toEqual([19, 19]);
    expect(mapSizeFor(4)).toEqual([19, 19]);
    expect(mapSizeFor(9)).toEqual([33, 33]);
    expect(mapSizeFor(32)).toEqual([75, 75]);
    expect(spawnPoints(1)).toEqual([{ x: 6, y: 6 }]);
    expect(spawnPoints(2)).toEqual([{ x: 2, y: 6 }, { x: 16, y: 6 }]);
    expect(spawnPoints(32).length).toBe(36);

    const sim = new Simulation({ seed: 11 });
    for (let i = 0; i < 9; i++) sim.addPlayer({ id: `p${i}`, name: '', skin: 0 });
    sim.step();
    const w = sim.state;
    expect([w.width, w.height]).toEqual([33, 33]);
    expect(w.pickups.size).toBe(0); // hidden pickups are not in WorldState
    let hidden = 0;
    let bricks = 0;
    for (let i = 0; i < w.tiles.length; i++) {
      if (w.tiles[i] === Tile.Brick) bricks++;
      if (sim.ctx.hidden[i]! >= 0) hidden++;
    }
    expect(hidden).toBe(Math.round(bricks * PICKUP_FILL));
    for (const p of w.players.values()) {
      // every spawn has a free plus of radius 2
      for (let k = -2; k <= 2; k++) {
        expect(tileAt(w, p.x + k, p.y)).toBe(Tile.Floor);
        expect(tileAt(w, p.x, p.y + k)).toBe(Tile.Floor);
      }
    }
  });

  test('add / remove at any moment is safe (carried, flying, respawning)', () => {
    const h = new Harness(OPEN, [['a', 1, 1], ['b', 5, 1], ['c', 8, 2]], { live: true });
    h.give('a', ['glove']);
    h.give('b', ['glove']);
    h.tap('a', Button.Bomb);
    h.p('a').dir = Dir.Right;
    h.set('a', 0, 0, Button.Action);
    h.step();
    expect(h.p('a').carrying).toBeGreaterThan(0);
    h.sim.removePlayer('a'); // carried bomb drops
    expect([...h.state.bombs.values()][0]!.motion).toBe(BombMotion.Idle);
    h.tap('b', Button.Bomb);
    h.p('b').dir = Dir.Left;
    h.set('b', 0, 0, Button.Action);
    h.step();
    h.set('b', 0, 0, 0);
    h.step(); // thrown
    h.sim.removePlayer('b'); // mid-flight
    h.sim.addPlayer({ id: 'a', name: 'again', skin: 1 });
    expect(h.p('a').inRound).toBe(false);
    expect(() => h.step(BOMB_FUSE + 400)).not.toThrow();
  });
});

describe('input handling', () => {
  test('one queued input per step, last input repeats, ackSeq, held buttons edge-detected', () => {
    const sim = new Simulation({ seed: 1 });
    sim.addPlayer({ id: 'a', name: 'a', skin: 0 });
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    const p = sim.state.players.get('a')!;
    for (let s = 1; s <= 3; s++) sim.pushInput('a', { seq: s, dx: 0, dy: 0, buttons: Button.Bomb });
    sim.pushInput('a', { seq: 2, dx: 1, dy: 0, buttons: 0 }); // stale: ignored
    sim.step();
    expect(p.ackSeq).toBe(1);
    expect(sim.state.bombs.size).toBe(1);
    sim.step();
    sim.step();
    sim.step(); // queue empty: frame 3 repeats (a guess, not acked)
    expect([p.ackSeq, p.guessed]).toEqual([3, 1]);
    expect(sim.state.bombs.size).toBe(1); // Bomb held the whole time -> one press
    // a flood beyond the guessed tick: only the newest 6 (+1 for the guess) are kept; the guess
    // was wrong (Bomb released), so it is rewound and its tick runs the first kept frame too
    for (let s = 4; s <= 20; s++) sim.pushInput('a', { seq: s, dx: 0, dy: 0, buttons: 0 });
    sim.step();
    expect([p.ackSeq, p.guessed]).toEqual([15, 0]);
  });

  test('late frames: the sim guesses the last input and settles it, ending exactly where the frames lead', () => {
    // the same frames on time (ref) and with stalls (late): positions must match tick for tick
    // once the late frames are in, whatever was guessed meanwhile
    const mk = () => {
      const sim = new Simulation({ seed: 7 });
      sim.addPlayer({ id: 'a', name: 'a', skin: 0 });
      until(sim, (e) => e.some((x) => x.type === 'roundStart'));
      sim.holdRound = true;
      const w = sim.state;
      for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === Tile.Brick) w.tiles[i] = Tile.Floor;
      const p = w.players.get('a')!;
      p.x = Math.floor(w.width / 2); p.y = Math.floor(w.height / 2);
      return sim;
    };
    const ref = mk(), late = mk();
    const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const frame = (s: number) => {
      const [dx, dy] = dirs[Math.floor(s / 17) % 4]!; // a turn every 17 frames
      return { seq: s, dx, dy, buttons: 0 };
    };
    // stalls (frames withheld, then all at once): within a straight run (all guesses right),
    // across a turn (rewind), and longer than the guess budget (the hero waits, then catches up)
    const withheld = new Set<number>();
    for (const [a, b] of [[3, 12], [28, 40], [60, 120]] as const) for (let s = a; s <= b; s++) withheld.add(s);
    const held: number[] = [];
    const pa = ref.state.players.get('a')!, pb = late.state.players.get('a')!;
    let guessedMax = 0;
    for (let s = 1; s <= 160; s++) {
      ref.pushInput('a', frame(s));
      ref.step();
      if (withheld.has(s)) held.push(s);
      else { for (const h of held.splice(0)) late.pushInput('a', frame(h)); late.pushInput('a', frame(s)); }
      late.step();
      guessedMax = Math.max(guessedMax, pb.guessed);
      if (held.length === 0) {
        expect([pb.ackSeq, pb.guessed]).toEqual([s, 0]);
        expect([pb.x, pb.y]).toEqual([pa.x, pa.y]);
      } else {
        expect(pb.ackSeq).toBeLessThan(held[0]!);
      }
    }
    expect(guessedMax).toBe(30); // MAX_GUESS: the long stall used them all up
  });

  test('crossing flames merge into a Center piece', () => {
    expect(mergeShape(FlameShape.Horizontal, FlameShape.Vertical)).toBe(FlameShape.Center);
    expect(mergeShape(FlameShape.EndLeft, FlameShape.EndRight)).toBe(FlameShape.Horizontal);
    expect(mergeShape(FlameShape.EndUp, FlameShape.Vertical)).toBe(FlameShape.Vertical);
    expect(mergeShape(FlameShape.EndUp, FlameShape.EndLeft)).toBe(FlameShape.Center);
  });

  test('a duel decided by a death still has a winner after the loser leaves', () => {
    const sim = new Simulation({ seed: 1 });
    sim.addPlayer({ id: 'a', name: 'a', skin: 0 });
    sim.addPlayer({ id: 'b', name: 'b', skin: 0 });
    until(sim, (e) => e.some((x) => x.type === 'roundStart'));
    sim.pushInput('b', { seq: 1, dx: 0, dy: 0, buttons: Button.Bomb });
    until(sim, (e) => e.some((x) => x.type === 'playerDied'), BOMB_FUSE + 5);
    sim.removePlayer('b');
    const e = until(sim, (ev) => ev.some((x) => x.type === 'roundOver'), 60);
    expect(e).toContainEqual({ type: 'roundOver', winner: 'a' });
  });
});

describe('canon pickups', () => {
  test('abilities are timed: bit set while the timer runs, effectEnded when it stops; time stacks', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    const a = h.p('a');
    h.sim.spawnPickup(1, 1, PickupType.Kick);
    h.step();
    expect(a.effects.kick).toBeGreaterThan(KICK_TIME - 3);
    expect(a.abilities & Ability.Kick).toBeTruthy();
    h.sim.spawnPickup(1, 1, PickupType.Kick);
    h.step();
    expect(a.effects.kick).toBeGreaterThan(2 * KICK_TIME - 5);
    a.effects.kick = 2;
    h.step(2);
    expect(a.abilities & Ability.Kick).toBe(0);
    expect(ev(h.events, 'effectEnded')).toContainEqual({ type: 'effectEnded', player: 'a', effect: 'kick' });
  });

  test('SpeedUp is timed and cancels Fire (and vice versa); BombUp / FireUp persist', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    const a = h.p('a');
    h.sim.spawnPickup(1, 1, PickupType.Fire);
    h.step();
    expect(a.effects.fire).toBeGreaterThan(FIRE_TIME - 3);
    h.sim.spawnPickup(1, 1, PickupType.SpeedUp);
    h.step();
    expect(a.effects.fire).toBe(0); // 25 s of speed eats 25 s of fire
    expect(a.effects.speed).toBe(0);
    expect(ev(h.events, 'effectEnded')).toContainEqual({ type: 'effectEnded', player: 'a', effect: 'fire' });
    h.sim.spawnPickup(1, 1, PickupType.SpeedUp);
    h.step();
    expect(a.speedLevel).toBe(1);
    const x = a.x;
    h.set('a', 1, 0);
    h.step(10);
    expect(a.x - x).toBeCloseTo((10 * BASE_SPEED * SPEED_MULT) / 60, 5);
    for (const t of [PickupType.BombUp, PickupType.FireUp]) {
      h.sim.spawnPickup(Math.round(a.x), 1, t);
      h.step();
    }
    expect([a.bombs, a.radius]).toEqual([2, 2]);
  });

  test('remote running out gives waiting bombs a normal fuse', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    h.give('a', ['remote'], 30);
    h.tap('a', Button.Bomb);
    const b = [...h.state.bombs.values()][0]!;
    expect(b.fuse).toBeLessThan(0);
    h.step(30);
    expect(b.fuse).toBeGreaterThan(BOMB_FUSE - 5);
  });

  test('kicking a bomb takes the kill credit (legacy)', () => {
    const h = new Harness(['.........', '.........', '.........'], [['a', 3, 1], ['k', 1, 1], ['v', 8, 1], ['z', 0, 2]]);
    h.give('k', ['kick']);
    h.tap('a', Button.Bomb);
    h.p('a').x = 0; // out of the way
    h.p('a').y = 0;
    h.set('k', 1, 0);
    h.until((e) => ev(e, 'bombKicked').length > 0, 60);
    h.set('k', 0, 0);
    h.p('v').x = 7.6; // the bomb stops next to v
    h.until((e) => ev(e, 'playerDied').length > 0, BOMB_FUSE + 10);
    expect(ev(h.events, 'playerDied')[0]).toMatchObject({ player: 'v', killer: 'k' });
    expect(h.p('k').kills).toBe(1);
  });
});
