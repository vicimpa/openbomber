// Players: per-tick input -> movement -> actions, damage, death/respawn, timed effects,
// and player-vs-player touches (Fire, curse contagion).

import {
  BOMB_FUSE,
  BOMB_RELEASE_DISTANCE,
  FLAME_TIME,
  PLAYER_RADIUS,
  RESPAWN_DELAY,
  SPAWN_INVULNERABLE,
  START_BOMBS,
  START_RADIUS,
} from '../contract/constants';
import type { NewPlayer } from '../contract/api';
import { Button, type DeathCause, type InputFrame } from '../contract/protocol';
import { Ability, Curse, Dir, DIR_VEC, Phase, Tile, type PlayerState } from '../contract/types';
import { circleTouchesTile } from './collision';
import { emptyEffects, syncAbilities, TIMED_ABILITIES } from './effects';
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
import { randInt } from './rng';
import { bombAtTile } from './world';

/** After a shield soaks a hit, the rest of that blast can't hurt you. */
const SHIELD_GRACE = FLAME_TIME + 2;
const FLAME_HIT_RADIUS = 0.6 * PLAYER_RADIUS;
// players push each other apart to exactly 2R, so contact means within a hair of that
const TOUCH2 = (2 * PLAYER_RADIUS + 0.06) ** 2;
const MAX_QUEUE = 6;
/** Ticks a player may run on a guessed input (its last frame repeated) while its next frames are late. */
export const MAX_GUESS = 30;
/** Ticks without any input (guesses used up) whose frames still run when they come. */
const MAX_OWED = 60;
const GUESS_FIELDS = 5; // x, y, dir, moving, stun before the guessed tick

export const gameplayPhase = (ph: Phase) => ph === Phase.Playing || ph === Phase.SuddenDeath;

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
    teleports: 0,
    bombs: START_BOMBS,
    radius: START_RADIUS,
    speedLevel: 0,
    abilities: 0,
    curse: Curse.None,
    effects: emptyEffects(),
    carrying: -1,
    respawnIn: 0,
    wins: 0,
    kills: 0,
    deaths: 0,
    ackSeq: 0,
    guessed: 0,
  };
  return p;
}

export function createInternal(): PlayerInternal {
  return {
    queue: [], last: EMPTY_INPUT, lastSeq: 0, prevButtons: 0, collected: [], curseImmune: 0, spawnX: 0, spawnY: 0,
    guesses: 0, guessHead: 0, guessRound: -1, guessLog: new Float64Array(MAX_GUESS * GUESS_FIELDS), owed: 0,
  };
}

function clearEffects(p: PlayerState) {
  Object.assign(p.effects, emptyEffects());
  p.curse = Curse.None;
  syncAbilities(p);
}

/** Fresh stats for a new round. */
export function resetStats(ctx: SimCtx, p: PlayerState) {
  p.lives = 0;
  p.teleports = 0;
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
  // frames that settle guessed / owed ticks don't count against the queue
  const max = MAX_QUEUE + pi.guesses + pi.owed;
  if (pi.queue.length > max) pi.queue.splice(0, pi.queue.length - max);
}

const sameInput = (a: InputFrame, b: InputFrame) => a.dx === b.dx && a.dy === b.dy && a.buttons === b.buttons;

/**
 * Late frames arrived for ticks that ran on a guess (the last frame repeated). Matching
 * ones confirm their guess; at the first wrong one the hero goes back to where it stood
 * before that guess, and the real frames of the rewound ticks run right away (`owed`).
 * So the hero ends up exactly where the client predicted, however late its frames came.
 */
function settleGuesses(ctx: SimCtx, p: PlayerState, pi: PlayerInternal) {
  if (pi.guesses === 0 || pi.queue.length === 0) return;
  if (!p.alive || !p.inRound || pi.guessRound !== ctx.world.round) { dropGuesses(ctx, p); return; }
  while (pi.guesses > 0 && pi.queue.length > 0) {
    const f = pi.queue[0]!;
    if (!sameInput(f, pi.last)) {
      const g = pi.guessLog, i = pi.guessHead * GUESS_FIELDS;
      p.x = g[i]!; p.y = g[i + 1]!; p.dir = g[i + 2]! as Dir; p.moving = g[i + 3] === 1; p.effects.stun = g[i + 4]!;
      pi.owed += pi.guesses;
      pi.guesses = 0;
      pi.guessHead = 0;
      // standing on a bomb dropped meanwhile (its passers were settled without us): walk off it
      for (const b of ctx.world.bombs.values()) {
        const dx = p.x - b.x, dy = p.y - b.y;
        if (dx * dx + dy * dy < BOMB_RELEASE_DISTANCE ** 2 && !b.passers.includes(p.id)) b.passers.push(p.id);
      }
      return;
    }
    // the guess was right
    pi.queue.shift();
    pi.last = f;
    pi.prevButtons = f.buttons;
    p.ackSeq = f.seq;
    pi.guessHead = (pi.guessHead + 1) % MAX_GUESS;
    pi.guesses--;
  }
}

/**
 * One tick of a player: its next queued frame (plus the frames of ticks it is owed after a
 * rewind or a long stall); with nothing queued, a guess (the last frame again) that the
 * real frame settles later, see settleGuesses.
 */
