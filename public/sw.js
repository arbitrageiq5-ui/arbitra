// ArbitrageIQ Service Worker — self-destruct build
// This SW wipes all caches and unregisters itself on every install so that
// stale JS chunk caches (which cause "module factory not available" errors)
// can never survive a rebuild. A new SW with real caching can be introduced
// once the app is stable.

self.addEventListener('install', event => {
  // Skip waiting immediately so this SW activates before the old one can
  // serve any more stale responses.
  self.skipWaiting()
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    // Delete every cache that might exist.
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  )
})

// No fetch handler — every request goes straight to the network.
