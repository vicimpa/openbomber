// Shared world analysis for bots: per-tile danger windows (when flames will arrive and
// when they'll be gone), predicted from fuses and chain reactions. Computed once per
// world tick and shared by every bot.
//
// A bot reads bombs the way a player reads the screen. The radius of someone else's bomb is
// not on it: it's estimated from what everybody could see (the longest flame arm each player's
// bombs have shown, the FireUp / FullFire pickups they were seen walking over), plus a safety
// margin. Only the bot's own bombs are known exactly. What is visible is the same for every
// bot, so the memory is one per world, and the danger map one per way of reading it (Sight);
// a bot gets a map of its own only while a bomb of its own on the map reads differently there.
// Fuses and Pierce are read as before: a bomb's age is seen from when it was laid, a Pierce
// bomb glows differently and a Pierce pickup is taken in plain sight.

import {
  BOUNCE_TIME,
  CHAIN_DELAY,
  CRAZY_FUSE_MAX,
  CRAZY_FUSE_MIN,
  CRAZY_RADIUS_MULT,
  FLAME_TIME,
  MAX_RADIUS,
  SKY_BOMB_FUSE,
  SKY_BOMB_RADIUS,
  START_RADIUS,
  THROW_TIME,
  sec,
} from '../contract/constants';
import {
  Ability,
  BombKind,
  BombMotion,
  Curse,
  DropKind,
  FlameShape,
  PickupType,
  Tile,
  type BombState,
  type FlameState,
  type PlayerState,
  type WorldState,
} from '../contract/types';
import { zoneDepth } from '../sim/shapes';

export const INF = 0x3fffffff;
/**
 * The ring the zone is about to close only counts as danger this close to closing: long enough
 * to walk out of it, short enough that a pickup or a brick there is still worth the trip.
 */
export const ZONE_HEED = sec(4);
/** Remote bombs this close to their automatic detonation count as timed bombs. */
const REMOTE_TIMED = 90;

/** How a bot reads the radius of other players' bombs. */
export interface Sight {
  /** Tiles added on top of the estimate (it can miss a pickup: under-guessing kills). */
  margin: number;
  /** Counts the fire pickups players are seen collecting; without it only the flames seen count. */
  pickups: boolean;
}

export const DEFAULT_SIGHT: Sight = { margin: 1, pickups: true };

export interface Analysis {
  world: WorldState;
  tick: number;
  width: number;
  height: number;
  /** Whose bombs are known exactly ('' = nobody's: every bomb is estimated). */
  self: string;
  sight: Sight;
  /** Ticks from now until the tile burns (INF = never), and until it stops burning. */
  dStart: Int32Array;
  dEnd: Int32Array;
  /**
   * Tiles in the blast of a remote bomb that can go off at any moment (untimed): fine to
   * walk through, never a place to stop.
   */
  soft: Uint8Array;
  /** When a brick / pickup is predicted to be destroyed (INF = not). */
  gone: Int32Array;
  /** Grounded bomb id per tile, 0 = none. */
  bomb: Int32Array;
  /** Pickup type + 1 per tile, 0 = none. */
  pickup: Int8Array;
  /** Alive, in-round players per tile. */
  players: Uint8Array;
  /** Tiles near players with the Fire effect (touch = death), keyed by player id. */
  fire: { id: string; x: number; y: number }[];
  /** Cursed players (touch = their curse). */
  cursed: { id: string; x: number; y: number }[];
  /** Overtime: ticks + 1 until a sky bomb lands on the tile (0 = none); it blocks from then on. */
  land: Int32Array;
  /** Overtime: pickup type + 1 falling onto the tile (0 = none). */
  dropPickup: Int8Array;
  /** What has been seen this round (shared by every analysis of the world). */
  memory: Memory;
}

// ---------------------------------------------------------------- what has been seen

