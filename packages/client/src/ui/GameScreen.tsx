// The world screen: ALWAYS mounted. A full-viewport stage for the renderer canvas (the live
// shared arena, spectated by default) with the canon UI layered on top: top counters pill,
// bottom «Подключиться»/«Отключиться» pill, Ping/FPS, stats strip, kill feed, banners, chat
// drawer + ticker, menu drawer, touch controls.
//
// INTEGRATION POINT (session layer):
//   setStageHandler((el) => { renderer = await createRenderer({ parent: el }); return () => renderer.destroy(); })
//   (from ./App) or pass <GameScreen onStageReady={...}/>.
//   - `el` is the full-viewport `<div id="stage">`; append the canvas there (size it with a
//     ResizeObserver). Called ONCE at app start, because the world is visible behind every
//     screen (loader excepted, which covers it). The callback may return a cleanup.
//   - The same element is published as `stage.value` in ./store.
// The HUD reads `hud.value` (buildHud), `chat`, `killFeed`, `room`, `fps` from the store.
import { useEffect, useRef } from 'preact/hooks';
import { lastDevice } from '$/input/device';
import { installPlayGuards } from '$/input/guards';
import { isTextTarget } from '$/input/keyboard';
import { TouchControls } from '$/input/TouchControls';
import { ChatDrawer, ChatTicker } from './hud/Chat';
import { Banners, BottomPill, Countdown, DebugInfo, KillFeed, RoundResult, Scoreboard, StatsStrip, TopPill } from './hud/Hud';
import { t } from './i18n';
import { Icon } from './icons';
import { MenuDrawer } from './MenuDrawer';
import { chatOpen, hud, menuOpen, modals, scoreboardOpen, screen, settings, stage } from './store';

export interface GameScreenProps {
  /** Called once with the #stage element after mount; may return a cleanup. */
  onStageReady?: (el: HTMLElement) => void | (() => void);
}

export function GameScreen({ onStageReady }: GameScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sc = screen.value;
  const inWorld = sc === 'game';

  useEffect(() => {
    const el = stageRef.current!;
    stage.value = el;
    const cleanup = onStageReady?.(el);
    return () => {
      if (typeof cleanup === 'function') cleanup();
      if (stage.peek() === el) stage.value = null;
    };
  }, []);

  useEffect(() => (inWorld ? installPlayGuards(rootRef.current!) : undefined), [inWorld]);

  // Desktop shortcuts: T / Enter chat, hold Tab scoreboard, Esc menu.
  useEffect(() => {
    if (!inWorld) return;
    const down = (e: KeyboardEvent) => {
      if (modals.peek().length || isTextTarget(e.target) || menuOpen.peek() || chatOpen.peek()) return;
      if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) scoreboardOpen.value = true; return; }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (scoreboardOpen.peek()) scoreboardOpen.value = false;
        else menuOpen.value = true;
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
  }, [inWorld]);

  const h = hud.value;
  const s = settings.value;
  const touch = lastDevice.value === 'touch';
  const me = h?.me;
  const playing = !!me && !me.spectating;
  const showTouch = inWorld && touch && playing && !chatOpen.value && !menuOpen.value && !modals.value.length;

  return (
    <div ref={rootRef} class={`world ${touch ? 'is-touch' : ''} ${playing ? 'is-playing-round' : ''} ${inWorld ? '' : 'is-covered'}`}>
      <div id="stage" class="stage" ref={stageRef} />
      <div class="stage-vignette" aria-hidden="true" />

      {showTouch && (
        <TouchControls
          size={s.touch.size}
          opacity={s.touch.opacity}
          leftHanded={s.touch.leftHanded}
          bombLabel={<Icon name="bomb" size={50 * s.touch.size} />}
          actionLabel={<Icon name="hand" size={34 * s.touch.size} />}
          bombTitle={t('bind.bomb')}
          actionTitle={t('bind.action')}
        />
      )}

      {inWorld && (
        <div class="hud" aria-label="HUD">
          <DebugInfo ping={h?.ping ?? 0} />
          <TopPill h={h} />
          {h && <>
            <div class="hud__left">{me && playing && <StatsStrip me={me} compact={touch} />}</div>
            <div class="hud__right"><KillFeed /></div>
            <div class="hud__center"><Banners h={h} /><RoundResult h={h} /></div>
            <Countdown h={h} />
            {scoreboardOpen.value && <Scoreboard h={h} onClose={() => { scoreboardOpen.value = false; }} />}
          </>}
          <ChatTicker />
          <BottomPill h={h} />
        </div>
      )}
      {inWorld && <ChatDrawer />}
      {inWorld && <MenuDrawer />}
    </div>
  );
}
