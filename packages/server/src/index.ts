import "dotenv/config";

import { Server } from "http";
import { game } from "./main";

const server = new Server();
game(server);
server.listen(3001, '127.0.0.1');