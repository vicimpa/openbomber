import Express from "express";
import { Server } from "http";
import { Server as SocketIO } from "socket.io";

import { Game } from "./class/Game";

const app = Express();
const server = new Server(app);
const socketio = new SocketIO(server, { cors: { origin: '*' } });

const game = new Game(17, 17);

socketio.on('connection', socket => {
  game.join(socket);

  socket.once('disconnect', () => {
    game.leave(socket);
  });
});

game.start();
server.listen(3001, '0.0.0.0');