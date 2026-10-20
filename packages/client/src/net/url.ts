// Server endpoint resolution:
//   1. VITE_SERVER_URL (e.g. "wss://bomber.example.com/api")
//   2. dev (vite serve): ws(s)://<page hostname>:2567
//   3. prod: ws(s)://<page host>/api   (nginx proxies /api to the game server)

interface LocationLike { protocol: string; host: string; hostname: string }

export function resolveServerUrl(): string {
  // Must stay literally `import.meta.env` so Vite can substitute it.
  const env = import.meta.env as Record<string, unknown> | undefined;
  const fromEnv = env?.VITE_SERVER_URL;
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv.replace(/\/$/, '');
  const location = (globalThis as { location?: LocationLike }).location;
  if (!location) return 'ws://localhost:2567';
  const secure = location.protocol === 'https:';
  if (env?.DEV) return `${secure ? 'wss' : 'ws'}://${location.hostname}:2567`;
  return `${secure ? 'wss' : 'ws'}://${location.host}/api`;
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
