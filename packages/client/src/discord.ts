// Discord Activity: the game launched inside Discord (an iframe on <client id>.discordsays.com).
//
// The player signs in with Discord (scope `identify`); the name comes from Discord and can't be
// changed, the avatar is shown to the room, and everyone who launched the activity in the same
// channel lands in one room (server: packages/server/src/discord.ts). Others can still be
// invited into that room by its code / link.
//
// Build with VITE_DISCORD_CLIENT_ID. Developer Portal → Activities → URL Mappings: `/` → the
// site's host (openbomber.ru); the game server is then reached through the same mapping.
// Outside Discord nothing here runs and the SDK isn't even loaded.
import { signal } from '@preact/signals';
import type { DiscordSDK } from '@discord/embedded-app-sdk';

/** Launched as a Discord activity (Discord adds frame_id / instance_id to the iframe url). */
export const inDiscord = typeof location !== 'undefined' && new URLSearchParams(location.search).has('frame_id');

export interface DiscordProfile {
  id: string;
  name: string;
  /** Avatar url (cdn.discordapp.com is allowed by the activity's CSP). */
  avatar: string;
  /** OAuth access token: the server resolves it to this user on every join. */
  token: string;
  /** Activity instance: one per channel session, shared by everyone in it. */
  instanceId: string;
}

/** Signed-in Discord player (null outside Discord or until the login finishes / if it failed). */
export const discord = signal<DiscordProfile | null>(null);
/** Why the Discord login failed (the loader shows it; the activity's console is hard to reach). */
export const discordError = signal<string | null>(null);

const READY_TIMEOUT_MS = 10_000;

let sdk: DiscordSDK | null = null;

/** Same rule as the server's avatarUrl (packages/server/src/discord.ts). */
function avatarUrl(u: { id: string; avatar?: string | null; discriminator?: string }): string {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
  const legacy = Number(u.discriminator);
  const n = legacy > 0 ? legacy % 5 : Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${n}.png`;
}

/**
 * Handshake with Discord, OAuth (Discord shows its consent dialog the first time) and the token
 * exchange on our server. Resolves either way; on failure `discord` stays null and the game
 * runs like the website.
 */
export async function discordLogin(httpBase: string): Promise<void> {
  if (!inDiscord) return;
  try {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
    if (!clientId) throw new Error('VITE_DISCORD_CLIENT_ID is not set');
    const { DiscordSDK } = await import('@discord/embedded-app-sdk');
    sdk = new DiscordSDK(clientId);
    // no Discord client on the other end (the url opened outside Discord): don't hold the loader
    await Promise.race([sdk.ready(), new Promise((_, no) => setTimeout(() => no(new Error('ready timeout')), READY_TIMEOUT_MS))]);
    installExternalLinks();
    const { code } = await sdk.commands.authorize({ client_id: clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify'] });
    const res = await fetch(`${httpBase}/discord/token`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(`token: HTTP ${res.status}`);
    const { access_token } = (await res.json()) as { access_token: string };
    const { user } = await sdk.commands.authenticate({ access_token });
    discord.value = {
      id: user.id,
      name: user.global_name || user.username,
      avatar: avatarUrl(user),
      token: access_token,
      instanceId: sdk.instanceId,
    };
  } catch (e) {
    console.warn('[discord] login failed', e);
    const err = e as { message?: string; code?: number };
    discordError.value = `${err.message || String(e)}${err.code !== undefined ? ` (${err.code})` : ''}`;
  }
}

/** Discord's «invite to activity» dialog (friends / channels). */
export function discordInvite() {
  sdk?.commands.openInviteDialog().catch((e) => console.warn('[discord] invite', e));
}

/** The iframe can't open new tabs: external links go through Discord's «open link» prompt. */
function installExternalLinks() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.origin === location.origin) return;
    e.preventDefault();
    sdk?.commands.openExternalLink({ url: a.href }).catch(() => {});
  }, true);
}
