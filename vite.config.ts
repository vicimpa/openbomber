import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import commonjs from "vite-plugin-commonjs";
import paths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react-swc";

import { game } from "./server/main";
import { resolve } from "path";

export default defineConfig({
  base: './',
  root: './src',
  publicDir: '../public',

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
    react({ plugins: [], tsDecorators: true }),
    svelte({ configFile: '../svelte.config.js' }),
    paths(),
    {
      name: "WebSocketServer",
      configurePreviewServer(server) {
        return game(server.httpServer);
      },
      configureServer(server) {
        return game(server.httpServer!);
      }
    }
  ],
});
