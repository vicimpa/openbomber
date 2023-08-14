import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import commonjs from "vite-plugin-commonjs";
import paths from "vite-tsconfig-paths";

import { game } from "./server/main";

export default defineConfig({
  base: './',
  root: './src',
  build: {
    outDir: '../dist',
    target: 'esnext',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src', 'index.html'),
        new: resolve(__dirname, 'src', 'new.html')
      }
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 3000
  },
  server: {
    host: '0.0.0.0',
    port: 3000
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
        game(server.httpServer!);
      }
    }
  ],
});
