// Public API of the online game source.

import { Client } from '@colyseus/sdk';
import { ROOM_NAME, type JoinOptions } from '@ob/game';
import type { BattleState, RoomListing } from '../../../server/src/schema.ts';
import { NetSource, type NetSourceOptions } from './NetSource.ts';
import { normalizeRoomCode, resolveServerUrl, toHttpUrl } from './url.ts';

export { NetSource, type NetStatus, type NetSourceOptions } from './NetSource.ts';
export { resolveServerUrl, normalizeRoomCode } from './url.ts';
export type { RoomListing, RoomMeta } from '../../../server/src/schema.ts';

export interface NetJoinOptions extends JoinOptions, NetSourceOptions {
  /** Defaults to resolveServerUrl(). */
  serverUrl?: string;
}

export interface NetCreateOptions extends NetJoinOptions {
  /** Bots that fill the room while humans are few (default 3, 0 = none). */
  bots?: number;
  maxPlayers?: number;
}

const makeClient = (url?: string) => new Client(url ?? resolveServerUrl());

/** Join any public room with space, or create one. */
export async function connectQuickPlay(opts: NetCreateOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).joinOrCreate<BattleState>(ROOM_NAME, {
    name: opts.name, skin: opts.skin, bots: opts.bots, maxPlayers: opts.maxPlayers,
  });
  return new NetSource(room, opts);
}

/** Create an unlisted room; share `source.roomId` (5-char code) with friends. */
export async function createPrivateRoom(opts: NetCreateOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).create<BattleState>(ROOM_NAME, {
    private: true, name: opts.name, skin: opts.skin, bots: opts.bots, maxPlayers: opts.maxPlayers,
  });
  return new NetSource(room, opts);
}

/** Join a room (public or private) by its code. Rejects if it does not exist or is full. */
export async function joinRoomByCode(code: string, opts: NetJoinOptions): Promise<NetSource> {
  const room = await makeClient(opts.serverUrl).joinById<BattleState>(normalizeRoomCode(code), {
    name: opts.name, skin: opts.skin,
  });
  return new NetSource(room, opts);
}

/** Public rooms (private ones are never listed). */
export async function listRooms(serverUrl?: string): Promise<RoomListing[]> {
  const res = await fetch(`${toHttpUrl(serverUrl ?? resolveServerUrl())}/rooms`);
  if (!res.ok) throw new Error(`listRooms: HTTP ${res.status}`);
  return (await res.json()) as RoomListing[];
}
