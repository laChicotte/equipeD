/*
 * Service worker de TalentsConnect : application installable et utilisable sans réseau.
 *
 * - Fichiers statiques versionnés de Next.js, images et icônes : servis depuis le cache après le
 *   premier chargement (moins de données consommées sur réseau mobile).
 * - Pages de l'espace connecté : réseau d'abord, copie gardée pour le hors ligne. Ces pages ne
 *   contiennent aucune donnée privée : celles-ci sont chargées ensuite par l'application.
 * - Autres pages sans connexion : la page « hors ligne ».
 * - API (/api/…) et WebSocket : jamais touchés par ce fichier.
 * - Notifications push : affichées quand l'application n'est pas à l'écran ; un clic ouvre
 *   l'écran concerné (conversation, demande, séance…).
 */
const VERSION = 'tc-v4';
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = '/hors-ligne.html';
const OFFLINE_PAGES =
  /^\/(tableau-de-bord|messages|seances|mentorats(\/consultation)?|compte|demandes)$/;
/** Route dynamique : sans réseau, on passe par son équivalent statique. */
const MENTORSHIP = /^\/mentorats\/([^/]+)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll([OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/logo.png']),
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
    url.pathname.startsWith('/_next/image') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/logo')
  );
}

/** Garde une page et les fichiers qu'elle référence, pour pouvoir l'ouvrir plus tard sans réseau. */
async function cachePage(path) {
  const response = await fetch(path, { credentials: 'same-origin' });
  if (!response.ok || response.redirected) return;
  const html = await response.clone().text();
  const pages = await caches.open(PAGE_CACHE);
  await pages.put(path, response);
  const statics = await caches.open(STATIC_CACHE);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) ?? [])];
  await Promise.allSettled(
    assets.map(async (asset) => {
      if (!(await statics.match(asset))) await statics.add(asset);
    }),
  );
}

self.addEventListener('message', (event) => {
  const data = event.data ?? {};
  if (data.type === 'CACHE_PAGES' && Array.isArray(data.urls)) {
    const urls = data.urls.filter((u) => typeof u === 'string' && OFFLINE_PAGES.test(u));
    event.waitUntil(Promise.allSettled(urls.map(cachePage)));
  } else if (data.type === 'CLEAR_PAGES') {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

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
    const keep = OFFLINE_PAGES.test(url.pathname);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (keep && response.ok && !response.redirected) {
            const copy = response.clone();
            event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.put(url.pathname, copy)));
          }
          return response;
        })
        .catch(async () => {
          const mentorship = url.pathname.match(MENTORSHIP);
          if (mentorship && mentorship[1] !== 'consultation') {
            return Response.redirect(`/mentorats/consultation?id=${mentorship[1]}`, 302);
          }
          const page = keep ? await (await caches.open(PAGE_CACHE)).match(url.pathname) : null;
          if (page) return page;
          return (await (await caches.open(STATIC_CACHE)).match(OFFLINE_URL)) ?? Response.error();
        }),
    );
  }
});

// ─── Notifications push ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'TalentsConnect', body: event.data ? event.data.text() : '' };
  }
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/';
  event.waitUntil(
    (async () => {
      // Application déjà à l'écran : la cloche et la messagerie s'en chargent, pas de doublon.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((w) => w.visibilityState === 'visible' && w.focused)) return;
      await self.registration.showNotification(data.title || 'TalentsConnect', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        tag: data.tag,
        renotify: !!data.tag,
        data: { url },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ('navigate' in existing) await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
