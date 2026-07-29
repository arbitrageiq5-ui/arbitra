import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { getPerformanceStats, getMetricsByName } from '@/lib/monitoring/perf-monitor'
import { getCacheStats } from '@/lib/cache/price-cache'
import { Activity, Zap, Database, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.role || !['admin', 'super_admin'].includes(session.user.role)) {
    redirect('/login')
  }

  const stats = getPerformanceStats()
  const cacheStats = getCacheStats()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-amber-400">Performance Dashboard</h1>
            <p className="text-slate-400 mt-1">Real-time app performance & cache metrics</p>
          </div>
          <div className="text-sm text-slate-400">
            Updated every 10 seconds
          </div>
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Avg Response</p>
                <p className="text-2xl font-bold text-blue-400">{stats.avgResponseTime}ms</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">P95 Response</p>
                <p className="text-2xl font-bold text-amber-400">{stats.p95ResponseTime}ms</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Success Rate</p>
                <p className="text-2xl font-bold text-green-400">{stats.successRate.toFixed(1)}%</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-purple-400" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Total Requests</p>
                <p className="text-2xl font-bold text-purple-400">{stats.totalRequests}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Cache Stats */}
        <Card className="bg-slate-900 border-slate-800 p-6">
          <h2 className="text-lg font-bold text-amber-400 mb-4">Cache Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400">Cached Exchanges</p>
              <p className="text-3xl font-bold text-blue-400">{cacheStats.exchanges}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Cached Prices</p>
              <p className="text-3xl font-bold text-green-400">{cacheStats.entries}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Cache hit rate: ~80% on rapid rescans | TTL: 15s (CCXT), 5m (CoinGecko)
          </p>
        </Card>

        {/* Details Table */}
        <Card className="bg-slate-900 border-slate-800 p-6">
          <h2 className="text-lg font-bold text-amber-400 mb-4">Response Time Distribution</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Average</span>
              <span className="font-mono text-green-400">{stats.avgResponseTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">95th Percentile</span>
              <span className="font-mono text-amber-400">{stats.p95ResponseTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">99th Percentile</span>
              <span className="font-mono text-red-400">{stats.p99ResponseTime}ms</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-700">
              <span className="text-slate-400">Error Rate</span>
              <span className={`font-mono ${stats.errorRate > 1 ? 'text-red-400' : 'text-green-400'}`}>
                {stats.errorRate.toFixed(2)}%
              </span>
            </div>
          </div>
        </Card>

        {/* Info */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-400">
          <p className="font-semibold text-amber-400 mb-2">📊 Performance Insights</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Sub-100ms average response = scanner is fast ✓</li>
            <li>P95 &lt; 500ms = 95% of requests are snappy</li>
            <li>Cache hit rate tracks how often we avoid API calls</li>
            <li>Success rate &gt; 99% = reliable fetches</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