/** What a player's bombs are known to reach. */
interface Reach {
  /** Longest flame arm seen from their bombs (a lower bound: bricks and walls cut arms short). */
  flame: number;
  /** START_RADIUS + the FireUps (and Randoms: one may have been a FireUp) seen collected. */
  fire: number;
  /** A FullFire was seen collected. */
  full: boolean;
}

interface SeenBomb {
  owner: string;
  /** Tile it was last seen on. */
  x: number;
  y: number;
  /** Tick it was first seen: a Crazy fuse is a secret, only its age is known. */
  since: number;
  /** Random radius (a Crazy bomb, or a Remote one laid by a crazy player): never a measure. */
  crazy: boolean;
}

export interface Memory {
  /** Last tick observed (-1 = never). */
  tick: number;
  round: number;
  reach: Map<string, Reach>;
  bombs: Map<number, SeenBomb>;
  /** Fire pickups lying on the map: id -> tile and type, to tell who took one. */
  pickups: Map<number, { x: number; y: number; type: PickupType }>;
}

const END_SHAPE = [FlameShape.EndUp, FlameShape.EndLeft, FlameShape.EndRight, FlameShape.EndDown];
/** A vanished pickup counts as collected by the nearest player this close (else it burned). */
const TAKE_DIST = 0.7;

function newMemory(): Memory {
  return { tick: -1, round: -1, reach: new Map(), bombs: new Map(), pickups: new Map() };
}

function reachOf(m: Memory, owner: string): Reach {
  let r = m.reach.get(owner);
  if (!r) m.reach.set(owner, (r = { flame: 0, fire: START_RADIUS, full: false }));
  return r;
}

/**
 * Update the memory from this tick's world: bombs that went off since the last look are
 * measured by their fresh flames, fire pickups that vanished next to a player count for them.
 * Ticks may be skipped (nobody thinking); a skipped explosion is only measured while its
 * flames are still up, so gaps make the memory coarser, never wrong the dangerous way round.
 */
function observe(m: Memory, w: WorldState) {
  if (m.tick === w.tick) return;
  let gap = m.tick < 0 ? INF : w.tick - m.tick;
  m.tick = w.tick;
  if (m.round !== w.round) {
    // stats reset with every round (and map)
    m.round = w.round;
    m.reach.clear();
    m.bombs.clear();
    m.pickups.clear();
    gap = INF;
  }
  const W = w.width;
  let flames: Map<number, FlameState> | null = null;
  for (const [id, s] of m.bombs) {
    if (w.bombs.has(id)) continue;
    m.bombs.delete(id);
    if (s.crazy || !s.owner || gap > FLAME_TIME || s.x < 0 || s.y < 0 || s.x >= W || s.y >= w.height) continue;
    if (!flames) {
      flames = new Map();
      for (const f of w.flames.values()) flames.set(f.y * W + f.x, f);
    }
    // flames lit since the last look; an arm ends at its end piece (or where the fire stops)
    const fresh = FLAME_TIME - gap;
    const c = flames.get(s.y * W + s.x);
    if (!c || c.ttl <= fresh) continue;
    let longest = 0;
    for (let d = 0; d < 4; d++) {
      const dx = d === 1 ? -1 : d === 2 ? 1 : 0;
      const dy = d === 0 ? -1 : d === 3 ? 1 : 0;
      for (let k = 1; k <= MAX_RADIUS; k++) {
        const x = s.x + dx * k;
        const y = s.y + dy * k;
        if (x < 0 || y < 0 || x >= W || y >= w.height) break;
        const f = flames.get(y * W + x);
        if (!f || f.ttl <= fresh) break;
        if (k > longest) longest = k;
        if (f.shape === END_SHAPE[d]) break;
      }
    }
    const r = reachOf(m, s.owner);
    if (longest > r.flame) r.flame = longest;
  }
  for (const [id, k] of m.pickups) {
    if (w.pickups.has(id)) continue;
    m.pickups.delete(id);
    // gone: collected by whoever stands on it, or burned
    let by: PlayerState | null = null;
    let best = TAKE_DIST * TAKE_DIST;
    for (const p of w.players.values()) {
      if (!p.alive || !p.inRound) continue;
      const d2 = (p.x - k.x) ** 2 + (p.y - k.y) ** 2;
      if (d2 < best) {
        best = d2;
        by = p;
      }
    }
    if (!by) continue;
    const r = reachOf(m, by.id);
    if (k.type === PickupType.FullFire) r.full = true;
    else if (r.fire < MAX_RADIUS) r.fire++;
  }
  for (const k of w.pickups.values()) {
    if (k.type !== PickupType.FireUp && k.type !== PickupType.FullFire && k.type !== PickupType.Random) continue;
    if (!m.pickups.has(k.id)) m.pickups.set(k.id, { x: k.x, y: k.y, type: k.type });
  }
  for (const b of w.bombs.values()) {
    let s = m.bombs.get(b.id);
    if (!s) {
      // a crazy player's bomb glows like one: its radius is a secret even when it's a Remote
      const o = w.players.get(b.owner);
      const crazy = b.kind === BombKind.Crazy || (o !== undefined && o.effects.crazy > 0);
      m.bombs.set(b.id, (s = { owner: b.owner, x: 0, y: 0, since: w.tick, crazy }));
    }
    s.x = Math.round(b.x);
    s.y = Math.round(b.y);
  }
}

