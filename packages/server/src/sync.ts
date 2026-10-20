// Diff the simulation's plain WorldState into the Colyseus schema. Only changed fields are
// assigned, removed entities are deleted, so the encoder emits minimal patches.

import { BombKind, type BombState, type FlameState, type PickupState, type PlayerState, type TimedEffects, type WorldState } from '@ob/game';
import {
  type BattleState, BombSchema, DropSchema, FallingSchema, FlameSchema, PickupSchema, PlayerSchema,
} from './schema.ts';

const at = (remaining: number, tick: number) => (remaining > 0 ? tick + remaining : 0);

type Writable = Record<string, unknown>;
/** Assign `obj[key] = v` only when it differs (keeps the change set minimal). */
function set<T extends object>(obj: T, key: keyof T & string, v: unknown) {
  if ((obj as Writable)[key] !== v) (obj as Writable)[key] = v;
}

function syncEffects(s: PlayerSchema['effects'], e: TimedEffects, tick: number) {
  for (const k in e) {
    const v = at((e as unknown as Record<string, number>)[k]!, tick);
    if (s.get(k) !== v) s.set(k, v);
  }
}

function syncPlayer(s: PlayerSchema, p: PlayerState, tick: number) {
  set(s, 'id', p.id);
  set(s, 'name', p.name);
  set(s, 'skin', p.skin);
  set(s, 'isBot', p.isBot);
  set(s, 'x', p.x);
  set(s, 'y', p.y);
  set(s, 'dir', p.dir);
  set(s, 'moving', p.moving);
  set(s, 'alive', p.alive);
  set(s, 'inRound', p.inRound);
  set(s, 'lives', p.lives);
  set(s, 'bombs', p.bombs);
  set(s, 'radius', p.radius);
  set(s, 'speedLevel', p.speedLevel);
  set(s, 'abilities', p.abilities);
  set(s, 'curse', p.curse);
  syncEffects(s.effects, p.effects, tick);
  set(s, 'carrying', p.carrying);
  set(s, 'respawnAt', at(p.respawnIn, tick));
  set(s, 'wins', p.wins);
  set(s, 'kills', p.kills);
  set(s, 'deaths', p.deaths);
  set(s, 'ackSeq', p.ackSeq);
}

function syncBomb(s: BombSchema, b: BombState, tick: number) {
  set(s, 'id', b.id);
  set(s, 'owner', b.owner);
  set(s, 'kind', b.kind);
  set(s, 'x', b.x);
  set(s, 'y', b.y);
  // Crazy bombs are random by design: their real fuse and radius are hidden information
  // (clients get radius 0 and a "waiting" fuse and just pulse evenly).
  const secret = b.kind === BombKind.Crazy;
  set(s, 'radius', secret ? 0 : b.radius);
  set(s, 'fuseAt', secret ? -1 : b.fuse < 0 ? b.fuse : tick + b.fuse);
  set(s, 'motion', b.motion);
  set(s, 'vx', b.vx);
  set(s, 'vy', b.vy);
  set(s, 'fromX', b.fromX);
  set(s, 'fromY', b.fromY);
  set(s, 'toX', b.toX);
  set(s, 'toY', b.toY);
  set(s, 'progress', b.progress);
  // `dud` is deliberately not synced (hidden information).
  const sp = s.passers;
  const bp = b.passers;
  let same = sp.length === bp.length;
  for (let i = 0; same && i < bp.length; i++) same = sp[i] === bp[i];
  if (!same) {
    sp.clear();
    for (const id of bp) sp.push(id);
  }
}

function syncFlame(s: FlameSchema, f: FlameState, tick: number) {
  set(s, 'id', f.id);
  set(s, 'x', f.x);
  set(s, 'y', f.y);
  set(s, 'shape', f.shape);
  set(s, 'owner', f.owner);
  set(s, 'ttlAt', at(f.ttl, tick));
}

function syncPickup(s: PickupSchema, p: PickupState, tick: number) {
  set(s, 'id', p.id);
  set(s, 'x', p.x);
  set(s, 'y', p.y);
  set(s, 'type', p.type);
  set(s, 'protectAt', at(p.protect, tick));
}

interface SchemaMap<V> {
  get(k: string): V | undefined;
  set(k: string, v: V): unknown;
  delete(k: string): unknown;
  keys(): IterableIterator<string>;
  readonly size: number;
}

const scratchKeys: string[] = [];
function syncMap<S, V>(
  target: SchemaMap<S>,
  source: Map<string | number, V>,
  create: () => S,
  apply: (s: S, v: V, tick: number) => void,
  tick: number,
) {
  for (const [k, v] of source) {
    const key = typeof k === 'string' ? k : String(k);
    let s = target.get(key);
    if (!s) {
      s = create();
      apply(s, v, tick);
      target.set(key, s);
    } else {
      apply(s, v, tick);
    }
  }
  if (target.size !== source.size) {
    scratchKeys.length = 0;
    const numeric = source.size > 0 && typeof source.keys().next().value === 'number';
    for (const key of target.keys()) {
      const has = numeric ? source.has(Number(key)) : source.has(key);
      if (!has) scratchKeys.push(key);
    }
    for (const key of scratchKeys) target.delete(key);
  }
}

export function syncWorld(state: BattleState, w: WorldState) {
  const tick = w.tick;
  set(state, 'tick', tick);
  set(state, 'phase', w.phase);
  set(state, 'phaseTicks', w.phaseTicks);
  set(state, 'round', w.round);
  set(state, 'width', w.width);
  set(state, 'height', w.height);
  set(state, 'winner', w.winner);
  set(state, 'zoneRing', w.zoneRing ?? 0);
  set(state, 'zoneAt', at(w.zoneIn ?? 0, tick));

  const tiles = state.tiles;
  const n = w.tiles.length;
  if (tiles.length !== n) {
    tiles.clear();
    for (let i = 0; i < n; i++) tiles.push(w.tiles[i]!);
  } else {
    for (let i = 0; i < n; i++) {
      const v = w.tiles[i]!;
      if (tiles[i] !== v) tiles[i] = v;
    }
  }

  syncMap(state.players, w.players, () => new PlayerSchema(), syncPlayer, tick);
  syncMap(state.bombs, w.bombs, () => new BombSchema(), syncBomb, tick);
  syncMap(state.flames, w.flames, () => new FlameSchema(), syncFlame, tick);
  syncMap(state.pickups, w.pickups, () => new PickupSchema(), syncPickup, tick);

  const falling = state.falling;
  const wf = w.falling;
  while (falling.length > wf.length) falling.pop();
  for (let i = 0; i < wf.length; i++) {
    const f = wf[i]!;
    let s = falling[i];
    if (!s) {
      s = new FallingSchema();
      s.x = f.x; s.y = f.y; s.ttlAt = at(f.ttl, tick);
      falling.push(s);
    } else {
      set(s, 'x', f.x);
      set(s, 'y', f.y);
      set(s, 'ttlAt', at(f.ttl, tick));
    }
  }

  // sky drops: few and short-lived, matched by position in the list like falling blocks
  const drops = state.drops;
  const wd = w.drops;
  while (drops.length > wd.length) drops.pop();
  for (let i = 0; i < wd.length; i++) {
    const d = wd[i]!;
    let s = drops[i];
    if (!s) { s = new DropSchema(); drops.push(s); }
    set(s, 'id', d.id);
    set(s, 'x', d.x);
    set(s, 'y', d.y);
    set(s, 'kind', d.kind);
    set(s, 'pickup', d.pickup);
    set(s, 'ttlAt', at(d.ttl, tick));
  }
}
