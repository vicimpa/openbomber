// Canon community links (legacy/client/src/config.ts EXTERNAL_LINKS).
import { onCrazyHost } from '$/crazygames';
import { inDiscord } from '$/discord';
import type { I18nKey } from './i18n';
import type { IconName } from './icons';

/** Inside Discord and on CrazyGames the game shows no links out to other sites. */
export const showLinks = !inDiscord && !onCrazyHost;

export const LINKS: { href: string; key: I18nKey; icon: IconName }[] = [
  { href: 'https://github.com/vicimpa/openbomber/', key: 'link.github', icon: 'github' },
  { href: 'https://discord.gg/JzapKXFqzt', key: 'link.discord', icon: 'discord' },
  { href: 'https://vk.com/openbomber', key: 'link.vk', icon: 'vk' },
  { href: 'https://t.me/gameopenbomber', key: 'link.tg', icon: 'telegram' },
  { href: 'https://www.youtube.com/@OpenBomber', key: 'link.youtube', icon: 'youtube' },
  { href: 'https://boosty.to/vic_dev', key: 'link.boosty', icon: 'boosty' },
];
