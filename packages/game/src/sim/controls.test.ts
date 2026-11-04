import { describe, expect, test } from 'bun:test';
import { Button } from '../contract/protocol';
import { Curse, Dir, Phase, PickupType } from '../contract/types';
import { controlHints } from './controls';
import { Harness, ev } from './testkit';

const OPEN = ['...........', '...........', '...........'];
const hints = (h: Harness) => controlHints(h.state, h.p('a'));

describe('control hints and independent actions', () => {
  test('shows the missing ability and empty charges before any boosts', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    expect(hints(h)).toMatchObject({
      bomb: { kind: 'bomb', reason: 'ready', count: 1 },
      action: { kind: 'grab', reason: 'noAbility' },
      punch: { kind: 'punch', reason: 'noAbility' },
      detonate: { kind: 'remote', reason: 'noAbility', count: 0 },
      teleport: { reason: 'noCharges', count: 0 },
    });
  });

  test('Punch stays accessible with Glove and Remote; Grab never detonates', () => {
    const h = new Harness(OPEN, [['a', 2, 1]]);
    h.give('a', ['glove', 'punch', 'remote']);
    h.tap('a', Button.Bomb);
    h.p('a').x = 1;
    h.p('a').dir = Dir.Right;
    expect(hints(h)).toMatchObject({ action: { reason: 'ready' }, punch: { reason: 'ready' }, detonate: { reason: 'ready' } });
    const punched = h.tap('a', Button.Punch);
    expect(ev(punched, 'bombPunched')).toHaveLength(1);
    expect(ev(punched, 'bombGrabbed')).toHaveLength(0);
    expect(ev(punched, 'explosion')).toHaveLength(0);
    expect(h.p('a').carrying).toBe(-1);
    expect(hints(h).action.reason).toBe('noBombNearby');
    expect(hints(h).detonate.reason).toBe('noRemoteBomb'); // flying bombs cannot detonate
    h.p('a').x = 0;
    h.p('a').y = 0;
    h.until((events) => ev(events, 'bombLanded').length > 0, 100);
    expect(hints(h).detonate.reason).toBe('ready');
    expect(ev(h.tap('a', Button.Action), 'explosion')).toHaveLength(0);
    expect(ev(h.tap('a', Button.Detonate), 'explosion')).toHaveLength(1);
  });

  test('Detonate works next to a grabbable bomb without picking it up', () => {
    const h = new Harness(OPEN, [['a', 2, 1]]);
    h.give('a', ['glove', 'punch', 'remote']);
    h.tap('a', Button.Bomb);
    h.p('a').x = 1;
    h.p('a').dir = Dir.Right;
    const events = h.tap('a', Button.Detonate);
    expect(ev(events, 'explosion')).toHaveLength(1);
    expect(ev(events, 'bombGrabbed')).toHaveLength(0);
    expect(ev(events, 'bombPunched')).toHaveLength(0);
  });

  test('a carried bomb changes Grab to release-to-Throw and blocks punching', () => {
    const h = new Harness(OPEN, [['a', 2, 1]]);
    h.give('a', ['glove', 'punch']);
    h.tap('a', Button.Bomb);
    h.set('a', 0, 0, Button.Action);
    h.step();
    expect(hints(h)).toMatchObject({ action: { kind: 'throw', reason: 'ready' }, punch: { reason: 'carrying' }, bomb: { reason: 'carrying' } });
    h.set('a', 0, 0, Button.Action | Button.Punch);
    expect(ev(h.step(), 'bombPunched')).toHaveLength(0);
    h.set('a', 0, 0);
    expect(ev(h.step(), 'bombThrown')).toHaveLength(1);
  });

  test('bomb count, curse, pickups and line direction determine placement availability', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    h.tap('a', Button.Bomb);
    expect(hints(h).bomb).toMatchObject({ reason: 'bombLimit', count: 0 });
    h.p('a').bombs = 3;
    expect(hints(h).bomb.reason).toBe('blocked');
    h.give('a', ['lineBomb']);
    h.p('a').dir = Dir.Right;
    expect(hints(h).bomb).toMatchObject({ kind: 'lineBomb', reason: 'ready', count: 2 });
    h.sim.spawnPickup(2, 1, PickupType.Heart);
    expect(hints(h).bomb.reason).toBe('blocked');
    h.p('a').curse = Curse.Constipation;
    expect(hints(h).bomb.reason).toBe('curse');
  });

  test('Teleport needs both a charge and an available destination', () => {
    const h = new Harness(['.'], [['a', 0, 0]]);
    h.p('a').teleports = 2;
    expect(hints(h).teleport).toMatchObject({ reason: 'noDestination', count: 2 });
    h.tap('a', Button.Teleport);
    expect(h.p('a').teleports).toBe(2);
    const open = new Harness(OPEN, [['a', 1, 1]]);
    open.p('a').teleports = 2;
    expect(hints(open).teleport.reason).toBe('ready');
    expect(ev(open.tap('a', Button.Teleport), 'playerTeleported')).toHaveLength(1);
    expect(hints(open).teleport.count).toBe(1);
  });

  test('countdown, stun, respawn and end of round disable every action', () => {
    const h = new Harness(OPEN, [['a', 1, 1]]);
    for (const phase of [Phase.Countdown, Phase.RoundOver]) {
      h.state.phase = phase;
      const reason = phase === Phase.Countdown ? 'countdown' : 'roundOver';
      expect(Object.values(hints(h)).every((v) => v.reason === reason)).toBe(true);
    }
    h.state.phase = Phase.Playing;
    h.p('a').effects.stun = 10;
    expect(Object.values(hints(h)).every((v) => v.reason === 'stun')).toBe(true);
    h.p('a').alive = false;
    expect(Object.values(hints(h)).every((v) => v.reason === 'respawning')).toBe(true);
  });
});
