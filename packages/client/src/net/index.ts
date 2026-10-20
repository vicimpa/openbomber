// Public API of the online game source.

import { Client } from '@colyseus/sdk';
import { ROOM_NAME, type JoinOptions } from '@ob/game';
import type { BattleState, RoomListing } from '../../../server/src/schema.ts';
import { NetSource, type NetSourceOptions } from './NetSource.ts';
import { MAIN_ROOM_ID, normalizeRoomCode, resolveServerUrl, toHttpUrl } from './url.ts';

export { NetSource, type NetStatus, type NetSourceOptions } from './NetSource.ts';
export { resolveServerUrl, normalizeRoomCode, MAIN_ROOM_ID } from './url.ts';
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

const makeClient = (url?: string) => new Client(url ?? resolveServerUrl());

/** Join the persistent shared world (room 'MAIN'). Spectator unless `play: true`. */
export async function connectQuickPlay(opts: NetJoinOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).joinById<BattleState>(MAIN_ROOM_ID, {
    name: opts.name, skin: opts.skin, play: opts.play ?? false,
  });
  return new NetSource(room, opts);
}

/**
 * Create an unlisted room (private match or vs bots); share `source.roomId` (5-char code).
 * The creator enters the arena immediately unless `play: false`.
 */
export async function createPrivateRoom(opts: NetCreateOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).create<BattleState>(ROOM_NAME, {
    private: true, name: opts.name, skin: opts.skin, bots: opts.bots, maxPlayers: opts.maxPlayers,
    play: opts.play ?? true,
  });
  return new NetSource(room, opts);
}

/** Join a room by its code (or 'MAIN'). Spectator unless `play: true`. Rejects if it does not exist. */
export async function joinRoomByCode(code: string, opts: NetJoinOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).joinById<BattleState>(normalizeRoomCode(code), {
    name: opts.name, skin: opts.skin, play: opts.play ?? false,
  });
  return new NetSource(room, opts);
}

/** Public rooms (private ones are never listed). */
export async function listRooms(serverUrl?: string): Promise<RoomListing[]> {
  const res = await fetch(`${toHttpUrl(serverUrl ?? resolveServerUrl())}/rooms`);
  if (!res.ok) throw new Error(`listRooms: HTTP ${res.status}`);
  return (await res.json()) as RoomListing[];
}
