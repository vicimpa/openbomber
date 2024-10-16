import { defineConfig } from "vite";
import paths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react-swc";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: './',
  root: './src',
  publicDir: '../public',
  envDir: '../',
  envPrefix: "APP_",
  build: {
    outDir: '../dist',
    target: 'esnext',
    emptyOutDir: true,
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
    react({ plugins: [], tsDecorators: true }),
    svelte({ configFile: '../svelte.config.js' }),
    paths({ root: '../' }),
    viteSingleFile()
  ],
});
