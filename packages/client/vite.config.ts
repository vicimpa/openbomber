import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * public/ files only the site ships, dropped from other builds (the Discord activity, a zip for a
 * game portal):
 * - VITE_WEBMANIFEST=1: site.webmanifest and its icons (logo/), plus their <link>s in index.html,
 *   and service.js (the kill switch for the v1 service worker returning players still have);
 * - VITE_POLICIES=1: the privacy policy and terms of service pages;
 * - VITE_CNAME=<domain>: a CNAME file with it (GitHub Pages' custom domain).
 */
function optionalPublic(env: Record<string, string>): Plugin {
  const manifest = env.VITE_WEBMANIFEST === '1';
  const drop = [
    ...(manifest ? [] : ['site.webmanifest', 'logo', 'service.js']),
    ...(env.VITE_POLICIES === '1' ? [] : ['privacy-policy', 'terms-of-service', 'team-of-service']),
  ];
  let outDir = '';
  return {
    name: 'ob-optional-public',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    transformIndexHtml: (html) => manifest ? html : html.replace(/\n\s*<!-- webmanifest[\s\S]*?<!-- \/webmanifest -->/, ''),
    writeBundle() {
      for (const p of drop) rmSync(resolve(outDir, p), { recursive: true, force: true });
      if (env.VITE_CNAME) writeFileSync(resolve(outDir, 'CNAME'), env.VITE_CNAME + '\n');
    },
  };
}

export default defineConfig(({ mode }) => ({
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
  plugins: [preact(), optionalPublic(loadEnv(mode, process.cwd(), 'VITE_'))],
  server: {
    host: '0.0.0.0',
    port: 8080,
    // Discord activity dev: Discord's proxy → a cloudflared tunnel → this server, which forwards
    // the game server under /api (the tunnel exposes this port only)
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/api': { target: 'http://localhost:2567', ws: true } },
  },
}));
