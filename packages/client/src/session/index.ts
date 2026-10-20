// Session layer: owns the current GameSource (shared online world, private room or offline
// bots) and wires it to the renderer, audio, input, haptics and the UI store.
//
// Canon flow: while the loader is up we already join the shared world as a spectator, so the
// live arena is behind the UI from the first second. If the server is unreachable we fall back
// to an offline bot match so the page is never empty.

import { effect } from '@preact/signals';
import { Phase, type GameEvent, type WorldState } from '@ob/game';
import type { AudioEngine, GameSource, InputManager, MusicMode } from '../contracts';
import { createAudio } from '../audio';
import { createInput, installPlayGuards } from '../input';
import { connectQuickPlay, createPrivateRoom, joinRoomByCode, MAIN_ROOM_ID, NetSource } from '../net';
import { createRenderer, type RendererExt } from '../render';
import { setStageHandler } from '../ui/App';
import { buildHud } from '../ui/hud';
import { t } from '../ui/i18n';
import {
  bindActions, connectStatus, fps, handleGameEvents, hud, pushChat, registerLoadTask, resetGameState,
  room, screen, settings, spectators, toast, uiCapturesInput,
} from '../ui/store';
import { LocalSource } from './LocalSource';

type Source = (NetSource | LocalSource) & GameSource;

const HUD_INTERVAL_MS = 100;
const ATTRACT_BOTS = 5;

