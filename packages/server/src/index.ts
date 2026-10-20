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
//   BOTS_MAIN  bots in the main room while exactly one human plays (default 0 = canon)
//   MAX_CLIENTS  connected clients per room, players + spectators (default 200)
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
