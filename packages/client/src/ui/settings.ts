// Persisted user settings (../storage). Read `settings.value`, write with `updateSettings()`.
import { effect, signal } from '@preact/signals';
import { inputPrefs } from '$/input/prefs';
import { readItem, writeItem } from '$/storage';
import { randomName } from './names';

export type Language = 'ru' | 'en';
export type Quality = 'low' | 'high';

export interface Settings {
  name: string;
  skin: number;                 // 0-based, sprite = assets/heroes/type{skin+1}
  volume: { master: number; sfx: number; music: number; ambient: number }; // 0..1
  haptics: boolean;
  touch: { size: number; opacity: number; leftHanded: boolean }; // size 0.7..1.4, opacity 0.2..1
  quality: Quality;
  language: Language;
  showFps: boolean;
  showPing: boolean;
}

export const SKIN_COUNT = 12;
export const SETTINGS_KEY = 'openbomber.settings.v2';

export const defaultSettings = (): Settings => ({
  name: randomName(),
  skin: Math.floor(Math.random() * SKIN_COUNT),
  volume: { master: 0.8, sfx: 0.9, music: 0.6, ambient: 0.6 },
  haptics: true,
  touch: { size: 1, opacity: 0.8, leftHanded: false },
  quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'high',
  language: 'ru',
  showFps: false,
  showPing: true,
});

function load(): Settings {
  const base = defaultSettings();
  try {
    const raw = readItem(SETTINGS_KEY);
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      ...base,
      ...s,
      volume: { ...base.volume, ...s.volume },
      touch: { ...base.touch, ...s.touch },
      skin: Number.isInteger(s.skin) && s.skin! >= 0 && s.skin! < SKIN_COUNT ? s.skin! : base.skin,
      name: typeof s.name === 'string' && s.name.trim() ? s.name.slice(0, 16) : base.name,
    };
  } catch {
    return base;
  }
}

export const settings = signal<Settings>(load());

type Patch = { [K in keyof Settings]?: Settings[K] extends object ? Partial<Settings[K]> : Settings[K] };

export function updateSettings(patch: Patch) {
  const cur = settings.value;
  const next = { ...cur } as Settings;
  for (const k of Object.keys(patch) as (keyof Settings)[]) {
    const v = patch[k];
    if (v && typeof v === 'object') (next as any)[k] = { ...(cur as any)[k], ...v };
    else (next as any)[k] = v;
  }
  settings.value = next;
}

effect(() => {
  const s = settings.value;
  inputPrefs.haptics = s.haptics;
  document.documentElement.lang = s.language;
  writeItem(SETTINGS_KEY, JSON.stringify(s));
});
