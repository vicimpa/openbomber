// Kill switch for the v1 service worker (it served a cached single-file index.html forever).
// Browsers re-check this script on navigation; this version wipes every cache, unregisters
// itself and reloads open tabs so returning players get the current game.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
