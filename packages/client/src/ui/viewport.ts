// The visible part of the page. iOS Safari lays `position: fixed; inset: 0` boxes out against a
// viewport that lags behind its collapsing toolbars and rotation, which leaves bands of page
// background above and below the game. The world is sized from visualViewport instead
// (--vvh / --vvt on <html>), and `viewport` lets the UI scale to the space that is really there.
import { signal } from '@preact/signals';

const vv = typeof window !== 'undefined' ? window.visualViewport : null;
/** A web app started from the iOS home screen. */
const iosApp = typeof navigator !== 'undefined' && (navigator as { standalone?: boolean }).standalone === true;

function height() {
  const h = vv?.height ?? innerHeight;
  if (!iosApp) return h;
  // The app owns the whole screen, yet iOS reports a height short by the status bar, which left
  // a band of page background at the bottom in portrait. The keyboard takes far more than that.
  const full = innerWidth > innerHeight ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
  return full > h && full - h < 80 ? full : h;
}

const read = () => ({ w: Math.round(vv?.width ?? innerWidth), h: Math.round(height()) });

export const viewport = signal(read());

function sync() {
  const v = read();
  const st = document.documentElement.style;
  st.setProperty('--vvh', `${v.h}px`);
  st.setProperty('--vvt', `${Math.max(0, Math.round(vv?.offsetTop ?? 0))}px`);
  const cur = viewport.peek();
  if (v.w !== cur.w || v.h !== cur.h) viewport.value = v;
}

if (typeof window !== 'undefined') {
  sync();
  vv?.addEventListener('resize', sync);
  vv?.addEventListener('scroll', sync);
  window.addEventListener('resize', sync);
  // iOS reports the new size a little after the rotation event
  window.addEventListener('orientationchange', () => { sync(); setTimeout(sync, 300); });
}
