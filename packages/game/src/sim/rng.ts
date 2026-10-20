// Deterministic PRNG (mulberry32). The simulation keeps its state in `WorldState.seed`,
// so a cloned world continues the exact same random sequence.

export interface SeedHolder {
  seed: number;
}

/** Uniform float in [0, 1); advances `h.seed`. */
export function nextFloat(h: SeedHolder): number {
  let t = (h.seed = (h.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform integer in [0, n). */
export function randInt(h: SeedHolder, n: number): number {
  return Math.floor(nextFloat(h) * n);
}

/** In-place Fisher-Yates shuffle. */
export function shuffle<T>(h: SeedHolder, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(h, i + 1);
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

/** Pick an index from a weight table. */
export function weightedIndex(h: SeedHolder, weights: readonly number[], total: number): number {
  let r = nextFloat(h) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** FNV-1a string hash, used to derive stable seeds (e.g. per bot). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stand-alone generator for code that must not touch the world seed (bots). */
export class Rng implements SeedHolder {
  constructor(public seed: number) {
    this.seed = seed >>> 0;
  }
  next() {
    return nextFloat(this);
  }
  int(n: number) {
    return randInt(this, n);
  }
  chance(p: number) {
    return nextFloat(this) < p;
  }
}
