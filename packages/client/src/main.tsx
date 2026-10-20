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

// Invite links: #room=CODE auto-joins (and keeps a banner in the menu if joining fails).
const tryInvite = () => {
  const code = parseRoomHash();
  if (!code || screen.peek() !== 'menu' || room.peek()?.code === code) return;
  pendingInvite.value = code;
  setTimeout(() => { pendingInvite.value = null; actions.joinByCode(code); }, 0);
};
tryInvite();
window.addEventListener('hashchange', tryInvite);

// Prevent pinch-zoom in iOS Safari, which ignores user-scalable=no.
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);
