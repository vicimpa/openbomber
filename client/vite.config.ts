import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import paths from "vite-tsconfig-paths";

export default defineConfig({
  base: './',
  root: './src',
  build: {
    outDir: '../dist'
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  plugins: [
    svelte({ configFile: '../svelte.config.js' }),
    paths()
  ],
});
