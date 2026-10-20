// Main menu: shown after the loader and whenever you leave a game. It sits over a live
// bot match (attract mode) and uses the new-openbomber look: noise panel with a white
// frame, the pixel logo, chunky white bevelled buttons.
import { useEffect, useRef, useState } from 'preact/hooks';
import { canFullscreen, isFullscreen, toggleFullscreen } from '$/input/fullscreen';
import { Button, Logo } from './components';
import { t } from './i18n';
import { LINKS } from './links';
import { NAME_MAX, randomName } from './names';
import { SKIN_COUNT } from './settings';
import { HeroSprite } from './sprites';
import { actions, onlineCount, openModal, setName, setSkin, settings } from './store';

function ProfileCard() {
  const { name, skin, language } = settings.value;
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(name), [name]);

  const commit = () => {
    const v = draft.trim();
    if (v) setName(v);
    else setDraft(name);
  };
  const step = (d: number) => {
    actions.uiSound('click');
    setSkin((skin + d + SKIN_COUNT) % SKIN_COUNT);
  };

  return (
    <section class="mm__profile">
      <button class="mm__arrow" onClick={() => step(-1)} aria-label={t('menu.prevSkin')} title={t('menu.prevSkin')}>◀</button>
      <button class="mm__hero" onClick={() => { actions.uiSound('click'); openModal('skin'); }} aria-label={t('menu.chooseSkin')} title={t('menu.chooseSkin')}>
        <span class="mm__spot" aria-hidden="true" />
        <HeroSprite skin={skin} anim="RunDown" scale={2} />
      </button>
      <button class="mm__arrow" onClick={() => step(1)} aria-label={t('menu.nextSkin')} title={t('menu.nextSkin')}>▶</button>
      <div class="mm__name">
        <input
          ref={input}
          class="mm__name-input"
          value={draft}
          maxLength={NAME_MAX}
          aria-label={t('menu.nickname')}
          autoComplete="nickname"
          spellcheck={false}
          enterKeyHint="done"
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') input.current?.blur(); }}
        />
        <button class="icon-btn" onClick={() => { actions.uiSound('click'); setName(randomName(language)); }} aria-label={t('menu.randomName')} title={t('menu.randomName')}>🎲</button>
      </div>
    </section>
  );
}

export function MainMenu() {
  const online = onlineCount.value;
  return (
    <div class="mm" data-nav-root>
      <div class="mm__panel">
        <Logo class="mm__logo" />
        <ProfileCard />

        <div class="mm__actions">
          <Button
            variant="white"
            size="xl"
            block
            data-autofocus
            onClick={() => actions.quickPlay()}
            sub={online === null ? t('mm.onlineHint') : t('mm.onlineCount', { n: online })}
          >
            {t('mm.online')}
          </Button>
          <Button variant="white" size="xl" block onClick={() => openModal('bots')} sub={t('mm.soloHint')}>
            {t('mm.solo')}
          </Button>
          <div class="row2">
            <Button block icon="🔒" onClick={() => actions.createPrivate()}>{t('mm.createRoom')}</Button>
            <Button block icon="🔑" onClick={() => openModal('join')}>{t('menu.joinByCode')}</Button>
          </div>
          <div class="row3">
            <Button block icon="⚙️" onClick={() => openModal('settings')}>{t('settings.title')}</Button>
            <Button block icon="❔" onClick={() => openModal('howto')}>{t('mm.rules')}</Button>
            {canFullscreen && (
              <Button block icon="⛶" onClick={() => toggleFullscreen()} aria-pressed={isFullscreen.value}>{t('mm.screen')}</Button>
            )}
          </div>
        </div>

        <nav class="mm__links" aria-label={t('menu.links')}>
          {LINKS.map((l) => (
            <a href={l.href} target="_blank" rel="noopener" title={t(l.key)} aria-label={t(l.key)}>
              <span class="links__icon" style={{ background: l.color }} aria-hidden="true">{l.glyph}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
