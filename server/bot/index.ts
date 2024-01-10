import { trim } from "core/trim";
import { events } from "server/events";
import { MAX_PLAYERS } from "shared/config";
import { Webhook } from "simple-discord-webhooks";

import type { IServerEvents } from "server/events";
import type { TCustomEventListener } from "core/Events";

const { DISCORD_HOOK_URL = '' } = process.env;

const hook = new Webhook(new URL(DISCORD_HOOK_URL));

export async function run(): Promise<void | Function> {
  await hook.send('', [
    {
      title: "💣 Обновление состояния игры",
      description: trim`
          Сервер был перезапущен!

          https://openbomber.ru/
        `,
      url: "https://openbomber.ru/",
      image: {
        url: "https://openbomber.ru/images/screen.gif"
      }
    }
  ]);

  const handler: TCustomEventListener<IServerEvents, 'changePlayes'> = ({ data: { nickname, type, totalCount } }) => {
    hook.send('', [
      {
        title: "💣 Обновление состояния игры",
        description: trim`
          ** Игрок || ${nickname.replaceAll('|', ':')} || ${type === 'in' ? 'подключился' : 'отключился'} **
          Сейчас в игре ${totalCount} из ${MAX_PLAYERS}

          https://openbomber.ru/
        `,
        url: "https://openbomber.ru/",
        image: {
          url: "https://openbomber.ru/images/screen.gif"
        }
      }
    ]).catch(console.error);
  };

  events.on('changePlayes', handler);

  return () => {
    events.off('changePlayes', handler);
  };
}
