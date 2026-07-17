// ArbitrageIQ Service Worker for offline support and caching
const CACHE_NAME = 'arbitrage-iq-v1'
const RUNTIME_CACHE = 'arbitrage-iq-runtime'
const API_CACHE = 'arbitrage-iq-api'

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

// Install event — cache essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
})

// Activate event — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== API_CACHE) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Fetch event — network-first for JS, cache-first for static assets
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and external URLs
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return
  }

  // Next.js JS chunks — always fetch fresh to avoid stale code
  if (url.pathname.includes('/_next/static/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone)
          })
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // API calls — network-first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseToCache = response.clone()
            caches.open(API_CACHE).then(cache => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Return cached API response if network fails
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || new Response('API unavailable offline', { status: 503 })
          })
        })
    )
    return
  }

  // Static assets (JS, CSS, images) — cache-first, network fallback
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return (
          cachedResponse ||
          fetch(request)
            .then(response => {
              if (response.ok) {
                const responseToCache = response.clone()
                caches.open(RUNTIME_CACHE).then(cache => {
                  cache.put(request, responseToCache)
                })
              }
              return response
            })
            .catch(() => {
              // Fallback for failed requests
              if (request.destination === 'image') {
                return new Response(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#333" width="100" height="100"/></svg>',
                  { headers: { 'Content-Type': 'image/svg+xml' } }
                )
              }
              return new Response('Offline', { status: 503 })
            })
        )
      })
    )
    return
  }

  // Navigation requests — network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseToCache = response.clone()
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Try to serve from cache on network failure
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || caches.match('/') || new Response('Offline', { status: 503 })
          })
        })
    )
  }
})
