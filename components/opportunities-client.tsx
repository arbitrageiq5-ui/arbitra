'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getMarketOpportunities } from '@/app/actions/arbitrage'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ArrowLeft, LogOut, RefreshCw, TrendingUp, TrendingDown,
  Activity, Filter, ChevronUp, ChevronDown, Search, X,
  Zap, Shield, AlertTriangle, Clock, BarChart3,
} from 'lucide-react'

type Opportunity = Awaited<ReturnType<typeof getMarketOpportunities>>[number]

type Category = 'all' | 'major' | 'alt' | 'meme' | 'defi' | 'ai' | 'l2'
type SortKey = 'netProfit' | 'spread' | 'volume24h' | 'symbol' | 'detectedAt'
type SortDir = 'asc' | 'desc'

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All Coins',
  major: 'Major',
  alt: 'Altcoins',
  meme: 'Meme',
  defi: 'DeFi',
  ai: 'AI / Data',
  l2: 'Layer 2',
}

const CATEGORY_COLORS: Record<Category, string> = {
  all: 'bg-slate-700 text-slate-300',
  major: 'bg-blue-500/20 text-blue-300',
  alt: 'bg-violet-500/20 text-violet-300',
  meme: 'bg-pink-500/20 text-pink-300',
  defi: 'bg-green-500/20 text-green-300',
  ai: 'bg-amber-500/20 text-amber-300',
  l2: 'bg-cyan-500/20 text-cyan-300',
}

const RISK_CONFIG = {
  Low: { color: 'text-green-400', bg: 'bg-green-400/10', icon: Shield },
  Medium: { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: AlertTriangle },
  High: { color: 'text-red-400', bg: 'bg-red-400/10', icon: AlertTriangle },
}

