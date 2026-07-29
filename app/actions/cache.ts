'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { clearAllCaches, clearPriceCacheOnly } from '@/lib/cache/clear-cache'
import { clearMetrics } from '@/lib/monitoring/perf-monitor'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.role || !['admin', 'super_admin'].includes(session.user.role)) {
    throw new Error('Admin access required')
  }
}

export async function clearPriceCache() {
  await requireAdmin()
  clearPriceCacheOnly()
  return { success: true, message: 'Price cache cleared. Next scan will fetch fresh data.' }
}

export async function clearAllAppCaches() {
  await requireAdmin()
  clearAllCaches()
  return { success: true, message: 'All caches cleared. All data will be freshly fetched.' }
}

export async function resetPerformanceMetrics() {
  await requireAdmin()
  clearMetrics()
  return { success: true, message: 'Performance metrics reset.' }
}
