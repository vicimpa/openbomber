// Session layer: owns the current GameSource (shared online world, private room or offline
// bots) and wires it to the renderer, audio, input, haptics and the UI store.
//
// Flow: loader → main menu over a live offline bot match (attract camera) → «Играть онлайн»
// (shared arena), «Одиночная игра» (bots), own room / join by code → the in-game HUD.
// Leaving any game returns to the menu. Music is off by design; sound effects stay.

import { effect } from '@preact/signals';
import { sec, type GameEvent, type WorldState } from '@ob/game';
import type { AudioEngine, GameSource, InputManager } from '../contracts';
import { createAudio } from '../audio';
import { createInput, installPlayGuards } from '../input';
import { connectQuickPlay, createPrivateRoom, joinDiscordRoom, joinRoomByCode, listRooms, MAIN_ROOM_ID, NetSource, resolveServerUrl, toHttpUrl } from '../net';
import { discord, discordLogin, inDiscord } from '../discord';
import { createRenderer, type RendererExt } from '../render';
import { setStageHandler } from '../ui/App';
import { buildHud } from '../ui/hud';
import { t } from '../ui/i18n';
import {
  avatars, bindActions, connectStatus, fps, handleGameEvents, hud, onlineCount, pushChat, registerLoadTask, resetGameState,
  pendingInvite, room, roomSettings, screen, settings, spectators, toast, uiCapturesInput,
} from '../ui/store';
import { LocalSource } from './LocalSource';
import { perfAdd, perfFrame, perfNow } from '../perf';

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
  let avatarsVersion = -1;  // NetSource.avatarsVersion last copied into the `avatars` signal
  let cameraMode: 'overview' | 'follow' = 'overview'; // for the source on show (kept until the renderer exists)

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
      .then((r) => {
        renderer = r;
        r.onTravel = (ms, dx) => audio.travel?.(ms, dx); // whoosh while the camera travels between maps
        r.onTeleport = (kind, x, y, who, crowd) => audio.teleport?.(kind, x, y, who, crowd);
        r.onThunder = (delay, power) => audio.thunder?.(delay, power);
        // the first menu backdrop was set up (and warmed up) before the renderer existed
        r.setCameraMode(cameraMode);
        if (source instanceof LocalSource) r.prime(source.takePrimeEvents());
      }),
  );
  // Discord activity: sign in while the loader runs (the name and the room come from it)
  if (inDiscord) registerLoadTask(discordLogin(toHttpUrl(resolveServerUrl())));
  effect(() => renderer?.setQuality(settings.value.quality));
  effect(() => audio.setVolume(settings.value.volume));
  effect(() => input.setEnabled(!uiCapturesInput.value));
  // Desktop main menu: the panel covers the left side, so the spectator camera frames the rest.
  const menuInset = () => {
    const el = document.querySelector<HTMLElement>('.mm__panel');
    const r = el?.getBoundingClientRect();
    // only a left-hand panel that leaves real room beside it; on phones the panel sits in the
    // middle, and framing "beside" it pushed the arena off-screen
    const side = !!r && r.left < innerWidth * 0.25 && r.right < innerWidth * 0.55;
    renderer?.setViewInset(screen.peek() === 'menu' && side ? r!.right : 0);
  };
  effect(() => { screen.value; requestAnimationFrame(menuInset); });
  addEventListener('resize', menuInset);

  // ---------------------------------------------------------------- sources
  // Discord activity: the channel's room is the whole game (no main menu, other rooms or bots)
  const locked = () => !!discord.peek();
  const joinDiscord = () => {
    const d = discord.peek();
    if (d) return connect('discord', () => joinDiscordRoom(d.instanceId, { ...profile(), discord: d.token }));
  };

  const profile = () => {
    const d = discord.peek();
    return { name: d?.name ?? settings.peek().name, skin: settings.peek().skin, discord: d?.token };
  };

  function setSource(next: Source, info: { code: string; isPrivate: boolean; offline: boolean } | null, to: 'menu' | 'game') {
    if (source && source !== next) source.dispose();
    unsub.forEach((u) => u());
    unsub = [];
    resetGameState();
    avatarsVersion = -1;
    avatars.value = new Map();
    source = next;
    room.value = info;
    cameraMode = to === 'menu' ? 'overview' : 'follow';
    renderer?.setCameraMode(cameraMode);
    if (started) screen.value = to;
    if (next instanceof NetSource) {
      next.chatLog.forEach(pushChat);
      unsub.push(next.onChat(pushChat));
      unsub.push(next.onStatus((s) => {
        if (s === 'reconnecting') toast(t('net.reconnecting'), 'info');
        if (s === 'disconnected' && source === next) {
          toast(t('net.disconnected'), 'bad', undefined, undefined, true);
          if (locked()) void joinDiscord();
          else toMenu();
        }
      }));
    }
  }

  /** Main menu: a live bot match behind it, watched with the spectator camera. */
  function toMenu() {
    // start the backdrop mid-game (20-35 s in), not on a pristine map
    const warmupTicks = sec(20 + Math.random() * 15);
    const src = new LocalSource({ bots: ATTRACT_BOTS, difficulty: 'normal', warmupTicks });
    setSource(src, null, 'menu');
    if (renderer) renderer.prime(src.takePrimeEvents());
  }

  async function connect(kind: 'quick' | 'private' | 'join' | 'discord', job: () => Promise<NetSource>, code?: string) {
    connectStatus.value = { kind, code };
    screen.value = 'connecting';
    try {
      const net = await job();
      setSource(net, { code: net.roomId, isPrivate: net.roomId !== MAIN_ROOM_ID, offline: false }, 'game');
    } catch (e) {
      console.warn('[session] connect failed', e);
      connectStatus.value = { kind, code, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // no game behind the loader: only the countryside (the renderer draws it while there's no source)

  // Shared arena head count for the menu («общая арена · игроков: N»).
  const pollOnline = async () => {
    if (screen.peek() === 'menu' || screen.peek() === 'loader') {
      try {
        const rooms = await listRooms();
        const main = rooms.find((r) => r.roomId === MAIN_ROOM_ID);
        onlineCount.value = main ? (main.metadata?.humans ?? 0) : null;
      } catch {
        onlineCount.value = null;
      }
    }
    setTimeout(pollOnline, 5000);
  };
  pollOnline();

  bindActions({
    start() {
      started = true;
      audio.unlock();
      // started without a gesture (Discord activity): the first input wakes the audio up
      for (const type of ['pointerdown', 'keydown'] as const) addEventListener(type, () => audio.unlock(), { once: true, capture: true });
      audio.setMusic('off');
      // the bot match behind the menu starts now, and the camera flies over to it; an invite link
      // or the Discord room go straight to their own game instead
      if (!locked() && !pendingInvite.peek()) toMenu();
      else screen.value = 'menu';
    },
    async play(enabled) {
      if (!source) return;
      const ok = await source.play(enabled);
      if (enabled && !ok) {
        const why = source instanceof NetSource ? source.playRefusal : undefined;
        toast(t(why === 'wait' ? 'net.wait' : why === 'rate' ? 'net.rate' : 'net.full'), 'bad');
      }
    },
    // «Играть онлайн»: the shared arena, straight into the round (spectate via «Отключиться»)
    quickPlay: () => { if (!locked()) return connect('quick', () => connectQuickPlay({ ...profile(), play: true })); },
    createPrivate: () => { if (!locked()) return connect('private', () => createPrivateRoom({ ...profile(), bots: 0 })); },
    joinByCode: (code) => { if (!locked()) return connect('join', () => joinRoomByCode(code, { ...profile(), play: true }), code); },
    joinDiscord,
    playOffline({ bots, difficulty }) {
      if (locked()) return;
      setSource(new LocalSource({ bots, difficulty, play: true, ...profile() }), { code: 'OFFLINE', isPrivate: false, offline: true }, 'game');
    },
    leave: () => { if (!locked()) toMenu(); },
    sendChat(text) {
      if (source instanceof NetSource) source.sendChat(text);
      else pushChat({ from: source?.localId ?? '', name: settings.peek().name, text, at: Date.now() });
    },
    setProfile(p) { source?.setProfile(p); },
    setRoomSettings(p) { if (source instanceof NetSource) source.setRoomSettings(p); },
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
    perfFrame(dt);

    const src = source;
    if (src) {
      const s = input.sample();
      const s0 = perfNow();
      src.update(dt, { dx: s.dx, dy: s.dy, buttons: s.buttons });
      perfAdd('sim', perfNow() - s0);
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
          if (src.avatarsVersion !== avatarsVersion) { avatarsVersion = src.avatarsVersion; avatars.value = new Map(src.avatars); }
          if (spectators.peek().length !== src.spectators)
            spectators.value = Array.from({ length: src.spectators }, (_, i) => ({ id: `s${i}`, name: '' }));
          // own rooms: settings panel (re-render only when something changed)
          const rs = src.roomId !== MAIN_ROOM_ID ? { ...src.roomSettings, isHost: src.isHost } : null;
          const cur = roomSettings.peek();
          if (!rs !== !cur || (rs && cur && (rs.bots !== cur.bots || rs.botDifficulty !== cur.botDifficulty
            || rs.maxPlayers !== cur.maxPlayers || rs.zone !== cur.zone || rs.events !== cur.events
            || rs.isHost !== cur.isHost))) roomSettings.value = rs;
        } else {
          if (avatars.peek().size) { avatarsVersion = -1; avatars.value = new Map(); }
          if (spectators.peek().length) spectators.value = [];
          if (roomSettings.peek()) roomSettings.value = null;
        }
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
    (window as unknown as { __ob: unknown }).__ob = {
      get source() { return source; },
      get renderer() { return renderer; },
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
}
