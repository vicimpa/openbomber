// CrazyGames (https://docs.crazygames.com/sdk/). On their site the SDK is loaded and initialised
// while the loader runs; the loader then goes straight on to the menu (the platform has its own play
// button, no «Играть» click), the platform hears when the game is loading and when it is being
// played (loadingStart / loadingStop, gameplayStart / gameplayStop), and its «mute audio» setting
// is honoured. Anywhere else none of this loads. `?useLocalSdk=true` tries the SDK locally.
import { signal } from '@preact/signals';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const INIT_TIMEOUT_MS = 8000;

/** Served by CrazyGames (known before the SDK is up: e.g. to leave out external links). */
export const onCrazyHost = typeof location !== 'undefined'
  && (/(^|\.)crazygames\.[a-z.]+$/i.test(location.hostname) || new URLSearchParams(location.search).get('useLocalSdk') === 'true');

interface CrazySdk {
  init(): Promise<void>;
  environment: 'crazygames' | 'local' | 'disabled';
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener(listener: (s: { muteAudio?: boolean }) => void): void;
  };
  data?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}

let sdk: CrazySdk | null = null;
let playing = false;
let loading = false;

/** The SDK is up (on CrazyGames, or local testing). */
export const onCrazyGames = signal(false);
/** The platform's «mute audio» setting (wins over the game's own volume). */
export const crazyMuted = signal(false);

const call = (what: string, f: () => void) => { try { f(); } catch (e) { console.warn(`[crazygames] ${what}`, e); } };

function loadScript(src: string) {
  return new Promise<void>((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => ok();
    s.onerror = () => fail(new Error(`${src} failed to load`));
    document.head.appendChild(s);
  });
}

/**
 * The SDK, started (a loader task); resolves either way, the game runs without it. index.html
 * loads and starts it from the very first moment and reports loadingStart() right away
 * (window.__crazyBoot); this only falls back to loading it here.
 */
export async function crazyInit(): Promise<void> {
  if (!onCrazyHost) return;
  try {
    const boot = (window as unknown as { __crazyBoot?: Promise<CrazySdk | null> }).__crazyBoot;
    const timeout = new Promise<null>((done) => setTimeout(() => done(null), INIT_TIMEOUT_MS));
    let s: CrazySdk | null;
    if (boot) {
      s = await Promise.race([boot, timeout]);
      if (s) loading = true; // loadingStart() went out already
    } else {
      await loadScript(SDK_URL);
      const fresh = (window as unknown as { CrazyGames?: { SDK?: CrazySdk } }).CrazyGames?.SDK;
      if (!fresh) return;
      await Promise.race([fresh.init(), timeout]);
      s = fresh.environment === 'crazygames' || fresh.environment === 'local' ? fresh : null;
      if (s) { loading = true; call('loadingStart', () => fresh.game.loadingStart()); }
    }
    if (!s) return;
    sdk = s;
    onCrazyGames.value = true;
    crazyMuted.value = !!s.game.settings?.muteAudio;
    s.game.addSettingsChangeListener((st) => { crazyMuted.value = !!st.muteAudio; });
  } catch (e) {
    console.warn('[crazygames] sdk', e);
  }
}

/**
 * Their Data module, as the game's store (../storage): saves go to the player's CrazyGames
 * account (kept locally for guests). Null without the SDK or with the module off for this game
 * (the «Progress Save» option at submission).
 */
export function crazyData() {
  const d = sdk?.data;
  if (!d) return null;
  try { d.getItem('openbomber.probe'); } catch (e) { console.warn('[crazygames] data module off', e); return null; }
  return d;
}

/** The loader is done: the game shows its menu. */
export function crazyLoaded() {
  if (!sdk || !loading) return;
  loading = false;
  call('loadingStop', () => sdk!.game.loadingStop());
}

/** In a game and not paused (menu drawer, dialogs) → gameplayStart; any break → gameplayStop. */
export function crazyGameplay(on: boolean) {
  if (!sdk || on === playing) return;
  playing = on;
  call(on ? 'gameplayStart' : 'gameplayStop', () => (on ? sdk!.game.gameplayStart() : sdk!.game.gameplayStop()));
}
