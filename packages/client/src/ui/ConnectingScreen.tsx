// Connecting overlay (over the world): joining / creating a room, or the error with retry.
import { useEffect } from 'preact/hooks';
import { Button } from './components';
import { t } from './i18n';
import { Icon } from './icons';
import { HeroSprite } from './sprites';
import { actions, connectStatus, openModal, screen, settings } from './store';

export function ConnectingScreen() {
  const st = connectStatus.value;
  const msg = st.kind === 'private' ? t('connect.creating')
    : st.kind === 'join' ? t('connect.joining', { code: st.code ?? '' })
    : st.kind === 'quick' ? t('connect.searching') : t('connect.connecting');

  const back = () => { actions.uiSound('back'); actions.leave(); };
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
    <div class="overlay" data-nav-root>
      <div class={`box connect ${st.error ? 'is-error' : ''}`} role="status" aria-live="polite">
        {st.error ? <>
          <h2><Icon name="warning" /> {t('connect.error')}</h2>
          <p class="muted">{st.error}</p>
          <div class="connect__row">
            <Button variant="white" onClick={retry} data-autofocus>{t('connect.retry')}</Button>
            <Button onClick={() => { screen.value = 'menu'; openModal('bots'); }} icon={<Icon name="bot" />}>{t('connect.offline')}</Button>
            <Button onClick={back}>{t('connect.back')}</Button>
          </div>
        </> : <>
          <div class="connect__runner" aria-hidden="true"><HeroSprite skin={settings.value.skin} anim="RunRight" scale={2} /></div>
          <h2>{msg}</h2>
          <div class="progress progress--busy" aria-hidden="true"><div class="progress__fill" /></div>
          <Button onClick={back} data-autofocus>{t('connect.cancel')}</Button>
        </>}
      </div>
    </div>
  );
}
