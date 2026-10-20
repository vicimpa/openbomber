// Server factory used by index.ts (production / dev) and by the tests.

import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createEndpoint, createRouter, defineRoom, defineServer, matchMaker } from '@colyseus/core';
import { ROOM_NAME } from '@ob/game';
import { BattleRoom } from './BattleRoom.ts';
import type { RoomListing, RoomMeta } from './schema.ts';

export interface GameServerOptions {
  port?: number;
  host?: string;
  /** Optional path prefix (e.g. "/api") under which every route is ALSO served. */
  basePath?: string;
}

export interface GameServer {
  port: number;
  close(): Promise<void>;
}

const health = createEndpoint('/health', { method: 'GET' }, async () => {
  const rooms = await matchMaker.query({ name: ROOM_NAME });
  const clients = rooms.reduce((n, r) => n + r.clients, 0);
  return Response.json({ ok: true, rooms: rooms.length, clients, uptime: Math.round(process.uptime()) });
});

const listRooms = createEndpoint('/rooms', { method: 'GET' }, async () => {
  const rooms = await matchMaker.query({ name: ROOM_NAME, private: false, unlisted: false });
  const out: RoomListing[] = rooms.map((r) => ({
    roomId: r.roomId,
    clients: r.clients,
    maxClients: r.maxClients,
    metadata: r.metadata as RoomMeta | undefined,
  }));
  return Response.json(out);
});

function normalizeBase(p?: string): string {
  if (!p) return '';
  const s = ('/' + p).replace(/\/+/g, '/').replace(/\/$/, '');
  return s === '/' ? '' : s;
}

export async function startGameServer(opts: GameServerOptions = {}): Promise<GameServer> {
  const base = normalizeBase(opts.basePath);
  // NOTE: no explicit `transport`: Colyseus core loads its own @colyseus/ws-transport.
  // With bun's isolated installs, importing ws-transport from this package resolves a
  // second copy of @colyseus/core (peer-dep variant) and joins fail with
  // "seat reservation expired". Letting core import it keeps a single core instance.
  const server = defineServer({
    rooms: { [ROOM_NAME]: defineRoom(BattleRoom) },
    routes: createRouter({ health, listRooms }),
    greet: false,
  });
  await server.listen(opts.port ?? 2567, opts.host);

  const http = server.transport.server as HttpServer;
  if (base) {
    // Strip the prefix before Colyseus' own listeners see the request (prepend AFTER
    // listen(), because Colyseus prepends its CORS handler while binding routes).
    const strip = (req: IncomingMessage) => {
      const url = req.url ?? '/';
      if (url === base || url.startsWith(base + '/') || url.startsWith(base + '?')) {
        req.url = url.slice(base.length) || '/';
        if (req.url.startsWith('?')) req.url = '/' + req.url;
      }
    };
    http.prependListener('request', (req: IncomingMessage, _res: ServerResponse) => strip(req));
    http.prependListener('upgrade', (req: IncomingMessage) => strip(req));
  }

  const port = (http.address() as AddressInfo).port;
  return {
    port,
    close: () => server.gracefullyShutdown(false),
  };
}
