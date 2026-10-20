// Tiny throwaway simulation used by the server tests when the real Simulation is not
// available (or OB_STUB_SIM=1). Implements just enough of ISimulation: movement with
// pillar collision, bombs on Bomb edge, fuse -> explosion + flames, ackSeq.

import {
  BASE_SPEED, BOMB_FUSE, Button, Dir, FLAME_TIME, FlameShape, Phase, TICK_RATE, Tile,
  type GameEvent, type IBot, type ISimulation, type InputFrame, type MatchConfig, type NewPlayer,
  type PlayerState, type WorldState,
} from '@ob/game';
import type { GameImpl } from '../src/game.ts';

const W = 15, H = 13;
const SPAWNS: [number, number][] = [[0, 0], [W - 1, H - 1], [W - 1, 0], [0, H - 1], [7, 0], [7, H - 1], [0, 6], [W - 1, 6]];

const solid = (w: WorldState, x: number, y: number) =>
  x < 0 || y < 0 || x >= w.width || y >= w.height || w.tiles[y * w.width + x] !== Tile.Floor;

/** Movement shared by the stub sim and the client prediction in tests. */
export function stubMove(w: WorldState, p: PlayerState, f: InputFrame) {
  if (!p.alive) return;
  const sp = BASE_SPEED / TICK_RATE;
  const nx = p.x + f.dx * sp, ny = p.y + f.dy * sp;
  if (!solid(w, Math.round(nx), Math.round(p.y))) p.x = Math.max(0, Math.min(w.width - 1, nx));
  if (!solid(w, Math.round(p.x), Math.round(ny))) p.y = Math.max(0, Math.min(w.height - 1, ny));
  p.moving = f.dx !== 0 || f.dy !== 0;
  if (Math.abs(f.dx) > Math.abs(f.dy)) p.dir = f.dx > 0 ? Dir.Right : Dir.Left;
  else if (f.dy !== 0) p.dir = f.dy > 0 ? Dir.Down : Dir.Up;
}

export class StubSim implements ISimulation {
  readonly state: WorldState;
  private queues = new Map<string, InputFrame[]>();
  private last = new Map<string, InputFrame>();
  private prevButtons = new Map<string, number>();

  constructor(_c: MatchConfig) {
    const tiles = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 2 === 1 && y % 2 === 1) tiles[y * W + x] = Tile.Wall;
    this.state = {
      tick: 0, seed: 1, phase: Phase.Waiting, phaseTicks: 0, round: 1, width: W, height: H, tiles,
      players: new Map(), bombs: new Map(), flames: new Map(), pickups: new Map(), falling: [], drops: [], winner: '', nextId: 1,
      zoneRing: 0, zoneIn: 0,
    };
  }

  addPlayer(np: NewPlayer): PlayerState {
    const [x, y] = SPAWNS[this.state.players.size % SPAWNS.length]!;
    const p: PlayerState = {
      id: np.id, name: np.name, skin: np.skin, isBot: !!np.isBot, x, y, dir: Dir.Down, moving: false, alive: true,
      inRound: true, lives: 0, bombs: 1, radius: 2, speedLevel: 0, abilities: 0, curse: 0,
      effects: {
        shield: 0, ghost: 0, crazy: 0, fire: 0, curse: 0, invulnerable: 120, stun: 0, speed: 0,
        kick: 0, glove: 0, punch: 0, remote: 0, pierce: 0, lineBomb: 0, bombPass: 0,
      },
      carrying: -1, respawnIn: 0, wins: 0, kills: 0, deaths: 0, ackSeq: 0,
    };
    this.state.players.set(p.id, p);
    this.queues.set(p.id, []);
    return p;
  }

  restarts = 0;
  restartRound() { this.restarts++; }

  removePlayer(id: string) {
    this.state.players.delete(id);
    this.queues.delete(id);
    this.last.delete(id);
  }

  updateProfile(id: string, pr: { name?: string; skin?: number }) {
    const p = this.state.players.get(id);
    if (!p) return;
    if (pr.name !== undefined) p.name = pr.name;
    if (pr.skin !== undefined) p.skin = pr.skin;
  }

  pushInput(id: string, f: InputFrame) {
    const q = this.queues.get(id);
    const p = this.state.players.get(id);
    if (!q || !p || f.seq <= p.ackSeq) return;
    q.push(f);
    if (q.length > 6) q.splice(0, q.length - 6);
  }

  step(): GameEvent[] {
    const w = this.state;
    const ev: GameEvent[] = [];
    w.tick++;
    w.phaseTicks++;
    for (const p of w.players.values()) {
      const f = this.queues.get(p.id)?.shift() ?? this.last.get(p.id);
      if (!f) continue;
      this.last.set(p.id, f);
      p.ackSeq = f.seq;
      stubMove(w, p, f);
      if (p.effects.invulnerable > 0) p.effects.invulnerable--;
      const prev = this.prevButtons.get(p.id) ?? 0;
      this.prevButtons.set(p.id, f.buttons);
      if (f.buttons & Button.Bomb && !(prev & Button.Bomb)) {
        const bx = Math.round(p.x), by = Math.round(p.y);
        const id = w.nextId++;
        w.bombs.set(id, {
          id, owner: p.id, kind: 0, x: bx, y: by, radius: p.radius, fuse: BOMB_FUSE, motion: 0, vx: 0, vy: 0,
          fromX: bx, fromY: by, toX: bx, toY: by, progress: 0, passers: [p.id], dud: false,
        });
        ev.push({ type: 'bombPlaced', bomb: id, x: bx, y: by, owner: p.id });
      }
    }
    for (const b of [...w.bombs.values()]) {
      if (--b.fuse > 0) continue;
      w.bombs.delete(b.id);
      const cells = [{ x: b.x, y: b.y, shape: FlameShape.Center }];
      for (const c of cells) {
        const id = w.nextId++;
        w.flames.set(id, { id, x: c.x, y: c.y, shape: c.shape, owner: b.owner, ttl: FLAME_TIME });
      }
      ev.push({ type: 'explosion', bomb: b.id, owner: b.owner, x: b.x, y: b.y, cells, power: b.radius });
    }
    for (const fl of [...w.flames.values()]) if (--fl.ttl <= 0) w.flames.delete(fl.id);
    return ev;
  }
}

export function stubBot(id: string): IBot {
  let seq = 0, t = 0;
  return {
    id,
    think: () => {
      t++;
      const a = Math.floor(t / 30) % 4;
      return { seq: ++seq, dx: a === 0 ? 1 : a === 2 ? -1 : 0, dy: a === 1 ? 1 : a === 3 ? -1 : 0, buttons: 0 };
    },
  };
}

export const stubGame: GameImpl = {
  createSimulation: (c) => new StubSim(c),
  createBot: (id) => stubBot(id),
};
