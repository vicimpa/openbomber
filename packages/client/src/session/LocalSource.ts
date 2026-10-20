// Offline GameSource: runs the authoritative Simulation in the browser with bots.
// Used for «Против ботов» and as the live attract-mode world behind the menu.

import {
  Bot, Simulation, TICK_MS,
  type BotDifficulty, type GameEvent, type InputFrame, type PlayerState, type WorldState,
} from '@ob/game';
import type { GameSource } from '../contracts';

const LOCAL_ID = 'local';
const BOT_NAMES = ['Бабах', 'Фитиль', 'Сапёр', 'Искра', 'Пороховой', 'Динамит', 'Шашка', 'Хлопушка', 'Петарда', 'Запал', 'Тротил'];
const MAX_CATCHUP = 8; // ticks per frame after a long stall (tab switch)

export interface LocalSourceOptions {
  bots: number;
  difficulty?: BotDifficulty;
  /** Join the arena right away as the local player. */
  play?: boolean;
  name?: string;
  skin?: number;
  seed?: number;
}

export class LocalSource implements GameSource {
  readonly sim: Simulation;
  readonly ping = 0;
  private bots: Bot[] = [];
  private events: GameEvent[] = [];
  private acc = 0;
  private seq = 0;
  private playing = false;
  private profile: { name: string; skin: number };

  constructor(opts: LocalSourceOptions) {
    this.sim = new Simulation({ seed: opts.seed ?? (Math.random() * 0x7fffffff) | 0 });
    this.profile = { name: opts.name ?? 'Игрок', skin: opts.skin ?? 0 };
    const difficulty = opts.difficulty ?? 'normal';
    for (let i = 0; i < opts.bots; i++) {
      const id = `bot${i}`;
      this.sim.addPlayer({ id, name: BOT_NAMES[i % BOT_NAMES.length], skin: (i * 3 + 1) % 11, isBot: true });
      this.bots.push(new Bot(id, difficulty));
    }
    if (opts.play) this.play(true);
  }

  get world(): WorldState { return this.sim.state; }
  get localId(): string { return this.playing ? LOCAL_ID : ''; }
  get isPlaying(): boolean { return this.playing; }

  get players(): PlayerState[] {
    return [...this.sim.state.players.values()];
  }

  play(enabled: boolean): Promise<boolean> {
    if (enabled && !this.playing) {
      this.sim.addPlayer({ id: LOCAL_ID, name: this.profile.name, skin: this.profile.skin });
      this.playing = true;
    } else if (!enabled && this.playing) {
      this.sim.removePlayer(LOCAL_ID);
      this.playing = false;
    }
    return Promise.resolve(this.playing);
  }

  setProfile(p: { name?: string; skin?: number }) {
    Object.assign(this.profile, p);
    if (this.playing) this.sim.updateProfile(LOCAL_ID, p);
  }

  update(dtMs: number, input: Omit<InputFrame, 'seq'>): void {
    this.acc = Math.min(this.acc + dtMs, TICK_MS * MAX_CATCHUP);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      const world = this.sim.state;
      for (const bot of this.bots) {
        if (world.players.has(bot.id)) this.sim.pushInput(bot.id, bot.think(world));
      }
      if (this.playing) this.sim.pushInput(LOCAL_ID, { ...input, seq: ++this.seq });
      const evs = this.sim.step();
      for (let i = 0; i < evs.length; i++) this.events.push(evs[i]);
    }
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  dispose(): void {
    this.events = [];
    this.bots = [];
  }
}