/** The radius `owner`'s bombs are believed to have, before the margin. */
function believed(m: Memory, owner: string, sight: Sight): number {
  const r = m.reach.get(owner);
  if (!r) return START_RADIUS;
  const fire = sight.pickups ? (r.full ? MAX_RADIUS : r.fire) : START_RADIUS;
  return Math.min(MAX_RADIUS, Math.max(r.flame, fire));
}

/**
 * The radius `self` plans a bomb of `owner` with: exact for its own (worst case for a crazy
 * one, the roll is a secret to the owner too) and for sky bombs (the rules fix it), estimated
 * for everybody else's.
 */
function radiusFor(m: Memory, sight: Sight, w: WorldState, self: string, owner: string, radius: number, crazy: boolean): number {
  if (!owner) return radius;
  if (owner === self) return crazy ? crazyRadius(w.players.get(owner)) : radius;
  const r = believed(m, owner, sight);
  return crazy ? Math.min(MAX_RADIUS, r * CRAZY_RADIUS_MULT) : Math.min(MAX_RADIUS, r + sight.margin);
}

/** The blast radius bomb `b` is planned with by `self` (default: whose analysis it is). */
export function blastRadius(a: Analysis, b: BombState, self = a.self): number {
  const crazy = b.kind === BombKind.Crazy || a.memory.bombs.get(b.id)?.crazy === true;
  return radiusFor(a.memory, a.sight, a.world, self, b.owner, b.radius, crazy);
}

interface PendingBomb {
  id: number;
  owner: string;
  x: number;
  y: number;
  /** The bomb's real radius; `crazy`: a secret roll. Sky bombs: owner ''. */
  radius: number;
  crazy: boolean;
  pierce: boolean;
  time: number;
  /** How long after `time` the tiles may still burn (a Crazy fuse is a window). */
  dur: number;
  /** Can't go off before this (a bomb still in the air). */
  earliest: number;
}

/**
 * Everything about a tick that doesn't depend on who's looking: computed once, then each
 * analysis of the world (one per Sight, plus bots holding a bomb of their own) only re-runs
 * the blasts.
 */
interface Frame {
  memory: Memory;
  tick: number;
  width: number;
  height: number;
  /** Danger from what's already burning / falling / closing (no bombs). */
  baseStart: Int32Array;
  baseEnd: Int32Array;
  bomb: Int32Array;
  pickup: Int8Array;
  players: Uint8Array;
  fire: { id: string; x: number; y: number }[];
  cursed: { id: string; x: number; y: number }[];
  land: Int32Array;
  dropPickup: Int8Array;
  pending: PendingBomb[];
  /** Analyses per Sight (key: sightKey), and per bot holding bombs. */
  views: Map<number, Analysis>;
  own: Map<number, Map<string, Analysis>>;
}

