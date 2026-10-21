// The authoritative, deterministic game simulation (fixed step = 1 / TICK_RATE).

import type { ISimulation, MatchConfig, NewPlayer } from '../contract/api';
import { MAX_PLAYERS } from '../contract/constants';
import type { GameEvent, InputFrame } from '../contract/protocol';
import { ArenaShape, type PickupState, type PickupType, type PlayerState, type WorldState } from '../contract/types';
import { dropCarried, updateBombs } from './bombs';
import { emit, type SimCtx } from './context';
import { tickFlames } from './flames';
import { parseMap } from './map';
import { hashString } from './rng';
import { pushPlayers } from './movement';
import { collectPickups, spawnPickup, tickPickups } from './pickups';
import {
  burnPlayers,
  createInternal,
  createPlayer,
  gameplayPhase,
  queueInput,
  tickPlayers,
  touchPlayers,
  updatePlayer,
} from './players';
import { newMap, startRound, updatePhase } from './round';
import { createWorld } from './world';

/** Carried bombs follow their holder after the player push moved them. */
function syncCarried(w: WorldState) {
  for (const p of w.players.values()) {
    if (p.carrying < 0) continue;
    const b = w.bombs.get(p.carrying);
    if (b) { b.x = p.x; b.y = p.y; }
  }
}

export class Simulation implements ISimulation {
  readonly state: WorldState;
  /** Internal state (hidden pickups, input queues, ...). Exposed for tests and tooling. */
  readonly ctx: SimCtx;

  constructor(config: MatchConfig) {
    this.state = createWorld(13, 13, config.seed ?? 0x0b0b);
    this.ctx = {
      world: this.state,
      config,
      secret: { seed: (hashString('secret') ^ (config.seed ?? 0x0b0b)) >>> 0 },
      events: [],
      hidden: new Int8Array(0),
      flameGrid: new Int32Array(0),
      pickupGrid: new Int32Array(0),
      bombGrid: new Int32Array(0),
      brickBurn: new Uint8Array(0),
      brickBurnCount: 0,
      players: new Map(),
      bombs: new Map(),
      spawns: [],
      zoneQuiet: 0,
      overtimeIn: 0,
      overtimeWave: 0,
      bricksAtStart: 0,
      hasWin: false,
      roundDeaths: 0,
      bombsAllowed: false,
      hold: false,
    };
    newMap(this.ctx, 1); // idle arena until somebody joins
  }

  /** Tests / tools: freeze round end, restarts and the zone (bombs, flames etc. still run). */
  get holdRound(): boolean {
    return this.ctx.hold;
  }
  set holdRound(v: boolean) {
    this.ctx.hold = v;
  }

  addPlayer(np: NewPlayer): PlayerState {
    const existing = this.state.players.get(np.id);
    if (existing) return existing;
    if (this.state.players.size >= MAX_PLAYERS) throw new Error(`room is full (${MAX_PLAYERS})`);
    const p = createPlayer(np);
    this.state.players.set(p.id, p);
    this.ctx.players.set(p.id, createInternal());
    // spectator (inRound = false) until the next restart; an idle arena restarts right away
    return p;
  }

  removePlayer(id: string): void {
    const p = this.state.players.get(id);
    if (!p) return;
    if (p.carrying >= 0) dropCarried(this.ctx, p);
    p.alive = false;
    for (const b of this.state.bombs.values()) {
      const i = b.passers.indexOf(id);
      if (i >= 0) b.passers.splice(i, 1);
    }
    this.state.players.delete(id);
    this.ctx.players.delete(id);
  }

  private restartAsked = false;

  restartRound(): void {
    this.restartAsked = true;
  }

  updateProfile(id: string, prof: { name?: string; skin?: number }): void {
    const p = this.state.players.get(id);
    if (!p) return;
    if (typeof prof.name === 'string') p.name = prof.name;
    if (typeof prof.skin === 'number' && Number.isFinite(prof.skin)) p.skin = prof.skin | 0;
  }

  pushInput(id: string, f: InputFrame): void {
    const dx = Number.isFinite(f.dx) ? Math.max(-1, Math.min(1, f.dx)) : 0;
    const dy = Number.isFinite(f.dy) ? Math.max(-1, Math.min(1, f.dy)) : 0;
    queueInput(this.ctx, id, dx, dy, f.buttons, f.seq);
  }

  step(): GameEvent[] {
    const ctx = this.ctx;
    const w = this.state;
    ctx.events = [];
    w.tick++;
    ctx.bombsAllowed = gameplayPhase(w.phase) && (w.players.size <= 1 || aliveCount(w) >= 2);
    for (const p of w.players.values()) updatePlayer(ctx, p);
    pushPlayers(w);
    syncCarried(w);
    if (gameplayPhase(w.phase)) {
      collectPickups(ctx);
      touchPlayers(ctx);
    }
    tickFlames(ctx);
    updateBombs(ctx);
    tickPickups(ctx);
    burnPlayers(ctx);
    tickPlayers(ctx);
    if (this.restartAsked) {
      this.restartAsked = false;
      if (w.zoneIn > 0) emit(ctx, { type: 'zoneCancel' });
      if (w.players.size > 0) startRound(ctx);
    }
    updatePhase(ctx);
    return ctx.events;
  }

  // ------------------------------------------------------------ dev / test helpers

  /** Replace the arena with an ASCII map ('#' wall, 'B' brick, '.' floor); clears everything on it. */
  loadMap(rows: string[]): void {
    const m = parseMap(rows);
    const w = this.state;
    const ctx = this.ctx;
    w.width = m.width;
    w.height = m.height;
    w.shape = ArenaShape.Rect;
    w.tiles = m.tiles;
    ctx.hidden = new Int8Array(m.width * m.height).fill(-1);
    ctx.flameGrid = new Int32Array(m.width * m.height);
    ctx.pickupGrid = new Int32Array(m.width * m.height);
    ctx.bombGrid = new Int32Array(m.width * m.height);
    ctx.brickBurn = new Uint8Array(m.width * m.height);
    ctx.brickBurnCount = 0;
    w.bombs.clear();
    ctx.bombs.clear();
    w.flames.clear();
    w.pickups.clear();
    w.falling.length = 0;
    w.zoneRing = 0;
    w.zoneIn = 0;
    // heroes get placed on the new map by hand: nothing from before to rewind into or catch up
    for (const pi of ctx.players.values()) { pi.guesses = 0; pi.guessHead = 0; pi.owed = 0; }
    for (const p of w.players.values()) p.guessed = 0;
  }

  /** Hide a pickup inside the brick at (x, y). */
  hidePickup(x: number, y: number, type: PickupType): void {
    this.ctx.hidden[y * this.state.width + x] = type;
  }

  /** Hidden pickup inside the brick at (x, y), or -1. */
  hiddenPickup(x: number, y: number): number {
    return this.ctx.hidden[y * this.state.width + x] ?? -1;
  }

  spawnPickup(x: number, y: number, type: PickupType): PickupState {
    const p = spawnPickup(this.ctx, x, y, type);
    p.protect = 0;
    return p;
  }
}

/** Alive players in the round (legacy livePlayersCount). */
function aliveCount(w: WorldState): number {
  let n = 0;
  for (const p of w.players.values()) if (p.alive && p.inRound) n++;
  return n;
}
