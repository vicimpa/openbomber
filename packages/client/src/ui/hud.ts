// HUD view-model: a small, render-friendly snapshot derived from WorldState by a pure function.
// The session layer calls `hud.value = buildHud(world, localId, ping)` ~10 times per second.
import * as G from '@ob/game';
import { Ability, Curse, Phase, TICK_RATE, type PlayerState, type WorldState } from '@ob/game';

/**
 * Any key of PlayerState.effects (shield, ghost, crazy, fire, curse, invulnerable, stun and the
 * canon timed boosts the sim adds: speed, kick, glove, punch, remote, pierce, lineBomb, bombPass…).
 */
export type EffectKind = string;

export interface HudEffect {
  kind: EffectKind;
  left: number;        // seconds remaining
  frac: number;        // 0..1 of the full duration (for bars / rings)
  curse?: Curse;       // when kind === 'curse'
}

export interface HudPlayer {
  id: string;
  name: string;
  skin: number;
  isBot: boolean;
  isLocal: boolean;
  alive: boolean;
  inRound: boolean;
  respawning: boolean;
  wins: number;
  kills: number;
  deaths: number;
}

export interface HudMe extends HudPlayer {
  lives: number;           // extra lives (Heart)
  teleports: number;       // Teleport charges
  bombs: number;           // max simultaneous bombs
  bombsPlaced: number;     // own bombs currently in the world
  radius: number;
  speedLevel: number;
  /** Ability flags that have NO timed effect counterpart (permanent ones), in display order. */
  abilities: Ability[];
  curse: Curse;
  effects: HudEffect[];    // active timed effects, longest first
  carrying: boolean;
  respawnIn: number;       // seconds, 0 = none
  /** Not playing this round: joined mid-round (waits for the next one) or eliminated. */
  spectating: boolean;
}

export interface HudSnapshot {
  tick: number;
  phase: Phase;
  round: number;
  /** Whole seconds left in Countdown (3, 2, 1), else 0. */
  countdown: number;
  /** @deprecated canon has no round timer; always 0. */
  timeLeft: number;
  /** Seconds left in RoundOver. */
  roundOverIn: number;
  suddenDeath: boolean;
  /** Seconds until the next zone ring closes («Уменьшение размера карты через N сек»), 0 = none pending. */
  shrinkIn: number;
  /** Zone rings already closed (0 = full map). */
  zoneRing: number;
  alive: number;           // players still in the round (alive or respawning)
  total: number;           // players taking part in the round
  ping: number;            // ms, 0 offline
  /** The local player is connected (has a PlayerState) — the bottom button shows «Отключиться». */
  connected: boolean;
  me: HudMe | null;
  /** Scoreboard order: wins, kills desc; deaths asc. */
  players: HudPlayer[];
  winner: HudPlayer | null;  // valid in RoundOver; null + phase RoundOver = draw
}

/** Fallback durations (ticks) when the contract has no `<KIND>_TIME` constant. Canon values. */
const FALLBACK_TOTAL: Record<string, number> = {
  shield: 50, ghost: 30, crazy: 30, fire: 25, curse: 15, invulnerable: 2, stun: 1.2,
  speed: 25, slow: 25, kick: 35, glove: 35, punch: 35, remote: 35, pierce: 35, lineBomb: 35, bombPass: 35,
};

const constName = (kind: string) => `${kind.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_TIME`;
const special: Record<string, string> = { invulnerable: 'SPAWN_INVULNERABLE' };

/** Full duration in ticks for an effect: contract constant if exported, else canon fallback. */
export function effectTotal(kind: string): number {
  const c = (G as unknown as Record<string, unknown>)[special[kind] ?? constName(kind)];
  if (typeof c === 'number' && c > 0) return c;
  return (FALLBACK_TOTAL[kind] ?? 30) * TICK_RATE;
}

/** Display order: defensive first, then movement, abilities, curse last. Unknown kinds keep insertion order. */
const ORDER = ['shield', 'invulnerable', 'ghost', 'speed', 'fire', 'crazy', 'kick', 'glove', 'punch', 'remote', 'pierce', 'lineBomb', 'bombPass', 'curse', 'stun'];

/** Ability flag → effect key that times it (when the sim made the ability timed). */
const ABILITY_EFFECT: [Ability, string][] = [
  [Ability.Kick, 'kick'], [Ability.Glove, 'glove'], [Ability.Punch, 'punch'], [Ability.Remote, 'remote'],
  [Ability.Pierce, 'pierce'], [Ability.LineBomb, 'lineBomb'], [Ability.BombPass, 'bombPass'],
];

const secs = (ticks: number) => Math.max(0, ticks) / TICK_RATE;

function toPlayer(p: PlayerState, localId: string): HudPlayer {
  return {
    id: p.id, name: p.name, skin: p.skin, isBot: p.isBot, isLocal: p.id === localId,
    alive: p.alive, inRound: p.inRound, respawning: p.respawnIn > 0,
    wins: p.wins, kills: p.kills, deaths: p.deaths,
  };
}

export function buildHud(world: WorldState, localId: string, ping = 0): HudSnapshot {
  const players: HudPlayer[] = [];
  let alive = 0, total = 0;
  for (const p of world.players.values()) {
    players.push(toPlayer(p, localId));
    if (p.inRound) {
      total++;
      if (p.alive || p.respawnIn > 0) alive++;
    }
  }
  players.sort((a, b) => b.wins - a.wins || b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name));

  let me: HudMe | null = null;
  const lp = localId ? world.players.get(localId) : undefined;
  if (lp) {
    let bombsPlaced = 0;
    for (const b of world.bombs.values()) if (b.owner === lp.id) bombsPlaced++;
    const fx = lp.effects as unknown as Record<string, number>;
    const kinds = Object.keys(fx).filter((k) => typeof fx[k] === 'number' && fx[k] > 0);
    kinds.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
    const effects: HudEffect[] = kinds.map((kind) => ({
      kind,
      left: secs(fx[kind]),
      frac: Math.min(1, fx[kind] / effectTotal(kind)),
      curse: kind === 'curse' ? lp.curse : undefined,
    }));
    const timed = new Set(kinds);
    me = {
      ...toPlayer(lp, localId),
      lives: lp.lives,
      teleports: lp.teleports,
      bombs: lp.bombs,
      bombsPlaced,
      radius: lp.radius,
      speedLevel: lp.speedLevel,
      abilities: ABILITY_EFFECT.filter(([a, k]) => lp.abilities & a && !timed.has(k)).map(([a]) => a),
      curse: lp.curse,
      effects,
      carrying: lp.carrying >= 0,
      respawnIn: secs(lp.respawnIn),
      spectating: !lp.inRound || (!lp.alive && lp.respawnIn <= 0),
    };
  }

  const phase = world.phase;
  const winnerState = phase === Phase.RoundOver && world.winner ? world.players.get(world.winner) : undefined;

  return {
    tick: world.tick,
    phase,
    round: world.round,
    countdown: phase === Phase.Countdown ? Math.ceil(secs(world.phaseTicks)) : 0,
    timeLeft: 0,
    roundOverIn: phase === Phase.RoundOver ? secs(world.phaseTicks) : 0,
    suddenDeath: phase === Phase.SuddenDeath,
    shrinkIn: secs(world.zoneIn ?? 0),
    zoneRing: world.zoneRing ?? 0,
    alive, total, ping,
    connected: !!lp,
    me,
    players,
    winner: winnerState ? toPlayer(winnerState, localId) : null,
  };
}
