import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, PluginOption } from "vite";
import commonjs from "vite-plugin-commonjs";
import paths from "vite-tsconfig-paths";

import { game } from "./server/main";

export default defineConfig({
  base: './',
  root: './src',
  build: {
    outDir: '../dist',
    target: 'esnext'
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: { origin: '*' }
  },
  plugins: [
    commonjs(),
    svelte({ configFile: '../svelte.config.js' }),
    paths(),
    {
      name: "WebSocketServer",
      configurePreviewServer(server) {
        game(server.httpServer);
      },
      configureServer(server) {
        game(server.httpServer);
      }
    }
  ],
});
