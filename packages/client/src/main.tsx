// Entry: mounts the Preact app. The session layer (src/session) binds real actions with
// `bindActions()` from ./ui/store and hooks the renderer via `setStageHandler()` from ./ui/App
// (or the `stage` signal). Until then the mock (./ui/mock) drives every screen.
import { render } from 'preact';
import './styles/global.css';
import './ui/viewport';
import { App } from './ui/App';
import { installMockActions } from './ui/mock';
import { startSession } from './session';
import { actions, parseRoomHash, pendingInvite, room, screen } from './ui/store';

// `?mock` runs the UI against the scripted fake world (no server / renderer needed).
if (new URLSearchParams(location.search).has('mock')) installMockActions();
else startSession();

render(<App />, document.getElementById('app')!);

// Invite links: #room=CODE. On first load the loader's button becomes «Войти в комнату CODE»
// (that click is also the audio-unlock gesture); later hash changes join directly.
const tryInvite = () => {
  const code = parseRoomHash();
  if (!code || room.peek()?.code === code) return;
  if (screen.peek() === 'loader') pendingInvite.value = code;
  else actions.joinByCode(code);
};
tryInvite();
window.addEventListener('hashchange', tryInvite);

// v1 shipped a cache-first service worker; v2 has none. Drop any old registration + caches.
navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});

// Prevent pinch-zoom in iOS Safari, which ignores user-scalable=no.
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);
