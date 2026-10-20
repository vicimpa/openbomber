import { useState } from 'preact/hooks';
import { Button, Modal, Segmented } from './components';
import { t } from './i18n';
import { HeroSprite } from './sprites';
import { RoomCode } from './hud/RoomCode';
import { actions, closeAllModals, closeModal, openModal, room, type Difficulty } from './store';

// ---------------------------------------------------------------- join by code
export function JoinModal() {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e?: Event) => {
    e?.preventDefault();
    if (!/^[A-Z0-9]{4,5}$/.test(code)) { setErr(true); actions.uiSound('error'); return; }
    closeModal('join');
    actions.joinByCode(code);
  };
  return (
    <Modal title={t('join.title')} onClose={() => closeModal('join')} size="sm" accent="pink">
      <form class="join" onSubmit={submit}>
        <label for="room-code" class="field__label">{t('join.label')}</label>
        <input
          id="room-code"
          class={`input input--code ${err ? 'is-bad' : ''}`}
          value={code}
          maxLength={5}
          autoComplete="off"
          autoCapitalize="characters"
          spellcheck={false}
          inputMode="text"
          enterKeyHint="go"
          placeholder="AB12"
          data-autofocus
          onInput={(e) => { setErr(false); setCode((e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9]/g, '')); }}
        />
        <p class={`join__hint ${err ? 'is-bad' : ''}`} role={err ? 'alert' : undefined}>{err ? t('join.invalid') : t('join.hint')}</p>
        <Button variant="pink" size="lg" block type="submit" onClick={() => {}} disabled={code.length < 4}>{t('join.go')}</Button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- versus bots
let lastBots = 3;
let lastDiff: Difficulty = 'normal';

export function BotsModal() {
  const [bots, setBots] = useState(lastBots);
  const [diff, setDiff] = useState<Difficulty>(lastDiff);
  const change = (d: number) => setBots((b) => Math.max(1, Math.min(7, b + d)));
  const start = () => {
    lastBots = bots; lastDiff = diff;
    closeModal('bots');
    actions.playOffline({ bots, difficulty: diff });
  };
  return (
    <Modal title={t('bots.title')} onClose={() => closeModal('bots')} size="sm" accent="lime">
      <div class="bots">
        <div class="field">
          <span class="field__label">{t('bots.count')}</span>
          <div class="stepper">
            <button class="icon-btn icon-btn--lg" onClick={() => { actions.uiSound('click'); change(-1); }} disabled={bots <= 1} aria-label="−">−</button>
            <output class="stepper__value pixel" aria-live="polite">{bots}</output>
            <button class="icon-btn icon-btn--lg" onClick={() => { actions.uiSound('click'); change(1); }} disabled={bots >= 7} aria-label="+">+</button>
          </div>
          <div class="bots__row" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span class={i < bots ? 'is-on' : ''}><HeroSprite skin={(i * 3 + 1) % 11} anim="IdleDown" scale={1} still={i >= bots} /></span>
            ))}
          </div>
        </div>
        <Segmented
          label={t('bots.difficulty')}
          value={diff}
          options={[
            { value: 'easy', label: `🙂 ${t('bots.easy')}` },
            { value: 'normal', label: `😼 ${t('bots.normal')}` },
            { value: 'hard', label: `😈 ${t('bots.hard')}` },
          ]}
          onChange={setDiff}
        />
        <p class="bots__hint">📴 {t('bots.offlineHint')}</p>
        <Button variant="lime" size="lg" block icon="▶" onClick={start} data-autofocus>{t('bots.start')}</Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- in-game menu
export function PauseModal() {
  const r = room.value;
  return (
    <Modal title={t('hud.pause')} onClose={() => closeModal('pause')} size="sm" accent="cyan">
      <div class="pause">
        <Button variant="primary" size="lg" block icon="▶" onClick={() => closeModal('pause')} data-autofocus>{t('hud.resume')}</Button>
        {r && !r.offline && <RoomCode code={r.code} />}
        <Button variant="plain" block icon="⚙️" onClick={() => openModal('settings')}>{t('menu.settings')}</Button>
        <Button variant="plain" block icon="❔" onClick={() => openModal('howto')}>{t('menu.howTo')}</Button>
        <Button variant="danger" block icon="🚪" onClick={() => openModal('leave')}>{t('hud.leave')}</Button>
        <p class="pause__note">{t('hud.pauseNote')}</p>
      </div>
    </Modal>
  );
}

export function LeaveModal() {
  return (
    <Modal title={t('hud.leaveConfirm')} onClose={() => closeModal('leave')} size="sm" accent="pink">
      <p class="leave__text">{t('hud.leaveText')}</p>
      <div class="leave__row">
        <Button variant="plain" onClick={() => closeModal('leave')} data-autofocus>{t('hud.cancel')}</Button>
        <Button variant="danger" icon="🚪" onClick={() => { closeAllModals(); actions.leave(); }}>{t('hud.leaveYes')}</Button>
      </div>
    </Modal>
  );
}
