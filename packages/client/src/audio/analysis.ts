// Offline analysis: renders every SFX, a worst-case mix and every music mode with
// OfflineAudioContext and checks peak / loudness / duration. Used by the dev harness.

import type { MusicMode } from '../contracts';
import { buildGraph, duckMusic } from './graph';
import { Music } from './music';
import { RECIPES, SFX_KEYS, SfxPlayer, renderSfx, type RenderStats, type SfxBank, type SfxKey } from './sfx';
import { mulberry32 } from './synth';

export interface Row { name: string; peak: number; rmsDb: number; dur: number; ok: boolean; note: string }

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function measure(buf: AudioBuffer, gain = 1) {
  let peak = 0, sum = 0, n = 0, first = -1, last = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i] * gain);
      if (a > peak) peak = a;
      if (a > 0.001) { if (first < 0 || i < first) first = i; if (i > last) last = i; }
    }
  }
  // RMS over the audible span only
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = Math.max(0, first); i <= last; i++) { const v = d[i] * gain; sum += v * v; n++; }
  }
  return { peak, rms: n ? Math.sqrt(sum / n) : 0, dur: first < 0 ? 0 : (last - first) / buf.sampleRate };
}

export async function analyzeSfx(sampleRate = 48000, bank?: SfxBank): Promise<Row[]> {
  const rows: Row[] = [];
  for (const key of SFX_KEYS) {
    const rc = RECIPES[key] as { level: number; variants?: number };
    const list: AudioBuffer[] = [];
    for (let v = 0; v < (rc.variants ?? 1); v++) {
      const st: RenderStats = { rawPeak: 0, trimmedDur: 0 };
      const buf = await renderSfx(key, v, sampleRate, st);
      list.push(buf);
      const m = measure(buf, rc.level);
      const issues: string[] = [];
      if (m.peak > 1) issues.push('CLIP');
      if (st.rawPeak < 0.001 || m.rms < 0.003) issues.push('SILENT');
      if (m.dur < 0.01 || m.dur > 3.5) issues.push('DURATION');
      rows.push({ name: `${key}#${v}`, peak: r3(m.peak), rmsDb: Math.round(db(m.rms) * 10) / 10, dur: r3(m.dur), ok: !issues.length, note: `raw ${r3(st.rawPeak)} ${issues.join(' ')}` });
    }
    bank?.set(key, list);
  }
  return rows;
}

/** Worst case: battle music + a 12-bomb chain of big explosions + bricks + falling blocks. */
export async function analyzeStress(sampleRate: number, bank: SfxBank): Promise<Row> {
  const len = 8;
  const off = new OfflineAudioContext(2, sampleRate * len, sampleRate);
  const g = buildGraph(off, off.destination);
  const player = new SfxPlayer(off, bank, g.sfx, g.sfxWet);
  const music = new Music(off, g.duck, g.musicWet, 99);
  music.setMode('battle');
  music.schedule(len);
  const r = mulberry32(5);
  const hit = (key: SfxKey, when: number, gain = 1.2) => player.play(key, { when, gain, pan: r() * 2 - 1 });
  for (let i = 0; i < 12; i++) {
    hit('boom_l', 1 + i * 0.05);
    hit('brick', 1.01 + i * 0.05);
    hit('brick', 1.02 + i * 0.05);
  }
  for (let i = 0; i < 6; i++) hit('boom_m', 4 + i * 0.016);
  for (let i = 0; i < 4; i++) hit('blockFall', 5.5 + i * 0.25);
  hit('victory', 6.5); hit('death', 6.5); hit('collectShield', 6.6);
  // ducking automation (offline: schedule directly at the hit times)
  for (const t of [1, 1.3, 4]) duckMusic(g, t, 0.55);
  const buf = await off.startRendering();
  const m = measure(buf);
  const issues: string[] = [];
  if (m.peak > 1) issues.push('CLIP');
  if (m.rms < 0.01) issues.push('SILENT');
  return { name: 'STRESS mix (battle + 12-chain)', peak: r3(m.peak), rmsDb: Math.round(db(m.rms) * 10) / 10, dur: r3(m.dur), ok: !issues.length, note: issues.join(' ') };
}

export async function analyzeMusic(sampleRate: number, mode: MusicMode, seconds = 10): Promise<Row> {
  const off = new OfflineAudioContext(2, sampleRate * seconds, sampleRate);
  const g = buildGraph(off, off.destination);
  const music = new Music(off, g.duck, g.musicWet, 1234 + mode.length);
  music.setMode(mode);
  music.schedule(seconds);
  const buf = await off.startRendering();
  const m = measure(buf);
  const issues: string[] = [];
  if (m.peak > 1) issues.push('CLIP');
  if (m.rms < 0.005) issues.push('SILENT');
  return { name: `music:${mode}`, peak: r3(m.peak), rmsDb: Math.round(db(m.rms) * 10) / 10, dur: r3(m.dur), ok: !issues.length, note: issues.join(' ') };
}

export async function runAnalysis(sampleRate = 48000): Promise<{ ok: boolean; rows: Row[] }> {
  const bank: SfxBank = new Map();
  const t0 = performance.now();
  const rows = await analyzeSfx(sampleRate, bank);
  rows.push(await analyzeStress(sampleRate, bank));
  for (const mode of ['menu', 'waiting', 'battle', 'sudden', 'victory', 'defeat'] as MusicMode[]) {
    rows.push(await analyzeMusic(sampleRate, mode));
  }
  const ok = rows.every((r) => r.ok);
  console.table(rows);
  console.log(`[audio-analysis] ${ok ? 'PASS' : 'FAIL'}: ${rows.filter((r) => r.ok).length}/${rows.length} ok, ${Math.round(performance.now() - t0)} ms`);
  return { ok, rows };
}
