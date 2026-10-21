// Loader: logo + progress bar while sprites / fonts (and any registered session tasks) load,
// then a big "Играть" button. That click is the user gesture that unlocks audio (actions.start).
import { useEffect, useState } from 'preact/hooks';
import { crazyLoaded, onCrazyGames } from '$/crazygames';
import { discord, discordError } from '$/discord';
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
    if (!ready) return;
    // Discord activity: launching it was the click, go straight into the channel's room;
    // CrazyGames: the platform's own play button was the click, go straight on to the menu
    if (discord.peek() || onCrazyGames.peek()) go();
    else document.querySelector<HTMLElement>('.loader__play')?.focus({ preventScroll: true });
  }, [ready]);

  const go = () => {
    crazyLoaded();
    actions.start();
    // Discord activity: straight into the channel's room
    if (discord.peek()) actions.joinDiscord();
    else if (invite) { pendingInvite.value = null; actions.joinByCode(invite); }
    else screen.value = 'menu';
  };

  return (
    <div class="loader" data-nav-root>
      <Logo class="loader__logo" />
      <div class="loader__bottom">
        {ready ? (
          <>
            <Button variant="white" size="xl" onClick={go} data-autofocus class="loader__play">
              {discord.value ? t('loader.discord') : invite ? t('loader.joinRoom', { code: invite }) : t('loader.play')}
            </Button>
            {discordError.value && <p class="loader__text muted">{t('discord.loginFailed', { e: discordError.value })}</p>}
          </>
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
