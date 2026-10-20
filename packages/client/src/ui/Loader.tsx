// Loader: logo + progress bar while sprites / fonts (and any registered session tasks) load,
// then a big "Играть" button. That click is the user gesture that unlocks audio (actions.start).
import { useEffect, useState } from 'preact/hooks';
import { Button, Logo } from './components';
import { t } from './i18n';
import { heroImageUrls } from './sprites';
import { actions, pendingInvite, pendingLoadTasks, screen } from './store';

const extraImages = Object.values(import.meta.glob<string>(['../assets/pickups/*.png', '../assets/ui/*.png'], { eager: true, query: '?url', import: 'default' }));

function loadImage(url: string) {
  return new Promise<void>((res) => {
    const img = new Image();
    img.onload = img.onerror = () => res();
    img.src = url;
  });
}

export function Loader() {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const invite = pendingInvite.value;

  useEffect(() => {
    let done = 0;
    const jobs: Promise<unknown>[] = [
      ...[...heroImageUrls, ...extraImages].map(loadImage),
      document.fonts?.load('16px BetterVCR').catch(() => {}) ?? Promise.resolve(),
      ...pendingLoadTasks(),
    ];
    const total = jobs.length;
    jobs.forEach((j) => j.then(() => setProgress(++done / total)));
    const minTime = new Promise((r) => setTimeout(r, 700));
    Promise.all([Promise.all(jobs), minTime]).then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) document.querySelector<HTMLElement>('.loader__play')?.focus({ preventScroll: true });
  }, [ready]);

  const go = () => {
    actions.start();
    if (invite) { pendingInvite.value = null; actions.joinByCode(invite); }
    else screen.value = 'menu';
  };

  return (
    <div class="loader" data-nav-root>
      <Logo class="loader__logo" />
      <div class="loader__bottom">
        {ready ? (
          <Button variant="white" size="xl" onClick={go} data-autofocus class="loader__play">
            {invite ? t('loader.joinRoom', { code: invite }) : t('loader.play')}
          </Button>
        ) : (
          <>
            <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div class="progress__fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <h3 class="loader__text">{t('loader.loading')}</h3>
          </>
        )}
      </div>
    </div>
  );
}
