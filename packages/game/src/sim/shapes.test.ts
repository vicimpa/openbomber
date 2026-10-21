import { describe, expect, test } from 'bun:test';
import { Button, type GameEvent } from '../contract/protocol';
import { ArenaShape, Dir, Phase, Tile } from '../contract/types';
import { calcMap, generateMap, isPillar, ringTiles } from './map';
import { maxZoneDepth, shapeMask, shapeRingTiles, shapeSize, shapeSpawns, zoneDepth } from './shapes';
import { Simulation } from './Simulation';
import { Harness, ev } from './testkit';

const SHAPES = [ArenaShape.Circle, ArenaShape.Diamond, ArenaShape.Cross, ArenaShape.Ring];

/** Every cell reachable from `from` through non-wall cells (bricks break, so they count as open). */
function reach(tiles: Uint8Array, w: number, h: number, from: number) {
  const seen = new Uint8Array(tiles.length);
  const q = [from];
  seen[from] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j >= 0 && !seen[j] && tiles[j] !== Tile.Wall) { seen[j] = 1; q.push(j); }
    }
  }
  return seen;
}

describe('arena shapes', () => {
  test('spawns sit inside the shape, apart, on a free plus; the whole shape is reachable', () => {
    for (const shape of SHAPES) {
      for (const players of [1, 2, 4, 9, 16, 32]) {
        const m = calcMap(players);
        const [w, h] = shapeSize(shape, m.width, m.height);
        const rng = { seed: players * 31 + shape };
        const spawns = shapeSpawns(rng, shape, w, h, m.spawns.length);
        expect(spawns.length).toBeGreaterThanOrEqual(players);
        expect(new Set(spawns.map((s) => s.y * w + s.x)).size).toBe(spawns.length);
        const mask = shapeMask(shape, w, h);
        const g = generateMap(rng, w, h, spawns, rng, shape);
        for (const s of spawns) {
          expect(mask[s.y * w + s.x]).toBe(1);
          expect(isPillar(s.x, s.y)).toBe(false);
          expect(g.tiles[s.y * w + s.x]).toBe(Tile.Floor);
        }
        const seen = reach(g.tiles, w, h, spawns[0]!.y * w + spawns[0]!.x);
        for (let i = 0; i < mask.length; i++) {
          if (!mask[i]) expect(g.tiles[i]).toBe(Tile.Wall);
          else if (!isPillar(i % w, (i / w) | 0)) expect(seen[i]).toBe(1);
        }
      }
    }
  });

  test('the ring closes from the outside only, not from the rim of its middle', () => {
    const [w, h] = shapeSize(ArenaShape.Ring, 33, 33);
    const depth = zoneDepth(ArenaShape.Ring, w, h), mask = shapeMask(ArenaShape.Ring, w, h);
    const c = ((h - 1) / 2) * w + (w - 1) / 2;
    expect(mask[c]).toBe(0);
    // walk right from the middle: the first cell of the arena is its deepest ring there
    let i = c;
    while (!mask[i]) i++;
    expect(depth[i]).toBe(maxZoneDepth(ArenaShape.Ring, w, h));
  });

  test('a rectangle closes the same rings as before', () => {
    for (const [w, h] of [[13, 13], [19, 13], [33, 33], [20, 14]] as const) {
      for (let r = 0; r <= maxZoneDepth(ArenaShape.Rect, w, h); r++) {
        expect(new Set(shapeRingTiles(ArenaShape.Rect, w, h, r))).toEqual(new Set(ringTiles(w, h, r)));
      }
    }
  });

  test('every shape comes up, and its zone closes all the way', () => {
    const seen = new Set<ArenaShape>();
    for (let seed = 1; seen.size < 5 && seed < 200; seed++) {
      const sim = new Simulation({ seed, shapes: true, overtime: false });
      for (const id of ['a', 'b']) sim.addPlayer({ id, name: id, skin: 0 });
      let over = false;
      for (let i = 0; i < 4000 && sim.state.phase === Phase.Waiting; i++) sim.step();
      const w = sim.state;
      if (seen.has(w.shape)) continue;
      seen.add(w.shape);
      // both wait in the innermost ring, so only the very last ring can bury them
      const depth = zoneDepth(w.shape, w.width, w.height);
      const free = [...depth.keys()].filter((i) => depth[i] !== 255 && w.tiles[i] !== Tile.Wall);
      const deepest = Math.max(...free.map((i) => depth[i]!));
      const mid = free.filter((i) => depth[i] === deepest);
      for (const [k, id] of ['a', 'b'].entries()) {
        const i = mid[k % mid.length]!, p = w.players.get(id)!;
        w.tiles[i] = Tile.Floor;
        p.x = i % w.width; p.y = (i / w.width) | 0;
      }
      for (let i = 0; i < 60 * 60 * 15 && !over; i++) over = sim.step().some((e: GameEvent) => e.type === 'roundOver');
      expect(over).toBe(true);
      expect(w.zoneRing).toBeGreaterThanOrEqual(deepest + 1);
      expect(w.zoneRing).toBeLessThanOrEqual(maxZoneDepth(w.shape, w.width, w.height) + 1);
    }
    expect(seen.size).toBe(5);
  });

  test('glove: a bomb thrown into the countryside around a shape evaporates', () => {
    const h = new Harness(Array(9).fill('.........'), [['a', 4, 1]]);
    h.state.shape = ArenaShape.Diamond; // (1, 1) is outside a 9x9 diamond
    const a = h.p('a');
    h.give('a', ['glove']);
    h.tap('a', Button.Bomb);
    a.dir = Dir.Left;
    h.set('a', 0, 0, Button.Action);
    h.step();
    h.set('a', 0, 0, 0);
    const thrown = ev(h.step(), 'bombThrown')[0]!;
    expect([thrown.toX, thrown.toY]).toEqual([1, 1]);
    h.until((e) => ev(e, 'bombVanished').length > 0, 120);
    expect(ev(h.events, 'explosion')).toEqual([]);
  });
});
