import { effect } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { installNav } from './nav';
import { BotsModal, JoinModal, LeaveModal, PauseModal } from './Dialogs';
import { ConnectingScreen } from './ConnectingScreen';
import { GameScreen, type GameScreenProps } from './GameScreen';
import { HowToPlayModal } from './HowToPlay';
import { t } from './i18n';
import { MenuScreen } from './MenuScreen';
import { SettingsModal } from './SettingsModal';
import { modals, room, screen, toast } from './store';
import { Toasts } from './Toasts';

/** Session hook for the stage element; see GameScreen.tsx. */
let stageHandler: GameScreenProps['onStageReady'];
export function setStageHandler(fn: GameScreenProps['onStageReady']) { stageHandler = fn; }

const MODALS = {
  settings: SettingsModal,
  howto: HowToPlayModal,
  join: JoinModal,
  bots: BotsModal,
  pause: PauseModal,
  leave: LeaveModal,
} as const;

// Keep #room=CODE in the address bar while in an online room so the URL is shareable.
effect(() => {
  const r = room.value;
  const want = r && !r.offline ? `#room=${r.code}` : '';
  if (location.hash !== want && (want || /room=/.test(location.hash)))
    history.replaceState(null, '', want || location.pathname + location.search);
});

export function App() {
  useEffect(() => {
    installNav();
    const on = () => toast(`🎮 ${t('toast.gamepad')}`, 'good');
    const off = () => toast(`🎮 ${t('toast.gamepadOff')}`);
    window.addEventListener('gamepadconnected', on);
    window.addEventListener('gamepaddisconnected', off);
    return () => { window.removeEventListener('gamepadconnected', on); window.removeEventListener('gamepaddisconnected', off); };
  }, []);

  const sc = screen.value;
  const stack = modals.value;
  return (
    <>
      {sc === 'menu' && <MenuScreen />}
      {sc === 'connecting' && <ConnectingScreen />}
      {sc === 'game' && <GameScreen onStageReady={(el) => stageHandler?.(el)} />}
      {stack.map((id, i) => {
        const M = MODALS[id];
        return <div key={id} class="modal-layer" style={{ zIndex: 100 + i }} inert={i < stack.length - 1 ? true : undefined}><M /></div>;
      })}
      <Toasts />
    </>
  );
}
