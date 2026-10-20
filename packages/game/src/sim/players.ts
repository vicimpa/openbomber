// Players: per-tick input -> movement -> actions, damage, death/respawn, timed effects,
// and player-vs-player touches (Fire, curse contagion).

import {
  FLAME_TIME,
  PLAYER_RADIUS,
  RESPAWN_DELAY,
  SPAWN_INVULNERABLE,
  START_BOMBS,
  START_RADIUS,
  sec,
} from '../contract/constants';
import type { NewPlayer } from '../contract/api';
import { Button } from '../contract/protocol';
import { Ability, Curse, Dir, DIR_VEC, Phase, Tile, type PlayerState } from '../contract/types';
import { circleTouchesTile } from './collision';
import { EMPTY_INPUT, emit, type PlayerInternal, type SimCtx } from './context';
import {
  detonateRemote,
  dropCarried,
  releasePassers,
  throwBomb,
  tryGrab,
  tryKick,
  tryPlaceBomb,
  tryPunch,
} from './bombs';
import { applyCurse, CURSE_IMMUNITY, freeTiles, scatterPickups } from './pickups';
import { applyMovement } from './movement';
import { bombAtTile } from './world';

/** "Instant" respawn while Waiting: just long enough to show the death. */
export const WAITING_RESPAWN = sec(0.5);
/** After a shield soaks a hit, the rest of that blast can't hurt you. */
const SHIELD_GRACE = FLAME_TIME + 2;
const FLAME_HIT_RADIUS = 0.6 * PLAYER_RADIUS;
const TOUCH2 = (2 * PLAYER_RADIUS) ** 2;
const MAX_QUEUE = 6;

export const gameplayPhase = (ph: Phase) => ph === Phase.Waiting || ph === Phase.Playing || ph === Phase.SuddenDeath;
export const realRound = (ph: Phase) => ph === Phase.Playing || ph === Phase.SuddenDeath;

export function createPlayer(np: NewPlayer): PlayerState {
  const p: PlayerState = {
    id: np.id,
    name: np.name,
    skin: np.skin,
    isBot: !!np.isBot,
    x: 0,
    y: 0,
    dir: Dir.Down,
    moving: false,
    alive: false,
    inRound: false,
    lives: 0,
    bombs: START_BOMBS,
    radius: START_RADIUS,
    speedLevel: 0,
    abilities: 0,
    curse: Curse.None,
    effects: { shield: 0, ghost: 0, crazy: 0, fire: 0, curse: 0, invulnerable: 0, stun: 0 },
    carrying: -1,
    respawnIn: 0,
    wins: 0,
    kills: 0,
    deaths: 0,
    ackSeq: 0,
  };
  return p;
}

export function createInternal(): PlayerInternal {
  return { queue: [], last: EMPTY_INPUT, lastSeq: 0, prevButtons: 0, collected: [], curseImmune: 0, spawnX: 0, spawnY: 0 };
}

function clearEffects(p: PlayerState) {
  const e = p.effects;
  e.shield = e.ghost = e.crazy = e.fire = e.curse = e.invulnerable = e.stun = 0;
  p.curse = Curse.None;
}

/** Fresh stats for a new round. */
export function resetStats(ctx: SimCtx, p: PlayerState) {
  p.lives = 0;
  p.bombs = START_BOMBS;
  p.radius = START_RADIUS;
  p.speedLevel = 0;
  p.abilities = Ability.None;
  p.carrying = -1;
  p.respawnIn = 0;
  p.moving = false;
  p.dir = Dir.Down;
  clearEffects(p);
  const pi = ctx.players.get(p.id);
  if (pi) {
    pi.collected.length = 0;
    pi.curseImmune = 0;
  }
}

export function queueInput(ctx: SimCtx, id: string, dx: number, dy: number, buttons: number, seq: number) {
  const pi = ctx.players.get(id);
  if (!pi || !(seq > pi.lastSeq)) return;
  pi.lastSeq = seq;
  pi.queue.push({ seq, dx, dy, buttons: buttons | 0 });
  if (pi.queue.length > MAX_QUEUE) pi.queue.splice(0, pi.queue.length - MAX_QUEUE);
}

