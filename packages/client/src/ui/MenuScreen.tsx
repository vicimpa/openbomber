import { useEffect, useState } from 'preact/hooks';
import { Button } from './components';
import { t } from './i18n';
import { NAME_MAX, randomName } from './names';
import { SKIN_COUNT } from './settings';
import { HeroSprite, type HeroAnim } from './sprites';
import { actions, openModal, pendingInvite, setName, setSkin, settings } from './store';

const SHOWCASE: { anim: HeroAnim; flip?: boolean }[] = [
  { anim: 'RunDown' }, { anim: 'RunRight' }, { anim: 'IdleDown' }, { anim: 'RunUp' }, { anim: 'RunRight', flip: true }, { anim: 'IdleDownBomb' },
];

function ShowcaseHero({ skin }: { skin: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % SHOWCASE.length), 1500);
    return () => clearInterval(id);
  }, []);
  const s = SHOWCASE[i];
  return <HeroSprite skin={skin} anim={s.anim} flip={s.flip} scale={4} class="showcase__hero" />;
}

function SkinPicker() {
  const skin = settings.value.skin;
  const step = (d: number) => setSkin((skin + d + SKIN_COUNT) % SKIN_COUNT);
  return (
    <div class="skin-picker">
      <div class="showcase">
        <button class="icon-btn icon-btn--lg" onClick={() => { actions.uiSound('click'); step(-1); }} aria-label={t('menu.prevSkin')} title={t('menu.prevSkin')}>◀</button>
        <div class="showcase__stage" key={skin}>
          <ShowcaseHero skin={skin} />
          <div class="showcase__shadow" />
        </div>
        <button class="icon-btn icon-btn--lg" onClick={() => { actions.uiSound('click'); step(1); }} aria-label={t('menu.nextSkin')} title={t('menu.nextSkin')}>▶</button>
      </div>
      <div class="skin-strip" role="radiogroup" aria-label={t('menu.skin')}>
        {Array.from({ length: SKIN_COUNT }, (_, n) => (
          <button
            type="button"
            role="radio"
            aria-checked={n === skin}
            class={`skin-thumb ${n === skin ? 'is-on' : ''}`}
            onClick={() => { actions.uiSound('click'); setSkin(n); }}
            title={t('menu.skinN', { n: n + 1 })}
            aria-label={t('menu.skinN', { n: n + 1 })}
          >
            <HeroSprite skin={n} anim={n === skin ? 'RunDown' : 'IdleDown'} scale={1.25} />
          </button>
        ))}
      </div>
    </div>
  );
}

function NameField() {
  const name = settings.value.name;
  return (
    <div class="field field--name">
      <label for="nick" class="field__label">{t('menu.nickname')}</label>
      <div class="name-row">
        <input
          id="nick"
          class="input"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="nickname"
          spellcheck={false}
          enterKeyHint="done"
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          onBlur={(e) => { if (!(e.target as HTMLInputElement).value.trim()) setName(randomName(settings.value.language)); }}
        />
        <button
          class="icon-btn icon-btn--dice"
          onClick={() => { actions.uiSound('click'); setName(randomName(settings.value.language)); }}
          title={t('menu.randomName')}
          aria-label={t('menu.randomName')}
        >🎲</button>
      </div>
    </div>
  );
}

export function MenuScreen() {
  const invite = pendingInvite.value;
  return (
    <div class="screen menu" data-nav-root>
      <div class="menu__bg" aria-hidden="true">
        <div class="menu__grid" />
        <div class="menu__glow" />
      </div>
      <main class="menu__wrap">
        <header class="brand">
          <img class="brand__logo" src="./logo/logo_160.png" alt="" width={80} height={80} />
          <div>
            <h1 class="brand__title pixel">OPEN<span>BOMBER</span></h1>
            <p class="brand__tag">{t('app.tagline')}</p>
          </div>
        </header>

        {invite && (
          <div class="invite">
            <span>✉️ {t('menu.invite', { code: invite })}</span>
            <Button variant="lime" size="sm" onClick={() => { pendingInvite.value = null; actions.joinByCode(invite); }}>{t('menu.inviteJoin')}</Button>
            <button class="icon-btn" onClick={() => { pendingInvite.value = null; }} aria-label={t('common.close')}>✕</button>
          </div>
        )}

        <div class="menu__cols">
          <section class="card card--profile">
            <SkinPicker />
            <NameField />
          </section>

          <section class="card card--play">
            <Button variant="primary" size="xl" block icon="⚡" sub={t('menu.quickPlayHint')} onClick={() => actions.quickPlay()} data-autofocus>
              {t('menu.quickPlay')}
            </Button>
            <div class="play-grid">
              <Button variant="cyan" size="lg" icon="🔒" onClick={() => actions.createPrivate()} title={t('menu.createPrivate')}>
                {t('menu.createPrivateShort')}
              </Button>
              <Button variant="pink" size="lg" icon="🔑" onClick={() => openModal('join')}>{t('menu.joinByCode')}</Button>
              <Button variant="lime" size="lg" icon="🤖" onClick={() => openModal('bots')} class="play-grid__wide">{t('menu.vsBots')}</Button>
            </div>
            <div class="menu__minor">
              <Button variant="ghost" icon="⚙️" onClick={() => openModal('settings')}>{t('menu.settings')}</Button>
              <Button variant="ghost" icon="❔" onClick={() => openModal('howto')}>{t('menu.howTo')}</Button>
            </div>
          </section>
        </div>

        <footer class="menu__footer">
          <a href="https://github.com/vicimpa/openbomber" target="_blank" rel="noopener">{t('menu.footer')}</a>
          <span class="menu__lang">
            {(['ru', 'en'] as const).map((l) => (
              <button class={settings.value.language === l ? 'is-on' : ''} onClick={() => { settings.value = { ...settings.value, language: l }; }}>{l.toUpperCase()}</button>
            ))}
          </span>
        </footer>
      </main>
    </div>
  );
}
