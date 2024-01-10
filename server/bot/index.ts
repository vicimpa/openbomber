import { Client, Message, TextChannel } from "discord.js";

import { Events } from "../../core/Events";
import { MAX_PLAYERS } from "../../shared/config";

import type { IEventsMap } from "../../core/Events";

const isEnable = process.env.DISCORD_INFO === 'enable';
const discordChannel = process.env.DISCORD_CHANNEL ?? null;
const discordToken = process.env.DISCORD_TOKEN ?? null;

interface IDiscordEvents extends IEventsMap {
  change: {
    type: 'in' | 'out',
    name: string,
    totalCount: number;
  };
}

export const events = new Events<IDiscordEvents>();

export async function run(): Promise<void | Function> {
  if (!isEnable)
    return;

  if (!discordToken)
    throw new Error('You need DISCORD_TOKEN! in .env');

  if (!discordChannel)
    throw new Error('You need DISCORD_CHANNEL in .env');

  const client = new Client({
    intents: ['GuildMessages']
  });

  await client.login(discordToken);
  const channel = await client.channels.fetch(discordChannel);

  if (!(channel instanceof TextChannel))
    throw new Error('Channel is not text!');

  events.on('change', ({ data: { name, type, totalCount } }) => {
    channel.send({
      embeds: [
        {
          title: "💣 Обновление состояния игры",
          description: `**Игрок ||${name.replaceAll('|', ':')}|| ${type === 'in' ? 'подключился' : 'отключился'}**\nСейчас в игре ${totalCount} из ${MAX_PLAYERS}\n\nhttps://openbomber.ru/`,
          url: "https://openbomber.ru/",
          image: {
            url: "https://openbomber.ru/images/screen.gif"
          }
        }
      ]
    });
  });

  return () => {
    client.destroy();
  };
}