/** Apply at most one queued input (or repeat the last one), move, then act. */
export function updatePlayer(ctx: SimCtx, p: PlayerState) {
  const pi = ctx.players.get(p.id)!;
  const frame = pi.queue.length > 0 ? pi.queue.shift()! : pi.last;
  pi.last = frame;
  p.ackSeq = frame.seq;
  const held = frame.buttons;
  const pressed = held & ~pi.prevButtons;
  const released = pi.prevButtons & ~held;
  pi.prevButtons = held;
  if (!p.alive || !p.inRound) return;

  const w = ctx.world;
  const kick = applyMovement(w, p, frame);
  releasePassers(ctx, p);
  if (p.carrying >= 0) {
    const cb = w.bombs.get(p.carrying);
    if (cb) {
      cb.x = p.x;
      cb.y = p.y;
    } else p.carrying = -1;
  }
  if (!gameplayPhase(w.phase) || p.effects.stun > 0) return;

  if (kick >= 0 && p.abilities & Ability.Kick) {
    const b = w.bombs.get(kick);
    if (b) tryKick(ctx, p, b);
  }
  if (p.carrying >= 0) {
    if (released & Button.Action) throwBomb(ctx, p);
  } else if (pressed & Button.Action) {
    const a = p.abilities;
    if (!((a & Ability.Glove && tryGrab(ctx, p)) || (a & Ability.Punch && tryPunch(ctx, p)))) {
      if (a & Ability.Remote) detonateRemote(ctx, p);
    }
  }
  const bombPressed = (pressed & Button.Bomb) !== 0;
  if (bombPressed || p.curse === Curse.Diarrhea) tryPlaceBomb(ctx, p, bombPressed);
}

// ---------------------------------------------------------------- damage

/** Flame burning the player (forgiving hitbox), or 0. */
function flameTouching(ctx: SimCtx, p: PlayerState): number {
  const w = ctx.world;
  const cx = Math.round(p.x);
  const cy = Math.round(p.y);
  for (let dy = -1; dy <= 1; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= w.height) continue;
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= w.width) continue;
      const id = ctx.flameGrid[y * w.width + x]!;
      if (!id) continue;
      if ((dx === 0 && dy === 0) || circleTouchesTile(p.x, p.y, FLAME_HIT_RADIUS, x, y)) return id;
    }
  }
  return 0;
}

export function burnPlayers(ctx: SimCtx) {
  const w = ctx.world;
  if (w.flames.size === 0) return;
  for (const p of w.players.values()) {
    if (!p.alive || !p.inRound) continue;
    const id = flameTouching(ctx, p);
    if (id) killPlayer(ctx, p, w.flames.get(id)?.owner ?? '', false);
  }
}

/**
 * Kill (or shield / ignore) a player. `force` (falling blocks) ignores shield and
 * invulnerability.
 */
export function killPlayer(ctx: SimCtx, p: PlayerState, killer: string, force: boolean) {
  const w = ctx.world;
  if (!p.alive || w.phase === Phase.RoundOver || w.phase === Phase.Countdown) return;
  if (!force) {
    if (p.effects.invulnerable > 0) return;
    if (p.effects.shield > 0) {
      p.effects.shield = 0;
      p.effects.invulnerable = Math.max(p.effects.invulnerable, SHIELD_GRACE);
      emit(ctx, { type: 'shieldBlocked', player: p.id });
      return;
    }
  }
  p.alive = false;
  p.moving = false;
  if (p.carrying >= 0) dropCarried(ctx, p);
  releasePassers(ctx, p);
  const counted = realRound(w.phase);
  if (counted) {
    p.deaths++;
    if (killer && killer !== p.id) {
      const k = w.players.get(killer);
      if (k) k.kills++;
    }
  }
  emit(ctx, { type: 'playerDied', player: p.id, killer, x: Math.round(p.x) | 0, y: Math.round(p.y) | 0 });
  if (w.phase === Phase.Waiting) p.respawnIn = WAITING_RESPAWN;
  else if (p.lives > 0) {
    p.lives--;
    p.respawnIn = RESPAWN_DELAY;
  } else scatterPickups(ctx, p);
}

/** Fire touch kills, curses spread on contact. */
export function touchPlayers(ctx: SimCtx) {
  const w = ctx.world;
  for (const a of w.players.values()) {
    if (!a.alive || !a.inRound) continue;
    const aFire = a.effects.fire > 0;
    const aCurse = a.curse !== Curse.None;
    if (!aFire && !aCurse) continue;
    for (const b of w.players.values()) {
      if (b === a || !b.alive || !b.inRound) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy >= TOUCH2) continue;
      if (aFire && b.effects.fire <= 0) killPlayer(ctx, b, a.id, false);
      if (aCurse && b.alive && b.curse === Curse.None && ctx.players.get(b.id)!.curseImmune <= 0) {
        applyCurse(ctx, b, a.curse, a.id);
      }
    }
  }
}

// ---------------------------------------------------------------- respawn

/** Tiles covered by any bomb's blast lines (rough, ignores pierce/chains). */
function blastMask(ctx: SimCtx): Uint8Array {
  const w = ctx.world;
  const m = new Uint8Array(w.width * w.height);
  for (const b of w.bombs.values()) {
    const bx = Math.round(b.x);
    const by = Math.round(b.y);
    if (bx < 0 || by < 0 || bx >= w.width || by >= w.height) continue;
    m[by * w.width + bx] = 1;
    for (const [dx, dy] of Object.values(DIR_VEC)) {
      for (let i = 1; i <= b.radius; i++) {
        const x = bx + dx * i;
        const y = by + dy * i;
        if (x < 0 || y < 0 || x >= w.width || y >= w.height) break;
        if (w.tiles[y * w.width + x] !== Tile.Floor) break;
        m[y * w.width + x] = 1;
      }
    }
  }
  return m;
}

