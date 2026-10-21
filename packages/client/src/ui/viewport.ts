// The visible part of the page. iOS Safari lays `position: fixed; inset: 0` boxes out against a
// viewport that lags behind its collapsing toolbars and rotation, which leaves bands of page
// background above and below the game. The world is sized from visualViewport instead
// (--vvh / --vvt on <html>), and `viewport` lets the UI scale to the space that is really there.
import { signal } from '@preact/signals';

const vv = typeof window !== 'undefined' ? window.visualViewport : null;
const read = () => ({ w: Math.round(vv?.width ?? innerWidth), h: Math.round(vv?.height ?? innerHeight) });

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
