// Service worker : la page se charge toujours depuis le réseau (les mises à
// jour arrivent immédiatement), le cache ne sert qu'en secours hors ligne.
// Les bibliothèques et l'icône sont en cache-first. Les données IGN et les
// tuiles OSM restent toujours en réseau direct.
const CACHE = 'carte-rd-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-180.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchAndCache(request) {
  return fetch(request).then(resp => {
    const copy = resp.clone();
    caches.open(CACHE).then(c => c.put(request, copy));
    return resp;
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;

  // Page HTML : réseau d'abord, cache en secours.
  if (e.request.mode === 'navigate' || (sameOrigin && url.pathname.endsWith('index.html'))) {
    e.respondWith(
      fetchAndCache(e.request).catch(() =>
        caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Coquille statique (icône, manifeste, Leaflet) : cache d'abord.
  const isShellAsset = url.hostname === 'unpkg.com' ||
    (sameOrigin && /\.(svg|png|webmanifest)$/.test(url.pathname));
  if (isShellAsset) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetchAndCache(e.request)));
  }
  // Tout le reste (WFS IGN, tuiles OSM) : réseau direct sans interception.
});
