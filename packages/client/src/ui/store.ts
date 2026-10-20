// App state (signals) + the action surface the session layer implements.
//
// Session integration:
//   bindActions({ quickPlay, createPrivate, joinByCode, playOffline, leave, sendChat, setProfile, uiSound })
//   screen.value = 'connecting' | 'game' | 'menu';  connectStatus.value = {...}
//   hud.value = buildHud(world, localId, ping)      (~10 Hz)
//   fps.value = n;  room.value = { code, isPrivate, offline }
//   pushChat(msg) / handleGameEvents(events, world, localId) / toast(text)
//   stage.value: the #stage element of the mounted GameScreen (or use <GameScreen onStageReady>)
//   uiCapturesInput.value: true while chat / a modal is open → call input.setEnabled(!v)
import { computed, signal } from '@preact/signals';
import type { ChatMessage, GameEvent, RoomSettings, WorldState } from '@ob/game';
import type { UiSound } from '$/contracts';
import type { HudSnapshot } from './hud';
import { t, type I18nKey } from './i18n';
import type { IconName } from './icons';
import { CURSE_BY_ID } from './pickups';
import { tr } from './i18n';
import { settings, updateSettings, type Settings } from './settings';

export { settings, updateSettings, type Settings };

// ---------------------------------------------------------------- navigation
/**
 * 'loader' (asset preload + "Играть" gesture) → 'game' (the shared world, spectating first; the
 * menu is a drawer over it). 'connecting' overlays the world while switching rooms.
 * 'menu' is the main menu (over the attract-mode bot match), 'game' the in-game HUD.
 */
export type Screen = 'loader' | 'menu' | 'connecting' | 'game';
export const screen = signal<Screen>('loader');

/** Extra work the loader waits for (renderer atlases, audio...). Register before or during loading. */
const loadTasks: Promise<unknown>[] = [];
export const loadTaskCount = signal(0);
export function registerLoadTask<T>(p: Promise<T>): Promise<T> {
  loadTasks.push(p.catch((e) => console.warn('[ui] load task failed', e)));
  loadTaskCount.value = loadTasks.length;
  return p;
}
export function pendingLoadTasks() { return loadTasks; }

export type ModalId = null | 'settings' | 'howto' | 'join' | 'bots' | 'leave' | 'skin';
/** Stack of open modals (top = last). */
export const modals = signal<Exclude<ModalId, null>[]>([]);
export const topModal = computed<ModalId>(() => modals.value[modals.value.length - 1] ?? null);
export function openModal(id: Exclude<ModalId, null>) {
  if (topModal.value !== id) modals.value = [...modals.value, id];
}
export function closeModal(id?: ModalId) {
  const list = modals.value;
  if (!list.length) return;
  modals.value = id ? list.filter((m) => m !== id) : list.slice(0, -1);
}
export function closeAllModals() { modals.value = []; }

export interface ConnectStatus {
  kind: 'quick' | 'private' | 'join' | 'offline';
  code?: string;
  /** Set when connecting failed; the screen then shows retry / back / play offline. */
  error?: string;
}
export const connectStatus = signal<ConnectStatus>({ kind: 'quick' });

/** Current room: code is shown in the HUD with a copy/share button for private rooms. */
export interface RoomInfo { code: string; isPrivate: boolean; offline: boolean }
export const room = signal<RoomInfo | null>(null);

/** Code from `#room=CODE` (invite link) waiting to be joined. */
export const pendingInvite = signal<string | null>(null);

// ---------------------------------------------------------------- game HUD
export const hud = signal<HudSnapshot | null>(null);
export const fps = signal(0);
/** Own online room: its settings and whether this player is the host (null elsewhere). */
export const roomSettings = signal<(RoomSettings & { isHost: boolean }) | null>(null);
/** Players in the shared online arena (main menu hint); null = unknown / server down. */
export const onlineCount = signal<number | null>(null);
export const stage = signal<HTMLElement | null>(null);

/** Chat drawer open (T / chat button); its input gets focus. */
export const chatOpen = signal(false);
/** Menu drawer open (menu button / Esc / gamepad Start). */
export const menuOpen = signal(false);
export const scoreboardOpen = signal(false);
/** True while the UI owns the keyboard (chat input, modal). Session: input.setEnabled(!value). */
export const uiCapturesInput = computed(() => chatOpen.value || menuOpen.value || modals.value.length > 0);

/** Players of the current world (scoreboard order) — derived from `hud`. */
export const players = computed(() => hud.value?.players ?? []);
/** People watching the room without a PlayerState (canon «Наблюдателей: N»). Session sets it. */
export interface SpectatorInfo { id: string; name: string }
export const spectators = signal<SpectatorInfo[]>([]);

export const chat = signal<(ChatMessage & { id: number })[]>([]);
let chatSeq = 0;
export function pushChat(msg: ChatMessage) {
  chat.value = [...chat.value.slice(-49), { ...msg, id: ++chatSeq }];
}

export interface KillEntry {
  id: number;
  at: number;
  kind: 'kill' | 'self' | 'world';
  killer?: { name: string; skin: number; isLocal: boolean };
  victim: { name: string; skin: number; isLocal: boolean };
}
export const killFeed = signal<KillEntry[]>([]);
let killSeq = 0;
export function pushKill(e: Omit<KillEntry, 'id' | 'at'>) {
  killFeed.value = [...killFeed.value.slice(-5), { ...e, id: ++killSeq, at: Date.now() }];
}

