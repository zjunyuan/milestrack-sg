const CACHE_NAME = 'milestrack-cache-v1.8.5';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/app.js',
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

// Install: Pre-cache core shell, then gracefully fetch card images
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      await Promise.allSettled(
        CARD_ASSETS.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res);
          }).catch(() => {})
        )
      );
    })
  );
});

// Activate: Purge older cache versions immediately
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

// Listen for SKIP_WAITING signal from update toast
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: Network-first for Firebase APIs, Cache-first for local static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip caching for Firebase Auth, Firestore queries, and non-GET requests
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
        // Cache external static resources (like Google Fonts) dynamically
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
