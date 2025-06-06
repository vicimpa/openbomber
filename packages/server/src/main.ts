import * as bot from "./bot";

import { API_VERSION, MAX_ADDRESS_CONNECT } from "@ob/shared/config";
import { calc, makeData } from "@ob/core/verify";

import { Game } from "./class/Game";
import { IS_DEV } from "./env";
import type { Server } from "http";
import { Server as SocketIO } from "socket.io";
import { verifyApi } from "@ob/shared/api";

export function game(server: Server) {
  Promise.resolve()
    .then(() => bot.run())
    .then(func => {
      if (func instanceof Function) {
        server.once('close', () => {
          func();
        });
      }
    })
    .catch(console.error);

  const socketio = new SocketIO(server, {
    cors: {
      origin: IS_DEV ? 'http://localhost:3000' : 'https://openbomber.ru',
      allowedHeaders: [
        ...(IS_DEV ? ['localhost'] : []),
        'openbomber.ru'
      ]
    }
  });

  const addresses = new Map<string, number>();

  const game = new Game({
    fillAchivments: IS_DEV ? .9999 : .45,
    fillBlocks: .4
  });

  socketio.on('connection', async socket => {
    const api = verifyApi.use(socket);
    const nums = makeData();
    const address = (socket.handshake.headers['x-real-ip'] ?? socket.handshake.address) as string;

    addresses.set(
      address,
      (addresses.get(address) ?? 0) + 1
    );

    socket.once('disconnect', () => {
      api();
      game.leave(socket);
      addresses.set(
        address,
        (addresses.get(address) ?? 0) - 1
      );
    });

    if (await api.verify(nums) !== calc(nums))
      return socket.disconnect();

    const count = addresses.get(address) ?? 0;

    if (count > MAX_ADDRESS_CONNECT && !IS_DEV) {
      console.info(`Address block ${address}`);
      api.addressBlock(MAX_ADDRESS_CONNECT);
      return;
    }

    game.join(socket);
  });
}