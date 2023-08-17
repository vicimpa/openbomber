import { Server } from "http";
import { Server as SocketIO } from "socket.io";

import { verifyApi } from "../api";
import { point } from "../core/point";
import { calc, makeData } from "../core/verify";
import { defaultStartPositions, Game } from "./class/Game";
import { IS_DEV } from "./env";

export function game(server: Server) {
  const socketio = new SocketIO(server, { cors: { origin: '*' } });

  const game = new Game(31, 31, {
    fillAchivments: IS_DEV ? .999 : .15,
    fillBlocks: .7
  }, [
    ...defaultStartPositions,
    point(.333, 0),
    point(.666, 0),
    point(1, .333),
    point(1, .666),
    point(.333, 1),
    point(.666, 1),
    point(0, .333),
    point(0, .666),
    point(.333, .333),
    point(.333, .666),
    point(.666, .333),
    point(.666, .666),
  ]);

  socketio.on('connection', async socket => {
    const api = verifyApi.use(socket);
    const nums = makeData();

    const response = await api.verify(nums);
    if (response !== calc(nums))
      return socket.disconnect();

    game.join(socket);

    socket.once('disconnect', () => {
      game.leave(socket);
    });
  });

  game.start();
}