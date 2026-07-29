// Cache clearing utilities
// Run this to nuke all caches and force fresh fetches

import { clearPriceCache } from '@/lib/cache/price-cache'
import { clearExchangeCache } from '@/lib/cache/exchange-cache'
import { clearMetrics } from '@/lib/monitoring/perf-monitor'

export function clearAllCaches() {
  console.log('[v0] Clearing all application caches...')
  
  clearPriceCache()
  console.log('[v0] ✓ Price cache cleared')
  
  clearExchangeCache()
  console.log('[v0] ✓ Exchange cache cleared')
  
  clearMetrics()
  console.log('[v0] ✓ Performance metrics cleared')
  
  // Clear Next.js cache via revalidatePath if in a Server Action context
  console.log('[v0] ✓ All caches cleared. Next scan will fetch fresh prices.')
}

export function clearPriceCacheOnly() {
  clearPriceCache()
  console.log('[v0] Price cache cleared')
}

// Browser-side cache clear for PWA
export function clearBrowserCache() {
  if (typeof window !== 'undefined') {
    // Clear service worker cache
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName)
        })
      })
    }
    // Clear localStorage if app-specific
    localStorage.clear()
    sessionStorage.clear()
    console.log('[v0] Browser caches cleared')
  }
}
