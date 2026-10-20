// Public API of the online game source.

import { Client } from '@colyseus/sdk';
import { ROOM_NAME, type JoinOptions } from '@ob/game';
import type { BattleState, RoomListing } from '../../../server/src/schema.ts';
import { NetSource, type NetSourceOptions } from './NetSource.ts';
import { MAIN_ROOM_ID, isDiscordHost, normalizeRoomCode, resolveServerUrl, toHttpUrl } from './url.ts';

export { NetSource, type NetStatus, type NetSourceOptions } from './NetSource.ts';
export { resolveServerUrl, normalizeRoomCode, toHttpUrl, MAIN_ROOM_ID } from './url.ts';
export type { RoomListing, RoomMeta, PlayReply } from '../../../server/src/schema.ts';

export interface NetJoinOptions extends JoinOptions, NetSourceOptions {
  /** Defaults to resolveServerUrl(). */
  serverUrl?: string;
  /** Enter the arena right away instead of spectating (same as calling play(true)). */
  play?: boolean;
}

export interface NetCreateOptions extends NetJoinOptions {
  /** Bots that fill the room while humans are few (default 3, 0 = none). */
  bots?: number;
  maxPlayers?: number;
}

// On discordsays.com the SDK would rewrite every url to /.proxy/colyseus/…; our server sits
// behind the root URL mapping, so urls are used as they are.
const makeClient = (url?: string) => new Client(url ?? resolveServerUrl(), isDiscordHost() ? { urlBuilder: (u) => u.toString() } : undefined);

/** Join the persistent shared world (room 'MAIN'). Spectator unless `play: true`. */
export async function connectQuickPlay(opts: NetJoinOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).joinById<BattleState>(MAIN_ROOM_ID, {
    name: opts.name, skin: opts.skin, discord: opts.discord, play: opts.play ?? false,
  });
  return new NetSource(room, opts);
}

/**
 * Create an unlisted room (private match or vs bots); share `source.roomId` (5-char code).
 * The creator enters the arena immediately unless `play: false`.
 */
export async function createPrivateRoom(opts: NetCreateOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).create<BattleState>(ROOM_NAME, {
    private: true, name: opts.name, skin: opts.skin, discord: opts.discord, bots: opts.bots, maxPlayers: opts.maxPlayers,
    play: opts.play ?? true,
  });
  return new NetSource(room, opts);
}

/** Join a room by its code (or 'MAIN'). Spectator unless `play: true`. Rejects if it does not exist. */
export async function joinRoomByCode(code: string, opts: NetJoinOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).joinById<BattleState>(normalizeRoomCode(code), {
    name: opts.name, skin: opts.skin, discord: opts.discord, play: opts.play ?? false,
  });
  return new NetSource(room, opts);
}

/**
 * Discord activity: the room of this activity instance (the server creates it for the first one
 * in), entered as a player right away. `opts.discord` is the player's access token.
 */
export async function joinDiscordRoom(instanceId: string, opts: NetJoinOptions & { discord: string }): Promise<NetSource> {
  const base = toHttpUrl(opts.serverUrl ?? resolveServerUrl());
  const res = await fetch(`${base}/discord/room`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: opts.discord, instance: instanceId }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
  const { roomId } = (await res.json()) as { roomId: string };
  return joinRoomByCode(roomId, { ...opts, play: opts.play ?? true });
}

/** Public rooms (private ones are never listed). */
export async function listRooms(serverUrl?: string): Promise<RoomListing[]> {
  const res = await fetch(`${toHttpUrl(serverUrl ?? resolveServerUrl())}/rooms`);
  if (!res.ok) throw new Error(`listRooms: HTTP ${res.status}`);
  return (await res.json()) as RoomListing[];
}
