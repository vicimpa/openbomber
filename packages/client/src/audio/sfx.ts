// SFX recipes, offline pre-rendering into AudioBuffers, and a voice-limited player.

import { Kit, clamp, hashStr, mtof, mulberry32, semis, type Ctx } from './synth';

export interface Recipe {
  dur: number;        // render length (s); silence is trimmed afterwards
  level: number;      // playback gain of the peak-normalised buffer
  vary: number;       // random pitch variation, +- semitones
  reverb: number;     // reverb send
  variants?: number;  // distinct seeded renders
  group?: string;     // voice-limit group (defaults to the key)
  build(k: Kit): void;
}

function boom(s: number): Recipe {
  return {
    dur: 1.5 + s * 0.6, level: 0.72 + s * 0.1, vary: 1.2, reverb: 0.22 + s * 0.08, variants: 3, group: 'boom',
    build(k) {
      const r = k.r;
      // sub thump
      k.tone({ type: 'sine', f: 125 - s * 15, to: 34, glide: 0.3 + s * 0.15, a: 0.003, hold: 0.04, d: 0.55 + s * 0.35, peak: 1 });
      // crunchy body
      const dr = k.drive(2.2 + s * 0.8, k.out, 3500 + s * 500);
      k.noise({ color: 'brown', type: 'lowpass', f: 2600 + s * 900, to: 150, sweep: 0.45 + s * 0.3, q: 0.9, a: 0.004, hold: 0.03, d: 0.6 + s * 0.45, peak: 0.85, out: dr });
      // crack transient
      k.noise({ color: 'white', type: 'bandpass', f: 2400 + r() * 900, to: 700, sweep: 0.12, q: 0.8, a: 0.001, d: 0.08, peak: 0.55 });
      // rumble tail
      k.noise({ color: 'brown', type: 'lowpass', f: 360, q: 0.5, a: 0.05, hold: 0.08, d: 0.9 + s * 0.6, peak: 0.45 + s * 0.12, at: 0.02 });
      // debris crackle
      const n = 4 + s * 5;
      for (let i = 0; i < n; i++) {
        k.noise({ color: 'white', type: 'bandpass', f: 800 + r() * 3000, q: 3, a: 0.001, d: 0.02 + r() * 0.05, peak: 0.1 + r() * 0.12, at: 0.06 + r() * (0.4 + s * 0.3) });
      }
    },
  };
}

function arp(k: Kit, notes: number[], step: number, o: { type?: OscillatorType; d?: number; peak?: number; lp?: number; at?: number; sub?: boolean }) {
  notes.forEach((m, i) => {
    const at = (o.at ?? 0) + i * step;
    k.tone({ type: o.type ?? 'square', f: mtof(m), a: 0.002, hold: 0.02, d: o.d ?? 0.14, peak: o.peak ?? 0.3, lp: o.lp ?? 3800, at });
    if (o.sub) k.tone({ type: 'triangle', f: mtof(m - 12), a: 0.002, d: (o.d ?? 0.14) * 0.9, peak: 0.35, at });
  });
}

