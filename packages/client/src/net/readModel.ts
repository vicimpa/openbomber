// Decoded Colyseus state -> plain WorldState read model (objects are reused across patches).
// The schema types come from the server package as TYPE-ONLY imports; the client decodes
// through Colyseus reflection, so no server code ends up in the bundle.

import type { BombState, FlameState, PickupState, PlayerState, TimedEffects, WorldState } from '@ob/game';
import type {
  BattleState, BombSchema, FlameSchema, PickupSchema, PlayerSchema,
} from '../../../server/src/schema.ts';

const left = (at: number, tick: number) => (at > 0 ? Math.max(0, at - tick) : 0);

export function emptyWorld(): WorldState {
  return {
    tick: 0, seed: 0, phase: 0, phaseTicks: 0, round: 0, width: 0, height: 0, shape: 0,
    tiles: new Uint8Array(0),
    players: new Map(), bombs: new Map(), flames: new Map(), pickups: new Map(),
    falling: [], drops: [], winner: '', nextId: 0, zoneRing: 0, zoneIn: 0,
  };
}

/** Known effect keys are pre-filled; any other TimedEffects field arrives from the server
 *  (effects are synced as a generic map), so this stays valid as the contract grows. */
export function emptyEffects(): TimedEffects {
  return {
    shield: 0, ghost: 0, crazy: 0, fire: 0, curse: 0, invulnerable: 0, stun: 0, speed: 0,
    kick: 0, glove: 0, punch: 0, remote: 0, pierce: 0, lineBomb: 0, bombPass: 0,
  } as TimedEffects;
}

type NumRecord = Record<string, number>;
function copyEffects(a: TimedEffects, b: TimedEffects) {
  for (const k in a) (b as unknown as NumRecord)[k] = (a as unknown as NumRecord)[k]!;
}

export function newPlayer(id: string): PlayerState {
  return {
    id, name: '', skin: 0, isBot: false, x: 0, y: 0, dir: 0, moving: false, alive: false, inRound: false,
    lives: 0, teleports: 0, bombs: 0, radius: 0, speedLevel: 0, abilities: 0, curse: 0, effects: emptyEffects(),
    carrying: -1, respawnIn: 0, wins: 0, kills: 0, deaths: 0, ackSeq: 0,
  };
}

export function copyPlayer(src: PlayerState, dst: PlayerState) {
  dst.id = src.id; dst.name = src.name; dst.skin = src.skin; dst.isBot = src.isBot;
  dst.x = src.x; dst.y = src.y; dst.dir = src.dir; dst.moving = src.moving;
  dst.alive = src.alive; dst.inRound = src.inRound; dst.lives = src.lives; dst.teleports = src.teleports; dst.bombs = src.bombs;
  dst.radius = src.radius; dst.speedLevel = src.speedLevel; dst.abilities = src.abilities; dst.curse = src.curse;
  copyEffects(src.effects, dst.effects);
  dst.carrying = src.carrying; dst.respawnIn = src.respawnIn; dst.wins = src.wins;
  dst.kills = src.kills; dst.deaths = src.deaths; dst.ackSeq = src.ackSeq;
}

function readEffects(s: PlayerSchema['effects'] | undefined, e: TimedEffects, tick: number) {
  s?.forEach((at, k) => { (e as unknown as NumRecord)[k] = left(at, tick); });
}

function readPlayer(s: PlayerSchema, p: PlayerState, tick: number) {
  p.name = s.name; p.skin = s.skin; p.isBot = s.isBot;
  p.x = s.x; p.y = s.y; p.dir = s.dir; p.moving = s.moving;
  p.alive = s.alive; p.inRound = s.inRound; p.lives = s.lives; p.teleports = s.teleports ?? 0; p.bombs = s.bombs;
  p.radius = s.radius; p.speedLevel = s.speedLevel; p.abilities = s.abilities; p.curse = s.curse;
  readEffects(s.effects, p.effects, tick);
  p.carrying = s.carrying; p.respawnIn = left(s.respawnAt, tick);
  p.wins = s.wins; p.kills = s.kills; p.deaths = s.deaths; p.ackSeq = s.ackSeq;
}

function readBomb(s: BombSchema, b: BombState, tick: number) {
  b.owner = s.owner; b.kind = s.kind; b.x = s.x; b.y = s.y; b.radius = s.radius;
  b.fuse = s.fuseAt < 0 ? s.fuseAt : Math.max(0, s.fuseAt - tick);
  b.motion = s.motion; b.vx = s.vx; b.vy = s.vy;
  b.fromX = s.fromX; b.fromY = s.fromY; b.toX = s.toX; b.toY = s.toY; b.progress = s.progress;
  // Always restore passers from the server: client prediction may have mutated them.
  const sp = s.passers, bp = b.passers;
  bp.length = 0;
  if (sp) for (const id of sp) bp.push(id);
}

