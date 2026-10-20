// Game screen: a full-viewport stage for the renderer canvas with the DOM HUD layered on top.
//
// INTEGRATION POINT (session layer):
//   <GameScreen onStageReady={(el) => { renderer = await createRenderer({ parent: el }); return () => renderer.destroy(); }} />
//   - `el` is the full-viewport `<div id="stage">`; append the canvas there (it is sized by CSS
//     to the viewport, use a ResizeObserver on it).
//   - The callback may return a cleanup, called when the screen unmounts.
//   - The same element is published as `stage.value` in ./store for code that prefers signals.
//   App renders this when `screen.value === 'game'` and forwards `stageHooks.onStageReady`
//   (see ./App.tsx → `setStageHandler`).
// The HUD reads `hud.value` (buildHud), `chat`, `killFeed`, `room`, `fps` from the store.
import { useEffect, useRef } from 'preact/hooks';
import { lastDevice } from '$/input/device';
import { installPlayGuards } from '$/input/guards';
import { isTextTarget } from '$/input/keyboard';
import { TouchControls } from '$/input/TouchControls';
import { Chat } from './hud/Chat';
import {
  Countdown, HudButtons, KillFeed, NetStats, RoundOver, Scoreboard, SpectatorBanner, StatsPanel,
  SuddenDeathBanner, TopBar,
} from './hud/Hud';
import { RoomCode } from './hud/RoomCode';
import { t } from './i18n';
import { chatOpen, hud, modals, openModal, room, scoreboardOpen, settings, stage } from './store';

export interface GameScreenProps {
  /** Called once with the #stage element after mount; may return a cleanup. */
  onStageReady?: (el: HTMLElement) => void | (() => void);
}

export function GameScreen({ onStageReady }: GameScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stageRef.current!;
    stage.value = el;
    const cleanup = onStageReady?.(el);
    const unguard = installPlayGuards(rootRef.current!);
    return () => {
      unguard();
      if (typeof cleanup === 'function') cleanup();
      if (stage.peek() === el) stage.value = null;
    };
  }, []);

  // Desktop shortcuts: T / Enter chat, hold Tab scoreboard, Esc menu.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (modals.peek().length || isTextTarget(e.target)) return;
      if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) scoreboardOpen.value = true; return; }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (scoreboardOpen.peek()) scoreboardOpen.value = false;
        else openModal('pause');
        return;
      }
      const me = hud.peek()?.me;
      // Enter is also a Bomb key, so it only opens the chat when you are not playing.
      const canEnter = !me || me.spectating;
      if (e.code === 'KeyT' || (canEnter && (e.code === 'Enter' || e.code === 'NumpadEnter'))) {
        e.preventDefault();
        chatOpen.value = true;
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Tab') scoreboardOpen.value = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const h = hud.value;
  const s = settings.value;
  const touch = lastDevice.value === 'touch';
  const r = room.value;
  const me = h?.me;

  return (
    <div ref={rootRef} class={`screen game ${touch ? 'is-touch' : ''} ${s.touch.leftHanded ? 'is-lefty' : ''}`}>
      <div id="stage" class="stage" ref={stageRef} />

      {touch && !chatOpen.value && (
        <TouchControls
          size={s.touch.size}
          opacity={s.touch.opacity}
          leftHanded={s.touch.leftHanded}
          bombLabel="💣"
          actionLabel="✋"
          bombTitle={t('bind.bomb')}
          actionTitle={t('bind.action')}
        />
      )}

      <div class="hud" aria-label="HUD">
        {h && <>
          <div class="hud__top">
            <div class="hud__left">
              {me && <StatsPanel me={me} compact={touch} />}
              {r && !r.offline && r.isPrivate && !touch && <RoomCode code={r.code} />}
              {touch && <Chat compact />}
            </div>
            <div class="hud__center">
              <TopBar h={h} />
              {touch && <NetStats ping={h.ping} />}
              <SuddenDeathBanner h={h} />
            </div>
            <div class="hud__right">
              <div class="hud__right-row">
                {!touch && <NetStats ping={h.ping} />}
                <HudButtons touch={touch} />
              </div>
              <KillFeed />
            </div>
          </div>

          <Countdown h={h} />
          {me && <SpectatorBanner me={me} phase={h.phase} />}
          <RoundOver h={h} />
          {!touch && <Chat compact={false} />}
          {scoreboardOpen.value && <Scoreboard h={h} onClose={() => { scoreboardOpen.value = false; }} />}
        </>}
      </div>
    </div>
  );
}
