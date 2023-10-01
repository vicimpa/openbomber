import { game } from "./main";

import type { PluginOption } from "vite";

export const webSocketServer = (): PluginOption => {
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