import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * public/ files only the site ships, dropped from other builds (the Discord activity, a zip for a
 * game portal):
 * - VITE_WEBMANIFEST=1: site.webmanifest and its icons (logo/), plus their <link>s in index.html,
 *   and service.js (the kill switch for the v1 service worker returning players still have);
 * - VITE_POLICIES=1: the privacy policy and terms of service pages;
 * - VITE_CNAME=<domain>: a CNAME file with it (GitHub Pages' custom domain).
 * A single-file build (below) has no manifest, whatever VITE_WEBMANIFEST says.
 */
function optionalPublic(env: Record<string, string>): Plugin {
  const manifest = env.VITE_WEBMANIFEST === '1' && env.VITE_SINGLEFILE !== '1';
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

/**
 * VITE_SINGLEFILE=1: the whole game in one index.html (for a portal that takes a single file): one
 * JS module and the CSS inline, every asset a data: URI, nothing copied from public/ (the favicon
 * goes in too).
 */
function singleFile(on: boolean): Plugin | null {
  if (!on) return null;
  let publicDir = '';
  return {
    name: 'ob-single-file',
    enforce: 'post',
    config: () => ({
      build: {
        assetsInlineLimit: () => true,
        cssCodeSplit: false,
        modulePreload: false,
        copyPublicDir: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
      },
    }),
    configResolved(c) { publicDir = c.publicDir; },
    transformIndexHtml: (html) => html.replace('href="./favicon.ico"',
      () => `href="data:image/x-icon;base64,${readFileSync(resolve(publicDir, 'favicon.ico')).toString('base64')}"`),
    generateBundle(_, bundle) {
      const page = bundle['index.html'];
      if (page?.type !== 'asset') return;
      // the emitted file a tag points to, taken out of the bundle
      const take = (url: string) => { const f = url.replace(/^\.\//, ''); const o = bundle[f]; delete bundle[f]; return o; };
      page.source = String(page.source)
        .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (tag, src: string) => {
          const c = take(src);
          // Vite leaves its preload marker on the dynamic imports it inlined: nothing to preload
          const code = c?.type === 'chunk' && c.code.replace(/__VITE_PRELOAD__/g, 'void 0').replace(/<\/script/gi, '<\\/script');
          return code ? `<script type="module">${code}</script>` : tag;
        })
        .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (tag, href: string) => {
          const a = take(href);
          return a?.type === 'asset' ? `<style>${String(a.source).replace(/<\/style/gi, '<\\/style')}</style>` : tag;
        });
      const left = Object.keys(bundle).filter((f) => f !== 'index.html');
      if (left.length) this.error(`VITE_SINGLEFILE: not inlined: ${left.join(', ')}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
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
    plugins: [preact(), optionalPublic(env), singleFile(env.VITE_SINGLEFILE === '1')],
    server: {
      host: '0.0.0.0',
      port: 8080,
      // Discord activity dev: Discord's proxy → a cloudflared tunnel → this server, which forwards
      // the game server under /api (the tunnel exposes this port only)
      allowedHosts: ['.trycloudflare.com'],
      proxy: { '/api': { target: 'http://localhost:2567', ws: true } },
    },
  };
});
