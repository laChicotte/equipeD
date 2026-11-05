/*
 * Service worker de Talents Connectés : application installable et sobre en données.
 *
 * - Fichiers statiques versionnés de Next.js (/_next/static, icônes, polices) : servis depuis
 *   le cache après le premier chargement (moins de données consommées sur réseau mobile).
 * - Pages : toujours demandées au réseau ; sans connexion, la page « hors ligne » s'affiche.
 * - API (/api/…) et WebSocket : jamais mis en cache (données privées, toujours à jour).
 */
const VERSION = 'tc-v2';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/hors-ligne.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll([OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png']),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
  }
});
