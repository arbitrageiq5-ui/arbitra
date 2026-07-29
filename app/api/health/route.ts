import { getPerformanceStats } from '@/lib/monitoring/perf-monitor'
import { getCacheStats } from '@/lib/cache/price-cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      limit: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    cache: getCacheStats(),
    performance: getPerformanceStats(),
  })
}
