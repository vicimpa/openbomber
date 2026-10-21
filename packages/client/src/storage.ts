// Where the game's small saves live (settings, hint counts): localStorage, or on CrazyGames their
// Data module once the SDK is up (crazygames.ts): synced to the player's CrazyGames account, kept
// locally for guests. Same API either way; a failing store (private mode, quota) is just skipped.

export interface ItemStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let cloud: ItemStore | null = null;
const listeners: (() => void)[] = [];

export function readItem(key: string): string | null {
  try { return (cloud ?? localStorage).getItem(key); } catch { return null; }
}

export function writeItem(key: string, value: string) {
  try { (cloud ?? localStorage).setItem(key, value); } catch (e) { if (cloud) console.warn('[storage]', key, e); }
}

/** From now on saves go to `store`. Keys it doesn't have yet get this device's local copy (a
 *  returning player's settings move over); then whoever cached a value re-reads (onStoreChange). */
export function useStore(store: ItemStore, keys: string[]) {
  for (const k of keys) {
    try {
      if (store.getItem(k) !== null) continue;
      const local = localStorage.getItem(k);
      if (local !== null) store.setItem(k, local);
    } catch { /* nothing local to move */ }
  }
  cloud = store;
  for (const f of listeners) f();
}

/** Called when the store is switched (to re-read what was loaded from the old one). */
export function onStoreChange(f: () => void) { listeners.push(f); }
