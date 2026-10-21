// Server factory used by index.ts (production / dev) and by the tests.

import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createEndpoint, createRouter, defineRoom, defineServer, matchMaker } from '@colyseus/core';
import { Encoder } from '@colyseus/schema';
import { ROOM_NAME } from '@ob/game';
import { BattleRoom, MAIN_TOKEN } from './BattleRoom.ts';
import { discordRoom, discordToken } from './discord.ts';
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

// A 75x75 map (5625 tiles) + 32 players encodes to ~45 KB on a full sync (8 KB default).
Encoder.BUFFER_SIZE = 128 * 1024;

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
    routes: createRouter({ health, listRooms, discordToken, discordRoom }),
    greet: false,
  });
  await server.listen(opts.port ?? 2567, opts.host);

  const http = server.transport.server as HttpServer;
  // Behind a proxy that reports the client's address in a header of its own (Fly.io:
  // Fly-Client-IP), only that header counts: the client could send any X-Real-IP /
  // X-Forwarded-For, and the per-IP limits read those (limits.ts).
  const ipHeader = process.env.CLIENT_IP_HEADER?.toLowerCase();
  if (ipHeader) {
    const trust = (req: IncomingMessage) => {
      const ip = req.headers[ipHeader];
      delete req.headers['x-real-ip'];
      delete req.headers['x-forwarded-for'];
      delete req.headers['x-client-ip'];
      if (typeof ip === 'string' && ip) req.headers['x-real-ip'] = ip;
    };
    http.prependListener('request', (req: IncomingMessage) => trust(req));
    http.prependListener('upgrade', (req: IncomingMessage) => trust(req));
  }
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

  // The persistent shared world everyone lands in (autoDispose = false).
  await matchMaker.createRoom(ROOM_NAME, { __main: MAIN_TOKEN });

  const port = (http.address() as AddressInfo).port;
  return {
    port,
    close: () => server.gracefullyShutdown(false),
  };
}
