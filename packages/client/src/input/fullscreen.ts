import { signal } from '@preact/signals';

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

const doc = document as FsDoc;
const fsElement = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

export const canFullscreen = !!(document.documentElement.requestFullscreen || (document.documentElement as FsEl).webkitRequestFullscreen);
export const isFullscreen = signal(!!fsElement());

const sync = () => { isFullscreen.value = !!fsElement(); };
document.addEventListener('fullscreenchange', sync);
document.addEventListener('webkitfullscreenchange', sync);

/** Enter fullscreen and (on phones) try to lock landscape. Must run inside a user gesture. */
export async function enterFullscreen(lockLandscape = true) {
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else await el.webkitRequestFullscreen?.();
  } catch { return; }
  if (lockLandscape) {
    try { await (screen.orientation as LockableOrientation)?.lock?.('landscape'); } catch { /* unsupported (iOS, desktop) */ }
  }
}

export async function exitFullscreen() {
  try { (screen.orientation as LockableOrientation)?.unlock?.(); } catch { /* ignore */ }
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch { /* ignore */ }
}

export function toggleFullscreen() {
  return fsElement() ? exitFullscreen() : enterFullscreen();
}