const cache = new WeakMap<WorldState, Frame>();
const sightKey = (s: Sight) => s.margin * 2 + (s.pickups ? 1 : 0);
/** A bot's own analysis unused this long is dropped (it left, or has no bombs out). */
const VIEW_TTL = sec(10);


/**
 * Mark one bomb's blast cells with the window [t, t + FLAME_TIME] and call `onBomb` for
 * bombs it reaches. `gone` (optional) records when bricks / pickups get destroyed, so a
 * later blast passes through them once the earlier flame has died down.
 */
export function markBlast(
  w: WorldState,
  bombGrid: Int32Array,
  pickups: Int8Array,
  gone: Int32Array | null,
  x: number,
  y: number,
  radius: number,
  pierce: boolean,
  t: number,
  ds: Int32Array,
  de: Int32Array,
  onBomb: ((id: number, t: number) => void) | null,
  dur = FLAME_TIME,
) {
  const W = w.width;
  const mark = (i: number) => {
    if (t < ds[i]!) ds[i] = t;
    if (t + dur > de[i]!) de[i] = t + dur;
  };
  mark(y * W + x);
  for (let d = 0; d < 4; d++) {
    const dx = d === 1 ? -1 : d === 2 ? 1 : 0;
    const dy = d === 0 ? -1 : d === 3 ? 1 : 0;
    for (let k = 1; k <= radius; k++) {
      const cx = x + dx * k;
      const cy = y + dy * k;
      if (cx < 0 || cy < 0 || cx >= W || cy >= w.height) break;
      const i = cy * W + cx;
      const tile = w.tiles[i];
      if (tile === Tile.Wall) break;
      mark(i);
      if (bombGrid[i]) {
        onBomb?.(bombGrid[i]!, t);
        break;
      }
      // pickups burn but let the flame through; players stopping it is ignored (errs on the safe side)
      if (tile !== Tile.Brick || pierce) {
        if (gone && pickups[i] && t < gone[i]!) gone[i] = t;
        continue;
      }
      if (!gone) break;
      if (gone[i]! + FLAME_TIME < t) continue; // already burnt away by an earlier blast
      if (t < gone[i]!) gone[i] = t;
      break;
    }
  }
}

/**
 * The danger map as seen by `self` reading other players' bombs with `sight` (self '' =
 * nobody's bombs known: the public view). Cached per world and tick.
 *
 * A bot's own bombs could also be read from the public view, only bigger than they are (the
 * margin): over-cautious, never deadly. But a bot plans its escape with the exact blast when
 * it lays a bomb, and a map that grows the blast a tick later would chase it out of the tile it
 * chose. So a bot with a bomb out gets a map of its own; it only re-runs the blasts (the rest
 * of the frame is shared), and a bot without one shares the public map.
 */
export function analyze(w: WorldState, sight: Sight = DEFAULT_SIGHT, self = ''): Analysis {
  const f = frame(w);
  const key = sightKey(sight);
  // a map of its own only while a bomb of ours reads differently from the public view
  let mine = false;
  for (const q of f.pending) {
    if (!self || q.owner !== self) continue;
    const r = radiusFor(f.memory, sight, w, self, q.owner, q.radius, q.crazy);
    if (r !== radiusFor(f.memory, sight, w, '', q.owner, q.radius, q.crazy)) mine = true;
  }
  let a: Analysis | undefined;
  let views: Map<string, Analysis> | undefined;
  if (mine) {
    views = f.own.get(key);
    if (!views) f.own.set(key, (views = new Map()));
    a = views.get(self);
  } else a = f.views.get(key);
  if (a && a.tick === w.tick && a.width === w.width && a.height === w.height) return a;
  const n = w.width * w.height;
  if (!a || a.dStart.length !== n) {
    a = {
      world: w,
      tick: -1,
      width: w.width,
      height: w.height,
      self: mine ? self : '',
      sight,
      dStart: new Int32Array(n),
      dEnd: new Int32Array(n),
      gone: new Int32Array(n),
      soft: new Uint8Array(n),
      bomb: f.bomb,
      pickup: f.pickup,
      players: f.players,
      fire: f.fire,
      cursed: f.cursed,
      land: f.land,
      dropPickup: f.dropPickup,
      memory: f.memory,
    };
    if (views) views.set(self, a);
    else f.views.set(key, a);
  }
  a.tick = w.tick;
  a.width = w.width;
  a.height = w.height;
  a.bomb = f.bomb;
  a.pickup = f.pickup;
  a.players = f.players;
  a.land = f.land;
  a.dropPickup = f.dropPickup;
  a.dStart.set(f.baseStart);
  a.dEnd.set(f.baseEnd);
  a.gone.fill(INF);
  a.soft.fill(0);
  resolveChains(a, f.pending);
  return a;
}

