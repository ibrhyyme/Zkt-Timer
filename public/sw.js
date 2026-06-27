const CACHE_VERSION = '__DEPLOY_VERSION__';
const CACHE = 'zkt-' + CACHE_VERSION;
const CORE = [
  '/',
  '/timer',
  '/public/manifest.webmanifest',
  '/public/images/apple-touch-icon.png',
  '/public/images/zkt-logo.png'
];

self.addEventListener('install', (e) => {
  console.log('[SW] Installing...');
  // skipWaiting is REQUIRED here: iOS WKWebView (Capacitor server.url) never closes the
  // controlled client — backgrounding only suspends the WebView, it is not destroyed.
  // Without skipWaiting the new SW stays "waiting" forever, the activate handler never
  // runs, the old cache generation is never purged, and stale app.min.js/app.min.css are
  // served indefinitely (the iOS-only "updates don't show up" bug). Android WebView and
  // desktop browsers tear down the client, so their new SW activated normally — which is
  // why the symptom looked iOS-specific.
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Cache each asset individually so one failure doesn't prevent others
      Promise.allSettled(
        CORE.map(url => c.add(url).catch(err => console.warn('[SW] Cache failed for:', url, err)))
      )
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      // Take control of already-open clients so the cache purge and the corrected cache
      // key take effect right away. Safe to claim mid-session: the app ships as a single
      // bundle (worker bundles are bypassed below), so there is no risk of a chunk-version
      // mismatch. We intentionally do NOT force a reload — fresh JS/CSS load naturally on
      // the next cold start, avoiding a jarring mid-session refresh.
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Sadece same-origin request'leri handle et
  if (url.origin !== self.location.origin) {
    return;
  }

  // Socket.IO ve HMR polling isteklerini yoksay (network error'ları önlemek için)
  if (url.pathname.startsWith('/socket.io/') || url.pathname.includes('hot-update')) {
    return;
  }

  // Versiyon endpoint'ini her zaman network'ten al
  if (url.pathname === '/api/version') {
    return;
  }

  // Worker bundle'lari (scramble/cross-solver/solver): SW intercept etme.
  // Versiyonlu URL (?v=RELEASE) + browser cache tazeligi saglar; static handler
  // cacheUrl=pathname oldugu icin ?v= burada ise yaramaz, o yuzden komple bypass.
  if (url.pathname.endsWith('-worker.js')) {
    return;
  }

  // GraphQL API: Network-first, cache fallback
  if (url.pathname.startsWith('/graphql')) {
    e.respondWith(
      fetch(req)
        .catch(() => {
          // Offline: Cache'den getir veya offline response dön
          return caches.match(req).then(cached => {
            if (cached) return cached;
            // API offline ise, client-side error handling yapılacak
            return new Response(
              JSON.stringify({ errors: [{ message: 'Offline - API unavailable' }] }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // HTML pages: Network-first, fallback to cached page or root
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          // Sadece status 200 cache'lenir — 206 (Partial), opaque, redirect cache'lenmez
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req)
          .then(cached => cached || caches.match('/'))
          .then(res => {
            // Geçerli bir response yoksa veya status 0 ise (network error) offline dön
            if (!res || res.status < 200 || res.status > 599) {
              return new Response('Offline', { status: 503 });
            }
            // iOS WKWebView redirected flag'li SW response'lari reddeder.
            // Temiz bir response olustur.
            return new Response(res.body, {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
            });
          })
        )
    );
    return;
  }

  // Static assets (JS, CSS, images): Cache-first, arka planda güncelle
  // Cache key MUST include the query string. The app shell ships under a STABLE filename
  // (app.min.js / app.min.css) and is busted solely by ?v=<RELEASE_NAME>. Keying on
  // pathname alone made every deploy a cache HIT on the old bundle, so the ?v= bump was
  // silently ignored and stale JS/CSS were served. pathname+search makes each deploy a
  // fresh URL → cache miss → fresh fetch. Query-less assets (images) are unaffected
  // (empty search). Old ?v= entries are dropped wholesale when the cache generation
  // rotates in the activate handler.
  if (req.method === 'GET') {
    const cacheUrl = url.pathname + url.search;
    e.respondWith(
      caches.match(cacheUrl).then(hit => {
        const fetchPromise = fetch(req).then(res => {
          // Sadece status 200 cache'lenir — 206 Partial Content desteklenmiyor
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(cacheUrl, copy));
          }
          return res;
        }).catch(() => hit);

        return hit || fetchPromise;
      })
    );
  }
});

// Background Sync API - Offline mutation sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-solves') {
    event.waitUntil(syncOfflineQueue());
  }
});

/**
 * IndexedDB'deki offline queue'yu sync et
 */
async function syncOfflineQueue() {
  try {
    // IndexedDB'den pending mutation'ları al
    const db = await openQueueDB();
    if (!db.objectStoreNames.contains('mutations')) {
      // Client henuz queue'yu olusturmamis — sessizce cik
      return;
    }
    const tx = db.transaction('mutations', 'readonly');
    const store = tx.objectStore('mutations');
    const mutations = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    console.log('[SW] Background Sync:', mutations.length, 'mutation');

    // Client'lara bildir (client-side processQueue kullanacak)
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        count: mutations.length
      });
    });
  } catch (error) {
    console.error('[SW] Background Sync hatası:', error);
  }
}

async function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZktOfflineQueue', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = (data.notification && data.notification.title) || 'Zkt Timer';
  // FCM payload: { notification: {...}, data: {type, link, ...} }
  const payloadData = data.data || (data.notification && data.notification.data) || {};
  const options = {
    body: (data.notification && data.notification.body) || '',
    icon: '/public/images/zkt-logo.png',
    badge: '/public/images/apple-touch-icon.png',
    data: payloadData
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const link = (typeof data.link === 'string' && data.link.trim()) || '/';
  const isExternal = link.indexOf('http') === 0;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // External link → yeni pencere
      if (isExternal) {
        return self.clients.openWindow(link);
      }
      // Acik pencere varsa: navigate + focus, yoksa yeni pencere
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if ('navigate' in client && 'focus' in client) {
          return client.focus().then(function() {
            return client.navigate(link).catch(function() {
              return self.clients.openWindow(link);
            });
          });
        }
        if ('focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    })
  );
});

