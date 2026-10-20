// Discord Activity (Embedded App SDK) support.
//
//   DISCORD_CLIENT_ID      the application's id (Developer Portal; the client build gets the same
//                          value as VITE_DISCORD_CLIENT_ID)
//   DISCORD_CLIENT_SECRET  its OAuth2 secret. Either unset: the /discord/* routes answer 503 and
//                          `discord` join options are refused.
//
// Flow (client: packages/client/src/discord.ts): the activity authorizes with Discord and sends the
// OAuth code to POST /discord/token, which trades it for an access token (the secret never leaves
// the server). That token is the player's identity from then on:
//   - POST /discord/room maps the activity instance (everyone who launched the activity in the
//     same channel shares one) to its own private room and returns the room code;
//   - every join passes `discord: <token>`; BattleRoom.onAuth resolves it to the Discord user,
//     whose display name is locked and whose avatar is shown to the room.
// Discord's proxy hides the players' IPs, so the per-IP limits key Discord players by user id.

import { createEndpoint, matchMaker } from '@colyseus/core';
import { ROOM_NAME } from '@ob/game';
import { admit } from './limits.ts';
import { TokenBucket } from './util.ts';

const API = 'https://discord.com/api/v10';
/** Resolved tokens are trusted this long before Discord is asked again. */
const USER_TTL_MS = 15 * 60_000;
const USER_CACHE_MAX = 5000;
const INSTANCE_RE = /^[\w-]{1,100}$/;

export interface DiscordUser {
  id: string;
  /** Display name (global name, else username), not yet cleaned for the game. */
  name: string;
  /** Full CDN url of the avatar (Discord's default one when the user has none). */
  avatar: string;
}

/** Swappable for tests. */
export const discordApi = { fetch: (input: string, init?: RequestInit) => fetch(input, init) };

const config = () => {
  const id = process.env.DISCORD_CLIENT_ID;
  const secret = process.env.DISCORD_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
};

export const discordEnabled = () => config() !== null;

export function avatarUrl(u: { id: string; avatar?: string | null; discriminator?: string }): string {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
  // default avatars: new usernames (discriminator "0") by id, legacy tags by discriminator
  const legacy = Number(u.discriminator);
  const n = legacy > 0 ? legacy % 5 : Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${n}.png`;
}

// ------------------------------------------------------------------ tokens → users

const users = new Map<string, { user: DiscordUser; at: number }>();
/** Calls to Discord's API on behalf of unknown tokens / codes (they all arrive via one proxy). */
const upstream = new TokenBucket(40, 10);

/** The Discord user behind an access token, or null when the token is invalid. */
export async function discordUser(token: unknown): Promise<DiscordUser | null> {
  if (!config() || typeof token !== 'string' || !token || token.length > 200) return null;
  const hit = users.get(token);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.user;
  if (!upstream.take()) return null;
  const res = await discordApi.fetch(`${API}/users/@me`, { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res?.ok) return null;
  const u = (await res.json()) as { id: string; username: string; global_name?: string | null; avatar?: string | null; discriminator?: string };
  if (typeof u?.id !== 'string' || !/^\d+$/.test(u.id)) return null;
  const user: DiscordUser = { id: u.id, name: u.global_name || u.username || '', avatar: avatarUrl(u) };
  users.delete(token);
  users.set(token, { user, at: Date.now() });
  if (users.size > USER_CACHE_MAX) users.delete(users.keys().next().value!);
  return user;
}

// ------------------------------------------------------------------ instance → room

/** Activity instance id → its room (a promise while the room is being created). */
const instances = new Map<string, Promise<string>>();

async function roomFor(instance: string, creating: () => boolean): Promise<string | null> {
  const known = instances.get(instance);
  if (known) {
    const roomId = await known.catch(() => '');
    if (roomId && (await matchMaker.query({ roomId })).length) return roomId;
    if (instances.get(instance) === known) instances.delete(instance);
    return roomFor(instance, creating);
  }
  if (!creating()) return null;
  const created = matchMaker.createRoom(ROOM_NAME, { private: true, discordInstance: instance }).then((r) => r.roomId);
  instances.set(instance, created);
  try {
    return await created;
  } catch (e) {
    if (instances.get(instance) === created) instances.delete(instance);
    throw e;
  }
}

/** BattleRoom.onDispose: the instance gets a fresh room next time. */
export function forgetDiscordRoom(instance: string, roomId: string) {
  const p = instances.get(instance);
  p?.then((id) => { if (id === roomId && instances.get(instance) === p) instances.delete(instance); }, () => {});
}

// ------------------------------------------------------------------ routes

const fail = (status: number, error: string) => Response.json({ error }, { status });
const body = (ctx: { body?: unknown }) => (ctx.body && typeof ctx.body === 'object' ? ctx.body as Record<string, unknown> : {});

/** POST /discord/token { code } → { access_token } */
export const discordToken = createEndpoint('/discord/token', { method: 'POST' }, async (ctx) => {
  const cfg = config();
  if (!cfg) return fail(503, 'discord is not configured');
  const code = body(ctx).code;
  if (typeof code !== 'string' || !code || code.length > 200) return fail(400, 'bad code');
  if (!upstream.take()) return fail(429, 'too many requests');
  const res = await discordApi.fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.id, client_secret: cfg.secret, grant_type: 'authorization_code', code }).toString(),
  }).catch((e: unknown) => { console.warn('[discord] token exchange: discord.com unreachable', e); return null; });
  // say which side failed: the loader shows it inside the activity
  if (!res) return fail(502, 'discord.com unreachable from the game server');
  if (!res.ok) {
    const why = await res.text().catch(() => '');
    console.warn(`[discord] token exchange: HTTP ${res.status} ${why.slice(0, 200)}`);
    return fail(401, `code rejected: ${res.status} ${why.slice(0, 120)}`.trim());
  }
  const { access_token } = (await res.json()) as { access_token?: string };
  return access_token ? Response.json({ access_token }) : fail(502, 'no token');
});

/** POST /discord/room { token, instance } → { roomId } (created on the first call per instance). */
export const discordRoom = createEndpoint('/discord/room', { method: 'POST' }, async (ctx) => {
  if (!config()) return fail(503, 'discord is not configured');
  const { token, instance } = body(ctx);
  if (typeof instance !== 'string' || !INSTANCE_RE.test(instance)) return fail(400, 'bad instance');
  const user = await discordUser(token);
  if (!user) return fail(401, 'bad token');
  let denied: string | null = null;
  const roomId = await roomFor(instance, () => !(denied = admit(`discord:${user.id}`, true)));
  if (!roomId) return fail(denied === 'rooms' ? 503 : 429, 'try again later');
  return Response.json({ roomId });
});

/** Tests. */
export function resetDiscord() {
  users.clear();
  instances.clear();
}