/** This tick's frame of the world (memory updated, grids filled, bombs listed). */
function frame(w: WorldState): Frame {
  let f = cache.get(w);
  if (f && f.tick === w.tick && f.width === w.width && f.height === w.height) return f;
  const n = w.width * w.height;
  if (!f || f.bomb.length !== n) {
    const old = f;
    f = {
      memory: old?.memory ?? newMemory(),
      tick: -1,
      width: w.width,
      height: w.height,
      baseStart: new Int32Array(n),
      baseEnd: new Int32Array(n),
      bomb: new Int32Array(n),
      pickup: new Int8Array(n),
      players: new Uint8Array(n),
      fire: [],
      cursed: [],
      land: new Int32Array(n),
      dropPickup: new Int8Array(n),
      pending: [],
      views: new Map(),
      own: new Map(),
    };
    cache.set(w, f);
  }
  f.tick = w.tick;
  f.width = w.width;
  f.height = w.height;
  const m = f.memory;
  observe(m, w);
  if (w.tick % VIEW_TTL === 0) {
    for (const views of f.own.values()) for (const [id, a] of views) if (w.tick - a.tick > VIEW_TTL) views.delete(id);
  }
  const { baseStart: dStart, baseEnd: dEnd, bomb, pickup, players } = f;
  dStart.fill(INF);
  dEnd.fill(-1);
  bomb.fill(0);
  pickup.fill(0);
  players.fill(0);
  f.fire.length = 0;
  f.cursed.length = 0;
  f.land.fill(0);
  f.dropPickup.fill(0);
  const W = w.width;

  for (const k of w.pickups.values()) pickup[k.y * W + k.x] = k.type + 1;
  for (const p of w.players.values()) {
    if (!p.alive || !p.inRound) continue;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (x >= 0 && y >= 0 && x < W && y < w.height) players[y * W + x]++;
    if (p.effects.fire > 0) f.fire.push({ id: p.id, x, y });
    if (p.curse !== Curse.None) f.cursed.push({ id: p.id, x, y });
  }
  for (const fl of w.flames.values()) {
    const i = fl.y * W + fl.x;
    dStart[i] = 0;
    if (fl.ttl > dEnd[i]!) dEnd[i] = fl.ttl;
  }
  for (const fb of w.falling) {
    const i = fb.y * W + fb.x;
    if (fb.ttl < dStart[i]!) dStart[i] = fb.ttl;
    dEnd[i] = INF;
  }
  // the ring the zone will close next: get out before the warning runs out. When nothing
  // deeper is left open, there is no way out: it's no danger to flee, the fight goes on.
  const depth = w.zoneIn > 0 && w.zoneIn <= ZONE_HEED ? zoneDepth(w.shape, W, w.height) : null;
  let escape = false;
  if (depth) for (let i = 0; i < depth.length && !escape; i++) escape = depth[i] !== 255 && depth[i]! > w.zoneRing && w.tiles[i] !== Tile.Wall;
  if (depth && escape) {
    for (let i = 0; i < depth.length; i++) {
      if (depth[i] !== w.zoneRing) continue;
      if (w.zoneIn < dStart[i]!) dStart[i] = w.zoneIn;
      dEnd[i] = INF;
    }
  }

  // bombs -> pending list with their expected detonation time and where they'll be
  const pending = f.pending;
  pending.length = 0;
  for (const b of w.bombs.values()) {
    if (b.motion !== BombMotion.Idle && b.motion !== BombMotion.Sliding) continue;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (x >= 0 && y >= 0 && x < W && y < w.height) bomb[y * W + x] = b.id;
  }
  for (const b of w.bombs.values()) {
    if (b.motion === BombMotion.Carried) continue;
    let x = Math.round(b.x);
    let y = Math.round(b.y);
    let time = b.fuse > 0 ? b.fuse : b.fuse < 0 ? (-b.fuse <= REMOTE_TIMED ? -b.fuse : INF) : 0;
    let dur = FLAME_TIME;
    let earliest = 0;
    const seen = m.bombs.get(b.id)!;
    if (b.kind === BombKind.Crazy) {
      // the real fuse is secret: assume the shortest one, burning any time until the
      // longest fuse runs out; overdue = may go off any moment
      const age = w.tick - seen.since;
      time = CRAZY_FUSE_MIN - age > 0 ? CRAZY_FUSE_MIN - age : INF;
      dur = CRAZY_FUSE_MAX - age - time + FLAME_TIME;
    }
    if (b.motion === BombMotion.Flying) {
      const dx = Math.sign(b.toX - b.fromX);
      const dy = Math.sign(b.toY - b.fromY);
      const at = landingOn(w, bomb, pickup, players, b.toX, b.toY, dx, dy, b.id); // off the map it evaporates
      if (at < 0) continue;
      x = at % W;
      y = (at / W) | 0;
      earliest = Math.ceil((1 - b.progress) * THROW_TIME) + landHops * BOUNCE_TIME;
      time = Math.max(time, earliest);
      if (!bomb[at]) bomb[at] = b.id; // where it comes down: blasts there will chain it
    } else if (b.motion === BombMotion.Sliding) {
      const at = slideStopOn(w, bomb, pickup, players, x, y, Math.sign(b.vx), Math.sign(b.vy), b.id);
      x = at % W;
      y = (at / W) | 0;
    }
    if (x < 0 || y < 0 || x >= W || y >= w.height) continue;
    pending.push({ id: b.id, owner: b.owner, x, y, radius: b.radius, crazy: seen.crazy, pierce: bombPierces(w, b), time, dur, earliest });
  }
  // overtime rain: a sky bomb lands on its shadow and goes off SKY_BOMB_FUSE later
  if (w.drops) {
    for (const d of w.drops) {
      const i = d.y * W + d.x;
      if (w.tiles[i] !== Tile.Floor || bomb[i]) continue; // it fizzles
      if (d.kind === DropKind.Pickup) {
        f.dropPickup[i] = d.pickup + 1;
        continue;
      }
      f.land[i] = d.ttl + 1;
      pending.push({ id: -d.id, owner: '', x: d.x, y: d.y, radius: SKY_BOMB_RADIUS, crazy: false, pierce: false, time: d.ttl - 1 + SKY_BOMB_FUSE, dur: FLAME_TIME, earliest: d.ttl });
    }
  }
  return f;
}

