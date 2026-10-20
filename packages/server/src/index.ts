// OpenBomber game server entry point.
//
//   PORT       listen port (default 2567)
//   HOST       bind address (default all interfaces)
//   BASE_PATH  optional prefix also accepted for every route, e.g. "/api" when nginx
//              forwards https://host/api/* without stripping the prefix. Root paths
//              keep working either way, so both nginx styles are fine:
//                location /api/ { proxy_pass http://127.0.0.1:2567/; }      # strips
//                location /api/ { proxy_pass http://127.0.0.1:2567; }       # keeps, set BASE_PATH=/api
//              (plus the usual websocket headers: Upgrade / Connection "upgrade").
//              Always add `proxy_set_header X-Real-IP $remote_addr;`: the per-IP limits in
//              limits.ts trust it.
//   MAIN_SPARRING  shared arena: bots for a lone player; they leave when a second one joins (default 1)
//   MAX_CLIENTS  connected clients per room, players + spectators (default 200)
//   MAX_CLIENTS_PER_IP  connections from one IP across all rooms (default 6)
//   MAX_ROOMS  rooms alive at once (default 300)
//
// At boot the persistent shared world is created: room id 'MAIN' (autoDispose off).
// Clients join as spectators and send MSG.play true/false to enter / leave the arena.
//
// HTTP routes: GET /health, GET /rooms (public room list), POST /matchmake/* (Colyseus),
// websocket /<processId>/<roomId>. CORS echoes the request Origin (dev client on :8080).

import { startGameServer } from './app.ts';

const port = Number(process.env.PORT) || 2567;
const server = await startGameServer({
  port,
  host: process.env.HOST || undefined,
  basePath: process.env.BASE_PATH ?? '/api',
});
console.log(`[openbomber] server listening on :${server.port}`);
