// Generative chiptune / synthwave music. A step sequencer driven by the AudioContext
// clock: the caller wakes `schedule(until)` from a timer and it schedules every 16th
// note whose time falls before `until` (look-ahead scheduling, no timer drift).
// Everything stays in A minor so mode switches (on the next bar) never clash.

import type { MusicMode } from '../contracts';
import { Kit, mtof, mulberry32, type Ctx, type Rng } from './synth';

type Section = 'menu' | 'waiting' | 'battle' | 'sudden' | 'calm';
type DrumStyle = 'none' | 'soft' | 'groove' | 'drive' | 'tense';
type BassStyle = 'long' | 'synco' | 'drive' | 'pulse';

interface Style {
  bpm: number;
  swing: number;          // fraction of a 16th that odd steps are delayed
  barsPerChord: 1 | 2;
  drums: DrumStyle;
  bass: BassStyle;
  arp: 0 | 1 | 2 | 4;     // steps per arp note (0 = off)
  pad: boolean;
  lead: boolean;
  arpLp: number;
  level: number;
  pool: number[][];       // chord progressions (scale degrees)
}

const STYLES: Record<Section, Style> = {
  menu: { bpm: 92, swing: 0.12, barsPerChord: 2, drums: 'soft', bass: 'long', arp: 2, pad: true, lead: false, arpLp: 2200, level: 0.9,
    pool: [[0, 5, 2, 6], [5, 6, 0, 0], [3, 0, 5, 6], [0, 3, 6, 2], [5, 3, 0, 6]] },
  waiting: { bpm: 112, swing: 0.16, barsPerChord: 1, drums: 'groove', bass: 'synco', arp: 2, pad: true, lead: false, arpLp: 2800, level: 0.9,
    pool: [[0, 6, 5, 6], [0, 3, 6, 0], [5, 3, 0, 6], [0, 2, 3, 4], [0, 5, 3, 4]] },
  battle: { bpm: 140, swing: 0, barsPerChord: 1, drums: 'drive', bass: 'drive', arp: 1, pad: false, lead: true, arpLp: 3200, level: 1,
    pool: [[0, 5, 6, 0], [0, 3, 5, 6], [0, 6, 5, 4], [0, 0, 5, 6], [0, 3, 0, 4], [5, 6, 0, 0]] },
  sudden: { bpm: 158, swing: 0, barsPerChord: 1, drums: 'tense', bass: 'pulse', arp: 1, pad: false, lead: true, arpLp: 1600, level: 1,
    pool: [[0, 5, 0, 6], [0, 6, 5, 6], [0, 0, 5, 5], [0, 3, 4, 0]] },
  calm: { bpm: 80, swing: 0.1, barsPerChord: 2, drums: 'none', bass: 'long', arp: 4, pad: true, lead: false, arpLp: 1800, level: 0.75,
    pool: [[0, 3, 0, 5], [3, 0, 4, 0], [0, 5, 3, 6]] },
};
const CALM_BRIGHT = [[2, 5, 6, 2], [5, 2, 6, 2]];

const DRUMS: Record<Exclude<DrumStyle, 'none'>, { k: string[]; s: string[]; h: string[] }> = {
  soft: { k: ['x.........x.....', 'x.......x.......'], s: ['....o.......o...', '........o.......'], h: ['..o...o...o...o.', 'o.o.o.o.o.o.o.o.'] },
  groove: { k: ['x.....x...x.....', 'x..x......x..x..', 'x.....x.x.......'], s: ['....x.......x...', '....x.......x..o'], h: ['o.o.o.o.o.o.o.o.', 'o.x.o.x.o.x.o.x.', 'oooxoooxoooxooox'] },
  drive: { k: ['x...x...x...x...', 'x...x...x...x.x.', 'x...x..xx...x...'], s: ['....x.......x...', '....x.......x..o'], h: ['oxoxoxoxoxoxoxox', '.x.x.x.x.x.x.x.x', 'ooxooxoxooxooxox'] },
  tense: { k: ['x...x...x...x...', 'x...x...x.x.x...', 'x.x.x...x...x.xx'], s: ['....x.......x...', '....x..o....x...'], h: ['xoxoxoxoxoxoxoxo', 'xxxxxxxxxxxxxxxx'] },
};