export const RECIPES = {
  // ------------------------------------------------------------ UI (rendered first)
  ui_hover: { dur: 0.08, level: 0.16, vary: 0.4, reverb: 0, build(k) { k.tone({ type: 'sine', f: 1900, a: 0.002, d: 0.035, peak: 0.6 }); } },
  ui_click: { dur: 0.12, level: 0.32, vary: 0.3, reverb: 0.04, build(k) {
    k.tone({ type: 'triangle', f: 1000, to: 620, glide: 0.04, a: 0.001, d: 0.05, peak: 0.7 });
    k.noise({ type: 'highpass', f: 3000, a: 0.0005, d: 0.008, peak: 0.25 });
  } },
  ui_back: { dur: 0.2, level: 0.3, vary: 0.2, reverb: 0.04, build(k) { k.tone({ type: 'triangle', f: 760, to: 380, glide: 0.08, a: 0.002, d: 0.09, peak: 0.7 }); } },
  ui_join: { dur: 0.45, level: 0.38, vary: 0, reverb: 0.15, build(k) { arp(k, [69, 76, 81], 0.07, { d: 0.16, peak: 0.35, lp: 3000, sub: true }); } },
  ui_chat: { dur: 0.25, level: 0.32, vary: 0.5, reverb: 0.1, build(k) {
    k.tone({ type: 'sine', f: 600, to: 1300, glide: 0.05, a: 0.002, d: 0.05, peak: 0.7 });
    k.tone({ type: 'sine', f: 800, to: 1700, glide: 0.05, a: 0.002, d: 0.06, peak: 0.55, at: 0.07 });
  } },
  ui_error: { dur: 0.4, level: 0.36, vary: 0, reverb: 0.05, build(k) {
    for (const at of [0, 0.14]) for (const f of [150, 158]) k.tone({ type: 'square', f, a: 0.003, hold: 0.07, d: 0.05, peak: 0.3, lp: 900, at });
  } },
  ui_tick: { dur: 0.06, level: 0.22, vary: 0.2, reverb: 0, build(k) {
    k.tone({ type: 'sine', f: 1500, a: 0.001, d: 0.02, peak: 0.6 });
    k.noise({ type: 'highpass', f: 4000, a: 0.0005, d: 0.006, peak: 0.3 });
  } },

  // ------------------------------------------------------------ bombs
  place: { dur: 0.3, level: 0.5, vary: 1.2, reverb: 0.08, build(k) {
    k.tone({ type: 'sine', f: 190, to: 62, glide: 0.09, a: 0.002, d: 0.16, peak: 1 });
    k.tone({ type: 'triangle', f: 520, to: 300, glide: 0.03, a: 0.001, d: 0.045, peak: 0.25, lp: 2500 });
    k.noise({ color: 'pink', type: 'lowpass', f: 1400, a: 0.001, d: 0.035, peak: 0.35 });
  } },
  boom_s: boom(0),
  boom_m: boom(1),
  boom_l: boom(2),
  fizzle: { dur: 0.9, level: 0.42, vary: 1, reverb: 0.12, build(k) {
    k.noise({ type: 'lowpass', f: 7000, to: 600, sweep: 0.6, a: 0.01, hold: 0.05, d: 0.6, peak: 0.45 });
    k.tone({ type: 'sine', f: 420, to: 90, glide: 0.4, a: 0.01, d: 0.35, peak: 0.35 });
    k.noise({ color: 'pink', type: 'bandpass', f: 900, q: 1, a: 0.002, d: 0.05, peak: 0.4 });
  } },
  kick: { dur: 0.35, level: 0.48, vary: 1.5, reverb: 0.08, build(k) {
    k.noise({ color: 'pink', type: 'lowpass', f: 3000, a: 0.001, d: 0.03, peak: 0.6 });
    k.tone({ type: 'sine', f: 220, to: 90, glide: 0.05, a: 0.001, d: 0.08, peak: 0.8 });
    k.noise({ type: 'bandpass', f: 700, to: 2200, sweep: 0.18, q: 1.5, a: 0.03, d: 0.15, peak: 0.3, at: 0.02 });
  } },
  grab: { dur: 0.2, level: 0.38, vary: 1, reverb: 0.05, build(k) {
    k.tone({ type: 'sine', f: 260, to: 520, glide: 0.06, a: 0.003, d: 0.1, peak: 0.8 });
    k.tone({ type: 'triangle', f: 520, to: 1040, glide: 0.06, a: 0.003, d: 0.07, peak: 0.2 });
  } },
  throw: { dur: 0.5, level: 0.42, vary: 1.5, reverb: 0.1, build(k) {
    k.noise({ color: 'pink', type: 'bandpass', f: 400, to: 2400, sweep: 0.22, q: 2.5, a: 0.12, d: 0.25, peak: 0.9 });
    k.tone({ type: 'sine', f: 300, to: 600, glide: 0.25, a: 0.05, d: 0.2, peak: 0.15 });
  } },
  punch: { dur: 0.35, level: 0.52, vary: 1.5, reverb: 0.1, build(k) {
    const dr = k.drive(3);
    k.noise({ color: 'pink', type: 'lowpass', f: 3500, to: 600, sweep: 0.06, a: 0.001, d: 0.07, peak: 0.7, out: dr });
    k.tone({ type: 'sine', f: 170, to: 55, glide: 0.1, a: 0.001, d: 0.14, peak: 0.9 });
    k.noise({ type: 'bandpass', f: 1300, q: 2, a: 0.001, d: 0.04, peak: 0.4 });
  } },
  bounce: { dur: 0.45, level: 0.42, vary: 2, reverb: 0.1, build(k) {
    k.tone({ type: 'triangle', f: 160, to: 420, glide: 0.08, a: 0.002, hold: 0.05, d: 0.28, peak: 0.8, vib: { rate: 16, depth: 60 } });
    k.tone({ type: 'sine', f: 110, to: 60, glide: 0.06, a: 0.001, d: 0.08, peak: 0.5 });
  } },
  land: { dur: 0.35, level: 0.48, vary: 1.5, reverb: 0.08, build(k) {
    k.tone({ type: 'sine', f: 130, to: 48, glide: 0.1, a: 0.002, d: 0.18, peak: 1 });
    k.noise({ color: 'pink', type: 'lowpass', f: 1000, a: 0.001, d: 0.06, peak: 0.5 });
  } },
  stop: { dur: 0.2, level: 0.28, vary: 1.5, reverb: 0.04, build(k) {
    k.tone({ type: 'triangle', f: 320, to: 200, glide: 0.04, a: 0.001, d: 0.06, peak: 0.6, lp: 2000 });
    k.noise({ color: 'pink', type: 'lowpass', f: 2000, a: 0.001, d: 0.025, peak: 0.4 });
  } },

  // ------------------------------------------------------------ world
  brick: { dur: 0.55, level: 0.45, vary: 1.5, reverb: 0.12, variants: 3, build(k) {
    k.tone({ type: 'sine', f: 150, to: 60, glide: 0.08, a: 0.002, d: 0.12, peak: 0.7 });
    k.noise({ color: 'pink', type: 'lowpass', f: 1800, to: 400, sweep: 0.2, a: 0.002, d: 0.2, peak: 0.5 });
    for (let i = 0; i < 8; i++) {
      const at = Math.pow(k.r(), 1.6) * 0.3;
      k.noise({ type: 'bandpass', f: 500 + k.r() * 2200, q: 4 + k.r() * 4, a: 0.001, d: 0.015 + k.r() * 0.04, peak: (0.5 - at) * (0.6 + k.r() * 0.6), at });
    }
  } },
  blockFall: { dur: 0.7, level: 0.55, vary: 1.5, reverb: 0.15, variants: 2, build(k) {
    k.tone({ type: 'sine', f: 95, to: 32, glide: 0.25, a: 0.002, hold: 0.02, d: 0.35, peak: 1 });
    const dr = k.drive(2);
    k.noise({ color: 'brown', type: 'lowpass', f: 1200, to: 200, sweep: 0.2, a: 0.002, d: 0.25, peak: 0.8, out: dr });
    k.noise({ type: 'bandpass', f: 1700 + k.r() * 400, q: 9, a: 0.001, d: 0.12, peak: 0.5 });
    k.bell(420 + k.r() * 80, 0, 0.18, 0.15);
  } },
  spawn: { dur: 0.3, level: 0.36, vary: 1, reverb: 0.15, build(k) {
    k.tone({ type: 'sine', f: 320, to: 980, glide: 0.06, a: 0.002, d: 0.12, peak: 0.9 });
    k.tone({ type: 'triangle', f: 1400, to: 1800, glide: 0.04, a: 0.001, d: 0.06, peak: 0.25, at: 0.05 });
  } },
  burn: { dur: 0.4, level: 0.32, vary: 1.5, reverb: 0.1, build(k) {
    k.noise({ type: 'highpass', f: 3000, to: 6000, sweep: 0.25, a: 0.005, d: 0.25, peak: 0.5 });
    k.tone({ type: 'square', f: 700, to: 200, glide: 0.12, a: 0.002, d: 0.12, peak: 0.2, lp: 2000 });
  } },

  // ------------------------------------------------------------ pickups (all in A major / minor)
  collect: { dur: 0.55, level: 0.45, vary: 0, reverb: 0.2, build(k) {
    arp(k, [76, 81, 85, 88], 0.045, { sub: true });
    k.tone({ type: 'sine', f: mtof(100), a: 0.002, d: 0.25, peak: 0.15, at: 0.18 });
  } },
  collectPower: { dur: 0.6, level: 0.45, vary: 0, reverb: 0.2, build(k) {
    k.tone({ type: 'square', f: mtof(57), to: mtof(81), glide: 0.25, a: 0.005, d: 0.25, peak: 0.12, lp: 2500 });
    arp(k, [69, 73, 76, 81, 85, 88], 0.035, { d: 0.12, peak: 0.26 });
    k.tone({ type: 'triangle', f: mtof(93), a: 0.003, d: 0.3, peak: 0.2, at: 0.21, vib: { rate: 6, depth: 15 } });
  } },
  collectSkull: { dur: 0.9, level: 0.5, vary: 0, reverb: 0.3, build(k) {
    for (const [m, det] of [[45, 0], [51, 8], [46, -10]] as const) {
      k.tone({ type: 'sawtooth', f: mtof(m), to: mtof(m - 3), glide: 0.6, detune: det, a: 0.01, hold: 0.1, d: 0.5, peak: 0.28, lp: 900, lpTo: 300, vib: { rate: 6, depth: 30 } });
    }
    [0, 0.12, 0.24].forEach((at, i) => k.tone({ type: 'square', f: mtof(70 - i * 2), to: mtof(66 - i * 2), glide: 0.08, a: 0.004, d: 0.09, peak: 0.2, lp: 1500, at }));
  } },
  collectHeart: { dur: 0.9, level: 0.5, vary: 0, reverb: 0.3, build(k) {
    k.tone({ type: 'sine', f: 90, to: 50, glide: 0.08, a: 0.002, d: 0.12, peak: 0.8 });
    k.tone({ type: 'sine', f: 90, to: 50, glide: 0.08, a: 0.002, d: 0.14, peak: 0.6, at: 0.16 });
    [69, 73, 76, 81].forEach((m, i) => k.tone({ type: 'triangle', f: mtof(m), a: 0.004, hold: 0.05, d: 0.35, peak: 0.45, at: 0.08 + i * 0.07, vib: { rate: 5, depth: 12, delay: 0.1 } }));
    k.tone({ type: 'sine', f: mtof(88), a: 0.01, d: 0.4, peak: 0.15, at: 0.36 });
  } },
  collectShield: { dur: 1.0, level: 0.48, vary: 0, reverb: 0.3, build(k) {
    k.tone({ type: 'sine', f: 300, to: 1200, glide: 0.25, a: 0.01, hold: 0.1, d: 0.3, peak: 0.4, vib: { rate: 18, depth: 40 } });
    k.bell(mtof(81), 0.2, 0.6, 0.35);
    k.bell(mtof(88), 0.26, 0.5, 0.2);
  } },

  // ------------------------------------------------------------ players
  shieldBreak: { dur: 0.9, level: 0.55, vary: 1, reverb: 0.3, build(k) {
    k.bell(1320, 0, 0.35, 0.5);
    k.bell(1810, 0.02, 0.3, 0.35);
    k.noise({ type: 'highpass', f: 4000, a: 0.001, d: 0.2, peak: 0.5 });
    for (let i = 0; i < 6; i++) k.tone({ type: 'sine', f: 2500 + k.r() * 3500, a: 0.001, d: 0.05 + k.r() * 0.1, peak: 0.15, at: k.r() * 0.25 });
    k.tone({ type: 'triangle', f: 900, to: 220, glide: 0.4, a: 0.005, d: 0.4, peak: 0.25 });
  } },
  stun: { dur: 1.0, level: 0.42, vary: 0.8, reverb: 0.2, build(k) {
    k.tone({ type: 'triangle', f: 700, to: 300, glide: 0.1, a: 0.001, d: 0.12, peak: 0.6 });
    for (let i = 0; i < 5; i++) {
      k.tone({ type: 'sine', f: i % 2 ? 2200 : 2700, to: i % 2 ? 2600 : 2300, glide: 0.08, a: 0.005, d: 0.08, peak: 0.25, at: 0.12 + i * 0.13, vib: { rate: 30, depth: 50 } });
    }
  } },
  death: { dur: 1.2, level: 0.58, vary: 0.5, reverb: 0.25, build(k) {
    k.tone({ type: 'square', f: 740, to: 110, glide: 0.7, a: 0.005, hold: 0.1, d: 0.6, peak: 0.35, lp: 2400, lpTo: 500, vib: { rate: 11, depth: 45 } });
    k.tone({ type: 'triangle', f: 370, to: 55, glide: 0.7, a: 0.005, hold: 0.1, d: 0.6, peak: 0.4 });
    k.noise({ color: 'pink', type: 'lowpass', f: 2000, to: 200, sweep: 0.4, a: 0.003, d: 0.35, peak: 0.4 });
  } },
  respawn: { dur: 0.9, level: 0.45, vary: 0, reverb: 0.3, build(k) {
    k.noise({ type: 'bandpass', f: 800, to: 6000, sweep: 0.5, q: 3, a: 0.4, d: 0.2, peak: 0.25 });
    [57, 64, 69, 73, 76, 81].forEach((m, i) => k.tone({ type: 'triangle', f: mtof(m), a: 0.003, d: 0.25, peak: 0.4, at: i * 0.06 }));
    k.tone({ type: 'sine', f: mtof(93), a: 0.02, d: 0.3, peak: 0.12, at: 0.36 });
  } },
  curse: { dur: 1.0, level: 0.48, vary: 0, reverb: 0.3, build(k) {
    for (const [m, det] of [[57, 0], [63, 6]] as const) {
      k.tone({ type: 'sawtooth', f: mtof(m), to: mtof(m - 5), glide: 0.8, detune: det, a: 0.02, hold: 0.3, d: 0.4, peak: 0.3, lp: 500, lpTo: 2200, lpTime: 0.35, q: 6, vib: { rate: 7, depth: 80 } });
    }
  } },
  effectEnd: { dur: 0.45, level: 0.32, vary: 0, reverb: 0.2, build(k) {
    k.tone({ type: 'sine', f: mtof(81), a: 0.003, d: 0.12, peak: 0.6 });
    k.tone({ type: 'sine', f: mtof(76), a: 0.003, d: 0.2, peak: 0.6, at: 0.1 });
    k.tone({ type: 'triangle', f: mtof(69), a: 0.003, d: 0.25, peak: 0.3, at: 0.1 });
  } },

  // ------------------------------------------------------------ round flow
  tick: { dur: 0.25, level: 0.48, vary: 0, reverb: 0.15, build(k) {
    k.tone({ type: 'square', f: 880, a: 0.001, hold: 0.04, d: 0.1, peak: 0.4, lp: 3000 });
    k.tone({ type: 'sine', f: 1760, a: 0.001, d: 0.05, peak: 0.2 });
  } },
  go: { dur: 1.1, level: 0.65, vary: 0, reverb: 0.3, build(k) {
    for (const m of [57, 64, 69, 73, 76]) for (const det of [-8, 8]) {
      k.tone({ type: 'sawtooth', f: mtof(m), detune: det, a: 0.005, hold: 0.15, d: 0.6, peak: 0.12, lp: 900, lpTo: 6000, lpTime: 0.1 });
    }
    k.tone({ type: 'sine', f: 140, to: 45, glide: 0.15, a: 0.002, d: 0.3, peak: 0.8 });
    k.noise({ type: 'highpass', f: 5000, a: 0.002, d: 0.5, peak: 0.25 });
  } },
  roundStart: { dur: 1.3, level: 0.5, vary: 0, reverb: 0.3, build(k) {
    k.noise({ color: 'pink', type: 'bandpass', f: 300, to: 5000, sweep: 0.6, q: 2, a: 0.55, d: 0.3, peak: 0.6 });
    k.bell(mtof(81), 0.6, 0.6, 0.4);
    k.tone({ type: 'sine', f: 120, to: 45, glide: 0.15, a: 0.002, d: 0.3, peak: 0.7, at: 0.6 });
  } },
  siren: { dur: 2.2, level: 0.5, vary: 0, reverb: 0.3, build(k) {
    const pts: [number, number][] = [[0.45, 880], [0.9, 520], [1.35, 880], [1.8, 520]];
    k.tone({ type: 'sawtooth', f: 520, fpts: pts, a: 0.05, hold: 1.6, d: 0.3, peak: 0.3, lp: 2200 });
    k.tone({ type: 'square', f: 520, fpts: pts, detune: 7, a: 0.05, hold: 1.6, d: 0.3, peak: 0.15, lp: 1600 });
    k.tone({ type: 'triangle', f: 55, a: 0.05, hold: 1.6, d: 0.3, peak: 0.45, vib: { rate: 4, depth: 20 } });
  } },
  victory: { dur: 1.6, level: 0.65, vary: 0, reverb: 0.3, build(k) {
    arp(k, [69, 73, 76, 81], 0.09, { d: 0.12, peak: 0.25, lp: 4000 });
    for (const [m, det] of [[81, -5], [85, 5], [88, -5], [93, 5]] as const) {
      k.tone({ type: 'square', f: mtof(m), detune: det, a: 0.01, hold: 0.4, d: 0.6, peak: 0.1, lp: 3500, at: 0.38, vib: { rate: 5.5, depth: 15, delay: 0.2 } });
    }
    k.tone({ type: 'triangle', f: mtof(57), a: 0.01, hold: 0.4, d: 0.6, peak: 0.4, at: 0.38 });
    k.noise({ type: 'highpass', f: 6000, a: 0.002, d: 0.6, peak: 0.18, at: 0.38 });
  } },
  defeat: { dur: 1.9, level: 0.55, vary: 0, reverb: 0.3, build(k) {
    [[67, 0], [66, 0.3], [65, 0.6]].forEach(([m, at]) =>
      k.tone({ type: 'sawtooth', f: mtof(m), to: mtof(m) * 0.97, glide: 0.26, a: 0.02, hold: 0.12, d: 0.14, peak: 0.25, lp: 900, at }));
    k.tone({ type: 'sawtooth', f: mtof(64), to: mtof(63), glide: 0.9, a: 0.02, hold: 0.45, d: 0.4, peak: 0.28, lp: 1000, lpTo: 400, at: 0.9, vib: { rate: 5, depth: 35, delay: 0.15 } });
    k.tone({ type: 'triangle', f: mtof(40), a: 0.02, hold: 0.45, d: 0.4, peak: 0.4, at: 0.9 });
  } },
} satisfies Record<string, Recipe>;

