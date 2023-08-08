import { Server } from "http";
import { Server as SocketIO } from "socket.io";

import { Game } from "./class/Game";

export function game(server: Server) {
  const socketio = new SocketIO(server, { cors: { origin: '*' } });
  const game = new Game(21, 17);

  socketio.on('connection', socket => {
    game.join(socket);

    socket.once('disconnect', () => {
      game.leave(socket);
    });
  });

  game.start();
}