const ROOT = 45;                           // A2
const SCALE = [0, 2, 3, 5, 7, 8, 10];      // natural minor
const deg = (d: number) => SCALE[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
const vel = (c: string) => (c === 'x' ? 1 : c === 'o' ? 0.5 : 0);

interface MotifNote { s: number; off: number; len: number }
interface Phrase {
  prog: number[];
  arpPat: 'up' | 'down' | 'updown' | 'random' | 'skip';
  arpOct: number;
  arpOn: boolean;
  leadOn: boolean;
  breakdown: boolean;
  fill: boolean;
  openHat: boolean;
  k: string; s: string; h: string;
  motif: MotifNote[][];
  bright: boolean;
}

export class Music {
  private bus: GainNode;
  private tone: BiquadFilterNode;
  private echo: GainNode;              // arp / lead send into the tempo delay
  private delay: DelayNode;
  private rng: Rng;
  private running = false;
  private stopAt = 0;
  private requested: MusicMode = 'off';
  private pending: MusicMode | null = null;
  private section: Section = 'menu';
  private style: Style = STYLES.menu;
  private bright = false;
  private nextTime = 0;
  private jump = 0;
  private step = 0;
  private barInPhrase = 0;
  private barsInSection = 0;
  private phraseCount = 0;
  private phrase!: Phrase;
  private chordDeg = 0;
  private nextChordDeg = 0;
  private stepDur = 60 / 92 / 4;
  private lastProg = -1;

  constructor(private ctx: Ctx, out: AudioNode, reverb: AudioNode, seed: number) {
    this.rng = mulberry32(seed);
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 18000;
    this.tone.Q.value = 0.9;
    const level = ctx.createGain();
    level.gain.value = 0.5;
    this.bus.connect(this.tone).connect(level).connect(out);
    const rs = ctx.createGain();
    rs.gain.value = 0.22;
    level.connect(rs).connect(reverb);
    // tempo-synced feedback delay with a darkening loop
    this.echo = ctx.createGain();
    this.echo.gain.value = 0.28;
    this.delay = ctx.createDelay(2);
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 2500;
    this.echo.connect(this.delay).connect(dl).connect(fb).connect(this.delay);
    dl.connect(this.bus);
  }

  get mode(): MusicMode { return this.requested; }
  get isRunning() { return this.running; }

  setMode(mode: MusicMode): void {
    const now = this.ctx.currentTime;
    if (mode === this.requested && !(this.stopAt && mode !== 'off')) return;
    this.requested = mode;
    if (mode === 'off') {
      this.pending = null;
      if (this.running) {
        const g = this.bus.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.setTargetAtTime(0, now, 0.25);
        this.stopAt = now + 1.2;
      }
      return;
    }
    if (!this.running || this.stopAt) {
      // (re)start right away
      this.running = true;
      this.stopAt = 0;
      const t = now + 0.06;
      this.step = 0;
      this.nextTime = t;
      this.pending = null;
      this.enter(mode, t);
      if (this.jump) { this.nextTime = this.jump; this.jump = 0; }
      return;
    }
    this.pending = mode;
  }

  /** Schedule all steps before `until` (absolute context time). */
  schedule(until: number): void {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    if (this.stopAt && now >= this.stopAt) { this.running = false; this.stopAt = 0; return; }
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.03; // stalled (throttled tab): skip ahead
    let guard = 0;
    while (this.nextTime < until && guard++ < 256) {
      if (this.stopAt && this.nextTime >= this.stopAt) break;
      this.doStep(this.nextTime);
      if (this.jump) { this.nextTime = this.jump; this.jump = 0; }
      else this.nextTime += this.stepDur;
    }
  }

  stop(): void {
    this.running = false;
    this.requested = 'off';
    try { this.bus.gain.cancelScheduledValues(0); this.bus.gain.value = 0; } catch { /* closed */ }
  }

  // ------------------------------------------------------------ structure

  private enter(mode: MusicMode, t: number) {
    this.pending = null;
    if (mode === 'victory' || mode === 'defeat') { this.sting(mode, t); return; }
    if (mode === 'off') return;
    this.setSection(mode, t, false);
  }

  private setSection(sec: Section, t: number, bright: boolean) {
    this.section = sec;
    this.style = STYLES[sec];
    this.bright = bright;
    this.stepDur = 60 / this.style.bpm / 4;
    this.step = 0;
    this.barInPhrase = 0;
    this.barsInSection = 0;
    this.lastProg = -1;
    this.phrase = this.newPhrase();
    this.delay.delayTime.setValueAtTime(this.stepDur * 3, t);
    const g = this.bus.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(this.style.level, t, 0.08);
    const f = this.tone.frequency;
    f.cancelScheduledValues(t);
    if (sec === 'sudden') {
      // tension: the whole mix opens up over ~24 bars
      f.setTargetAtTime(1500, t, 0.1);
      f.setValueAtTime(1500, t + 0.4);
      f.exponentialRampToValueAtTime(16000, t + 0.4 + this.stepDur * 16 * 24);
    } else {
      f.setTargetAtTime(sec === 'calm' ? 5000 : 16000, t, 0.4);
    }
  }

  private pick<T>(a: T[]): T { return a[Math.floor(this.rng() * a.length)]; }

  private newPhrase(): Phrase {
    const st = this.style, r = this.rng;
    const pool = this.section === 'calm' && this.bright ? CALM_BRIGHT : st.pool;
    let pi = Math.floor(r() * pool.length);
    if (pool.length > 1 && pi === this.lastProg) pi = (pi + 1) % pool.length;
    this.lastProg = pi;
    const leadOn = st.lead && (this.phraseCount % 2 === 1 || r() < 0.35);
    const dr = st.drums === 'none' ? null : DRUMS[st.drums];
    const p: Phrase = {
      prog: pool[pi],
      arpPat: this.pick(['up', 'down', 'updown', 'random', 'skip'] as const),
      arpOct: r() < 0.3 ? 12 : 0,
      arpOn: st.arp > 0 && (!leadOn || r() < 0.55),
      leadOn,
      breakdown: this.section === 'battle' && this.phraseCount > 0 && this.phraseCount % 4 === 3 && r() < 0.75,
      fill: r() < 0.75,
      openHat: r() < 0.5,
      k: dr ? this.pick(dr.k) : '',
      s: dr ? this.pick(dr.s) : '',
      h: dr ? this.pick(dr.h) : '',
      motif: [this.genMotifBar(false), this.genMotifBar(true)],
      bright: this.bright,
    };
    this.phraseCount++;
    return p;
  }

  private genMotifBar(cadence: boolean): MotifNote[] {
    const r = this.rng;
    const out: MotifNote[] = [];
    let cur = this.pick([0, 2, 4, 7]);
    for (let s = 0; s < 16; s++) {
      const prob = s % 4 === 0 ? 0.72 : s % 2 === 0 ? 0.42 : 0.16;
      if (r() < prob) {
        out.push({ s, off: cur, len: 1 });
        cur += this.pick([-2, -1, -1, 1, 1, 2, 0, 3, -3]);
        cur = Math.max(-2, Math.min(9, cur));
      }
    }
    if (!out.length) out.push({ s: 0, off: 0, len: 4 });
    for (let i = 0; i < out.length; i++) {
      const next = i + 1 < out.length ? out[i + 1].s : 16;
      out[i].len = Math.max(1, Math.min(4, next - out[i].s));
    }
    if (cadence) { const l = out[out.length - 1]; l.off = this.pick([0, 4, 7]); }
    return out;
  }

  private chordAt(barInPhrase: number): number {
    const p = this.phrase.prog;
    return p[Math.floor(barInPhrase / this.style.barsPerChord) % p.length];
  }

  // ------------------------------------------------------------ sequencing

  private doStep(t: number) {
    const sting = this.pending === 'victory' || this.pending === 'defeat';
    if (this.pending && ((sting && this.step % 4 === 0) || (!sting && this.step === 0))) {
      this.enter(this.pending, t);
      if (this.jump) return;
    }
    if (this.step === 0) this.startBar(t);
    const st = this.style;
    const swing = this.step % 2 ? st.swing * this.stepDur : 0;
    this.playStep(t + swing, this.step);
    this.step++;
    if (this.step >= 16) {
      this.step = 0;
      this.barInPhrase++;
      this.barsInSection++;
      if (this.barInPhrase >= 8) { this.barInPhrase = 0; this.phrase = this.newPhrase(); }
    }
  }

  private startBar(t: number) {
    const st = this.style, ph = this.phrase;
    const b = this.barInPhrase;
    this.chordDeg = this.chordAt(b);
    this.nextChordDeg = this.chordAt((b + 1) % 8);
    const barDur = this.stepDur * 16;
    if (st.pad && b % st.barsPerChord === 0) this.pad(t, this.chordDeg, barDur * st.barsPerChord);
    const hot = this.section === 'battle' || this.section === 'sudden';
    if (hot && b === 0 && this.barsInSection > 0) this.crash(t);
    if (this.section === 'sudden' && b === 7) this.riser(t, barDur);
    if (ph.breakdown && b === 3) this.riser(t, barDur);
  }

  private playStep(t: number, s: number) {
    const st = this.style, ph = this.phrase, r = this.rng;
    const b = this.barInPhrase;
    const breakdown = ph.breakdown && b < 4;
    // ---- drums
    if (st.drums !== 'none') {
      const fill = ph.fill && b === 7 && st.drums !== 'soft';
      if (!breakdown) { const kv = vel(ph.k[s]); if (kv) this.kick(t, kv); }
      if (fill && s >= 12) this.snare(t, 0.35 + (s - 12) * 0.2);
      else if (!breakdown || s % 8 === 4) { const sv = vel(ph.s[s]); if (sv) this.snare(t, sv); }
      const hv = vel(ph.h[s]);
      if (hv) {
        const open = ph.openHat && s === 14 && st.drums !== 'soft';
        this.hat(t, hv * (0.85 + r() * 0.3), open);
      } else if (st.drums === 'groove' && r() < 0.08) this.hat(t, 0.3, false);
    }
    // ---- bass
    const root = ROOT + deg(this.chordDeg) - (deg(this.chordDeg) > 7 ? 12 : 0);
    const sd = this.stepDur;
    if (!breakdown) {
      switch (st.bass) {
        case 'long':
          if (s === 0 && b % st.barsPerChord === 0) this.bass(t, root, sd * 14, 0.8, 500);
          else if (s === 10 && r() < 0.5) this.bass(t, root + (r() < 0.5 ? 7 : 12), sd * 5, 0.55, 500);
          break;
        case 'synco':
          if ([0, 3, 6, 8, 11, 14].includes(s) && (s === 0 || r() < 0.85)) {
            const n = s === 0 ? root : root + this.pick([0, 0, 12, 7, 10]);
            this.bass(t, n, sd * 1.8, s === 0 ? 1 : 0.75, 900);
          }
          break;
        case 'drive':
          if (s % 2 === 0) {
            let n = root;
            if ((s === 6 || s === 14) && r() < 0.5) n = root + 12;
            if (s === 14 && this.nextChordDeg !== this.chordDeg && r() < 0.35) n = root + 7;
            this.bass(t, n, sd * 1.7, s % 4 === 0 ? 1 : 0.8, 1100);
          }
          break;
        case 'pulse':
          this.bass(t, s % 8 === 6 ? root + 12 : root, sd * 0.9, s % 4 === 0 ? 1 : 0.6, 900 + Math.min(1500, this.barsInSection * 60));
          break;
      }
    }
    const brightness = this.section === 'sudden' ? Math.min(3, 1 + this.barsInSection * 0.08) : 1;
    // ---- arp
    if (st.arp && ph.arpOn && s % st.arp === 0 && r() > 0.06) {
      const tones = [0, 2, 4, 6].map((i) => deg(this.chordDeg + i));
      const notes = [...tones, tones[0] + 12, tones[1] + 12];
      const i = Math.floor((b * 16 + s) / st.arp);
      const n = notes.length;
      let idx: number;
      switch (ph.arpPat) {
        case 'up': idx = i % n; break;
        case 'down': idx = n - 1 - (i % n); break;
        case 'updown': { const c = i % (2 * n - 2); idx = c < n ? c : 2 * n - 2 - c; break; }
        case 'skip': idx = (i * 2) % n; break;
        default: idx = Math.floor(r() * n);
      }
      const m = ROOT + 12 + ph.arpOct + notes[idx] + (deg(this.chordDeg) > 7 ? -12 : 0);
      this.arp(t, m, sd * st.arp, s % 4 === 0 ? 1 : 0.7, st.arpLp * brightness);
    }
    // ---- lead
    if (st.lead && ph.leadOn) {
      const motif = ph.motif[b % 2];
      const note = motif.find((x) => x.s === s);
      if (note) {
        let off = note.off;
        if (b >= 4 && r() < 0.22) off += r() < 0.5 ? -1 : 1;
        if (s % 4 === 0) off = this.snap(off);
        const len = b === 7 && note === motif[motif.length - 1] ? 16 - s : note.len;
        this.lead(t, ROOT + 24 + deg(off), sd * len, 2400 * brightness);
      }
    }
    // ---- sudden death: dissonant high pulse in the last two bars of each phrase
    if (this.section === 'sudden' && b >= 6 && s % 2 === 0) {
      this.arp(t, ROOT + 36 + (s % 4 === 0 ? 0 : 1), sd * 0.8, 0.5, 2500 * brightness);
    }
  }

  /** Snap a scale degree to the nearest tone of the current chord. */
  private snap(off: number): number {
    const tones = [0, 2, 4].map((i) => (((this.chordDeg + i) % 7) + 7) % 7);
    let best = off, bd = 99;
    for (let o = off - 3; o <= off + 3; o++) {
      if (tones.includes(((o % 7) + 7) % 7) && Math.abs(o - off) < bd) { best = o; bd = Math.abs(o - off); }
    }
    return best;
  }

  // ------------------------------------------------------------ stings

  private sting(mode: 'victory' | 'defeat', t: number) {
    // fade what's playing, leave room for the SFX sting, then a short cadence, then calm
    const g = this.bus.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, 0.07);
    const t0 = t + 1.0;
    g.setTargetAtTime(0.9, t0 - 0.05, 0.02);
    this.tone.frequency.cancelScheduledValues(t);
    this.tone.frequency.setTargetAtTime(mode === 'victory' ? 14000 : 3500, t, 0.2);
    const win = mode === 'victory';
    const beat = 60 / (win ? 132 : 100);
    // victory: F - G - A major (bVI bVII I); defeat: Dm - E - Am
    const chords = win
      ? [[53, 57, 60], [55, 59, 62], [57, 61, 64]]
      : [[50, 53, 57], [52, 56, 59], [45, 48, 52]];
    const melody = win
      ? [[69, 0, 1], [72, 1, 1], [71, 2, 1], [74, 3, 1], [73, 4, 1], [76, 5, 1], [81, 6, 2]]
      : [[77, 0, 1], [76, 1, 1], [74, 2, 1], [72, 3, 1], [71, 4, 1], [69, 5, 3]];
    const lens = [2, 2, 4];
    let at = 0;
    chords.forEach((ch, i) => {
      const tt = t0 + at * beat;
      const dur = lens[i] * beat;
      const k = new Kit(this.ctx, this.bus, tt, this.rng);
      for (const m of ch) for (const det of [-9, 9]) {
        k.tone({ type: win ? 'square' : 'sawtooth', f: mtof(m + 12), detune: det, a: 0.02, hold: dur * 0.6, d: dur * 0.6, peak: 0.035, lp: win ? 3000 : 1300 });
      }
      this.bass(tt, ch[0] - 12, dur * 0.9, 0.9, 700);
      this.kick(tt, 0.8);
      at += lens[i];
    });
    for (const [m, b, l] of melody) this.lead(t0 + b * beat, m, l * beat, win ? 3200 : 1500);
    if (win) this.crash(t0 + 4 * beat);
    const end = t0 + 8 * beat;
    this.setSection('calm', end, win);
    this.jump = end;
  }

  // ------------------------------------------------------------ instruments

  private kit(t: number, out: AudioNode = this.bus) { return new Kit(this.ctx, out, t, this.rng); }

  private kick(t: number, v: number) {
    const k = this.kit(t);
    k.tone({ type: 'sine', f: 165, to: 42, glide: 0.11, a: 0.002, hold: 0.02, d: 0.3, peak: 0.8 * v });
    k.noise({ type: 'lowpass', f: 2500, a: 0.0005, d: 0.01, peak: 0.2 * v });
  }

  private snare(t: number, v: number) {
    const k = this.kit(t);
    k.noise({ type: 'bandpass', f: 1900, q: 0.9, a: 0.001, d: 0.14, peak: 0.42 * v });
    k.tone({ type: 'triangle', f: 210, to: 160, glide: 0.05, a: 0.001, d: 0.07, peak: 0.3 * v });
  }

  private hat(t: number, v: number, open: boolean) {
    this.kit(t).noise({ type: 'highpass', f: 7500, a: 0.0005, d: open ? 0.18 : 0.035, peak: 0.13 * v });
  }

  private bass(t: number, m: number, dur: number, v: number, cutoff: number) {
    const k = this.kit(t);
    k.tone({ type: 'sawtooth', f: mtof(m), a: 0.004, hold: dur * 0.45, d: dur * 0.55, peak: 0.2 * v, lp: cutoff * 2.2, lpTo: cutoff, lpTime: 0.12, q: 3 });
    k.tone({ type: 'sine', f: mtof(m), a: 0.004, hold: dur * 0.5, d: dur * 0.5, peak: 0.22 * v });
  }

  private arp(t: number, m: number, dur: number, v: number, lp: number) {
    const out = this.ctx.createGain();
    out.connect(this.bus);
    out.connect(this.echo);
    this.kit(t, out).tone({ type: 'square', f: mtof(m), a: 0.002, hold: dur * 0.25, d: dur * 0.8, peak: 0.075 * v, lp: Math.min(16000, lp), q: 1.2 });
  }

  private lead(t: number, m: number, dur: number, lp: number) {
    const out = this.ctx.createGain();
    out.connect(this.bus);
    out.connect(this.echo);
    const k = this.kit(t, out);
    for (const det of [-7, 7]) {
      k.tone({ type: 'sawtooth', f: mtof(m), detune: det, a: 0.01, hold: Math.max(0, dur * 0.7 - 0.01), d: 0.18, peak: 0.055, lp: Math.min(16000, lp), q: 1.5, vib: { rate: 5.5, depth: 14, delay: 0.18 } });
    }
  }

  private pad(t: number, chordDeg: number, dur: number) {
    const k = this.kit(t);
    const base = ROOT + 12 + (deg(chordDeg) > 7 ? -12 : 0);
    for (const i of [0, 2, 4, 6]) {
      const m = base + deg(chordDeg + i);
      for (const det of [-10, 10]) {
        k.tone({ type: 'sawtooth', f: mtof(m), detune: det, a: Math.min(0.6, dur * 0.3), hold: Math.max(0, dur * 0.7 - 0.6), d: dur * 0.5, peak: 0.022, lp: 1100, lpTo: 700 });
      }
    }
  }

  private crash(t: number) {
    this.kit(t).noise({ type: 'highpass', f: 5000, a: 0.002, d: 1.2, peak: 0.1 });
  }

  private riser(t: number, dur: number) {
    this.kit(t).noise({ color: 'pink', type: 'bandpass', f: 400, to: 6000, sweep: dur, q: 2, a: dur * 0.9, d: 0.1, peak: 0.16 });
  }
}
