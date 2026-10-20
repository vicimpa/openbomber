import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: '../public',
  resolve: {
    alias: { '$': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    reportCompressedSize: false,
  },
  plugins: [preact()],
  server: {
    host: '0.0.0.0',
    port: 8080,
    // Discord activity dev: Discord's proxy → a cloudflared tunnel → this server, which forwards
    // the game server under /api (the tunnel exposes this port only)
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/api': { target: 'http://localhost:2567', ws: true } },
  },
});
