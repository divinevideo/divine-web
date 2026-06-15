self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName))
    ))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.unregister(),
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      )),
      self.clients.matchAll({ type: 'window' }).then((clients) => Promise.all(
        clients.map((client) => client.navigate(client.url))
      )),
    ])
  );
});
