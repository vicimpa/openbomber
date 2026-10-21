// Ambient sound of the round's weather, synthesised live like everything else: wind (filtered
// noise that gusts), rain (a hiss, heavier in a storm) with thunder after the lightning, birds on
// a clear day over grass, crickets at night. Quiet, on its own bus (the «Окружение» volume).

import { Theme, Weather } from '@ob/game';
import { clamp, mulberry32, noiseBuffer, type Rng } from './synth';

interface Bed { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode }

/** Target levels per weather: [wind, rain]. */
const LEVELS: Record<Weather, [number, number]> = {
  [Weather.Clear]: [0.05, 0], [Weather.Rain]: [0.07, 0.16], [Weather.Storm]: [0.16, 0.26],
  [Weather.Snow]: [0.08, 0], [Weather.Fog]: [0.04, 0], [Weather.Wind]: [0.24, 0], [Weather.Night]: [0.03, 0],
};

export class Ambience {
  private wind: Bed;
  private rain: Bed;
  private weather = Weather.Clear;
  private theme = Theme.Meadow;
  private nextGust = 0;
  private nextCall = 0;
  private rng: Rng;

  constructor(private ctx: AudioContext, private out: AudioNode) {
    this.rng = mulberry32((Date.now() * 2654435761) >>> 0);
    this.wind = this.bed('brown', 'bandpass', 420, 0.8);
    this.rain = this.bed('pink', 'highpass', 1600, 0.5);
  }

  private bed(color: 'pink' | 'brown', type: BiquadFilterType, freq: number, q: number): Bed {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, color);
    src.loop = true;
    src.loopStart = this.rng() * 1.5;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.out);
    src.start();
    return { src, filter, gain };
  }

  set(weather: Weather, theme: Theme) {
    if (weather === this.weather && theme === this.theme) return;
    this.weather = weather;
    this.theme = theme;
    const now = this.ctx.currentTime;
    const [, rain] = LEVELS[weather];
    this.rain.gain.gain.setTargetAtTime(rain, now, 1.2);
    this.nextGust = now;
  }

  /** Called often (the engine's scheduler): gusts and creature calls a little ahead of time. */
  tick(now: number) {
    const r = this.rng;
    if (now >= this.nextGust) {
      // a gust: level and pitch drift to a new spot over a second or two
      const [wind] = LEVELS[this.weather];
      const dur = 1.2 + r() * 2.5;
      const level = wind * (0.55 + r() * 0.9);
      this.wind.gain.gain.setTargetAtTime(level, now, dur / 3);
      this.wind.filter.frequency.setTargetAtTime(260 + r() * (this.weather === Weather.Wind || this.weather === Weather.Storm ? 900 : 400), now, dur / 2);
      this.nextGust = now + dur;
    }
    if (now >= this.nextCall) {
      const grass = this.theme !== Theme.Winter && this.theme !== Theme.Desert;
      if (this.weather === Weather.Night && this.theme !== Theme.Winter) {
        this.crickets(now + 0.05);
        this.nextCall = now + 0.9 + r() * 2.2;
      } else if (grass && (this.weather === Weather.Clear || this.weather === Weather.Wind)) {
        this.bird(now + 0.05);
        this.nextCall = now + 2.5 + r() * 6;
      } else this.nextCall = now + 2;
    }
  }

  /** Storm: thunder `delay` s from now, louder and closer with `power` 0..1. */
  thunder(delay: number, power: number) {
    const ctx = this.ctx, t = ctx.currentTime + Math.max(0, delay);
    const p = clamp(power, 0, 1);
    // the crack (only close strikes have one), then a long rolling rumble
    const crack = ctx.createBufferSource();
    crack.buffer = noiseBuffer(ctx, 'white');
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = 1800; hp.Q.value = 0.6;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, t);
    cg.gain.linearRampToValueAtTime(0.18 * p * p, t + 0.01);
    cg.gain.setTargetAtTime(0, t + 0.02, 0.06);
    crack.connect(hp).connect(cg).connect(this.out);
    crack.start(t); crack.stop(t + 0.6);
    const rumble = ctx.createBufferSource();
    rumble.buffer = noiseBuffer(ctx, 'brown');
    rumble.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 160 + 160 * p; lp.Q.value = 0.7;
    const rg = ctx.createGain();
    const len = 2.5 + 2.5 * p;
    rg.gain.setValueAtTime(0, t);
    rg.gain.linearRampToValueAtTime(0.5 * (0.4 + 0.6 * p), t + 0.15);
    // a few rolls
    for (let k = 1; k < 4; k++) rg.gain.setTargetAtTime(0.5 * (0.25 + 0.5 * this.rng()) * p, t + k * len / 5, 0.15);
    rg.gain.setTargetAtTime(0, t + len * 0.75, len / 6);
    rumble.connect(lp).connect(rg).connect(this.out);
    rumble.start(t); rumble.stop(t + len + 1);
  }

  /** A short song of 2..5 falling chirps somewhere to the side. */
  private bird(t: number) {
    const ctx = this.ctx, r = this.rng;
    const pan = ctx.createStereoPanner();
    pan.pan.value = r() * 1.6 - 0.8;
    pan.connect(this.out);
    const base = 2600 + r() * 2000, n = 2 + Math.floor(r() * 4), vol = 0.025 + r() * 0.025;
    for (let i = 0; i < n; i++) {
      const s = t + i * (0.09 + r() * 0.06);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (1.15 + r() * 0.2), s);
      o.frequency.exponentialRampToValueAtTime(base * (0.8 + r() * 0.1), s + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(vol, s + 0.008);
      g.gain.setTargetAtTime(0, s + 0.03, 0.02);
      o.connect(g).connect(pan);
      o.start(s); o.stop(s + 0.15);
    }
  }

  /** A train of quick cricket pulses. */
  private crickets(t: number) {
    const ctx = this.ctx, r = this.rng;
    const pan = ctx.createStereoPanner();
    pan.pan.value = r() * 1.6 - 0.8;
    pan.connect(this.out);
    const f = 4200 + r() * 900, n = 3 + Math.floor(r() * 4), vol = 0.012 + r() * 0.012;
    for (let i = 0; i < n; i++) {
      const s = t + i * 0.055;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(vol, s + 0.006);
      g.gain.setTargetAtTime(0, s + 0.018, 0.008);
      o.connect(g).connect(pan);
      o.start(s); o.stop(s + 0.06);
    }
  }

  stop() {
    try { this.wind.src.stop(); this.rain.src.stop(); } catch { /* ignore */ }
  }
}
