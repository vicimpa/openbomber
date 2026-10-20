// Timed abilities: each one is a timer in PlayerState.effects plus a bit in
// PlayerState.abilities that is set exactly while the timer runs.

import {
  BOMB_PASS_TIME,
  GLOVE_TIME,
  KICK_TIME,
  LINE_BOMB_TIME,
  PIERCE_TIME,
  PUNCH_TIME,
  REMOTE_TIME,
} from '../contract/constants';
import type { EffectName } from '../contract/protocol';
import { Ability, PickupType, type PlayerState, type TimedEffects } from '../contract/types';

export interface TimedAbility {
  key: keyof TimedEffects & EffectName;
  bit: Ability;
  time: number;
  pickup: PickupType;
}

export const TIMED_ABILITIES: readonly TimedAbility[] = [
  { key: 'kick', bit: Ability.Kick, time: KICK_TIME, pickup: PickupType.Kick },
  { key: 'glove', bit: Ability.Glove, time: GLOVE_TIME, pickup: PickupType.Glove },
  { key: 'punch', bit: Ability.Punch, time: PUNCH_TIME, pickup: PickupType.Punch },
  { key: 'remote', bit: Ability.Remote, time: REMOTE_TIME, pickup: PickupType.Remote },
  { key: 'pierce', bit: Ability.Pierce, time: PIERCE_TIME, pickup: PickupType.Pierce },
  { key: 'lineBomb', bit: Ability.LineBomb, time: LINE_BOMB_TIME, pickup: PickupType.LineBomb },
  { key: 'bombPass', bit: Ability.BombPass, time: BOMB_PASS_TIME, pickup: PickupType.BombPass },
];

export function emptyEffects(): TimedEffects {
  return {
    shield: 0, ghost: 0, crazy: 0, fire: 0, curse: 0, invulnerable: 0, stun: 0, speed: 0,
    kick: 0, glove: 0, punch: 0, remote: 0, pierce: 0, lineBomb: 0, bombPass: 0,
  };
}

/** Give a timed ability (stacking time). */
export function grantAbility(p: PlayerState, a: TimedAbility) {
  p.effects[a.key] += a.time;
  p.abilities |= a.bit;
}

/** Derive `abilities` and `speedLevel` from the timers. */
export function syncAbilities(p: PlayerState) {
  let bits = 0;
  for (const a of TIMED_ABILITIES) if (p.effects[a.key] > 0) bits |= a.bit;
  p.abilities = bits;
  p.speedLevel = p.effects.speed > 0 ? 1 : 0;
}