export function updatePlayer(ctx: SimCtx, p: PlayerState) {
  const pi = ctx.players.get(p.id)!;
  settleGuesses(ctx, p, pi);
  // on time (no backlog): ticks still owed from long ago lapse, they can't be saved up for a dash
  if (pi.owed > 0 && pi.guesses === 0 && pi.queue.length <= 1) pi.owed--;
  let ran = 0;
  while (pi.queue.length > 0 && ran <= pi.owed) { runFrame(ctx, p, pi, pi.queue.shift()!); ran++; }
  if (ran > 0) {
    pi.owed -= ran - 1;
  } else if (!p.alive || !p.inRound || pi.lastSeq === 0) {
    // dead, spectating, or no frames ever sent (nothing to guess from): the last input holds
    runFrame(ctx, p, pi, pi.last);
  } else if (pi.guesses < MAX_GUESS) {
    const g = pi.guessLog, i = ((pi.guessHead + pi.guesses) % MAX_GUESS) * GUESS_FIELDS;
    g[i] = p.x; g[i + 1] = p.y; g[i + 2] = p.dir; g[i + 3] = p.moving ? 1 : 0; g[i + 4] = p.effects.stun;
    if (pi.guesses === 0) pi.guessRound = ctx.world.round;
    pi.guesses++;
    runFrame(ctx, p, pi, pi.last, true);
  } else {
    // out of guesses: the hero waits, its frames catch up when they come
    pi.owed = Math.min(pi.owed + 1, MAX_OWED);
    p.moving = false;
  }
  p.guessed = pi.guesses;
}

/**
 * The sim put the hero somewhere itself (spawn, respawn, teleport, death...): its guesses can't
 * be rewound any more. They stand; the real frames of those ticks run when they come (owed).
 */
export function dropGuesses(ctx: SimCtx, p: PlayerState) {
  const pi = ctx.players.get(p.id);
  if (!pi || pi.guesses === 0) return;
  pi.owed = Math.min(pi.owed + pi.guesses, MAX_OWED);
  pi.guesses = 0;
  pi.guessHead = 0;
  p.guessed = 0;
}

/** Apply one input frame: move, then act. `guess`: a speculative repeat of the last frame (no ack). */
function runFrame(ctx: SimCtx, p: PlayerState, pi: PlayerInternal, frame: InputFrame, guess = false) {
  if (!guess) {
    pi.last = frame;
    p.ackSeq = frame.seq;
  }
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
  if (pressed & Button.Teleport && p.teleports > 0) teleport(ctx, p);
  const bombPressed = (pressed & Button.Bomb) !== 0;
  if (ctx.bombsAllowed && (bombPressed || p.curse === Curse.Diarrhea)) tryPlaceBomb(ctx, p, bombPressed);
}

/**
 * Spend a Teleport charge: jump to a random free floor tile (no bomb, flame, falling block
 * or other hero on or next to it). A carried bomb comes along. No free tile: nothing is spent.
 */
function teleport(ctx: SimCtx, p: PlayerState) {
  const w = ctx.world;
  const W = w.width;
  const fromX = Math.round(p.x);
  const fromY = Math.round(p.y);
  const falling = new Set(w.falling.map((f) => f.y * W + f.x));
  const spots: number[] = [];
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== Tile.Floor || ctx.bombGrid[i] || ctx.flameGrid[i] || falling.has(i)) continue;
    const x = i % W;
    const y = (i / W) | 0;
    if (x === fromX && y === fromY) continue;
    let near = false;
    for (const o of w.players.values()) {
      if (o !== p && o.alive && Math.abs(o.x - x) < 1.5 && Math.abs(o.y - y) < 1.5) { near = true; break; }
    }
    if (!near) spots.push(i);
  }
  if (spots.length === 0) return;
  const i = spots[randInt(ctx.secret, spots.length)]!;
  dropGuesses(ctx, p);
  p.x = i % W;
  p.y = (i / W) | 0;
  p.teleports--;
  releasePassers(ctx, p);
  emit(ctx, { type: 'playerTeleported', player: p.id, fromX, fromY, x: p.x, y: p.y });
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
    if (id) killPlayer(ctx, p, w.flames.get(id)?.owner ?? '', 'blast');
  }
}

/**
 * Kill (or shield / ignore) a player. Falling blocks (`crushed`) ignore shield and
 * invulnerability.
 */
export function killPlayer(ctx: SimCtx, p: PlayerState, killer: string, cause: DeathCause) {
  const w = ctx.world;
  if (!p.alive || w.phase === Phase.RoundOver || w.phase === Phase.Countdown) return;
  if (cause !== 'crushed') {
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
  ctx.roundDeaths++;
  // legacy: deaths count only with company; kills by another player always count
  if (w.players.size > 1) p.deaths++;
  if (killer && killer !== p.id) {
    const k = w.players.get(killer);
    if (k) k.kills++;
  }
  emit(ctx, { type: 'playerDied', player: p.id, killer, x: Math.round(p.x) | 0, y: Math.round(p.y) | 0, cause });
  if (p.lives > 0) {
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
      if (aFire && b.effects.fire <= 0) killPlayer(ctx, b, a.id, 'fire');
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
  dropGuesses(ctx, p);
  const t = findSafeTile(ctx, p, -1, -1);
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
      dropGuesses(ctx, p);
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
    if (e.speed > 0 && --e.speed === 0) emit(ctx, { type: 'effectEnded', player: p.id, effect: 'speed' });
    for (const a of TIMED_ABILITIES) {
      if (e[a.key] > 0 && --e[a.key] === 0) {
        emit(ctx, { type: 'effectEnded', player: p.id, effect: a.key });
        if (a.bit === Ability.Remote) timeRemoteBombs(ctx, p.id);
      }
    }
    syncAbilities(p);
  }
}

/** Remote ran out: waiting bombs get a normal fuse. */
function timeRemoteBombs(ctx: SimCtx, owner: string) {
  for (const b of ctx.world.bombs.values()) if (b.owner === owner && b.fuse < 0) b.fuse = BOMB_FUSE;
}
