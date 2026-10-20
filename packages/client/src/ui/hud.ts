// HUD view-model: a small, render-friendly snapshot derived from WorldState by a pure function.
// The session layer calls `hud.value = buildHud(world, localId, ping)` ~10 times per second.
import {
  Ability, Curse, CURSE_TIME, CRAZY_TIME, FIRE_TIME, GHOST_TIME, Phase, ROUND_TIME, SHIELD_TIME,
  SPAWN_INVULNERABLE, STUN_TIME, TICK_RATE, type PlayerState, type WorldState,
} from '@ob/game';

export type EffectKind = 'shield' | 'ghost' | 'crazy' | 'fire' | 'curse' | 'invulnerable' | 'stun';

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
  bombs: number;           // max simultaneous bombs
  bombsPlaced: number;     // own bombs currently in the world
  radius: number;
  speedLevel: number;
  abilities: Ability[];    // individual flags, in display order
  curse: Curse;
  effects: HudEffect[];    // active timed effects, longest first
  carrying: boolean;
  respawnIn: number;       // seconds, 0 = none
  /** Not playing this round: joined mid-round or eliminated. */
  spectating: boolean;
}

export interface HudSnapshot {
  tick: number;
  phase: Phase;
  round: number;
  /** Whole seconds left in Countdown (3, 2, 1), else 0. */
  countdown: number;
  /** Seconds until sudden death while Playing; 0 otherwise. */
  timeLeft: number;
  /** Seconds left in RoundOver. */
  roundOverIn: number;
  suddenDeath: boolean;
  alive: number;           // players still in the round (alive or respawning)
  total: number;           // players taking part in the round
  ping: number;            // ms, 0 offline
  me: HudMe | null;
  /** Scoreboard order: wins, kills desc; deaths asc. */
  players: HudPlayer[];
  winner: HudPlayer | null;  // valid in RoundOver; null + phase RoundOver = draw
}

const EFFECT_TOTAL: Record<EffectKind, number> = {
  shield: SHIELD_TIME, ghost: GHOST_TIME, crazy: CRAZY_TIME, fire: FIRE_TIME,
  curse: CURSE_TIME, invulnerable: SPAWN_INVULNERABLE, stun: STUN_TIME,
};
const EFFECT_ORDER: EffectKind[] = ['shield', 'ghost', 'crazy', 'fire', 'curse', 'invulnerable', 'stun'];

const ABILITY_ORDER = [Ability.Kick, Ability.Glove, Ability.Punch, Ability.Remote, Ability.Pierce, Ability.LineBomb, Ability.BombPass];

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
    const effects: HudEffect[] = [];
    for (const kind of EFFECT_ORDER) {
      const left = lp.effects[kind];
      if (left > 0) effects.push({
        kind, left: secs(left), frac: Math.min(1, left / EFFECT_TOTAL[kind]),
        curse: kind === 'curse' ? lp.curse : undefined,
      });
    }
    me = {
      ...toPlayer(lp, localId),
      lives: lp.lives,
      bombs: lp.bombs,
      bombsPlaced,
      radius: lp.radius,
      speedLevel: lp.speedLevel,
      abilities: ABILITY_ORDER.filter((a) => lp.abilities & a),
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
    timeLeft: phase === Phase.Playing ? secs(ROUND_TIME - world.phaseTicks) : 0,
    roundOverIn: phase === Phase.RoundOver ? secs(world.phaseTicks) : 0,
    suddenDeath: phase === Phase.SuddenDeath,
    alive, total, ping,
    me,
    players,
    winner: winnerState ? toPlayer(winnerState, localId) : null,
  };
}
