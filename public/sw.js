// ArbitrageIQ Service Worker for offline support and caching
// v2 — never cache /_next/static/ chunks; they are content-hashed by the build
const CACHE_NAME = 'arbitrage-iq-v2'
const RUNTIME_CACHE = 'arbitrage-iq-runtime-v2'
const API_CACHE = 'arbitrage-iq-api-v2'

// Assets to precache on install (app shell only — no JS chunks)
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

// Install event — cache essential static assets, skip waiting so the new SW
// activates immediately instead of waiting for old tabs to close.
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  )
})

// Activate event — delete ALL old caches so stale chunks can never be served,
// then claim all open clients immediately.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cacheName => {
          const isCurrentCache = [CACHE_NAME, RUNTIME_CACHE, API_CACHE].includes(cacheName)
          if (!isCurrentCache) {
            return caches.delete(cacheName)
          }
        })
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET, cross-origin, or chrome-extension requests
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.protocol === 'chrome-extension:'
  ) {
    return
  }

  // ── Next.js JS/CSS chunks — NETWORK ONLY, never cache ──────────────────────
  // These are content-hashed by the build tool. Serving a stale chunk causes
  // "module factory not available" errors. Let the browser handle caching.
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(request))
    return
  }

  // ── API calls — network-first, short-lived cache fallback ──────────────────
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || new Response('{"error":"offline"}', {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        )
    )
    return
  }

  // ── Images and fonts — cache-first, network fallback ──────────────────────
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // ── Navigation — network-first, cache fallback ────────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || caches.match('/') || new Response('Offline', { status: 503 })
          )
        )
    )
    return
  }
})
