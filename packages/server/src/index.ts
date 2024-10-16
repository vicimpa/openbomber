import { Server } from "http";
import { game } from "./main";

const server = new Server();
game(server);
server.listen(3001);