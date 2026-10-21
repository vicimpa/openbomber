import { useState } from 'preact/hooks';
import { Button, Modal, Segmented } from './components';
import { t } from './i18n';
import { Icon } from './icons';
import { SKIN_COUNT } from './settings';
import { HeroSprite } from './sprites';
import { actions, closeAllModals, closeModal, menuOpen, setSkin, settings, type Difficulty } from './store';

// ---------------------------------------------------------------- «Выберите скин»
export function SkinModal() {
  const [sel, setSel] = useState(settings.value.skin);
  const save = () => { setSkin(sel); closeModal('skin'); };
  return (
    <Modal
      title={t('menu.chooseSkin')}
      onClose={() => closeModal('skin')}
      size="md"
      footer={<Button variant="white" size="lg" onClick={save}>{t('common.save')}</Button>}
    >
      <div class="skins" role="radiogroup" aria-label={t('menu.chooseSkin')}>
        {Array.from({ length: SKIN_COUNT }, (_, n) => (
          <button
            type="button"
            role="radio"
            aria-checked={n === sel}
            class={`skin-item ${n === sel ? 'is-on' : ''}`}
            onClick={() => { actions.uiSound('click'); setSel(n); }}
            onDblClick={() => { setSel(n); setSkin(n); closeModal('skin'); }}
            aria-label={t('menu.skinN', { n: n + 1 })}
            title={t('menu.skinN', { n: n + 1 })}
            data-autofocus={n === sel ? '' : undefined}
          >
            <HeroSprite skin={n} anim={n === sel ? 'RunDown' : 'IdleDown'} scale={1.6} />
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- join by code
export function JoinModal() {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e?: Event) => {
    e?.preventDefault();
    if (!/^[A-Z0-9]{4,5}$/.test(code)) { setErr(true); actions.uiSound('error'); return; }
    closeAllModals();
    menuOpen.value = false;
    actions.joinByCode(code);
  };
  return (
    <Modal title={t('join.title')} onClose={() => closeModal('join')} size="sm">
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
          enterKeyHint="go"
          placeholder="AB12"
          data-autofocus
          onInput={(e) => { setErr(false); setCode((e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9]/g, '')); }}
        />
        <p class={`join__hint ${err ? 'is-bad' : ''}`} role={err ? 'alert' : undefined}>{err ? t('join.invalid') : t('join.hint')}</p>
        <Button variant="white" size="lg" block type="submit" disabled={code.length < 4}>{t('join.go')}</Button>
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
  const change = (d: number) => { actions.uiSound('click'); setBots((b) => Math.max(1, Math.min(7, b + d))); };
  const start = () => {
    lastBots = bots; lastDiff = diff;
    closeAllModals();
    menuOpen.value = false;
    actions.playOffline({ bots, difficulty: diff });
  };
  return (
    <Modal title={t('bots.title')} onClose={() => closeModal('bots')} size="sm">
      <div class="bots">
        <div class="field">
          <span class="field__label">{t('bots.count')}</span>
          <div class="stepper">
            <button class="icon-btn icon-btn--lg" onClick={() => change(-1)} disabled={bots <= 1} aria-label="-"><Icon name="minus" /></button>
            <output class="stepper__value" aria-live="polite">{bots}</output>
            <button class="icon-btn icon-btn--lg" onClick={() => change(1)} disabled={bots >= 7} aria-label="+"><Icon name="plus" /></button>
          </div>
          <div class="bots__row" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span class={i < bots ? 'is-on' : ''}><HeroSprite skin={(i * 3 + 1) % SKIN_COUNT} anim="IdleDown" scale={1} still={i >= bots} /></span>
            ))}
          </div>
        </div>
        <Segmented
          label={t('bots.difficulty')}
          value={diff}
          options={[
            { value: 'easy', label: t('bots.easy') },
            { value: 'normal', label: t('bots.normal') },
            { value: 'hard', label: t('bots.hard') },
          ]}
          onChange={setDiff}
        />
        <p class="bots__hint"><Icon name="offline" /> {t('bots.offlineHint')}</p>
        <Button variant="white" size="lg" block onClick={start} data-autofocus>{t('bots.start')}</Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- leave a private / offline room
export function LeaveModal() {
  return (
    <Modal title={t('hud.leaveConfirm')} onClose={() => closeModal('leave')} size="sm">
      <p class="leave__text">{t('hud.leaveText')}</p>
      <div class="leave__row">
        <Button onClick={() => closeModal('leave')} data-autofocus>{t('hud.cancel')}</Button>
        <Button variant="danger" onClick={() => { closeAllModals(); actions.leave(); }}>{t('hud.leaveYes')}</Button>
      </div>
    </Modal>
  );
}
