const CACHE = 'zkt-v1';
const CORE = [
  '/index.html',
  '/manifest.webmanifest',
  '/dist/app.min.js',
  '/dist/app.min.css',
  '/public/images/apple-touch-icon.png',
  '/public/favicon.ico'
];

self.addEventListener('install', (e) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(CORE).catch(err => {
        console.warn('[SW] Cache install failed for some assets:', err);
        // İlk install'da bazı asset'ler yoksa skip et
      })
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

  // HTML pages: Network-first, fallback to index.html for SPA
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets (JS, CSS, images): Cache-first with network update
  if (req.method === 'GET') {
    e.respondWith(
      caches.match(req).then(hit => {
        const fetchPromise = fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
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