// ---------------------------------------------------------------- toasts
export interface Toast { id: number; text: string; kind: 'info' | 'good' | 'bad'; ttl: number; icon?: IconName }
export const toasts = signal<Toast[]>([]);
let toastSeq = 0;
export function toast(text: string, kind: Toast['kind'] = 'info', ttl = 2800, icon?: IconName) {
  const id = ++toastSeq;
  toasts.value = [...toasts.value.slice(-3), { id, text, kind, ttl, icon }];
  setTimeout(() => { toasts.value = toasts.value.filter((x) => x.id !== id); }, ttl);
}
export const toastKey = (key: I18nKey, kind?: Toast['kind']) => toast(t(key), kind);

// ---------------------------------------------------------------- events → feed
/** Turns sim events into kill-feed entries / toasts. Call with every drained event batch. */
export function handleGameEvents(events: GameEvent[], world: WorldState | null, localId: string) {
  if (!world) return;
  const who = (id: string) => {
    const p = world.players.get(id);
    return p ? { name: p.name, skin: p.skin, isLocal: id === localId } : { name: '?', skin: 0, isLocal: false };
  };
  for (const e of events) {
    if (e.type === 'playerDied') {
      const victim = who(e.player);
      if (!e.killer) pushKill({ kind: 'world', victim });
      else if (e.killer === e.player) pushKill({ kind: 'self', victim });
      else pushKill({ kind: 'kill', killer: who(e.killer), victim });
    } else if (e.type === 'curseApplied' && e.player === localId) {
      const c = CURSE_BY_ID.get(e.curse);
      if (c) toast(t('toast.curse', { c: tr(c.name) }), 'bad', undefined, c.icon);
    }
  }
}

// ---------------------------------------------------------------- actions
export type Difficulty = 'easy' | 'normal' | 'hard';
export interface OfflineOptions { bots: number; difficulty: Difficulty }

export interface Actions {
  /** The player pressed "Играть" on the loader (a user gesture: unlock audio, start the attract-mode arena). */
  start(): void;
  /** Canon core loop: «Подключиться» (true) enters the round, «Отключиться» (false) back to spectating. */
  play(enabled: boolean): void | Promise<void>;
  quickPlay(): void | Promise<void>;
  createPrivate(): void | Promise<void>;
  joinByCode(code: string): void | Promise<void>;
  playOffline(opts: OfflineOptions): void | Promise<void>;
  /** Leave the current game and return to the menu. */
  leave(): void | Promise<void>;
  sendChat(text: string): void;
  /** Name / skin changed (also while in a room). */
  setProfile(p: { name?: string; skin?: number }): void;
  /** Own room host: change bots / difficulty / capacity / zone. */
  setRoomSettings(p: Partial<RoomSettings>): void;
  /** Menu click / hover sounds (AudioEngine.ui). */
  uiSound(sound: UiSound): void;
}

const log = (name: string) => (...args: unknown[]) => console.info(`[ui stub] ${name}`, ...args);

const stubActions: Actions = {
  start: log('start'),
  play: log('play'),
  quickPlay: log('quickPlay'),
  createPrivate: log('createPrivate'),
  joinByCode: log('joinByCode'),
  playOffline: log('playOffline'),
  leave: log('leave'),
  sendChat: log('sendChat'),
  setProfile: log('setProfile'),
  setRoomSettings: log('setRoomSettings'),
  uiSound: () => {},
};

const impl: Actions = { ...stubActions };

/** Replace some or all actions (session layer / networking). Returns a function that restores the previous ones. */
export function bindActions(next: Partial<Actions>): () => void {
  const prev = { ...impl };
  Object.assign(impl, next);
  return () => { Object.assign(impl, prev); };
}

/** Stable facade: always calls the currently bound implementation. */
export const actions: Actions = {
  start: () => impl.start(),
  play: (v) => impl.play(v),
  quickPlay: () => impl.quickPlay(),
  createPrivate: () => impl.createPrivate(),
  joinByCode: (code) => impl.joinByCode(code),
  playOffline: (o) => impl.playOffline(o),
  leave: () => impl.leave(),
  sendChat: (text) => impl.sendChat(text),
  setProfile: (p) => impl.setProfile(p),
  setRoomSettings: (p) => impl.setRoomSettings(p),
  uiSound: (s) => impl.uiSound(s),
};

// ---------------------------------------------------------------- helpers for UI code
export function setName(name: string) {
  updateSettings({ name });
  actions.setProfile({ name });
}
export function setSkin(skin: number) {
  updateSettings({ skin });
  actions.setProfile({ skin });
}

/** Clear per-game state (call when leaving a game). */
export function resetGameState() {
  hud.value = null;
  chat.value = [];
  killFeed.value = [];
  chatOpen.value = false;
  menuOpen.value = false;
  scoreboardOpen.value = false;
  room.value = null;
  closeAllModals();
}

/** Link to a room: current page + #room=CODE */
export function roomLink(code: string) {
  const u = new URL(location.href);
  u.hash = `room=${code}`;
  return u.toString();
}

export function parseRoomHash(hash = location.hash): string | null {
  const m = /room=([A-Za-z0-9]{4,5})\b/.exec(hash);
  return m ? m[1].toUpperCase() : null;
}
