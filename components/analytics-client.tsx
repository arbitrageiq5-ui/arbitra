'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getArbitrageOpportunities, getPortfolio } from '@/app/actions/arbitrage'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, LogOut, TrendingUp, BarChart3, PieChart } from 'lucide-react'

export function AnalyticsClient({ user }: { user: any }) {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [opps, port] = await Promise.all([
        getArbitrageOpportunities(1000),
        getPortfolio(),
      ])
      setOpportunities(opps)
      setPortfolio(port)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  // Calculate analytics
  const oppStats = {
    total: opportunities.length,
    scored: opportunities.filter((o: any) => parseFloat(o.aiScore || 0) > 0).length,
    avgProfit: opportunities.length > 0 
      ? opportunities.reduce((sum: number, o: any) => sum + parseFloat(o.profitPercentage || 0), 0) / opportunities.length
      : 0,
    maxProfit: opportunities.length > 0
      ? Math.max(...opportunities.map((o: any) => parseFloat(o.profitPercentage || 0)))
      : 0,
    minProfit: opportunities.length > 0
      ? Math.min(...opportunities.map((o: any) => parseFloat(o.profitPercentage || 0)))
      : 0,
  }

  const portfolioStats = {
    positions: portfolio.length,
    totalValue: portfolio.reduce((sum: number, p: any) => sum + parseFloat(p.currentValue || 0), 0),
    totalCost: portfolio.reduce((sum: number, p: any) => sum + (parseFloat(p.quantity || 0) * parseFloat(p.averageCost || 0)), 0),
  }

  const symbolStats = new Map<string, { count: number; avgProfit: number; maxProfit: number }>()
  opportunities.forEach((opp: any) => {
    if (!symbolStats.has(opp.symbol)) {
      symbolStats.set(opp.symbol, { count: 0, avgProfit: 0, maxProfit: 0 })
    }
    const stat = symbolStats.get(opp.symbol)!
    stat.count += 1
    stat.avgProfit = (stat.avgProfit * (stat.count - 1) + parseFloat(opp.profitPercentage)) / stat.count
    stat.maxProfit = Math.max(stat.maxProfit, parseFloat(opp.profitPercentage))
  })

  const exchangeStats = new Map<string, { count: number; opportunities: Set<string> }>()
  opportunities.forEach((opp: any) => {
    [opp.buyExchange, opp.sellExchange].forEach((ex: string) => {
      if (!exchangeStats.has(ex)) {
        exchangeStats.set(ex, { count: 0, opportunities: new Set() })
      }
      const stat = exchangeStats.get(ex)!
      stat.count += 1
      stat.opportunities.add(opp.symbol)
    })
  })

  const topSymbols = Array.from(symbolStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  const topExchanges = Array.from(exchangeStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {loading ? (
          <div className="text-center text-slate-400">
            <div className="animate-pulse">Loading analytics...</div>
          </div>
        ) : (
          <>
            {/* Opportunity Statistics */}
            <h2 className="text-xl font-bold text-white mb-4">Opportunity Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="text-slate-400 text-sm mb-2">Total Found</div>
                <div className="text-3xl font-bold text-white">{oppStats.total}</div>
              </Card>
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="text-slate-400 text-sm mb-2">AI Scored</div>
                <div className="text-3xl font-bold text-amber-400">{oppStats.scored}</div>
              </Card>
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="text-slate-400 text-sm mb-2">Avg Profit</div>
                <div className="text-3xl font-bold text-green-400">{oppStats.avgProfit.toFixed(2)}%</div>
              </Card>
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="text-slate-400 text-sm mb-2">Max Profit</div>
                <div className="text-3xl font-bold text-green-500">{oppStats.maxProfit.toFixed(2)}%</div>
              </Card>
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="text-slate-400 text-sm mb-2">Min Profit</div>
                <div className="text-3xl font-bold text-amber-600">{oppStats.minProfit.toFixed(2)}%</div>
              </Card>
            </div>

            {/* Portfolio Statistics */}
            <h2 className="text-xl font-bold text-white mb-4">Portfolio Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="text-slate-400 text-sm mb-2">Holdings</div>
                <div className="text-3xl font-bold text-white">{portfolioStats.positions}</div>
              </Card>
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="text-slate-400 text-sm mb-2">Total Value</div>
                <div className="text-3xl font-bold text-white">
                  ${portfolioStats.totalValue.toFixed(2)}
                </div>
              </Card>
              <Card className="bg-slate-800 border-slate-700 p-6">
                <div className="text-slate-400 text-sm mb-2">Cost Basis</div>
                <div className="text-3xl font-bold text-slate-300">
                  ${portfolioStats.totalCost.toFixed(2)}
                </div>
              </Card>
            </div>

            {/* Top Symbols */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <Card className="bg-slate-800 border-slate-700 overflow-hidden">
                <div className="border-b border-slate-700 p-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-bold text-white">Top Symbols</h3>
                  </div>
                </div>
                <div className="divide-y divide-slate-700">
                  {topSymbols.length === 0 ? (
                    <div className="p-6 text-slate-400 text-sm">No data available</div>
                  ) : (
                    topSymbols.map(([symbol, stats]) => (
                      <div key={symbol} className="p-4 hover:bg-slate-700/30 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-white">{symbol}</span>
                          <span className="text-sm text-slate-400">{stats.count} opps</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Avg: {stats.avgProfit.toFixed(2)}%</span>
                          <span className="text-green-400">Max: {stats.maxProfit.toFixed(2)}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="bg-slate-800 border-slate-700 overflow-hidden">
                <div className="border-b border-slate-700 p-6">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-white">Exchange Activity</h3>
                  </div>
                </div>
                <div className="divide-y divide-slate-700">
                  {topExchanges.length === 0 ? (
                    <div className="p-6 text-slate-400 text-sm">No data available</div>
                  ) : (
                    topExchanges.map(([exchange, stats]) => (
                      <div key={exchange} className="p-4 hover:bg-slate-700/30 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-white capitalize">{exchange}</span>
                          <span className="text-sm text-slate-400">{stats.count} trades</span>
                        </div>
                        <div className="text-sm text-slate-400">
                          {stats.opportunities.size} unique pairs
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Insights */}
            <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Key Insights</h3>
              <div className="space-y-3 text-sm">
                {oppStats.total > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5 flex-shrink-0" />
                    <p className="text-slate-300">
                      Found {oppStats.total} total opportunities with an average profit margin of{' '}
                      <span className="font-semibold text-green-400">{oppStats.avgProfit.toFixed(2)}%</span>
                    </p>
                  </div>
                )}
                {oppStats.scored > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" />
                    <p className="text-slate-300">
                      {oppStats.scored} opportunities have been scored with AI analysis
                    </p>
                  </div>
                )}
                {topSymbols.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                    <p className="text-slate-300">
                      <span className="font-semibold text-white">{topSymbols[0][0]}</span> is the most
                      active symbol with {topSymbols[0][1].count} opportunities
                    </p>
                  </div>
                )}
                {portfolioStats.positions > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5 flex-shrink-0" />
                    <p className="text-slate-300">
                      You&apos;re currently holding{' '}
                      <span className="font-semibold text-white">{portfolioStats.positions}</span> positions
                      worth ${portfolioStats.totalValue.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