export type SfxKey = keyof typeof RECIPES;
export const SFX_KEYS = Object.keys(RECIPES) as SfxKey[];
const recipe = (k: SfxKey): Recipe => RECIPES[k];

// ---------------------------------------------------------------- rendering

export interface RenderStats { rawPeak: number; trimmedDur: number }

/** Render one variant of a recipe offline. Peak-normalised, trailing silence trimmed. */
export async function renderSfx(key: SfxKey, variant: number, sampleRate: number, stats?: RenderStats): Promise<AudioBuffer> {
  const rc = recipe(key);
  const len = Math.ceil(rc.dur * sampleRate);
  const off = new OfflineAudioContext(1, len, sampleRate);
  const bus = off.createGain();
  bus.connect(off.destination);
  rc.build(new Kit(off, bus, 0, mulberry32(hashStr(key) + variant * 7919)));
  const buf = await off.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0, last = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
    if (a > 0.0005) last = i;
  }
  const n = Math.min(d.length, last + Math.ceil(sampleRate * 0.01));
  const out = new AudioBuffer({ length: Math.max(1, n), numberOfChannels: 1, sampleRate });
  const o = out.getChannelData(0);
  const norm = peak > 0 ? 1 / peak : 0;
  const fade = Math.min(n, Math.ceil(sampleRate * 0.006));
  for (let i = 0; i < n; i++) {
    const tail = n - i < fade ? (n - i) / fade : 1;
    o[i] = d[i] * norm * tail;
  }
  if (stats) { stats.rawPeak = peak; stats.trimmedDur = n / sampleRate; }
  return out;
}

