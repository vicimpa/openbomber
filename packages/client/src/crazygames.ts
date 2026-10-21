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

/** Load and start the SDK (a loader task); resolves either way, the game runs without it. */
export async function crazyInit(): Promise<void> {
  if (!onCrazyHost) return;
  try {
    await loadScript(SDK_URL);
    const s = (window as unknown as { CrazyGames?: { SDK?: CrazySdk } }).CrazyGames?.SDK;
    if (!s) return;
    await Promise.race([s.init(), new Promise((_, no) => setTimeout(() => no(new Error('init timeout')), INIT_TIMEOUT_MS))]);
    if (s.environment !== 'crazygames' && s.environment !== 'local') return;
    sdk = s;
    onCrazyGames.value = true;
    crazyMuted.value = !!s.game.settings?.muteAudio;
    s.game.addSettingsChangeListener((st) => { crazyMuted.value = !!st.muteAudio; });
    loading = true;
    call('loadingStart', () => s.game.loadingStart());
  } catch (e) {
    console.warn('[crazygames] sdk', e);
  }
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
