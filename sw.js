const CACHE_NAME = 'milestrack-cache-v1.8.2';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0'
];

const CARD_ASSETS = [
  './assets/cards/dbs-yuu.png',
  './assets/cards/uob-ppv.png',
  './assets/cards/uob-vs.png',
  './assets/cards/citi-rewards.png',
  './assets/cards/ocbc-rewards.png',
  './assets/cards/dbs-wwmc.png',
  './assets/cards/uobladysolitaire.png',
  './assets/cards/hsbc-rev.png',
  './assets/cards/kf-uob.png',
  './assets/cards/maybank-world.png',
  './assets/cards/maybank-horizon.png',
  './assets/cards/dbs-vantage.png',
  './assets/cards/uob-prvi.png',
  './assets/cards/dbs-altitude.png',
  './assets/cards/citi-pm.png'
];

// Install: Pre-cache core assets, then gracefully attempt card images
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Must succeed
      await cache.addAll(CORE_ASSETS);

      // 2. Gracefully attempt each card image (won't crash if file is missing)
      await Promise.allSettled(
        CARD_ASSETS.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: Purge older caches (including v1.7.9)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first for Firebase, Cache-first for local assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (
          networkResponse.status === 200 &&
          (url.hostname.includes('gstatic.com') || url.hostname.includes('fonts.googleapis.com'))
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
