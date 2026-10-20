// Input sanitising helpers shared by the room (names, chat, room codes, rate limits).

export const NAME_MAX = 18;
export const CHAT_MAX = 100;
export const CHAT_COOLDOWN_MS = 2000;
/** Number of hero skins (client assets heroes/type1..type11). */
export const SKIN_COUNT = 11;

// C0/C1 control chars, zero-width & bidi overrides (prevent invisible / spoofed names).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g;

export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  const s = v.replace(CONTROL, '').replace(/\s+/g, ' ').trim();
  // Slice by code points so surrogate pairs are never split.
  return Array.from(s).slice(0, max).join('').trim();
}

const ADJ = ['Swift', 'Brave', 'Lucky', 'Sneaky', 'Crazy', 'Fiery', 'Silent', 'Mighty', 'Tiny', 'Wild'];
const NOUN = ['Bomber', 'Fox', 'Panda', 'Tiger', 'Ninja', 'Robot', 'Comet', 'Otter', 'Raven', 'Mole'];

export function randomName(): string {
  const a = ADJ[(Math.random() * ADJ.length) | 0]!;
  const n = NOUN[(Math.random() * NOUN.length) | 0]!;
  return `${a}${n}${(Math.random() * 100) | 0}`.slice(0, NAME_MAX);
}

export function sanitizeName(v: unknown): string {
  return cleanText(v, NAME_MAX) || randomName();
}

export function clampSkin(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(0, Math.min(SKIN_COUNT - 1, n));
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

// Room codes: no 0/O, 1/I/L, 5/S, 2/Z, 8/B to avoid misreads.
export const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';
export const CODE_LENGTH = 5;
const usedCodes = new Set<string>();

export function allocateRoomCode(): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[(Math.random() * CODE_ALPHABET.length) | 0];
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
  throw new Error('room codes exhausted');
}

export function releaseRoomCode(code: string) {
  usedCodes.delete(code);
}

/** Normalise user-typed codes: upper-case, strip separators / spaces. */
export function normalizeRoomCode(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Simple token bucket: `take()` returns false when the budget is exhausted. */
export class TokenBucket {
  private tokens: number;
  private last = performance.now();
  constructor(private readonly capacity: number, private readonly perSecond: number) {
    this.tokens = capacity;
  }
  take(n = 1): boolean {
    const now = performance.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}