function readFlame(s: FlameSchema, f: FlameState, tick: number) {
  f.x = s.x; f.y = s.y; f.shape = s.shape; f.owner = s.owner; f.ttl = left(s.ttlAt, tick);
}

function readPickup(s: PickupSchema, p: PickupState, tick: number) {
  p.x = s.x; p.y = s.y; p.type = s.type; p.protect = left(s.protectAt, tick);
}

interface DecodedMap<V> {
  forEach(cb: (v: V, k: string) => void): void;
  readonly size: number;
}

function syncNumMap<S extends { id: number }, T extends { id: number }>(
  src: DecodedMap<S> | undefined,
  dst: Map<number, T>,
  make: (id: number) => T,
  read: (s: S, t: T, tick: number) => void,
  tick: number,
  live: Set<number>,
) {
  live.clear();
  src?.forEach((s) => {
    let t = dst.get(s.id);
    if (!t) { t = make(s.id); dst.set(s.id, t); }
    read(s, t, tick);
    live.add(s.id);
  });
  if (dst.size !== live.size) for (const k of dst.keys()) if (!live.has(k)) dst.delete(k);
}

export function copyBomb(a: BombState, b: BombState) {
  b.owner = a.owner; b.kind = a.kind; b.x = a.x; b.y = a.y; b.radius = a.radius; b.fuse = a.fuse;
  b.motion = a.motion; b.vx = a.vx; b.vy = a.vy; b.fromX = a.fromX; b.fromY = a.fromY;
  b.toX = a.toX; b.toY = a.toY; b.progress = a.progress; b.dud = a.dud;
  b.passers.length = 0;
  for (const id of a.passers) b.passers.push(id);
}

export const newBomb = (id: number): BombState => ({
  id, owner: '', kind: 0, x: 0, y: 0, radius: 0, fuse: 0, motion: 0, vx: 0, vy: 0,
  fromX: 0, fromY: 0, toX: 0, toY: 0, progress: 0, passers: [], dud: false,
});
const newFlame = (id: number): FlameState => ({ id, x: 0, y: 0, shape: 0, owner: '', ttl: 0 });
const newPickup = (id: number): PickupState => ({ id, x: 0, y: 0, type: 0, protect: 0 });

/** Mirror of the latest authoritative server state. */
export class ReadModel {
  readonly world: WorldState = emptyWorld();
  ready = false;
  private readonly liveNum = new Set<number>();
  private readonly liveStr = new Set<string>();

  apply(s: BattleState) {
    const w = this.world;
    const tick = s.tick;
    w.tick = tick;
    w.phase = s.phase;
    w.phaseTicks = s.phaseTicks;
    w.round = s.round;
    w.width = s.width;
    w.height = s.height;
    w.shape = s.shape ?? 0;
    w.winner = s.winner;
    w.zoneRing = s.zoneRing ?? 0;
    w.zoneIn = left(s.zoneAt ?? 0, tick);

    const n = s.tiles?.length ?? 0;
    if (w.tiles.length !== n) w.tiles = new Uint8Array(n);
    if (s.tiles) {
      let i = 0;
      for (const v of s.tiles) w.tiles[i++] = v;
    }

    const live = this.liveStr;
    live.clear();
    s.players?.forEach((ps, id) => {
      let p = w.players.get(id);
      if (!p) { p = newPlayer(id); w.players.set(id, p); }
      readPlayer(ps, p, tick);
      live.add(id);
    });
    if (w.players.size !== live.size) for (const k of w.players.keys()) if (!live.has(k)) w.players.delete(k);

    syncNumMap(s.bombs, w.bombs, newBomb, readBomb, tick, this.liveNum);
    syncNumMap(s.flames, w.flames, newFlame, readFlame, tick, this.liveNum);
    syncNumMap(s.pickups, w.pickups, newPickup, readPickup, tick, this.liveNum);

    const fall = w.falling;
    let i = 0;
    if (s.falling) {
      for (const f of s.falling) {
        const t = fall[i] ?? (fall[i] = { x: 0, y: 0, ttl: 0 });
        t.x = f.x; t.y = f.y; t.ttl = left(f.ttlAt, tick);
        i++;
      }
    }
    fall.length = i;

    const drops = w.drops;
    let j = 0;
    if (s.drops) {
      for (const d of s.drops) {
        const t = drops[j] ?? (drops[j] = { id: 0, x: 0, y: 0, kind: 0, pickup: 0, ttl: 0 });
        t.id = d.id; t.x = d.x; t.y = d.y; t.kind = d.kind; t.pickup = d.pickup; t.ttl = left(d.ttlAt, tick);
        j++;
      }
    }
    drops.length = j;

    this.ready = w.width > 0 && w.height > 0 && w.tiles.length === w.width * w.height;
  }
}
