import { effect } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { installNav } from './nav';
import { BotsModal, JoinModal, LeaveModal, SkinModal } from './Dialogs';
import { ConnectingScreen } from './ConnectingScreen';
import { GameScreen, type GameScreenProps } from './GameScreen';
import { HowToPlayModal } from './HowToPlay';
import { t } from './i18n';
import { Loader } from './Loader';
import { MainMenu } from './MainMenu';
import { SettingsModal } from './SettingsModal';
import { modals, room, screen, toast } from './store';
import { Toasts } from './Toasts';

/** Session hook for the stage element; see GameScreen.tsx. Set it before (or right after) mount. */
let stageHandler: GameScreenProps['onStageReady'];
let mountedStage: HTMLElement | null = null;
let stageCleanup: void | (() => void);
export function setStageHandler(fn: GameScreenProps['onStageReady']) {
  stageHandler = fn;
  if (mountedStage && fn) stageCleanup = fn(mountedStage); // late binding: stage already exists
}

const MODALS = {
  settings: SettingsModal,
  howto: HowToPlayModal,
  join: JoinModal,
  bots: BotsModal,
  leave: LeaveModal,
  skin: SkinModal,
} as const;

// Keep #room=CODE in the address bar while in a private online room so the URL is shareable.
effect(() => {
  const r = room.value;
  const want = r && !r.offline && r.isPrivate ? `#room=${r.code}` : '';
  if (location.hash !== want && (want || /room=/.test(location.hash)))
    history.replaceState(null, '', want || location.pathname + location.search);
});

export function App() {
  useEffect(() => {
    installNav();
    const on = () => toast(t('toast.gamepad'), 'good', undefined, 'gamepad');
    const off = () => toast(t('toast.gamepadOff'), 'info', undefined, 'gamepad');
    window.addEventListener('gamepadconnected', on);
    window.addEventListener('gamepaddisconnected', off);
    return () => { window.removeEventListener('gamepadconnected', on); window.removeEventListener('gamepaddisconnected', off); };
  }, []);

  const sc = screen.value;
  const stack = modals.value;
  return (
    <>
      <GameScreen onStageReady={(el) => {
        mountedStage = el;
        if (stageHandler) stageCleanup = stageHandler(el);
        return () => { if (typeof stageCleanup === 'function') stageCleanup(); mountedStage = null; };
      }} />
      {sc === 'loader' && <Loader />}
      {sc === 'menu' && <MainMenu />}
      {sc === 'connecting' && <ConnectingScreen />}
      {stack.map((id, i) => {
        const M = MODALS[id];
        return <div key={id} class="modal-layer" style={{ zIndex: 100 + i }} inert={i < stack.length - 1 ? true : undefined}><M /></div>;
      })}
      <Toasts />
    </>
  );
}
