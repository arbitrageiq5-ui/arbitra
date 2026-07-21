'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  TrendingUp, TrendingDown, RefreshCw, Zap, Lock, Unlock,
  ArrowUpRight, ArrowDownLeft, Info, AlertTriangle, Loader2, Search,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import type { LendingRatesResponse, CoinData, LendingPool } from '@/app/api/trader/lending-rates/route'

// ── Project display names ──────────────────────────────────────────────────
const PROJECT_LABELS: Record<string, string> = {
  'aave-v3':              'Aave v3',
  'aave-v2':              'Aave v2',
  'compound-v3':          'Compound v3',
  'compound-v2':          'Compound v2',
  'maple':                'Maple Finance',
  'spark-savings':        'Spark',
  'sparklend':            'SparkLend',
  'fluid-lending':        'Fluid',
  'fluid-lite':           'Fluid Lite',
  'jupiter-lend':         'Jupiter Lend',
  'centrifuge-protocol':  'Centrifuge',
  'pareto-credit':        'Pareto',
  'morpho':               'Morpho',
  'morpho-blue':          'Morpho Blue',
  'venus':                'Venus',
  'radiant-v2':           'Radiant v2',
  'benqi-lending':        'BENQI',
  'ironclad-finance':     'Ironclad',
  'moonwell-apollo':      'Moonwell',
  'sonne-finance':        'Sonne',
  'lido':                 'Lido',
  'rocketpool':           'Rocket Pool',
  'justlend-v1':          'JustLend',
  'lista-lending':        'Lista',
  'b14g':                 'B14G',
}

