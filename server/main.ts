import { Server } from "http";
import { Server as SocketIO } from "socket.io";

import { defaultStartPositions, Game } from "./class/Game";

export function game(server: Server) {
  const socketio = new SocketIO(server, { cors: { origin: '*' } });
  const game = new Game(21, 17, {
    fillAchivments: .15,
    fillBlocks: .7
  }, [
    ...defaultStartPositions,
    [.5, 0],
    [1, .5],
    [.5, 1],
    [0, .5],
    [.5, .5]
  ]);


  socketio.on('connection', socket => {
    game.join(socket);

    socket.once('disconnect', () => {
      game.leave(socket);
    });
  });

  game.start();
}