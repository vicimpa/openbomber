import { useEffect } from 'preact/hooks';
import { Button } from './components';
import { t } from './i18n';
import { HeroSprite } from './sprites';
import { actions, connectStatus, openModal, screen, settings } from './store';

export function ConnectingScreen() {
  const st = connectStatus.value;
  const msg = st.kind === 'private' ? t('connect.creating')
    : st.kind === 'join' ? t('connect.joining', { code: st.code ?? '' })
    : st.kind === 'quick' ? t('connect.searching') : t('connect.connecting');

  const back = () => { actions.uiSound('back'); actions.leave(); screen.value = 'menu'; };
  const retry = () => {
    if (st.kind === 'private') actions.createPrivate();
    else if (st.kind === 'join' && st.code) actions.joinByCode(st.code);
    else actions.quickPlay();
  };

  useEffect(() => {
    const onBack = () => back();
    document.addEventListener('ui:back', onBack);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') back(); };
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('ui:back', onBack); window.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div class="screen connecting" data-nav-root>
      <div class="menu__bg" aria-hidden="true"><div class="menu__grid" /><div class="menu__glow" /></div>
      <div class={`connect-card card ${st.error ? 'is-error' : ''}`} role="status" aria-live="polite">
        {st.error ? <>
          <div class="connect-card__icon" aria-hidden="true">💥</div>
          <h2 class="pixel">{t('connect.error')}</h2>
          <p class="connect-card__err">{st.error}</p>
          <div class="connect-card__row">
            <Button variant="primary" icon="↻" onClick={retry} data-autofocus>{t('connect.retry')}</Button>
            <Button variant="lime" icon="🤖" onClick={() => { screen.value = 'menu'; openModal('bots'); }}>{t('connect.offline')}</Button>
            <Button variant="ghost" onClick={back}>{t('connect.back')}</Button>
          </div>
        </> : <>
          <div class="connect-card__runner" aria-hidden="true">
            <HeroSprite skin={settings.value.skin} anim="RunRight" scale={3} />
            <span class="connect-card__bomb">💣</span>
          </div>
          <h2 class="pixel connect-card__msg">{msg}</h2>
          <div class="dots" aria-hidden="true"><i /><i /><i /></div>
          <Button variant="ghost" onClick={back} data-autofocus>{t('connect.cancel')}</Button>
        </>}
      </div>
    </div>
  );
}
