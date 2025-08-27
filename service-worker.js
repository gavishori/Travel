// service-worker.js (hardened)
// - Cache only GET over http/https
// - Ignore chrome-extension/data/blob schemes
// - Network-first for navigations and Firestore GETs
// - Cache-first for same-origin static assets

const CACHE_NAME = 'flymily-v3';
const ASSETS = [
  'index.html',
  'style.css',
  'script.js',
  'firebase.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') {
    return; // let the browser do its thing
  }

  const url = new URL(req.url);

  // Only http/https
  if (!/^https?:$/.test(url.protocol)) {
    return; // ignore chrome-extension:, data:, blob:, etc.
  }

  const isNavigate = req.mode === 'navigate' || (req.destination === 'document');
  const isSameOrigin = url.origin === self.location.origin;
  const isFirestore = url.hostname.endsWith('firestore.googleapis.com');

  // Strategy: network-first for navigations & Firestore GETs
  if (isNavigate || isFirestore) {
    event.respondWith(
      fetch(req).then((res) => {
        try {
          const copy = res.clone();
          if (isSameOrigin) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
        } catch (e) {/* ignore */}
        return res;
      }).catch(() =>
        caches.match(req).then((cached) => cached || (isNavigate ? caches.match('index.html') : undefined))
      )
    );
    return;
  }

  // For same-origin static GETs: cache-first
  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          try {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          } catch (e) {/* ignore */}
          return res;
        });
      })
    );
    return;
  }

  // For cross-origin GETs: just fetch (no caching)
  // This avoids opaque responses / CORS complexity
  event.respondWith(fetch(req));
});
