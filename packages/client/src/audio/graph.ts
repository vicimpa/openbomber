// Mixer graph shared by the live engine and the offline analysis.
//
//   sfx voices ─► sfx ─────────────┐
//   sfx sends  ─► sfxWet ─► reverb ├─► master ─► pad ─► glue comp ─► limiter ─► trim ─► ½ ─► soft clip ─► out
//   music ─► duck ─► music ────────┤
//   music send ─► musicWet ─► reverb
//   ambience (weather) ─► ambient ─► master
//
// The soft clipper's curve tops out at 0.98, so the output can never exceed full scale.

import { makeImpulse, softClipCurve, type Ctx } from './synth';

export interface Graph {
  master: GainNode;
  sfx: GainNode;
  sfxWet: GainNode;
  music: GainNode;
  musicWet: GainNode;
  /** music enters here (sidechain-ish ducking) */
  duck: GainNode;
  /** weather ambience */
  ambient: GainNode;
}

export function buildGraph(ctx: Ctx, dest: AudioNode): Graph {
  const gain = (v: number) => { const g = ctx.createGain(); g.gain.value = v; return g; };

  const master = gain(1);
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16;
  glue.knee.value = 10;
  glue.ratio.value = 3;
  glue.attack.value = 0.005;
  glue.release.value = 0.25;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  // Pad into the compressors, then trim back. WebAudio compressors add automatic makeup
  // gain (~+6.8 dB here): measured small-signal gain ~1.0, ceiling ~0.9 before the clipper.
  const pad = gain(0.43);
  const trim = gain(1.07);
  const half = gain(0.5);
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve();
  clip.oversample = '4x';
  master.connect(pad).connect(glue).connect(limiter).connect(trim).connect(half).connect(clip).connect(dest);

  const reverb = ctx.createConvolver();
  reverb.normalize = true;
  reverb.buffer = makeImpulse(ctx, 1.8, 3.2);
  const revOut = gain(0.55);
  reverb.connect(revOut).connect(master);

  const sfx = gain(1);
  sfx.connect(master);
  const sfxWet = gain(1);
  sfxWet.connect(reverb);
  const music = gain(1);
  music.connect(master);
  const musicWet = gain(1);
  musicWet.connect(reverb);
  const duck = gain(1);
  duck.connect(music);

  const ambient = gain(1);
  ambient.connect(master);

  return { master, sfx, sfxWet, music, musicWet, duck, ambient };
}

/** Brief music dip under big hits. amount 0..1. */
export function duckMusic(g: Graph, now: number, amount: number) {
  const p = g.duck.gain;
  const target = Math.max(0.3, 1 - amount);
  p.cancelScheduledValues(now);
  p.setValueAtTime(Math.min(1, Math.max(target, p.value)), now);
  p.linearRampToValueAtTime(target, now + 0.025);
  p.setTargetAtTime(1, now + 0.12, 0.3);
}
