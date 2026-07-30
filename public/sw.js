// sw.js — network-only service worker (no caching)
// All requests pass directly to the network. This SW never caches anything,
// preventing stale JS chunk errors after rebuilds.

const VERSION = 'v3'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Delete every old cache from previous SW versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

// Network-only for ALL requests — especially /_next/ chunks
self.addEventListener('fetch', event => {
  // Always fetch from network, never touch the cache
  event.respondWith(fetch(event.request))
})
