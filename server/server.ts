import { PluginOption } from "vite";

import { game } from "./main";

export const webScoketServer = (): PluginOption => {
  return {
    name: "WebSocketServer",
    configurePreviewServer(server) {
      return game(server.httpServer);
    },
    configureServer(server) {
      return game(server.httpServer!);
    }
  };
};