// resolveChains scratch (per pending bomb): when it goes off, its radius, done flag
let qTime = new Int32Array(64);
let qRadius = new Int32Array(64);
let qDone = new Uint8Array(64);

/** Explode pending bombs in time order, pulling chained bombs forward (Dijkstra-like). */
function resolveChains(a: Analysis, pending: readonly PendingBomb[]) {
  const n = pending.length;
  if (qTime.length < n) {
    qTime = new Int32Array(n * 2);
    qRadius = new Int32Array(n * 2);
    qDone = new Uint8Array(n * 2);
  }
  for (let j = 0; j < n; j++) {
    const q = pending[j]!;
    qTime[j] = q.time;
    qDone[j] = 0;
    qRadius[j] = radiusFor(a.memory, a.sight, a.world, a.self, q.owner, q.radius, q.crazy);
  }
  const w = a.world;
  const onBomb = (id: number, t: number) => {
    for (let j = 0; j < n; j++) {
      const q = pending[j]!;
      if (q.id === id && !qDone[j] && qTime[j]! > t + CHAIN_DELAY) qTime[j] = Math.max(q.earliest, t + CHAIN_DELAY);
    }
  };
  for (;;) {
    let best = -1;
    for (let j = 0; j < n; j++) if (!qDone[j] && (best < 0 || qTime[j]! < qTime[best]!)) best = j;
    if (best < 0) break;
    qDone[best] = 1;
    const q = pending[best]!;
    if (qTime[best]! >= INF) {
      markSoft(w, a.bomb, q.x, q.y, qRadius[best]!, q.pierce, a.soft);
      continue;
    }
    markBlast(w, a.bomb, a.pickup, a.gone, q.x, q.y, qRadius[best]!, q.pierce, qTime[best]!, a.dStart, a.dEnd, onBomb, q.dur);
  }
}