function projectLabel(slug: string) {
  return PROJECT_LABELS[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function apyColor(apy: number) {
  if (apy >= 8)  return 'text-green-400'
  if (apy >= 4)  return 'text-amber-400'
  if (apy >= 1)  return 'text-slate-300'
  return 'text-slate-500'
}

function apyBg(apy: number) {
  if (apy >= 8)  return 'bg-green-500/15 border-green-500/30 text-green-300'
  if (apy >= 4)  return 'bg-amber-500/15 border-amber-500/30 text-amber-300'
  return 'bg-slate-700/50 border-slate-700 text-slate-400'
}

// ── Main component ─────────────────────────────────────────────────────────
export function Lending() {
  const [data, setData]         = useState<LendingRatesResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null)
  const [sortBy, setSortBy]     = useState<'apy' | 'volume' | 'price' | 'change'>('apy')
  const [search, setSearch]     = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // ── Fetch from the API route (real live data) ────────────────────────────
  const fetchRates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/trader/lending-rates', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: LendingRatesResponse = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      console.error('[lending] fetch error:', err)
      setError('Could not reach live data sources. Retrying in 30 s.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchRates(false)
    intervalRef.current = setInterval(() => fetchRates(true), 30_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchRates])

  // ── Derived data ─────────────────────────────────────────────────────────
  const coins: CoinData[] = data?.coins ?? []
  const poolsByCoin = data?.poolsByCoin ?? {}

  const bestApy = (sym: string) => {
    const pools = poolsByCoin[sym.toUpperCase()] ?? []
    return pools.length > 0 ? Math.max(...pools.map(p => p.apy)) : 0
  }

  const filtered = coins
    .filter(c =>
      search === '' ||
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'price')  return b.current_price - a.current_price
      if (sortBy === 'volume') return (b.total_volume ?? 0) - (a.total_volume ?? 0)
      if (sortBy === 'change') return (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0)
      // 'apy' — sort by highest available yield
      return bestApy(b.symbol) - bestApy(a.symbol)
    })

  // ── Aggregate stats ────────────────────────────────────────────────────
  const totalMarketCap   = coins.reduce((s, c) => s + (c.market_cap ?? 0), 0)
  const totalVolume      = coins.reduce((s, c) => s + (c.total_volume ?? 0), 0)
  const avgChange        = coins.length ? coins.reduce((s, c) => s + (c.price_change_percentage_24h ?? 0), 0) / coins.length : 0
  const totalPools       = Object.values(poolsByCoin).reduce((s, p) => s + p.length, 0)

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      <p className="text-slate-400 text-sm">Fetching live rates from CoinGecko + DeFiLlama...</p>
    </div>
  )

  if (error && !data) return (
    <Card className="bg-slate-900 border-red-500/30 p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
      <p className="text-white font-semibold mb-1">Data fetch failed</p>
      <p className="text-slate-400 text-sm">{error}</p>
      <button onClick={() => fetchRates(false)} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">
        Retry
      </button>
    </Card>
  )

  return (
    <div className="space-y-5 pb-12">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-white text-2xl font-bold">Lending & Yields</h2>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-semibold">Live</span>
            </div>
            {refreshing && (
              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                <RefreshCw className="w-3 h-3 animate-spin" /> Updating...
              </div>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Real APY rates from DeFiLlama &amp; live prices from CoinGecko
            {lastUpdated && (
              <span className="ml-2 text-slate-600">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchRates(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold text-xs rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Market Cap', value: `$${(totalMarketCap / 1e12).toFixed(2)}T`, sub: `${coins.length} coins tracked` },
          { label: '24h Volume',       value: `$${(totalVolume / 1e9).toFixed(1)}B`,     sub: 'Aggregate' },
          { label: 'Avg 24h Change',   value: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
            sub: avgChange >= 0 ? 'Market rising' : 'Market falling',
            color: avgChange >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Live Lending Pools', value: totalPools.toString(), sub: 'From DeFi protocols' },
        ].map((s, i) => (
          <Card key={i} className="bg-slate-900 border-slate-800 p-4">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color ?? 'text-white'}`}>{s.value}</p>
            <p className="text-slate-600 text-xs mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search coin..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:border-cyan-500/50 placeholder-slate-600"
          />
        </div>
        {(['apy', 'volume', 'price', 'change'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${
              sortBy === s
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {s === 'apy' ? 'Highest APY' : s === 'change' ? '24h Change' : s === 'volume' ? 'Volume' : 'Price'}
          </button>
        ))}
      </div>

      {/* ── Error banner (soft, data still shown) ─────────────────────── */}
      {error && data && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Coin cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map(coin => {
          const sym      = coin.symbol.toUpperCase()
          const pools    = poolsByCoin[sym] ?? []
          const topApy   = pools.length > 0 ? Math.max(...pools.map(p => p.apy)) : 0
          const change   = coin.price_change_percentage_24h ?? 0
          const isGain   = change >= 0
          const isOpen   = expandedCoin === sym
          const decimals = coin.current_price < 1 ? 6 : coin.current_price < 100 ? 4 : 2

          return (
            <Card key={coin.id}
              className={`bg-slate-900 border transition-all ${isOpen ? 'border-cyan-500/40' : 'border-slate-800 hover:border-slate-700'}`}
            >
              {/* ── Card header ────────────────────────────────────────── */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={coin.image}
                      alt={coin.name}
                      className="w-9 h-9 rounded-full bg-slate-800"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div>
                      <p className="text-white font-bold text-sm leading-none">{sym}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{coin.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm leading-none">
                      ${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 })}
                    </p>
                    <div className={`flex items-center justify-end gap-0.5 mt-1 text-xs font-semibold ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                      {isGain ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                      {Math.abs(change).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* ── Best APY badge ──────────────────────────────────── */}
                {topApy > 0 ? (
                  <div className={`px-3 py-1.5 rounded-lg border text-center text-xs font-bold ${apyBg(topApy)}`}>
                    Best APY: {topApy.toFixed(2)}% &nbsp;·&nbsp; {pools.length} pool{pools.length !== 1 ? 's' : ''}
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-lg border border-slate-800 text-center text-xs text-slate-600 bg-slate-800/30">
                    No lending pools found
                  </div>
                )}

                {/* ── Market stats ────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Volume 24h</span>
                    <span className="text-slate-400 font-mono">${(coin.total_volume / 1e9).toFixed(2)}B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Mkt Cap</span>
                    <span className="text-slate-400 font-mono">${(coin.market_cap / 1e9).toFixed(1)}B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">24h High</span>
                    <span className="text-green-400/80 font-mono">${coin.high_24h.toLocaleString(undefined, { maximumFractionDigits: decimals })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">24h Low</span>
                    <span className="text-red-400/80 font-mono">${coin.low_24h.toLocaleString(undefined, { maximumFractionDigits: decimals })}</span>
                  </div>
                </div>

                {/* ── Expand button ───────────────────────────────────── */}
                {pools.length > 0 && (
                  <button
                    onClick={() => setExpandedCoin(isOpen ? null : sym)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
                  >
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isOpen ? 'Hide pools' : `View ${pools.length} lending pool${pools.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              {/* ── Expanded pools ──────────────────────────────────────── */}
              {isOpen && pools.length > 0 && (
                <div className="border-t border-slate-800 p-4 space-y-2">
                  <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-3">
                    Live Lending Pools — {sym} &nbsp;|&nbsp; Source: DeFiLlama
                  </p>
                  {pools.map((pool, i) => (
                    <div key={i}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center shrink-0">
                          <Zap className="w-3 h-3 text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-xs truncate">
                            {projectLabel(pool.project)}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{pool.chain}</span>
                            {pool.poolMeta && (
                              <span className="text-[10px] text-slate-600 truncate max-w-[80px]">{pool.poolMeta}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className={`font-bold text-sm ${apyColor(pool.apy)}`}>{pool.apy.toFixed(2)}%</p>
                        <p className="text-slate-600 text-[10px]">
                          TVL ${pool.tvlUsd >= 1e9
                            ? `${(pool.tvlUsd / 1e9).toFixed(1)}B`
                            : `${(pool.tvlUsd / 1e6).toFixed(0)}M`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* ── Source attribution ─────────────────────────────────────────── */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="text-slate-300 font-semibold">Data sources</p>
            <p className="text-slate-500">
              <span className="text-white">Coin prices</span> — CoinGecko public API, refreshed every 30 s.
            </p>
            <p className="text-slate-500">
              <span className="text-white">APY / Lending pools</span> — DeFiLlama Yields API (<code className="text-slate-400">yields.llama.fi/pools</code>). Real on-chain rates from Aave, Compound, Maple, Fluid, Morpho, and 150+ protocols. Single-asset pools only, min. $5 M TVL.
            </p>
            <p className="text-slate-600">Rates are informational. Always verify directly on the protocol before depositing.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
