'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getArbitrageOpportunities, scoreOpportunityWithAI } from '@/app/actions/arbitrage'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, TrendingUp, LogOut, Filter, X } from 'lucide-react'

export function OpportunitiesClient({ user }: { user: any }) {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [filteredOpps, setFilteredOpps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scoringId, setScoringId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    minProfit: 0.5,
    symbol: '',
    exchange: '',
    sortBy: 'profit_desc',
  })
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadOpportunities()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [opportunities, filters])

  const loadOpportunities = async () => {
    try {
      setLoading(true)
      const data = await getArbitrageOpportunities(100)
      setOpportunities(data)
    } catch (error) {
      console.error('Failed to load opportunities:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = opportunities.filter(
      (opp: any) => parseFloat(opp.profitPercentage) >= filters.minProfit
    )

    if (filters.symbol) {
      filtered = filtered.filter((opp: any) =>
        opp.symbol.toUpperCase().includes(filters.symbol.toUpperCase())
      )
    }

    if (filters.exchange) {
      filtered = filtered.filter(
        (opp: any) =>
          opp.buyExchange.toLowerCase() === filters.exchange.toLowerCase() ||
          opp.sellExchange.toLowerCase() === filters.exchange.toLowerCase()
      )
    }

    // Sort
    if (filters.sortBy === 'profit_desc') {
      filtered.sort((a: any, b: any) => parseFloat(b.profitPercentage) - parseFloat(a.profitPercentage))
    } else if (filters.sortBy === 'profit_asc') {
      filtered.sort((a: any, b: any) => parseFloat(a.profitPercentage) - parseFloat(b.profitPercentage))
    } else if (filters.sortBy === 'score_desc') {
      filtered.sort((a: any, b: any) => (parseFloat(b.aiScore) || 0) - (parseFloat(a.aiScore) || 0))
    }

    setFilteredOpps(filtered)
  }

  const handleScoreOpportunity = async (opportunityId: number) => {
    setScoringId(opportunityId)
    try {
      await scoreOpportunityWithAI(opportunityId)
      await loadOpportunities()
    } catch (error) {
      console.error('Scoring failed:', error)
    } finally {
      setScoringId(null)
    }
  }

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  const uniqueSymbols = Array.from(
    new Set(opportunities.map((opp: any) => opp.symbol))
  ).sort()

  const uniqueExchanges = Array.from(
    new Set(
      opportunities.flatMap((opp: any) => [opp.buyExchange, opp.sellExchange])
    )
  ).sort()

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
            <h1 className="text-2xl font-bold text-white">Opportunities Explorer</h1>
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
        {/* Filter Controls */}
        <div className="mb-6">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>

        {showFilters && (
          <Card className="bg-slate-800 border-slate-700 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Min Profit %</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={filters.minProfit}
                  onChange={(e) =>
                    setFilters({ ...filters, minProfit: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Symbol</label>
                <input
                  type="text"
                  placeholder="BTC, ETH, etc."
                  value={filters.symbol}
                  onChange={(e) =>
                    setFilters({ ...filters, symbol: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Exchange</label>
                <select
                  value={filters.exchange}
                  onChange={(e) =>
                    setFilters({ ...filters, exchange: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded text-sm"
                >
                  <option value="">All Exchanges</option>
                  {uniqueExchanges.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Sort By</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters({ ...filters, sortBy: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded text-sm"
                >
                  <option value="profit_desc">Profit (High to Low)</option>
                  <option value="profit_asc">Profit (Low to High)</option>
                  <option value="score_desc">AI Score (High to Low)</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-800 border-slate-700 p-4">
            <div className="text-slate-400 text-sm">Total Opportunities</div>
            <div className="text-2xl font-bold text-white">{opportunities.length}</div>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-4">
            <div className="text-slate-400 text-sm">Filtered Results</div>
            <div className="text-2xl font-bold text-amber-400">{filteredOpps.length}</div>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-4">
            <div className="text-slate-400 text-sm">Avg Profit</div>
            <div className="text-2xl font-bold text-green-400">
              {filteredOpps.length > 0
                ? (
                    filteredOpps.reduce(
                      (sum: number, opp: any) => sum + parseFloat(opp.profitPercentage),
                      0
                    ) / filteredOpps.length
                  ).toFixed(2)
                : '0.00'}
              %
            </div>
          </Card>
        </div>

        {/* Opportunities Table */}
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="animate-pulse">Loading opportunities...</div>
            </div>
          ) : filteredOpps.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No opportunities match your filters. Try adjusting criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Symbol
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Buy
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Buy Price
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Sell
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Sell Price
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Profit %
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      AI Score
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpps.map((opp: any) => (
                    <tr key={opp.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 text-white font-semibold">{opp.symbol}</td>
                      <td className="px-6 py-4 text-slate-300 text-sm">{opp.buyExchange}</td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        ${parseFloat(opp.buyPrice).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-sm">{opp.sellExchange}</td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        ${parseFloat(opp.sellPrice).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          <span className="font-semibold text-green-400">
                            {parseFloat(opp.profitPercentage).toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {opp.aiScore ? (
                          <span className="inline-block px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-sm font-semibold">
                            {parseFloat(opp.aiScore).toFixed(0)}/100
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          size="sm"
                          disabled={scoringId === opp.id}
                          onClick={() => handleScoreOpportunity(opp.id)}
                          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        >
                          {scoringId === opp.id ? 'Scoring...' : 'Score'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