export function startSession() {
  const input: InputManager = createInput();
  const audio: AudioEngine = createAudio();
  let renderer: RendererExt | null = null;
  let source: Source | null = null;
  let unsub: (() => void)[] = [];
  let started = false;      // loader's «Играть» pressed (audio unlocked)
  let wasPlaying = false;

  // ---------------------------------------------------------------- renderer on #stage
  let resolveStage!: (el: HTMLElement) => void;
  const stageReady = new Promise<HTMLElement>((r) => (resolveStage = r));
  setStageHandler((el) => {
    resolveStage(el);
    const unguard = installPlayGuards(el);
    return () => unguard();
  });
  registerLoadTask(
    stageReady
      .then((el) => createRenderer({ parent: el, quality: settings.peek().quality }))
      .then((r) => { renderer = r; }),
  );
  effect(() => renderer?.setQuality(settings.value.quality));
  effect(() => audio.setVolume(settings.value.volume));
  effect(() => input.setEnabled(!uiCapturesInput.value));

  // ---------------------------------------------------------------- sources
  const profile = () => ({ name: settings.peek().name, skin: settings.peek().skin });

  function setSource(next: Source, info: { code: string; isPrivate: boolean; offline: boolean }) {
    if (source && source !== next) source.dispose();
    unsub.forEach((u) => u());
    unsub = [];
    resetGameState();
    source = next;
    wasPlaying = false;
    room.value = info;
    screen.value = started ? 'game' : screen.peek();
    if (next instanceof NetSource) {
      next.chatLog.forEach(pushChat);
      unsub.push(next.onChat(pushChat));
      unsub.push(next.onStatus((s) => {
        if (s === 'reconnecting') toast(t('net.reconnecting'), 'info');
        if (s === 'disconnected' && source === next) {
          toast(t('net.disconnected'), 'bad');
          goOfflineAttract();
        }
      }));
    }
  }

  function goOfflineAttract() {
    setSource(new LocalSource({ bots: ATTRACT_BOTS, ...profile() }), { code: 'OFFLINE', isPrivate: false, offline: true });
  }

  async function connect(kind: 'quick' | 'private' | 'join', job: () => Promise<NetSource>, code?: string) {
    connectStatus.value = { kind, code };
    if (started) screen.value = 'connecting';
    try {
      const net = await job();
      setSource(net, { code: net.roomId, isPrivate: net.roomId !== MAIN_ROOM_ID, offline: false });
    } catch (e) {
      console.warn('[session] connect failed', e);
      if (kind === 'quick' && !source) {
        goOfflineAttract();
        toast(t('net.offlineFallback'), 'bad');
      } else {
        connectStatus.value = { kind, code, error: e instanceof Error ? e.message : String(e) };
        if (!started) goOfflineAttract();
      }
    }
  }

  const quickPlay = () => connect('quick', () => connectQuickPlay(profile()));

  // Join the shared world (or the invite room) while the loader is still showing.
  registerLoadTask(quickPlay());

  bindActions({
    start() {
      started = true;
      audio.unlock();
      screen.value = 'game';
    },
    async play(enabled) {
      if (!source) return;
      const ok = await source.play(enabled);
      if (enabled && !ok) toast(t('net.full'), 'bad');
    },
    quickPlay,
    createPrivate: () => connect('private', () => createPrivateRoom({ ...profile(), bots: 0 })),
    joinByCode: (code) => connect('join', () => joinRoomByCode(code, profile()), code),
    playOffline({ bots, difficulty }) {
      setSource(new LocalSource({ bots, difficulty, play: true, ...profile() }), { code: 'OFFLINE', isPrivate: false, offline: true });
    },
    leave: () => quickPlay(),
    sendChat(text) {
      if (source instanceof NetSource) source.sendChat(text);
      else pushChat({ from: source?.localId ?? '', name: settings.peek().name, text, at: Date.now() });
    },
    setProfile(p) { source?.setProfile(p); },
    uiSound(s) { audio.ui(s); },
  });

  // ---------------------------------------------------------------- frame loop
  let last = performance.now();
  let hudAcc = HUD_INTERVAL_MS;
  let fpsAcc = 0;
  let frames = 0;

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(now - last, 250);
    last = now;

    const src = source;
    if (src) {
      const s = input.sample();
      src.update(dt, { dx: s.dx, dy: s.dy, buttons: s.buttons });
      const world = src.world;
      const localId = src.localId;
      const events = src.drainEvents();
      if (events.length) react(events, world, localId);
      renderer?.render(world, localId, dt);

      hudAcc += dt;
      if (world && hudAcc >= HUD_INTERVAL_MS) {
        hudAcc = 0;
        hud.value = buildHud(world, localId, src.ping);
        if (src instanceof NetSource) {
          if (spectators.peek().length !== src.spectators)
            spectators.value = Array.from({ length: src.spectators }, (_, i) => ({ id: `s${i}`, name: '' }));
        } else if (spectators.peek().length) spectators.value = [];
        if (started) audio.setMusic(musicFor(world, localId));
      }
    } else {
      renderer?.render(null, '', dt);
    }

    frames++;
    fpsAcc += dt;
    if (fpsAcc >= 500) {
      fps.value = Math.round((frames * 1000) / fpsAcc);
      frames = 0;
      fpsAcc = 0;
    }
  };
  requestAnimationFrame(frame);

  // Dev / QA hook (stripped from production builds): inspect the live session from the console.
  if (import.meta.env.DEV) {
    let music: MusicMode = 'off';
    const setMusic = audio.setMusic.bind(audio);
    audio.setMusic = (m) => { music = m; setMusic(m); };
    (window as unknown as { __ob: unknown }).__ob = {
      get source() { return source; },
      get renderer() { return renderer; },
      get music() { return music; },
      audio, input,
    };
  }

  function react(events: GameEvent[], world: WorldState | null, localId: string) {
    renderer?.handleEvents(events, localId);
    audio.handleEvents(events, world, localId);
    handleGameEvents(events, world, localId);
    if (!localId) return;
    const me = world?.players.get(localId);
    for (const e of events) {
      switch (e.type) {
        case 'bombPlaced': if (e.owner === localId) input.vibrate(15, 0.3); break;
        case 'playerDied': if (e.player === localId) input.vibrate([60, 40, 120], 1); break;
        case 'shieldBlocked': if (e.player === localId) input.vibrate([30, 30, 30], 0.7); break;
        case 'pickupCollected': if (e.by === localId) input.vibrate(10, 0.2); break;
        case 'explosion':
          if (me && Math.hypot(e.x - me.x, e.y - me.y) < 5) input.vibrate(35, 0.6);
          break;
      }
    }
  }

  function musicFor(world: WorldState, localId: string): MusicMode {
    const me = localId ? world.players.get(localId) : undefined;
    const playing = !!me && me.inRound;
    if (world.phase === Phase.RoundOver && wasPlaying) {
      return world.winner === localId ? 'victory' : 'defeat';
    }
    wasPlaying = playing;
    if (!playing) return 'menu';
    if (world.zoneRing > 0) return 'sudden';
    if (world.phase === Phase.Waiting) return 'waiting';
    return 'battle';
  }
}
