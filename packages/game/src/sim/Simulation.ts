// The authoritative, deterministic game simulation (fixed step = 1 / TICK_RATE).

import type { ISimulation, MatchConfig, NewPlayer } from '../contract/api';
import { MAX_PLAYERS } from '../contract/constants';
import type { GameEvent, InputFrame } from '../contract/protocol';
import { Phase, type PickupState, type PickupType, type PlayerState, type WorldState } from '../contract/types';
import { dropCarried, updateBombs } from './bombs';
import type { SimCtx } from './context';
import { tickFlames } from './flames';
import { parseMap } from './map';
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
import { joinWaiting, startWaiting, updatePhase } from './round';
import { createWorld } from './world';

export class Simulation implements ISimulation {
  readonly state: WorldState;
  /** Internal state (hidden pickups, input queues, ...). Exposed for tests and tooling. */
  readonly ctx: SimCtx;

  constructor(config: MatchConfig) {
    this.state = createWorld(15, 13, config.seed ?? 0x0b0b);
    this.ctx = {
      world: this.state,
      config,
      events: [],
      hidden: new Int8Array(0),
      flameGrid: new Int32Array(0),
      brickBurn: new Uint8Array(0),
      brickBurnCount: 0,
      players: new Map(),
      bombs: new Map(),
      spawns: [],
      spiral: new Int32Array(0),
      spiralPos: 0,
      suddenTimer: 0,
      roundPlayers: 0,
    };
    startWaiting(this.ctx);
  }

  addPlayer(np: NewPlayer): PlayerState {
    const existing = this.state.players.get(np.id);
    if (existing) return existing;
    if (this.state.players.size >= MAX_PLAYERS) throw new Error(`room is full (${MAX_PLAYERS})`);
    const p = createPlayer(np);
    this.state.players.set(p.id, p);
    this.ctx.players.set(p.id, createInternal());
    if (this.state.phase === Phase.Waiting) joinWaiting(this.ctx, p);
    else p.x = p.y = 0; // spectator until the next round
    return p;
  }

  removePlayer(id: string): void {
    const p = this.state.players.get(id);
    if (!p) return;
    if (p.carrying >= 0) dropCarried(this.ctx, p);
    for (const b of this.state.bombs.values()) {
      const i = b.passers.indexOf(id);
      if (i >= 0) b.passers.splice(i, 1);
    }
    this.state.players.delete(id);
    this.ctx.players.delete(id);
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
    for (const p of w.players.values()) updatePlayer(ctx, p);
    if (gameplayPhase(w.phase)) {
      collectPickups(ctx);
      touchPlayers(ctx);
    }
    tickFlames(ctx);
    updateBombs(ctx);
    tickPickups(ctx);
    burnPlayers(ctx);
    tickPlayers(ctx);
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
    w.tiles = m.tiles;
    ctx.hidden = new Int8Array(m.width * m.height).fill(-1);
    ctx.flameGrid = new Int32Array(m.width * m.height);
    ctx.brickBurn = new Uint8Array(m.width * m.height);
    ctx.brickBurnCount = 0;
    w.bombs.clear();
    ctx.bombs.clear();
    w.flames.clear();
    w.pickups.clear();
    w.falling.length = 0;
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
