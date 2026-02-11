const CACHE = 'zkt-v3';
const CORE = [
  '/',
  '/public/manifest.webmanifest',
  '/dist/app.min.js',
  '/dist/app.min.css',
  '/public/images/apple-touch-icon.png',
  '/public/images/zkt-logo.png'
];

self.addEventListener('install', (e) => {
  console.log('[SW] Installing...');
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
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
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
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/')))
    );
    return;
  }

  // Static assets (JS, CSS, images): Cache-first with network update
  // Strip query strings for cache matching (handles ?v=xxx cache busting)
  if (req.method === 'GET') {
    const cacheUrl = url.pathname;
    e.respondWith(
      caches.match(cacheUrl).then(hit => {
        const fetchPromise = fetch(req).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(cacheUrl, copy));
          }
          return res;
        }).catch(() => hit); // Network fail -> return cached

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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

