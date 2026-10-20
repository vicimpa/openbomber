// Small WebAudio synth toolkit. Everything works on any BaseAudioContext, so the same
// code renders SFX offline (OfflineAudioContext) and plays music live (AudioContext).

export type Ctx = BaseAudioContext;
export type Rng = () => number;

export const EPS = 0.0001;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const semis = (st: number) => Math.pow(2, st / 12);

// ---------------------------------------------------------------- noise

export type NoiseColor = 'white' | 'pink' | 'brown';
const noiseCache = new WeakMap<Ctx, Partial<Record<NoiseColor, AudioBuffer>>>();

/** 2 s mono noise loop per context and colour (cached). */
export function noiseBuffer(ctx: Ctx, color: NoiseColor = 'white'): AudioBuffer {
  let m = noiseCache.get(ctx);
  if (!m) { m = {}; noiseCache.set(ctx, m); }
  const hit = m[color];
  if (hit) return hit;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = mulberry32(color === 'white' ? 11 : color === 'pink' ? 22 : 33);
  let b0 = 0, b1 = 0, b2 = 0, last = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
    let v = w;
    if (color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      v = b0 + b1 + b2 + w * 0.1848;
    } else if (color === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      v = last;
    }
    d[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
  m[color] = buf;
  return buf;
}

// ---------------------------------------------------------------- envelopes

/** 0 -> peak (attack) -> hold -> exponential decay to silence. Returns end time. */
export function envelope(p: AudioParam, t: number, peak: number, a: number, hold: number, d: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) p.setValueAtTime(peak, t + a + hold);
  p.exponentialRampToValueAtTime(EPS, t + a + hold + d);
  p.setValueAtTime(0, t + a + hold + d + 0.001);
  return t + a + hold + d;
}

// ---------------------------------------------------------------- shapers

const curveCache = new Map<string, Float32Array<ArrayBuffer>>();

/** tanh drive curve (crunch). Output always within (-1, 1). */
export function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const key = 'd' + amount;
  const hit = curveCache.get(key);
  if (hit) return hit;
  const n = 2048;
  const c = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / norm * 0.95;
  }
  curveCache.set(key, c);
  return c;
}

/**
 * Safety soft clipper. Feed it the signal scaled by 0.5: input u in [-1, 1] stands for
 * x = 2u. Transparent below |x| = 0.75, saturates smoothly towards 0.98. Inputs beyond
 * the curve clamp to the end points, so the output can never exceed 0.98.
 */
export function softClipCurve(): Float32Array<ArrayBuffer> {
  const hit = curveCache.get('soft');
  if (hit) return hit;
  const n = 8192;
  const c = new Float32Array(n);
  const k = 0.75, room = 0.23;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;
    const ax = Math.abs(x);
    const y = ax < k ? ax : k + room * Math.tanh((ax - k) / room);
    c[i] = Math.sign(x) * y;
  }
  curveCache.set('soft', c);
  return c;
}

// ---------------------------------------------------------------- reverb

/** Stereo impulse response from decaying noise that darkens over time (warm room). */
export function makeImpulse(ctx: Ctx, seconds: number, decay: number, seed = 7): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const rnd = mulberry32(seed + ch * 101);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const w = rnd() * 2 - 1;
      const coef = 0.15 + 0.8 * t;           // one-pole lowpass closes as the tail decays
      lp += (w - lp) * (1 - coef);
      const pre = i < sr * 0.008 ? i / (sr * 0.008) : 1; // short pre-delay fade-in
      d[i] = lp * Math.pow(1 - t, decay) * pre * 0.6;
    }
  }
  return buf;
}

// ---------------------------------------------------------------- voices

export interface ToneOpts {
  type?: OscillatorType;
  f: number;
  /** glide target frequency, reached after `glide` seconds (exponential) */
  to?: number;
  glide?: number;
  /** explicit frequency points [offset seconds, Hz] (linear ramps) */
  fpts?: [number, number][];
  detune?: number;          // cents
  at?: number;              // offset from the kit's start time
  a?: number;
  hold?: number;
  d: number;
  peak?: number;
  vib?: { rate: number; depth: number; delay?: number };   // depth in cents
  lp?: number;
  lpTo?: number;
  lpTime?: number;
  q?: number;
  out?: AudioNode;
}

