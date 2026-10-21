// Procedural audio engine: every SFX is synthesised (pre-rendered offline while the loader runs,
// or at unlock) and
// the music is generated live. No sample files. See contracts.ts for the interface.

import { DropKind, PickupType, Theme, type GameEvent, type WorldState } from '@ob/game';
import type { AudioEngine, CreateAudio, MusicMode, UiSound } from '../contracts';
import { buildGraph, duckMusic, type Graph } from './graph';
import { Ambience } from './ambient';
import { Music } from './music';
import { renderBank, SfxPlayer, type PlayOpts, type SfxBank, type SfxKey } from './sfx';
import { clamp, semis } from './synth';

const LOOKAHEAD = 0.15;   // s of music scheduled ahead
const WAKE_MS = 25;       // scheduler wake-up interval (timing comes from the audio clock)
/** Sample rate of the SFX bank when there is no AudioContext to ask (phones run at 48 kHz; any other
 *  rate just resamples on playback). */
const PREPARE_RATE = 48000;
/** Tiles walked per footstep. */
const STRIDE = 0.7;

/** Per-batch caps so a big chain doesn't trigger 40 identical sounds at once. */
const BATCH_CAP: Partial<Record<SfxKey, number>> = { brick: 4, spawn: 3, burn: 3, blockFall: 2, bounce: 3, land: 3, stop: 2, boom_s: 4, boom_m: 4, boom_l: 4, place: 4 };

function collectSound(kind: PickupType): SfxKey {
  switch (kind) {
    case PickupType.Skull: return 'collectSkull';
    case PickupType.Heart: return 'collectHeart';
    case PickupType.Shield: return 'collectShield';
    case PickupType.BombUp: case PickupType.FireUp: case PickupType.SpeedUp: case PickupType.FullFire: case PickupType.Random:
      return 'collect';
    default: return 'collectPower';
  }
}

class Engine implements AudioEngine {
  private ctx: AudioContext | null = null;
  private g: Graph | null = null;
  private player: SfxPlayer | null = null;
  private music: Music | null = null;
  private amb: Ambience | null = null;
  private bank: SfxBank = new Map();
  private bankJob: Promise<void> | null = null;
  private vol = { master: 0.9, sfx: 1, music: 0.7, ambient: 0.6 };
  private mode: MusicMode = 'off';
  private timer: ReturnType<typeof setInterval> | 0 = 0;
  private disposed = false;
  private hiddenSuspend = false;
  private lastTick = -10;
  private lastGo = -10;
  private readonly onGesture = () => this.resumeIfNeeded();
  private readonly onVisibility = () => this.visibility();

  constructor() {
    if (typeof document !== 'undefined') {
      for (const ev of ['touchend', 'pointerup', 'keydown', 'click'] as const) {
        document.addEventListener(ev, this.onGesture, { capture: true, passive: true });
      }
      document.addEventListener('visibilitychange', this.onVisibility);
    }
  }

  // ------------------------------------------------------------ lifecycle

  unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.timer) this.init();
      else this.resumeIfNeeded();
    } catch (e) {
      console.warn('[audio] unlock failed', e);
    }
  }

  /** The context and the mixer. Made ahead by prepare() (a context made before any gesture just
   *  stays suspended until unlock()), or at unlock. */
  private setup() {
    if (this.ctx) return this.ctx;
    const AC = typeof window !== 'undefined' ? window.AudioContext : undefined;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const g = buildGraph(ctx, ctx.destination);
    this.g = g;
    this.applyVolume(true);
    this.player = new SfxPlayer(ctx, this.bank, g.sfx, g.sfxWet);
    this.music = new Music(ctx, g.duck, g.musicWet, (Date.now() * 2654435761) >>> 0);
    this.amb = new Ambience(ctx, g.ambient);
    ctx.addEventListener('statechange', () => { if (ctx.state === 'running' && this.music) this.music.schedule(ctx.currentTime + LOOKAHEAD); });
    return ctx;
  }

  private init() {
    const ctx = this.setup();
    if (!ctx) return;
    // iOS: playing a (silent) buffer inside the gesture fully unlocks output
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    silent.connect(ctx.destination);
    silent.start();
    void ctx.resume().catch(() => {});
    void this.renderSfx(ctx.sampleRate);
    this.timer = setInterval(() => this.pump(), WAKE_MS);
    if (this.mode !== 'off') this.music?.setMode(this.mode);
  }

  /** Before the first gesture: the context and the mixer, and the SFX bank synthesised (offline
   *  contexts need no unlock), so unlock() only has to start the output. */
  prepare(): Promise<void> {
    let rate = PREPARE_RATE;
    try { rate = this.setup()?.sampleRate ?? rate; } catch (e) { console.warn('[audio] setup failed', e); }
    return this.renderSfx(rate);
  }

  private renderSfx(rate: number) {
    return (this.bankJob ??= renderBank(rate, this.bank, () => this.disposed).catch((e) => console.warn('[audio] render failed', e)));
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.music) return;
    try { this.music.schedule(ctx.currentTime + LOOKAHEAD); } catch (e) { console.warn('[audio] music', e); }
    try { this.amb?.tick(ctx.currentTime); } catch (e) { console.warn('[audio] ambience', e); }
    try { this.footsteps(); } catch (e) { console.warn('[audio] steps', e); }
  }

  private resumeIfNeeded() {
    const ctx = this.ctx;
    if (!ctx || this.disposed || (typeof document !== 'undefined' && document.hidden)) return;
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  }

  private visibility() {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    if (document.hidden) {
      if (ctx.state === 'running') { this.hiddenSuspend = true; void ctx.suspend().catch(() => {}); }
    } else if (this.hiddenSuspend) {
      this.hiddenSuspend = false;
      void ctx.resume().catch(() => {});
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
    if (typeof document !== 'undefined') {
      for (const ev of ['touchend', 'pointerup', 'keydown', 'click'] as const) {
        document.removeEventListener(ev, this.onGesture, { capture: true });
      }
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    try { this.music?.stop(); this.player?.stopAll(); this.amb?.stop(); } catch { /* ignore */ }
    const ctx = this.ctx;
    this.ctx = null;
    this.g = null;
    this.player = null;
    this.music = null;
    this.amb = null;
    if (ctx) void ctx.close().catch(() => {});
  }

  // ------------------------------------------------------------ volume & music

  setVolume(v: { master?: number; sfx?: number; music?: number; ambient?: number }): void {
    const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
    if (ok(v.master)) this.vol.master = clamp(v.master, 0, 1);
    if (ok(v.sfx)) this.vol.sfx = clamp(v.sfx, 0, 1);
    if (ok(v.music)) this.vol.music = clamp(v.music, 0, 1);
    if (ok(v.ambient)) this.vol.ambient = clamp(v.ambient, 0, 1);
    try { this.applyVolume(false); } catch { /* ignore */ }
  }

  private applyVolume(instant: boolean) {
    const g = this.g, ctx = this.ctx;
    if (!g || !ctx) return;
    const now = ctx.currentTime;
    const set = (p: AudioParam, v: number) => {
      const x = v * v; // perceptual-ish taper
      p.cancelScheduledValues(now);
      if (instant) p.setValueAtTime(x, now);
      else { p.setValueAtTime(p.value, now); p.setTargetAtTime(x, now, 0.05); }
    };
    set(g.master.gain, this.vol.master);
    set(g.sfx.gain, this.vol.sfx);
    set(g.sfxWet.gain, this.vol.sfx);
    set(g.music.gain, this.vol.music);
    set(g.musicWet.gain, this.vol.music);
    set(g.ambient.gain, this.vol.ambient);
  }

  setMusic(mode: MusicMode): void {
    this.mode = mode;
    if (!this.music || !this.ctx) return;
    try {
      this.music.setMode(mode);
      this.pump();
    } catch (e) { console.warn('[audio] setMusic', e); }
  }

  // ------------------------------------------------------------ sfx

  private get live(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !!this.player;
  }

  private play(key: SfxKey, o?: PlayOpts) {
    try { this.player?.play(key, o); } catch (e) { console.warn('[audio] play', key, e); }
  }

  private last: { world: WorldState | null; localId: string } = { world: null, localId: '' };

  /**
   * Teleport sounds from the renderer. beamOut: a frozen old-arena hero beams away (not
   * positional; `crowd` = how many beam out together, to keep the stack quiet). dropIn: a hero
   * drops in on a new map (positional, the local hero louder).
   */
  teleport(kind: 'beamOut' | 'dropIn', x: number, y: number, who: string, crowd = 1): void {
    if (!this.live) return;
    if (kind === 'beamOut') { this.play('beamOut', { gain: 0.8 / Math.sqrt(Math.max(1, crowd)) }); return; }
    const { world, localId } = this.last;
    const o = who && who === localId ? this.where(world, localId, x, y, who) : this.where(world, localId, x, y);
    if (who !== localId) o.gain = (o.gain ?? 1) * 0.6;
    this.play('dropIn', o);
  }

  /** Camera travel to a new map: a soft whoosh, panned towards where the camera heads. */
  travel(durationMs: number, pan: number): void {
    if (!this.live) return;
    this.play('travel', { pan: clamp(pan, -1, 1) * 0.45, rate: clamp(1200 / Math.max(300, durationMs), 0.7, 1.4) });
  }

  ui(sound: UiSound): void {
    if (!this.live) return;
    this.play(`ui_${sound}` as SfxKey);
  }

  /** Spatial placement relative to the local player. */
  private where(world: WorldState | null, localId: string, x?: number, y?: number, who?: string): PlayOpts {
    if (who && localId && who === localId) return { gain: 1.2, pan: 0, wet: 0.8 };
    if (world && who && (x === undefined || y === undefined)) {
      const p = world.players.get(who);
      if (p) { x = p.x; y = p.y; }
    }
    if (!world || x === undefined || y === undefined) return { gain: 1, pan: 0 };
    const me = localId ? world.players.get(localId) : undefined;
    const lx = me ? me.x : (world.width - 1) / 2;
    const ly = me ? me.y : (world.height - 1) / 2;
    const dx = x - lx, dy = y - ly;
    const d = Math.hypot(dx, dy);
    const range = me ? 7 : 11;
    const gain = 0.2 + 0.8 / (1 + (d / range) ** 2);
    return { gain: gain * (who ? 0.85 : 1), pan: clamp(dx / 9, -1, 1) * 0.85, wet: 1 + d / 10 };
  }

  private walked = new Map<string, { x: number; y: number; acc: number }>();

  /** A footstep every STRIDE tiles a hero walks; the ground's sound follows the round's theme. */
  private footsteps() {
    const { world, localId } = this.last;
    if (!world || !this.live) return;
    const key: SfxKey = world.theme === Theme.Winter ? 'stepSnow' : world.theme === Theme.Desert ? 'stepSand' : 'step';
    let n = 0;
    for (const p of world.players.values()) {
      let s = this.walked.get(p.id);
      if (!s) { this.walked.set(p.id, { x: p.x, y: p.y, acc: 0 }); continue; }
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      s.x = p.x; s.y = p.y;
      // dead, waiting, or a jump (teleport, respawn, new map): no steps
      if (!p.alive || !p.inRound || d > 1.5) { s.acc = 0; continue; }
      s.acc += d;
      if (s.acc < STRIDE) continue;
      s.acc = Math.min(s.acc - STRIDE, STRIDE * 0.5);
      if (n++ >= 4) continue;
      const o = this.where(world, localId, p.x, p.y);
      this.play(key, p.id === localId ? { gain: 1, pan: 0, wet: 0 } : { gain: (o.gain ?? 1) * 0.6, pan: o.pan, wet: 0 });
    }
    if (this.walked.size > world.players.size + 8) for (const id of this.walked.keys()) if (!world.players.has(id)) this.walked.delete(id);
  }

  /** Storm: thunder `delaySec` after a lightning flash. */
  thunder(delaySec: number, power: number): void {
    try { if (this.live) this.amb?.thunder(delaySec, power); } catch (e) { console.warn('[audio] thunder', e); }
  }

  handleEvents(events: GameEvent[], world: WorldState | null, localId: string): void {
    this.last = { world, localId };
    if (world && this.amb) this.amb.set(world.weather, world.theme);
    if (!this.live || !events || !events.length) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const count = new Map<SfxKey, number>();
    const fire = (key: SfxKey, o: PlayOpts) => {
      const n = count.get(key) ?? 0;
      const cap = BATCH_CAP[key];
      if (cap !== undefined && n >= cap) return;
      count.set(key, n + 1);
      // spread repeats inside one batch by a few ms so they don't phase
      this.play(key, { ...o, when: now + n * 0.012 });
    };
    const W = (x?: number, y?: number, who?: string) => this.where(world, localId, x, y, who);

    for (const e of events) {
      try {
        switch (e.type) {
          case 'bombPlaced': fire('place', W(e.x, e.y, e.owner)); break;
          case 'bombKicked': fire('kick', W(undefined, undefined, e.by)); break;
          case 'bombGrabbed': fire('grab', W(undefined, undefined, e.by)); break;
          case 'bombThrown': fire('throw', W(undefined, undefined, e.by)); break;
          case 'bombPunched': fire('punch', W(undefined, undefined, e.by)); break;
          case 'bombBounced': fire('bounce', W(e.x, e.y)); break;
          case 'bombLanded': fire('land', W(e.x, e.y)); break;
          case 'bombStopped': fire('stop', W(e.x, e.y)); break;
          case 'bombFizzled': fire('fizzle', W(e.x, e.y)); break;
          case 'bombVanished': { const o = W(e.x, e.y); o.gain = (o.gain ?? 1) * 0.7; o.rate = 1.35; fire('fizzle', o); break; }
          case 'explosion': {
            const power = Math.max(e.power || 1, Math.sqrt(e.cells?.length ?? 1));
            const size = power >= 6 ? 2 : power >= 3 ? 1 : 0;
            const key: SfxKey = size === 2 ? 'boom_l' : size === 1 ? 'boom_m' : 'boom_s';
            const o = W(e.x, e.y);
            o.gain = (o.gain ?? 1) * (0.85 + 0.04 * Math.min(power, 6));
            fire(key, o);
            if (this.g) duckMusic(this.g, now, (0.25 + 0.15 * size) * Math.min(1, o.gain));
            break;
          }
          case 'brickDestroyed': fire('brick', W(e.x, e.y)); break;
          case 'pickupSpawned': fire('spawn', W(e.x, e.y)); break;
          case 'pickupBurned': fire('burn', W(e.x, e.y)); break;
          case 'pickupCollected': {
            const o = W(undefined, undefined, e.by);
            if (e.by !== localId) o.gain = (o.gain ?? 1) * 0.6;
            fire(collectSound(e.kind), o);
            break;
          }
          case 'shieldBlocked': fire('shieldBreak', W(undefined, undefined, e.player)); break;
          case 'playerStunned': fire('stun', W(undefined, undefined, e.player)); break;
          case 'playerDied': {
            const o = e.player === localId ? W(e.x, e.y, e.player) : W(e.x, e.y);
            if (e.cause === 'fire') {
              // burned alive: ignition + crackle first, the death jingle once the ghost rises (~1 s)
              fire('ignite', o);
              this.play('death', { ...o, when: now + 0.95, gain: (o.gain ?? 1) * 0.8 });
            } else fire('death', o);
            break;
          }
          case 'playerRespawned': fire('respawn', e.player === localId ? W(e.x, e.y, e.player) : W(e.x, e.y)); break;
          case 'curseApplied': fire('curse', W(undefined, undefined, e.player)); break;
          case 'effectEnded': {
            const o = W(undefined, undefined, e.player);
            if (e.player !== localId) o.gain = (o.gain ?? 1) * 0.5;
            fire('effectEnd', o);
            break;
          }
          case 'countdown':
            if (e.seconds > 0) { this.lastTick = now; fire('tick', { rate: e.seconds === 1 ? semis(2) : 1 }); }
            else { this.lastGo = now; fire('go', {}); }
            break;
          case 'roundStart':
            if (now - this.lastGo > 0.6) {
              if (now - this.lastTick < 1.6) { this.lastGo = now; fire('go', {}); }
              else fire('roundStart', {});
            }
            break;
          case 'suddenDeath': break; // the first zoneShrink already sounds the siren
          case 'zoneWarning': fire('ui_error', { gain: 0.9 }); break;
          case 'zoneCancel': fire('effectEnd', {}); break;
          case 'zoneShrink': fire('siren', {}); break;
          case 'skyRain': fire(e.kind === 'bombs' ? 'ui_error' : 'go', { gain: 0.8 }); break;
          case 'dropLanded': fire(e.kind === DropKind.Bomb ? 'land' : 'spawn', W(e.x, e.y)); break;
          case 'blockFell': {
            const o = W(e.x, e.y);
            fire('blockFall', o);
            if (this.g) duckMusic(this.g, now, 0.15 * Math.min(1, o.gain ?? 1));
            break;
          }
          case 'roundOver': {
            // a win / a loss only for someone who played the round; the rest hear it end
            const me = localId ? world?.players.get(localId) : undefined;
            fire(!me?.inRound ? 'roundEnd' : e.winner === localId ? 'victory' : 'defeat', {});
            break;
          }
        }
      } catch (err) {
        console.warn('[audio] event', e.type, err);
      }
    }
  }
}

export const createAudio: CreateAudio = () => new Engine();
export type { SfxKey } from './sfx';
