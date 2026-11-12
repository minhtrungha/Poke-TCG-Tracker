/* Offline support: cache-first for the app shell, stale-while-revalidate for
   data and images. No dependencies; plain Service Worker API.

   Bump CACHE when the shell changes so old copies are evicted. */
const CACHE = 'ptcg-v1';
const SHELL = [
  'index.html', 'cards.html', 'sealed.html', 'sets.html', 'wishlist.html',
  'css/main.css',
  'js/data.js', 'js/portfolio.js', 'js/cards.js', 'js/sealed.js', 'js/sets.js',
  'js/wishlist.js', 'js/chart.js',
  'img/logo.svg', 'img/favicon.svg', 'img/icon-192.png',
  'manifest.webmanifest',
  'data/cards.json', 'data/sets.json', 'data/prices.json',
  'data/wishlist.json', 'data/sealed.json', 'data/need-images.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll fails the whole install if any single file 404s, so add leniently
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never cache third parties

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });

    const net = fetch(request).then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);

    // Images are immutable once downloaded: serve from cache first.
    if (/\.(jpg|jpeg|png|svg|webp)$/i.test(url.pathname)) return hit || (await net) || Response.error();

    // Shell and data: serve cache immediately, refresh in the background.
    if (hit) { net; return hit; }
    const res = await net;
    if (res) return res;
    // Offline with nothing cached: fall back to the start page if it is a nav.
    if (request.mode === 'navigate') {
      const idx = await cache.match('index.html');
      if (idx) return idx;
    }
    return Response.error();
  })());
});
