import { defineConfig } from "vite";
import commonjs from "vite-plugin-commonjs";
import glsl from "vite-plugin-glsl";
import { viteSingleFile } from "vite-plugin-singlefile";
import paths from "vite-tsconfig-paths";

import { webSocketServer } from "@server/server";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  base: './',
  root: './src',
  publicDir: '../public',
  envDir: '../',
  envPrefix: "APP_",
  build: {
    outDir: '../dist',
    target: 'esnext',
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
    glsl(),
    react({ plugins: [], tsDecorators: true }),
    svelte({ configFile: '../svelte.config.js' }),
    paths({ root: '../' }),
    viteSingleFile(),
    webSocketServer()
  ],
});
