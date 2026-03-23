const CACHE_NAME = 'agrifinconnect-cache-v1';
const API_CACHE_NAME = 'agrifinconnect-api-cache-v1';
const APP_SHELL = ['/', '/index.html', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_NAME, API_CACHE_NAME].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isApiGet = url.pathname.startsWith('/api/');

  if (isApiGet) {
    event.respondWith(networkFirst(req, API_CACHE_NAME));
    return;
  }

  const isStaticAsset =
    isSameOrigin &&
    (req.destination === 'style' || req.destination === 'script' || req.destination === 'image' || req.destination === 'font');

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(req, CACHE_NAME));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
  }
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Offline and no cached response available.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
