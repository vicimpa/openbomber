import { describe, expect, test } from 'bun:test';
import { snapStick } from '../src/input/stick';
import { Harness } from '../../game/src/sim/testkit';

const at = (degrees: number, previous = -1, radius = 1) => snapStick(
  Math.cos(degrees * Math.PI / 180) * radius,
  Math.sin(degrees * Math.PI / 180) * radius,
  previous,
);

describe('eight-way touch stick', () => {
  test('cardinal directions tolerate an imprecise finger; intentional diagonals stay diagonal', () => {
    for (const rotation of [0, 90, 180, 270]) {
      for (const offset of [-29, 0, 29]) expect(at(rotation + offset).direction).toBe(rotation / 45);
      for (const offset of [31, 45, 59]) expect(at(rotation + offset).direction).toBe(rotation / 45 + 1);
    }
  });

  test('direction does not flicker when the finger jitters on a diagonal boundary', () => {
    let direction = at(20).direction;
    for (const angle of [29, 28, 29]) {
      direction = at(angle, direction).direction;
      expect(direction).toBe(0);
    }
    direction = at(31, direction).direction;
    expect(direction).toBe(1);
    for (const angle of [29, 31, 26, 28]) {
      direction = at(angle, direction).direction;
      expect(direction).toBe(1);
    }
    expect(at(24, direction).direction).toBe(0);
    expect(at(64, 1).direction).toBe(1);
    expect(at(66, 1).direction).toBe(2);
  });

  test('turning across zero degrees and reversing direction do not get stuck', () => {
    expect(at(-26, 7).direction).toBe(7);
    expect(at(-24, 7).direction).toBe(0);
    expect(at(1, 0).direction).toBe(0);
    expect(at(180, 0).direction).toBe(4);
    expect(at(270, 1).direction).toBe(6);
  });

  test('a small movement at rest does not start walking; returning to centre releases the direction', () => {
    expect(at(0, -1, 0.4)).toEqual({ dx: 0, dy: 0, direction: -1 });
    expect(at(0, -1, 0.43).direction).toBe(0);
    expect(at(10, 0, 0.35).direction).toBe(0);
    expect(at(45, 0, 0.3)).toEqual({ dx: 0, dy: 0, direction: -1 });
    expect(at(28).direction).toBe(0); // a new drag forgets the previous diagonal
    for (const x of [NaN, Infinity, -Infinity]) expect(snapStick(x, 0).direction).toBe(-1);
    expect(snapStick(0, 0, 1).direction).toBe(-1);
  });

  test('every direction has equal speed and diagonal axes have equal magnitude', () => {
    for (let angle = -360; angle < 360; angle += 3) {
      const input = at(angle);
      expect(Math.hypot(input.dx, input.dy)).toBeCloseTo(1, 10);
      if (input.direction % 2) expect(Math.abs(input.dx)).toBe(Math.abs(input.dy));
      else expect(input.dx === 0 || input.dy === 0).toBe(true);
    }
  });

  test('the simulation runs straight for a near-horizontal drag, and true diagonals are no faster', () => {
    const rows = Array.from({ length: 15 }, () => '.'.repeat(15));
    const straight = new Harness(rows, [['a', 5, 5]]);
    const diagonal = new Harness(rows, [['a', 5, 5]]);
    const right = at(20), downRight = at(45);
    straight.set('a', right.dx, right.dy);
    diagonal.set('a', downRight.dx, downRight.dy);
    straight.step(30);
    diagonal.step(30);
    expect(straight.p('a').y).toBe(5);
    const a = straight.p('a'), b = diagonal.p('a');
    expect(Math.hypot(b.x - 5, b.y - 5)).toBeCloseTo(a.x - 5, 8);
  });
});
