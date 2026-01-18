const CACHE_NAME = 'gemini-web-wrapper-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/logo.svg',
  '/static/default-avatar.png'
];

// Install a service worker
self.addEventListener('install', (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        // Ensure cache.addAll() failures are not silent during installation
        console.error('Service worker install failed to pre-cache resources:', error);
        // Resolve to avoid blocking service worker installation entirely
        return Promise.resolve();
      })
  );
});

// Cache and return requests
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Use network-first strategy for API requests and do not cache them
  if (
    requestUrl.pathname.startsWith('/api/') ||
    requestUrl.pathname.startsWith('/v1/')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Use cache-first strategy for other requests
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return the cached response if found
      if (response) {
        return response;
      }

      // Only cache safe, same-origin GET requests
      if (
        event.request.method !== 'GET' ||
        requestUrl.origin !== self.location.origin
      ) {
        return fetch(event.request);
      }

      // Clone the request since we need to use it in multiple places
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((networkResponse) => {
        // Check if we received a valid response
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }

        // Clone the response since we need to use it in multiple places
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

// Update a service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});