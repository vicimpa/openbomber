// Where the game's small saves live (settings, hint counts): localStorage. A failing one (private
// mode, quota) is just skipped.

export function readItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writeItem(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* not saved */ }
}
