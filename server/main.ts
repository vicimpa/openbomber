import { Server } from "http";
import { Server as SocketIO } from "socket.io";

import { point } from "../core/point";
import { calc, makeData } from "../core/verify";
import { verifyApi } from "../shared/api";
import { defaultStartPositions, Game } from "./class/Game";
import { IS_DEV } from "./env";

export function game(server: Server) {
  const socketio = new SocketIO(server, { cors: { origin: '*' } });

  const game = new Game({
    fillAchivments: IS_DEV ? .9999 : .15,
    fillBlocks: .7
  });

  socketio.on('connection', async socket => {
    const api = verifyApi.use(socket);
    const nums = makeData();

    const response = await api.verify(nums);
    if (response !== calc(nums)) {
      api();
      return socket.disconnect();
    }

    game.join(socket);

    socket.once('disconnect', () => {
      api();
      game.leave(socket);
    });
  });
}