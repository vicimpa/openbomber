import { Server } from "http";
import { Server as SocketIO } from "socket.io";

import { point } from "../core/point";
import { defaultStartPositions, Game } from "./class/Game";
import { IS_DEV } from "./env";

export function game(server: Server) {
  const socketio = new SocketIO(server, { cors: { origin: '*' } });

  const game = new Game(21, 17, {
    fillAchivments: IS_DEV ? .999 : .15,
    fillBlocks: .7
  }, [
    ...defaultStartPositions,
    point(.5, 0),
    point(1, .5),
    point(.5, 1),
    point(0, .5),
    point(.5, .5)
  ]);


  socketio.on('connection', socket => {
    game.join(socket);

    socket.once('disconnect', () => {
      game.leave(socket);
    });
  });

  game.start();
}