// Production bundle for Node (pm2 on the game server): dist/index.js + dist/package.json.
// Colyseus stays external (core loads ws-transport with a dynamic import), so the bundle
// ships a package.json pinned to the exact installed versions; `npm install --omit=dev`
// in dist/ is all the server needs.
import { $ } from 'bun';
import { mkdirSync, writeFileSync } from 'node:fs';

const external = ['@colyseus/core', '@colyseus/ws-transport', '@colyseus/schema'];
mkdirSync('dist', { recursive: true });
await $`bun build src/index.ts --target=node --outfile=dist/index.js --minify ${external.flatMap((e) => ['--external', e])}`;

const version = async (name: string) =>
  ((await import(`${name}/package.json`, { with: { type: 'json' } })).default as { version: string }).version;
const dependencies: Record<string, string> = {};
for (const name of external) dependencies[name] = await version(name);

writeFileSync('dist/package.json', JSON.stringify({
  name: 'openbomber-server',
  private: true,
  type: 'module',
  main: 'index.js',
  engines: { node: '>=20' },
  dependencies,
}, null, 2) + '\n');
console.log('dist/index.js + dist/package.json', dependencies);