/** Blast cells of an untimed (remote) bomb. */
function markSoft(w: WorldState, bombGrid: Int32Array, x: number, y: number, radius: number, pierce: boolean, soft: Uint8Array) {
  const W = w.width;
  soft[y * W + x] = 1;
  for (let d = 0; d < 4; d++) {
    const dx = d === 1 ? -1 : d === 2 ? 1 : 0;
    const dy = d === 0 ? -1 : d === 3 ? 1 : 0;
    for (let k = 1; k <= radius; k++) {
      const cx = x + dx * k;
      const cy = y + dy * k;
      if (cx < 0 || cy < 0 || cx >= W || cy >= w.height) break;
      const i = cy * W + cx;
      const tile = w.tiles[i];
      if (tile === Tile.Wall) break;
      soft[i] = 1;
      if (bombGrid[i] || (tile === Tile.Brick && !pierce)) break;
    }
  }
}

/** A tile that is neither timed danger nor in an untimed remote blast. */
export const restful = (a: Analysis, ds: Int32Array, i: number) => ds[i]! >= INF && !a.soft[i];

/**
 * Danger windows with extra (hypothetical) bombs added: one at (x, y), plus `more` (tile
 * indices, e.g. a LineBomb line) with the same fuse. Writes into ds/de copies.
 */
export function withExtraBomb(
  a: Analysis,
  x: number,
  y: number,
  radius: number,
  pierce: boolean,
  time: number,
  ds: Int32Array,
  de: Int32Array,
  dur = FLAME_TIME,
  more?: readonly number[],
) {
  ds.set(a.dStart);
  de.set(a.dEnd);
  const w = a.world;
  const W = a.width;
  const chain = (id: number, t: number) => {
    // a bomb we'd reach may now go off earlier: re-mark its blast from the chained time
    const b = w.bombs.get(id);
    if (!b) return;
    const bt = t + CHAIN_DELAY;
    const bx = Math.round(b.x);
    const by = Math.round(b.y);
    if (bt < a.dStart[by * W + bx]!) markBlast(w, a.bomb, a.pickup, a.gone, bx, by, blastRadius(a, b), bombPierces(w, b), bt, ds, de, null);
  };
  // our bomb goes off early if it already sits in a blast; a line chains as one
  const early = (i: number) => (a.dStart[i]! < INF ? a.dStart[i]! + CHAIN_DELAY : INF);
  let t0 = Math.min(time, early(y * W + x));
  if (more) for (const i of more) t0 = Math.min(t0, early(i));
  markBlast(w, a.bomb, a.pickup, a.gone, x, y, radius, pierce, t0, ds, de, chain, dur);
  if (more) for (const i of more) markBlast(w, a.bomb, a.pickup, a.gone, i % W, (i / W) | 0, radius, pierce, t0, ds, de, chain, dur);
}

