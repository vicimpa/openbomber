// Server endpoint resolution:
//   0. inside a Discord activity: always the page's own host (Discord's proxy maps the path to the
//      server; its CSP allows nothing else), whatever VITE_SERVER_URL says
//   1. VITE_SERVER_URL (e.g. "wss://openbomber-eu.fly.dev/socket.io": the client is served from
//      GitHub Pages, the game server lives on its own host)
//   2. dev (vite serve): ws(s)://<page hostname>:2567, or through vite's /api proxy inside a
//      Discord activity (the tunnel exposes only the vite port)
//   3. prod: ws(s)://<page host><VITE_SERVER_PATH>, default "/api" (inside Discord: the path its
//      proxy maps to the game server, see the Developer Portal's URL mappings)

interface LocationLike { protocol: string; host: string; hostname: string }

export function resolveServerUrl(): string {
  // Must stay literally `import.meta.env` so Vite can substitute it.
  const env = import.meta.env as Record<string, unknown> | undefined;
  const fromEnv = env?.VITE_SERVER_URL;
  if (typeof fromEnv === 'string' && fromEnv && !isDiscordHost()) return fromEnv.replace(/\/$/, '');
  const location = (globalThis as { location?: LocationLike }).location;
  if (!location) return 'ws://localhost:2567';
  const secure = location.protocol === 'https:';
  if (env?.DEV && !isDiscordHost()) return `${secure ? 'wss' : 'ws'}://${location.hostname}:2567`;
  const path = typeof env?.VITE_SERVER_PATH === 'string' && env.VITE_SERVER_PATH ? env.VITE_SERVER_PATH : '/api';
  return `${secure ? 'wss' : 'ws'}://${location.host}${path.startsWith('/') ? path : `/${path}`}`.replace(/\/$/, '');
}

/** Served by Discord's activity proxy (everything goes through its URL mappings). */
export function isDiscordHost(): boolean {
  return !!(globalThis as { location?: LocationLike }).location?.hostname.endsWith('.discordsays.com');
}

/** ws(s)://host/path -> http(s)://host/path */
export function toHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/$/, '');
}

/** Upper-case, strip spaces / dashes so "ab-c d e" joins room "ABCDE". */
export function normalizeRoomCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** roomId of the persistent main public room (server: util.ts MAIN_ROOM_ID). */
export const MAIN_ROOM_ID = 'MAIN';
