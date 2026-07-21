'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  RefreshCw, Zap, Info, AlertTriangle, Loader2, Search,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Clock,
  Activity,
} from 'lucide-react'
import type { LendingRatesResponse, CoinData, LendingPool } from '@/app/api/trader/lending-rates/route'

const REFRESH_INTERVAL = 30 // seconds

// ─── Helpers ──────────────────────────────────────────────────────────────
const PROJECT_LABELS: Record<string, string> = {
  'aave-v3': 'Aave v3', 'aave-v2': 'Aave v2',
  'compound-v3': 'Compound v3', 'compound-v2': 'Compound v2',
  'maple': 'Maple Finance', 'spark-savings': 'Spark',
  'sparklend': 'SparkLend', 'fluid-lending': 'Fluid',
  'fluid-lite': 'Fluid Lite', 'morpho': 'Morpho',
  'morpho-blue': 'Morpho Blue', 'venus': 'Venus',
  'radiant-v2': 'Radiant v2', 'benqi-lending': 'BENQI',
  'lido': 'Lido', 'rocketpool': 'Rocket Pool',
  'justlend-v1': 'JustLend', 'lista-lending': 'Lista',
}
function projectLabel(s: string) {
  return PROJECT_LABELS[s] ?? s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function apyColor(apy: number) {
  if (apy >= 8) return 'text-green-400'
  if (apy >= 4) return 'text-amber-400'
  if (apy >= 1) return 'text-slate-300'
  return 'text-slate-500'
}
function apyBadge(apy: number) {
  if (apy >= 8) return 'bg-green-500/15 border-green-500/40 text-green-300'
  if (apy >= 4) return 'bg-amber-500/15 border-amber-500/40 text-amber-300'
  return 'bg-slate-700/50 border-slate-700 text-slate-400'
}
function fmtPrice(n: number) {
  if (n >= 1000)  return n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  if (n >= 1)     return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  if (n >= 0.001) return n.toFixed(6)
  return n.toExponential(4)
}
function fmtBig(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

// ─── Flash hook — returns 'flash-up'/'flash-down'/'' ─────────────────────
function useFlash(value: number): string {
  const prev   = useRef(value)
  const [cls, setCls] = useState('')
  useEffect(() => {
    if (prev.current === 0 || value === 0) { prev.current = value; return }
    if (value !== prev.current) {
      setCls(value > prev.current ? 'flash-up' : 'flash-down')
      const t = setTimeout(() => setCls(''), 1200)
      prev.current = value
      return () => clearTimeout(t)
    }
  }, [value])
  return cls
}

// ─── Single coin card ─────────────────────────────────────────────────────
function CoinCard({
  coin, pools, expanded, onToggle,
}: {
  coin: CoinData
  pools: LendingPool[]
  expanded: boolean
  onToggle: () => void
}) {
  const flashCls = useFlash(coin.price)
  const topApy   = pools.length ? Math.max(...pools.map(p => p.apy)) : 0
  const isUp     = coin.change24h >= 0

  return (
    <Card className={`border transition-colors ${expanded ? 'border-cyan-500/40 bg-slate-900' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}>

      {/* Header */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          {/* Coin identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-white shrink-0">
              {coin.symbol.slice(0, 3)}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-none">{coin.symbol}</p>
              <p className="text-slate-500 text-xs mt-0.5 truncate">{coin.name}</p>
            </div>
          </div>

          {/* Live price */}
          <div className="text-right shrink-0">
            <p className={`font-bold text-sm leading-none tabular-nums transition-colors duration-300 ${
              flashCls === 'flash-up'   ? 'text-green-300' :
              flashCls === 'flash-down' ? 'text-red-300'   : 'text-white'
            }`}>
              ${fmtPrice(coin.price)}
            </p>
            <div className={`flex items-center justify-end gap-0.5 mt-1 text-xs font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isUp ? '+' : ''}{coin.change24h.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Best APY badge */}
        {topApy > 0 ? (
          <div className={`px-3 py-1.5 rounded-lg border text-center text-xs font-bold ${apyBadge(topApy)}`}>
            Best APY: {topApy.toFixed(2)}% &nbsp;&middot;&nbsp; {pools.length} pool{pools.length !== 1 ? 's' : ''}
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded-lg border border-slate-800 text-center text-xs text-slate-600 bg-slate-800/30">
            No lending pools found
          </div>
        )}

        {/* Mini stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-600">Volume 24h</span>
            <span className="text-slate-400 font-mono">{fmtBig(coin.volume24h)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Mkt Cap</span>
            <span className="text-slate-400 font-mono">{fmtBig(coin.marketCap)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">24h High</span>
            <span className="text-green-400/80 font-mono">${fmtPrice(coin.high24h)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">24h Low</span>
            <span className="text-red-400/80 font-mono">${fmtPrice(coin.low24h)}</span>
          </div>
        </div>

        {/* Toggle */}
        {pools.length > 0 && (
          <button onClick={onToggle}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide pools' : `View ${pools.length} lending pool${pools.length !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      {/* Expanded pools */}
      {expanded && pools.length > 0 && (
        <div className="border-t border-slate-800 p-4 space-y-2">
          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-3">
            Live Pools &mdash; {coin.symbol} &nbsp;&middot;&nbsp; via DeFiLlama
          </p>
          {pools.map((pool, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center shrink-0">
                  <Zap className="w-3 h-3 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-xs truncate">{projectLabel(pool.project)}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{pool.chain}</span>
                    {pool.poolMeta && <span className="text-[10px] text-slate-600 truncate max-w-[70px]">{pool.poolMeta}</span>}
                    {pool.apyReward > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300">
                        +{pool.apyReward.toFixed(2)}% reward
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className={`font-bold text-sm ${apyColor(pool.apy)}`}>{pool.apy.toFixed(2)}%</p>
                <p className="text-slate-600 text-[10px]">TVL {fmtBig(pool.tvlUsd).replace('$','$')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Countdown component ──────────────────────────────────────────────────
function Countdown({ seconds, total }: { seconds: number; total: number }) {
  const pct = ((total - seconds) / total) * 100
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-5 h-5">
        <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" stroke="#334155" strokeWidth="2.5" fill="none" />
          <circle cx="10" cy="10" r="8" stroke="#06b6d4" strokeWidth="2.5" fill="none"
            strokeDasharray={`${2 * Math.PI * 8}`}
            strokeDashoffset={`${2 * Math.PI * 8 * (1 - pct / 100)}`}
            className="transition-all duration-1000" />
        </svg>
      </div>
      <span className="text-slate-500 text-xs tabular-nums">{seconds}s</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────
export function Lending() {
  const [data, setData]           = useState<LendingRatesResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null)
  const [sortBy, setSortBy]       = useState<'apy' | 'volume' | 'price' | 'change'>('apy')
  const [search, setSearch]       = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const fetchRates = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/trader/lending-rates', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: LendingRatesResponse = await res.json()
      if ('error' in json) throw new Error((json as any).error)
      setData(json)
      setLastUpdated(new Date())
      setError(null)
      setCountdown(REFRESH_INTERVAL)
    } catch (e) {
      setError('Live data temporarily unavailable. Retrying...')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Auto-refresh every 30 s + countdown every 1 s
  useEffect(() => {
    fetchRates(false)
    intervalRef.current  = setInterval(() => fetchRates(true), REFRESH_INTERVAL * 1000)
    countdownRef.current = setInterval(() => setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1)), 1000)
    return () => {
      clearInterval(intervalRef.current!)
      clearInterval(countdownRef.current!)
    }
  }, [fetchRates])

  const coins       = data?.coins ?? []
  const poolsByCoin = data?.poolsByCoin ?? {}

  const bestApy = (sym: string) => {
    const ps = poolsByCoin[sym] ?? []
    return ps.length ? Math.max(...ps.map(p => p.apy)) : 0
  }

  const filtered = coins
    .filter(c =>
      !search ||
      c.symbol.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'price')  return b.price - a.price
      if (sortBy === 'volume') return b.volume24h - a.volume24h
      if (sortBy === 'change') return b.change24h - a.change24h
      return bestApy(b.symbol) - bestApy(a.symbol)
    })

  const totalPools  = Object.values(poolsByCoin).reduce((s, p) => s + p.length, 0)
  const totalMktCap = coins.reduce((s, c) => s + c.marketCap, 0)
  const totalVol    = coins.reduce((s, c) => s + c.volume24h, 0)
  const avgChange   = coins.length ? coins.reduce((s, c) => s + c.change24h, 0) / coins.length : 0

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      <p className="text-slate-400 text-sm">Fetching live rates from Coinpaprika &amp; DeFiLlama...</p>
    </div>
  )

  if (error && !data) return (
    <Card className="bg-slate-900 border-red-500/30 p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
      <p className="text-white font-semibold mb-1">Data fetch failed</p>
      <p className="text-slate-400 text-sm">{error}</p>
      <button onClick={() => fetchRates(false)} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors">
        Retry
      </button>
    </Card>
  )

  return (
    <>
      {/* Flash animation styles */}
      <style>{`
        @keyframes flashUp   { 0%,100%{background:transparent} 30%{background:rgba(74,222,128,.12)} }
        @keyframes flashDown { 0%,100%{background:transparent} 30%{background:rgba(248,113,113,.12)} }
        .flash-up   { animation: flashUp   1.2s ease }
        .flash-down { animation: flashDown 1.2s ease }
      `}</style>

      <div className="space-y-5 pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-white text-2xl font-bold">Lending &amp; Yields</h2>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30">
                <Activity className="w-3 h-3 text-green-400 animate-pulse" />
                <span className="text-green-400 text-xs font-bold">LIVE</span>
              </div>
              {refreshing && (
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Updating prices...
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <p className="text-slate-500 text-sm">
                Prices: <span className="text-slate-400 font-medium">Coinpaprika</span> &nbsp;&middot;&nbsp;
                APYs: <span className="text-slate-400 font-medium">DeFiLlama</span>
              </p>
              {lastUpdated && (
                <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                  <Clock className="w-3 h-3" />
                  {lastUpdated.toLocaleTimeString()}
                </div>
              )}
              {data && <Countdown seconds={countdown} total={REFRESH_INTERVAL} />}
            </div>
          </div>
          <button onClick={() => fetchRates(true)} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-semibold text-xs rounded-lg transition-colors">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Now
          </button>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Market Cap',    value: fmtBig(totalMktCap),                         sub: `${coins.length} coins tracked` },
            { label: '24h Volume',    value: fmtBig(totalVol),                             sub: 'Coinpaprika live' },
            { label: 'Avg 24h Change',value: `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`,
              sub: avgChange >= 0 ? 'Market up' : 'Market down',
              color: avgChange >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Live Pools',    value: String(totalPools),                           sub: 'DeFiLlama protocols' },
          ].map((s, i) => (
            <Card key={i} className="bg-slate-900 border-slate-800 p-4">
              <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color ?? 'text-white'}`}>{s.value}</p>
              <p className="text-slate-600 text-xs mt-0.5">{s.sub}</p>
            </Card>
          ))}
        </div>

        {/* ── Filters ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search coin..." className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:outline-none focus:border-cyan-500/50 placeholder-slate-600" />
          </div>
          {(['apy','volume','price','change'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                sortBy === s ? 'bg-cyan-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
              }`}>
              {s === 'apy' ? 'Highest APY' : s === 'change' ? '24h Change' : s === 'volume' ? 'Volume' : 'Price'}
            </button>
          ))}
        </div>

        {/* ── Error banner (soft) ────────────────────────────────────── */}
        {error && data && (
          <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ── Coin grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(coin => (
            <CoinCard
              key={coin.symbol}
              coin={coin}
              pools={poolsByCoin[coin.symbol] ?? []}
              expanded={expandedCoin === coin.symbol}
              onToggle={() => setExpandedCoin(expandedCoin === coin.symbol ? null : coin.symbol)}
            />
          ))}
        </div>

        {/* ── Source footer ─────────────────────────────────────────── */}
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="text-slate-300 font-semibold">Live data sources</p>
              <p className="text-slate-500">
                <span className="text-white">Prices &amp; 24h stats</span> — Coinpaprika public API (no auth, no rate limit).
                Refreshed every {REFRESH_INTERVAL}s automatically.
              </p>
              <p className="text-slate-500">
                <span className="text-white">APY / Lending pools</span> — DeFiLlama Yields (<code className="text-slate-400">yields.llama.fi/pools</code>).
                Real on-chain rates from Aave, Compound, Maple, Fluid, Morpho &amp; 150+ protocols. Single-asset only, min $2M TVL.
              </p>
              <p className="text-slate-600">Rates are informational only. Always verify directly on the protocol before depositing.</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