export interface NoiseOpts {
  color?: NoiseColor;
  type?: BiquadFilterType;
  f?: number;
  to?: number;
  sweep?: number;
  q?: number;
  at?: number;
  a?: number;
  hold?: number;
  d: number;
  peak?: number;
  out?: AudioNode;
}

/** A synth "kit" bound to a context, an output node, a start time and an RNG. */
export class Kit {
  constructor(public c: Ctx, public out: AudioNode, public t: number, public r: Rng) {}

  rand(a: number, b: number) { return a + (b - a) * this.r(); }

  tone(o: ToneOpts): OscillatorNode {
    const c = this.c;
    const t = this.t + (o.at ?? 0);
    const a = o.a ?? 0.005, hold = o.hold ?? 0;
    const osc = c.createOscillator();
    osc.type = o.type ?? 'sine';
    if (o.detune) osc.detune.value = o.detune;
    const fq = osc.frequency;
    fq.setValueAtTime(Math.max(1, o.f), t);
    if (o.fpts) for (const [dt, f] of o.fpts) fq.linearRampToValueAtTime(Math.max(1, f), t + dt);
    else if (o.to !== undefined) fq.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.glide ?? o.d));
    let lfo: OscillatorNode | null = null;
    if (o.vib) {
      lfo = c.createOscillator();
      lfo.frequency.value = o.vib.rate;
      const lg = c.createGain();
      const vd = o.vib.delay ?? 0;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(0, t + vd);
      lg.gain.linearRampToValueAtTime(o.vib.depth, t + vd + 0.08);
      lfo.connect(lg).connect(osc.detune);
    }
    const g = c.createGain();
    const end = envelope(g.gain, t, o.peak ?? 0.5, a, hold, o.d);
    let head: AudioNode = osc;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = o.q ?? 0.8;
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + (o.lpTime ?? a + hold + o.d));
      head.connect(f);
      head = f;
    }
    head.connect(g).connect(o.out ?? this.out);
    osc.start(t);
    osc.stop(end + 0.02);
    if (lfo) { lfo.start(t); lfo.stop(end + 0.02); }
    return osc;
  }

  noise(o: NoiseOpts): AudioBufferSourceNode {
    const c = this.c;
    const t = this.t + (o.at ?? 0);
    const a = o.a ?? 0.002, hold = o.hold ?? 0;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, o.color ?? 'white');
    src.loop = true;
    const g = c.createGain();
    const end = envelope(g.gain, t, o.peak ?? 0.5, a, hold, o.d);
    let head: AudioNode = src;
    if (o.type) {
      const f = c.createBiquadFilter();
      f.type = o.type;
      f.Q.value = o.q ?? 0.7;
      f.frequency.setValueAtTime(o.f ?? 1000, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.sweep ?? a + hold + o.d));
      head.connect(f);
      head = f;
    }
    head.connect(g).connect(o.out ?? this.out);
    src.start(t, this.r() * 1.5);
    src.stop(end + 0.02);
    return src;
  }

  /** Waveshaper crunch followed by a tame lowpass; returns the node to feed. */
  drive(amount: number, out: AudioNode = this.out, tame = 5000): AudioNode {
    const sh = this.c.createWaveShaper();
    sh.curve = driveCurve(amount);
    sh.oversample = '2x';
    const lp = this.c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = tame;
    sh.connect(lp).connect(out);
    return sh;
  }

  /** Inharmonic bell partials. */
  bell(f: number, at: number, d: number, peak: number) {
    [1, 2.76, 5.4, 8.93].forEach((p, i) =>
      this.tone({ type: 'sine', f: f * p, a: 0.001, d: d / (1 + i * 0.7), peak: peak / (1 + i * 1.3), at }));
  }
}