/**
 * A free, currently safe floor tile. Prefers (px, py) when it qualifies, otherwise the
 * tile farthest from other living players.
 */
export function findSafeTile(ctx: SimCtx, self: PlayerState, px: number, py: number): { x: number; y: number } {
  const w = ctx.world;
  const free = freeTiles(ctx);
  const danger = blastMask(ctx);
  const ok = free.filter((i) => !danger[i]);
  const pool = ok.length ? ok : free;
  if (pool.length === 0) return { x: px, y: py };
  const pref = py * w.width + px;
  if (px >= 0 && py >= 0 && px < w.width && py < w.height && pool.includes(pref)) return { x: px, y: py };
  let best = pool[0]!;
  let bestD = -1;
  for (const i of pool) {
    const x = i % w.width;
    const y = (i / w.width) | 0;
    let d = 1e9;
    for (const q of w.players.values()) {
      if (q === self || !q.alive) continue;
      const dd = (q.x - x) ** 2 + (q.y - y) ** 2;
      if (dd < d) d = dd;
    }
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  return { x: best % w.width, y: (best / w.width) | 0 };
}

export function spawnPlayerAt(p: PlayerState, x: number, y: number, invulnerable: number) {
  p.x = x;
  p.y = y;
  p.alive = true;
  p.moving = false;
  p.carrying = -1;
  p.respawnIn = 0;
  clearEffects(p);
  p.effects.invulnerable = invulnerable;
}

function respawn(ctx: SimCtx, p: PlayerState) {
  const pi = ctx.players.get(p.id)!;
  const waiting = ctx.world.phase === Phase.Waiting;
  const t = findSafeTile(ctx, p, waiting ? pi.spawnX : -1, waiting ? pi.spawnY : -1);
  spawnPlayerAt(p, t.x, t.y, SPAWN_INVULNERABLE);
  emit(ctx, { type: 'playerRespawned', player: p.id, x: t.x, y: t.y });
}

/** Ghost ran out inside a brick: pop out onto the nearest free floor tile. */
function pushOutOfBricks(ctx: SimCtx, p: PlayerState) {
  const w = ctx.world;
  const sx = Math.round(p.x);
  const sy = Math.round(p.y);
  const at = (x: number, y: number) => w.tiles[y * w.width + x];
  if (sx < 0 || sy < 0 || sx >= w.width || sy >= w.height || at(sx, sy) !== Tile.Brick) return;
  const seen = new Uint8Array(w.width * w.height);
  const queue = [sy * w.width + sx];
  seen[queue[0]!] = 1;
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h]!;
    const x = i % w.width;
    const y = (i / w.width) | 0;
    if (at(x, y) === Tile.Floor && !bombAtTile(w, x, y)) {
      p.x = x;
      p.y = y;
      return;
    }
    for (const [dx, dy] of Object.values(DIR_VEC)) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w.width || ny >= w.height) continue;
      const j = ny * w.width + nx;
      if (seen[j] || at(nx, ny) === Tile.Wall) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
}

/** Timed effects and respawn countdowns. */
export function tickPlayers(ctx: SimCtx) {
  const w = ctx.world;
  for (const p of w.players.values()) {
    const pi = ctx.players.get(p.id)!;
    if (pi.curseImmune > 0) pi.curseImmune--;
    if (!p.alive) {
      if (p.respawnIn > 0 && --p.respawnIn === 0 && p.inRound) respawn(ctx, p);
      continue;
    }
    const e = p.effects;
    if (e.invulnerable > 0) e.invulnerable--;
    if (e.shield > 0 && --e.shield === 0) emit(ctx, { type: 'effectEnded', player: p.id, effect: 'shield' });
    if (e.ghost > 0 && --e.ghost === 0) {
      pushOutOfBricks(ctx, p);
      emit(ctx, { type: 'effectEnded', player: p.id, effect: 'ghost' });
    }
    if (e.crazy > 0 && --e.crazy === 0) emit(ctx, { type: 'effectEnded', player: p.id, effect: 'crazy' });
    if (e.fire > 0 && --e.fire === 0) emit(ctx, { type: 'effectEnded', player: p.id, effect: 'fire' });
    if (e.curse > 0 && --e.curse === 0) {
      p.curse = Curse.None;
      pi.curseImmune = CURSE_IMMUNITY;
      emit(ctx, { type: 'effectEnded', player: p.id, effect: 'curse' });
    }
  }
}
