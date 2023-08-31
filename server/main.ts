import { Server } from "http";
import { Server as SocketIO } from "socket.io";

import { calc, makeData } from "../core/verify";
import { verifyApi } from "../shared/api";
import { Game } from "./class/Game";
import { IS_DEV } from "./env";

export function game(server: Server) {
  const socketio = new SocketIO(server);

  const game = new Game({
    fillAchivments: IS_DEV ? .9999 : .55,
    fillBlocks: .4
  });

  socketio.on('connection', async socket => {
    const api = verifyApi.use(socket);
    const nums = makeData();

    socket.once('disconnect', () => {
      api();
      game.leave(socket);
    });

    if (await api.verify(nums) !== calc(nums))
      return socket.disconnect();

    game.join(socket);
  });
}