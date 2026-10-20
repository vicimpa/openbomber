// Entry: mounts the Preact app. The session layer (src/session) binds real actions with
// `bindActions()` from ./ui/store and hooks the renderer via `setStageHandler()` from ./ui/App
// (or the `stage` signal). Until then the mock (./ui/mock) drives every screen.
import { render } from 'preact';
import './styles/global.css';
import { App } from './ui/App';
import { installMockActions } from './ui/mock';
import { actions, parseRoomHash, pendingInvite, room, screen } from './ui/store';

// TODO(session): remove once src/session binds the real actions (its bindActions() call wins anyway).
installMockActions();

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

// Prevent pinch-zoom in iOS Safari, which ignores user-scalable=no.
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);
