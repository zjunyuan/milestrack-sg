const CACHE_NAME = 'milestrack-cache-v1.44.5';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/state.js',
  './js/firebase.js',
  './js/recommender.js',
  './js/ui.js',
  './js/retailers.js',
  './js/mcc.js',
  './js/cardrules.js',
  './js/posting.js',
  './js/posting-ui.js',
  './js/settings-ui.js',
  './js/search-mode.js',
  './js/layout-report.js',
  './js/summary.js',
  './js/demo.js',
  './js/history-table.js',
  './js/history-chips.js',
  './js/log-feedback.js',
  './js/bulk-delete.js',
  './js/tiers.js',
  './js/vault-guard.js',
  './js/krisplus-merchants.js',
  './js/krisplus-browse.js',
  './js/heymax.js',
  './js/statements.js',
  './js/xls.js',
  './js/pdf-statement.js',
  './js/statement-import.js',
  './js/format.js',
  './js/mcc-names.js',
  './js/merchants.js',
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
  './assets/cards/citi-pm.png',
  './assets/cards/trust-freedom.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // cache:'reload' skips the browser's HTTP cache, so a freshly published version is never mixed with stale copies of other files
      await Promise.all(CORE_ASSETS.map(async (url) => {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (!res.ok) throw new Error(`Failed to cache ${url}: ${res.status}`);
        await cache.put(url, res);
      }));
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
  // Pages already open (including a blank one left by a broken update) are reloaded onto the fresh files, no manual clearing needed.
  event.waitUntil(self.clients.claim().then(() => self.clients.matchAll({ type: 'window' })).then((cs) => Promise.all(cs.map((c) => c.navigate(c.url).catch(() => {})))));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

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

  // The app's own pages, scripts and styles: network first (so an update is never half-applied), cache when offline or when the
  // network is slow (8s). Written defensively: Safari is strict about re-creating navigation requests, so those are fetched as they are.
  const own = url.origin === self.location.origin && (event.request.mode === 'navigate' || /\.(js|mjs|css|html|json)$/.test(url.pathname));
  if (own) {
    event.respondWith((async () => {
      let req = event.request;
      if (req.mode !== 'navigate') { try { req = new Request(req.url, { cache: 'no-cache', credentials: req.credentials }); } catch (e) { req = event.request; } }
      const fromCache = () => caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => {}); }
        return res;
      });
      try {
        const first = await Promise.race([net, new Promise((r) => setTimeout(() => r(null), 8000))]);
        if (first) return first;
        return (await fromCache()) || net;          // slow network: use the cached copy if there is one, otherwise keep waiting
      } catch (e) {
        const hit = await fromCache();
        if (hit) return hit;
        return fetch(event.request);                // last resort: plain request, never leave the page without an answer
      }
    })());
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