/** Largest blast a Crazy bomb of this owner can have (their own radius: for the owner only). */
export const crazyRadius = (owner: PlayerState | undefined) =>
  owner ? Math.min(MAX_RADIUS, (owner.curse === Curse.TinyFlame ? 1 : owner.radius) * CRAZY_RADIUS_MULT) : MAX_RADIUS;

/** Hops taken by the last landing() call. */
export let landHops = 0;

/**
 * Where a thrown / punched bomb aimed at (x, y), flying along (dx, dy), comes down: a
 * blocked tile or a head makes it hop one tile on. -1 = off the map (it evaporates).
 */
export const landing = (a: Analysis, x: number, y: number, dx: number, dy: number, self: number) =>
  landingOn(a.world, a.bomb, a.pickup, a.players, x, y, dx, dy, self);

function landingOn(w: WorldState, bomb: Int32Array, pickup: Int8Array, players: Uint8Array, x: number, y: number, dx: number, dy: number, self: number): number {
  const W = w.width;
  landHops = 0;
  if (dx === 0 && dy === 0) return x >= 0 && y >= 0 && x < W && y < w.height ? y * W + x : -1;
  for (let h = 0; h <= 64; h++) {
    if (x < 0 || y < 0 || x >= W || y >= w.height) return -1;
    const i = y * W + x;
    const id = bomb[i]!;
    if (w.tiles[i] === Tile.Floor && (!id || id === self) && !pickup[i] && !players[i]) {
      landHops = h;
      return i;
    }
    x += dx;
    y += dy;
  }
  return -1;
}

/** Tile where a bomb sliding from (x, y) along (dx, dy) stops (before walls, bombs, pickups, players). */
export const slideStop = (a: Analysis, x: number, y: number, dx: number, dy: number, self: number) =>
  slideStopOn(a.world, a.bomb, a.pickup, a.players, x, y, dx, dy, self);

function slideStopOn(w: WorldState, bomb: Int32Array, pickup: Int8Array, players: Uint8Array, x: number, y: number, dx: number, dy: number, self: number): number {
  const W = w.width;
  let i = y * W + x;
  if (dx === 0 && dy === 0) return i;
  for (let k = 0; k < 128; k++) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= w.height) break;
    const j = ny * W + nx;
    const id = bomb[j]!;
    if (w.tiles[j] !== Tile.Floor || (id && id !== self) || pickup[j] || players[j]) break;
    x = nx;
    y = ny;
    i = j;
  }
  return i;
}

/**
 * Whether a bomb at (bx, by) with `radius` burns tile (tx, ty): same row / column, in
 * reach, nothing in between that soaks up the flame (walls, bricks unless piercing,
 * bombs, pickups).
 */
export function inBlast(a: Analysis, bx: number, by: number, radius: number, pierce: boolean, tx: number, ty: number): boolean {
  if (bx === tx && by === ty) return true;
  if (bx !== tx && by !== ty) return false;
  const dist = Math.abs(tx - bx) + Math.abs(ty - by);
  if (dist > radius) return false;
  const W = a.width;
  const dx = Math.sign(tx - bx);
  const dy = Math.sign(ty - by);
  const tiles = a.world.tiles;
  for (let k = 1; k < dist; k++) {
    const i = (by + dy * k) * W + bx + dx * k;
    const t = tiles[i];
    if (t === Tile.Wall || (t === Tile.Brick && !pierce) || a.bomb[i] || a.pickup[i]) return false;
  }
  return tiles[ty * W + tx] !== Tile.Wall;
}

/** The Pierce flag a bomb will explode with (kind, or the owner's ability baked in at placement). */
export const bombPierces = (w: WorldState, b: BombState) => {
  if (b.kind === BombKind.Pierce) return true;
  const o = w.players.get(b.owner);
  return o !== undefined && (o.abilities & Ability.Pierce) !== 0;
};

export const isSkull = (a: Analysis, i: number) => a.pickup[i] === PickupType.Skull + 1;