const LIQUIDITY_CONFIG = {
  High: { color: 'text-green-400', dots: 3 },
  Medium: { color: 'text-amber-400', dots: 2 },
  Low: { color: 'text-red-400', dots: 1 },
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function formatVolume(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

function formatPrice(p: number) {
  if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(3)}`
  if (p >= 0.01) return `$${p.toFixed(4)}`
  if (p >= 0.0001) return `$${p.toFixed(6)}`
  return `$${p.toFixed(8)}`
}

function LiquidityDots({ level }: { level: 'High' | 'Medium' | 'Low' }) {
  const { color, dots } = LIQUIDITY_CONFIG[level]
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((d) => (
        <span
          key={d}
          className={`w-1.5 h-1.5 rounded-full ${d <= dots ? color.replace('text-', 'bg-') : 'bg-slate-600'}`}
        />
      ))}
      <span className={`text-xs ml-1 ${color}`}>{level}</span>
    </div>
  )
}

function SortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors font-semibold text-xs uppercase tracking-wider"
    >
      {label}
      <span className="flex flex-col -space-y-0.5">
        <ChevronUp className={`w-3 h-3 ${active && dir === 'asc' ? 'text-[#00D4FF]' : 'text-slate-600'}`} />
        <ChevronDown className={`w-3 h-3 ${active && dir === 'desc' ? 'text-[#00D4FF]' : 'text-slate-600'}`} />
      </span>
    </button>
  )
}

export function OpportunitiesClient({ user }: { user: { name?: string | null; email?: string; role?: string } }) {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Filters
  const [category, setCategory] = useState<Category>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [exchangeFilter, setExchangeFilter] = useState('')
  const [minProfit, setMinProfit] = useState(0)
  const [riskFilter, setRiskFilter] = useState<'all' | 'Low' | 'Medium' | 'High'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('netProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await getMarketOpportunities()
      setOpportunities(data)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Failed to load market opportunities:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(() => loadData(true), 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }

  const filtered = useMemo(() => {
    let data = opportunities

    if (category !== 'all') data = data.filter(o => o.category === category)
    if (searchQuery) {
      const q = searchQuery.toUpperCase()
      data = data.filter(o =>
        o.symbol.includes(q) ||
        o.buyExchange.toUpperCase().includes(q) ||
        o.sellExchange.toUpperCase().includes(q)
      )
    }
    if (exchangeFilter) data = data.filter(o => o.buyExchange === exchangeFilter || o.sellExchange === exchangeFilter)
    if (minProfit > 0) data = data.filter(o => o.netProfit >= minProfit)
    if (riskFilter !== 'all') data = data.filter(o => o.risk === riskFilter)

    data = [...data].sort((a, b) => {
      let va: number | string = a[sortKey] as number | string
      let vb: number | string = b[sortKey] as number | string
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

    return data
  }, [opportunities, category, searchQuery, exchangeFilter, minProfit, riskFilter, sortKey, sortDir])

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const allExchanges = useMemo(() => {
    const set = new Set<string>()
    opportunities.forEach(o => { set.add(o.buyExchange); set.add(o.sellExchange) })
    return Array.from(set).sort()
  }, [opportunities])

  // Summary stats
  const stats = useMemo(() => ({
    total: filtered.length,
    avgProfit: filtered.length ? filtered.reduce((s, o) => s + o.netProfit, 0) / filtered.length : 0,
    topProfit: filtered.length ? filtered[0]?.netProfit ?? 0 : 0,
    highLiq: filtered.filter(o => o.liquidity === 'High').length,
  }), [filtered])

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  const hasActiveFilters = category !== 'all' || searchQuery || exchangeFilter || minProfit > 0 || riskFilter !== 'all'

  const clearFilters = () => {
    setCategory('all'); setSearchQuery(''); setExchangeFilter('')
    setMinProfit(0); setRiskFilter('all'); setPage(0)
  }

  return (
    <div className="flex flex-col min-h-screen font-sans">
      {/* Header */}
      <header className="border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#00D4FF]/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-[#00D4FF]" />
              </div>
              <span className="text-white font-bold text-lg">Arbitrage IQ</span>
            </div>
            <span className="hidden md:block text-slate-600">/</span>
            <span className="hidden md:block text-slate-400 text-sm">Market Opportunities</span>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="hidden md:flex items-center gap-1.5 text-slate-500 text-xs">
                <Clock className="w-3 h-3" />
                Updated {timeAgo(lastUpdated.toISOString())}
              </span>
            )}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#00D4FF]' : ''}`} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-slate-300 text-sm font-medium">{user.name ?? user.email}</span>
              <span className="px-1.5 py-0.5 rounded text-xs bg-[#00D4FF]/10 text-[#00D4FF] font-semibold uppercase">
                {user.role ?? 'viewer'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto px-4 md:px-6 py-6 w-full space-y-5">
        {/* Page title + live badge */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Market Opportunities</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Real-time arbitrage detection across {allExchanges.length} exchanges
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-400/10 border border-green-400/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-semibold">LIVE</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Opportunities', value: stats.total.toString(), icon: TrendingUp, color: 'text-[#00D4FF]', sub: `of ${opportunities.length} total` },
            { label: 'Avg Net Profit', value: `${stats.avgProfit.toFixed(2)}%`, icon: BarChart3, color: 'text-green-400', sub: 'after fees' },
            { label: 'Top Spread', value: `${stats.topProfit.toFixed(2)}%`, icon: Zap, color: 'text-amber-400', sub: 'best opportunity' },
            { label: 'High Liquidity', value: stats.highLiq.toString(), icon: Activity, color: 'text-violet-400', sub: 'easy execution' },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <Card key={label} className="bg-slate-800/60 border-slate-700/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-xs mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
                </div>
                <div className={`p-2 rounded-lg bg-slate-700/60`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setPage(0) }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                category === cat
                  ? `${CATEGORY_COLORS[cat]} ring-1 ring-current`
                  : 'text-slate-500 hover:text-slate-300 bg-slate-800/50'
              }`}
            >
              {CATEGORY_LABELS[cat]}
              {cat !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">
                  {opportunities.filter(o => o.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0) }}
              placeholder="Search symbol or exchange..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00D4FF]/50"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              hasActiveFilters
                ? 'bg-[#00D4FF]/10 border-[#00D4FF]/40 text-[#00D4FF]'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Advanced filters panel */}
        {showFilters && (
          <Card className="bg-slate-800/80 border-slate-700/50 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Exchange</label>
                <select
                  value={exchangeFilter}
                  onChange={e => { setExchangeFilter(e.target.value); setPage(0) }}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg text-sm focus:outline-none focus:border-[#00D4FF]/50"
                >
                  <option value="">All Exchanges</option>
                  {allExchanges.map(ex => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Min Net Profit %</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={minProfit}
                  onChange={e => { setMinProfit(parseFloat(e.target.value) || 0); setPage(0) }}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg text-sm focus:outline-none focus:border-[#00D4FF]/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Risk Level</label>
                <select
                  value={riskFilter}
                  onChange={e => { setRiskFilter(e.target.value as typeof riskFilter); setPage(0) }}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg text-sm focus:outline-none focus:border-[#00D4FF]/50"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Table */}
        <Card className="bg-slate-800/60 border-slate-700/50 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-[#00D4FF] animate-spin mx-auto mb-3" />
              <p className="text-slate-400">Scanning exchanges for arbitrage opportunities...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingDown className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No opportunities match your filters</p>
              <button onClick={clearFilters} className="mt-3 text-[#00D4FF] text-sm hover:underline">
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60 bg-slate-900/40">
                      <th className="px-4 py-3 text-left">
                        <SortHeader label="Symbol" sortKey="symbol" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Category</span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Buy On</span>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Buy Price</span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Sell On</span>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Sell Price</span>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <SortHeader label="Spread" sortKey="spread" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-3 text-right">
                        <SortHeader label="Net Profit" sortKey="netProfit" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-3 text-right">
                        <SortHeader label="Volume 24h" sortKey="volume24h" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </th>
                      <th className="px-4 py-3 text-center">
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Liquidity</span>
                      </th>
                      <th className="px-4 py-3 text-center">
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Risk</span>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <SortHeader label="Detected" sortKey="detectedAt" current={sortKey} dir={sortDir} onSort={handleSort} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((opp, i) => {
                      const catColor = CATEGORY_COLORS[opp.category] ?? CATEGORY_COLORS.alt
                      const riskCfg = RISK_CONFIG[opp.risk]
                      const RiskIcon = riskCfg.icon
                      return (
                        <tr
                          key={opp.id}
                          className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                            i % 2 === 0 ? '' : 'bg-slate-900/20'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-bold text-white">{opp.symbol}</span>
                            <span className="text-slate-500">/USDT</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor}`}>
                              {CATEGORY_LABELS[opp.category] ?? opp.category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-300 font-medium">{opp.buyExchange}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-400 font-mono text-xs">{formatPrice(opp.buyPrice)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-300 font-medium">{opp.sellExchange}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-400 font-mono text-xs">{formatPrice(opp.sellPrice)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-[#00D4FF] font-semibold">{opp.spread.toFixed(2)}%</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                              <span className={`font-bold ${
                                opp.netProfit >= 2 ? 'text-green-300' :
                                opp.netProfit >= 1 ? 'text-green-400' : 'text-green-500'
                              }`}>
                                {opp.netProfit.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-400 text-xs font-mono">{formatVolume(opp.volume24h)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <LiquidityDots level={opp.liquidity} />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${riskCfg.bg} ${riskCfg.color}`}>
                                <RiskIcon className="w-3 h-3" />
                                {opp.risk}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-slate-500 text-xs">{timeAgo(opp.detectedAt)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/60">
                  <span className="text-slate-500 text-sm">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 px-3"
                    >
                      Prev
                    </Button>
                    <span className="text-slate-400 text-sm px-1">{page + 1} / {totalPages}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page === totalPages - 1}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        <p className="text-slate-600 text-xs text-center pb-4">
          Prices update every 30 seconds. Data is for informational purposes only. Always verify on exchange before executing trades.
        </p>
      </main>
    </div>
  )
}