export type SfxBank = Map<SfxKey, AudioBuffer[]>;

/** Pre-render every recipe (UI first). Buffers become available one by one. */
export async function renderBank(sampleRate: number, bank: SfxBank, isCancelled: () => boolean = () => false): Promise<void> {
  for (const key of SFX_KEYS) {
    const n = recipe(key).variants ?? 1;
    const list: AudioBuffer[] = [];
    for (let v = 0; v < n; v++) {
      if (isCancelled()) return;
      list.push(await renderSfx(key, v, sampleRate));
    }
    bank.set(key, list);
  }
}

// ---------------------------------------------------------------- playback

export interface PlayOpts {
  gain?: number;     // linear multiplier
  pan?: number;      // -1..1
  wet?: number;      // reverb send multiplier
  rate?: number;     // extra playback-rate multiplier
  when?: number;     // absolute context time
}

interface Voice { group: string; src: AudioScheduledSourceNode; g: GainNode; start: number; end: number }

const GROUP_LIMIT: Record<string, number> = { boom: 5, brick: 4, blockFall: 3, ui_hover: 2 };
const DEFAULT_LIMIT = 3;
const GLOBAL_LIMIT = 28;

export class SfxPlayer {
  private voices: Voice[] = [];
  private rnd = mulberry32((Date.now() ^ 0x5eed) >>> 0);
  private lastVariant = new Map<SfxKey, number>();

  constructor(private ctx: Ctx, private bank: SfxBank, private out: AudioNode, private wet: AudioNode) {}

  get activeVoices() { return this.voices.length; }

  play(key: SfxKey, o: PlayOpts = {}): void {
    const ctx = this.ctx;
    const rc = recipe(key);
    const now = ctx.currentTime;
    const when = Math.max(now, o.when ?? now);
    const group = rc.group ?? key;
    this.voices = this.voices.filter((v) => v.end > when);

    // voice limiting: steal the oldest voice of the group (or globally)
    const same = this.voices.filter((v) => v.group === group);
    if (same.length >= (GROUP_LIMIT[group] ?? DEFAULT_LIMIT)) this.steal(same[0], when);
    if (this.voices.length >= GLOBAL_LIMIT) this.steal(this.voices[0], when);
    // pile-up compensation: many fresh voices of a group at once -> each a bit quieter
    const fresh = same.filter((v) => when - v.start < 0.12).length;
    const pile = 1 / Math.sqrt(1 + fresh * 0.7);

    const rate = semis((this.rnd() * 2 - 1) * rc.vary) * (o.rate ?? 1);
    const gain = rc.level * (o.gain ?? 1) * (0.88 + this.rnd() * 0.24) * pile;
    const g = ctx.createGain();
    g.gain.value = gain;
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(o.pan ?? 0, -1, 1);
    g.connect(pan).connect(this.out);
    if (rc.reverb > 0) {
      const send = ctx.createGain();
      send.gain.value = rc.reverb * (o.wet ?? 1);
      pan.connect(send).connect(this.wet);
    }

    const list = this.bank.get(key);
    let src: AudioScheduledSourceNode;
    let dur: number;
    if (list && list.length) {
      // pick a variant, avoiding an immediate repeat
      let vi = Math.floor(this.rnd() * list.length);
      if (list.length > 1 && vi === this.lastVariant.get(key)) vi = (vi + 1) % list.length;
      this.lastVariant.set(key, vi);
      const s = ctx.createBufferSource();
      s.buffer = list[vi];
      s.playbackRate.value = rate;
      s.connect(g);
      s.start(when);
      src = s;
      dur = list[vi].duration / rate;
    } else {
      // not rendered yet: synthesise live (un-normalised, so a bit quieter)
      const live = ctx.createGain();
      live.gain.value = 0.6;
      live.connect(g);
      rc.build(new Kit(ctx, live, when, mulberry32(hashStr(key))));
      const s = ctx.createConstantSource(); // lifetime marker for the voice list
      s.offset.value = 0;
      s.connect(g);
      s.start(when);
      s.stop(when + rc.dur);
      src = s;
      dur = rc.dur;
    }
    src.onended = () => { try { g.disconnect(); pan.disconnect(); } catch { /* already gone */ } };
    this.voices.push({ group, src, g, start: when, end: when + dur });
  }

  private steal(v: Voice, when: number) {
    this.voices.splice(this.voices.indexOf(v), 1);
    try {
      v.g.gain.cancelScheduledValues(when);
      v.g.gain.setTargetAtTime(0, when, 0.015);
      v.src.stop(when + 0.1);
    } catch { /* already stopped */ }
  }

  stopAll() {
    const now = this.ctx.currentTime;
    for (const v of this.voices.slice()) this.steal(v, now);
  }
}
