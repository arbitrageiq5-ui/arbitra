'use client'

import { useEffect, useState } from 'react'
import { getLiveRates, getLendingPools, getMyLendingPositions, type CoinRate, type LendingPool } from '@/app/actions/lending'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, TrendingDown, RefreshCw, Zap, DollarSign, Lock, Unlock,
  ArrowUpRight, ArrowDownLeft, Info, AlertTriangle, CheckCircle2, Loader2,
  Eye, EyeOff,
} from 'lucide-react'

export function Lending() {
  const [rates, setRates] = useState<CoinRate[]>([])
  const [pools, setPools] = useState<LendingPool[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(true)
  const [sortBy, setSortBy] = useState<'apy' | 'volume' | 'price'>('apy')
  const [filterNetwork, setFilterNetwork] = useState<'all' | 'eth' | 'bsc' | 'locked'>('all')

  async function loadData() {
    setLoading(true)
    try {
      const [ratesData, poolsData] = await Promise.all([
        getLiveRates(),
        getLendingPools(),
      ])
      setRates(ratesData)
      setPools(poolsData)
    } catch (err) {
      console.error('[v0] Lending load error:', err)
    }
    setLoading(false)
  }

  async function refresh() {
    setRefreshing(true)
    try {
      const ratesData = await getLiveRates()
      setRates(ratesData)
    } catch (err) {
      console.error('[v0] Refresh error:', err)
    }
    setRefreshing(false)
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(refresh, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const sortedRates = [...rates].sort((a, b) => {
    if (sortBy === 'price') return b.current_price - a.current_price
    if (sortBy === 'volume') return (b.total_volume ?? 0) - (a.total_volume ?? 0)
    if (sortBy === 'apy') {
      // Sort by best APY from the lending pools
      const poolA = pools.find(p => p.id === `pool-${a.id}`)
      const poolB = pools.find(p => p.id === `pool-${b.id}`)
      const maxApyA = poolA ? Math.max(...poolA.rates.map(r => r.apy)) : 0
      const maxApyB = poolB ? Math.max(...poolB.rates.map(r => r.apy)) : 0
      return maxApyB - maxApyA // Higher APY first
    }
    return 0
  })

  const filteredRates = sortedRates.filter(r => {
    if (!showHidden && !r.market_cap) return false
    return true
  })

  return (
    <div className="space-y-6 pb-12">
      {/* ═══ Header ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-white text-2xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-400" />
              Lending & Yields
            </h2>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-semibold">Live Rates</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-1">Earn passive income by lending your crypto assets • Rates update every 30 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-medium transition-all text-xs"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white transition-all"
          >
            {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ═══ Stats Row ═════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Assets</div>
          <p className="text-white text-2xl font-bold">${(rates.reduce((sum, r) => sum + (r.market_cap ?? 0), 0) / 1e9).toFixed(1)}B</p>
          <p className="text-slate-600 text-xs mt-2">{rates.length} assets tracked</p>
        </Card>
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Avg Daily Volume</div>
          <p className="text-white text-2xl font-bold">${(rates.reduce((sum, r) => sum + (r.total_volume ?? 0), 0) / 1e9).toFixed(1)}B</p>
          <p className="text-slate-600 text-xs mt-2">24h aggregate</p>
        </Card>
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Avg 24h Change</div>
          <div className="flex items-baseline gap-2">
            <p className="text-white text-2xl font-bold">
              {(rates.reduce((sum, r) => sum + (r.price_change_percentage_24h ?? 0), 0) / Math.max(rates.length, 1)).toFixed(1)}%
            </p>
            {(rates.reduce((sum, r) => sum + (r.price_change_percentage_24h ?? 0), 0) / Math.max(rates.length, 1)) >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
          </div>
        </Card>
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Pools Available</div>
          <p className="text-white text-2xl font-bold">{pools.length}</p>
          <p className="text-slate-600 text-xs mt-2">active lending pools</p>
        </Card>
      </div>

      {/* ═══ Filters & Sort ════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSortBy('apy')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            sortBy === 'apy'
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          Highest APY
        </button>
        <button
          onClick={() => setSortBy('volume')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            sortBy === 'volume'
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          Volume
        </button>
        <button
          onClick={() => setSortBy('price')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            sortBy === 'price'
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          Price
        </button>
      </div>

      {/* ═══ Coins Grid ════════════════════════════════════════════════════ */}
      {loading ? (
        <Card className="bg-slate-900 border-slate-800 p-12 text-center">
          <Loader2 className="w-8 h-8 text-slate-600 mx-auto animate-spin mb-3" />
          <p className="text-slate-400">Loading live rates from CoinGecko...</p>
        </Card>
      ) : filteredRates.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No coins available</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredRates.map(coin => {
            const pool = pools.find(p => p.id === `pool-${coin.id}`)
            const bestApy = pool ? Math.max(...pool.rates.map(r => r.apy)) : 0
            const priceChange = coin.price_change_percentage_24h ?? 0
            const isGain = priceChange >= 0

            return (
              <Card
                key={coin.id}
                onClick={() => setSelectedCoin(selectedCoin === coin.id ? null : coin.id)}
                className="bg-slate-900 border-slate-800 p-4 cursor-pointer hover:border-slate-700 transition-colors group"
              >
                {/* Coin header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                    <div>
                      <p className="text-white font-bold text-sm">{coin.symbol.toUpperCase()}</p>
                      <p className="text-slate-600 text-xs">{coin.name.slice(0, 15)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm">${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: coin.current_price < 1 ? 6 : 2 })}</p>
                    <div className={`text-xs font-semibold flex items-center justify-end gap-1 ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                      {isGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                      {Math.abs(priceChange).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* APY badge */}
                {bestApy > 0 && (
                  <div className="mb-3 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-center">
                    <p className="text-amber-300 font-bold text-xs">Up to {bestApy.toFixed(1)}% APY</p>
                  </div>
                )}

                {/* Volume & Market Cap */}
                <div className="space-y-1.5 text-xs mb-3 pb-3 border-t border-slate-800">
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-slate-500">24h Volume</span>
                    <span className="text-white font-mono">${(coin.total_volume / 1e9).toFixed(1)}B</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Market Cap</span>
                    <span className="text-white font-mono">
                      {coin.market_cap_rank && `#${coin.market_cap_rank}`} · ${(coin.market_cap / 1e9).toFixed(1)}B
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">24h High/Low</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      ${coin.high_24h.toFixed(coin.current_price < 1 ? 6 : 2)} / ${coin.low_24h.toFixed(coin.current_price < 1 ? 6 : 2)}
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <Button
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs py-1.5 gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedCoin(coin.id)
                  }}
                >
                  <Zap className="w-3.5 h-3.5" /> Lend {coin.symbol.toUpperCase()}
                </Button>

                {/* Expanded details */}
                {selectedCoin === coin.id && pool && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">Lending Options</p>
                    {pool.rates.map((rate, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 text-xs">
                        <div className="flex items-center gap-1.5">
                          {rate.locked ? (
                            <Lock className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Unlock className="w-3 h-3 text-green-400" />
                          )}
                          <div>
                            <p className="text-white font-semibold">{rate.network}</p>
                            <p className="text-slate-600 text-[10px]">
                              Min: {rate.minDeposit} {rate.coin} {rate.duration && `• ${rate.duration}`}
                            </p>
                          </div>
                        </div>
                        <p className="text-amber-300 font-bold">{rate.apy.toFixed(1)}%</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ═══ Info Banner ═══════════════════════════════════════════════════ */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="text-slate-300">
              <span className="font-semibold">Live coin rates & APYs updated every 30 seconds</span> from CoinGecko. APY is calculated dynamically based on coin volatility, trading volume, and market conditions.
            </p>
            <p className="text-slate-500 text-xs">
              • Higher volatility = higher APY • Lock-in periods offer premium yields • Rates vary by network (Ethereum, BSC, etc.)
            </p>
            <p className="text-slate-500 text-xs">Lending products are subject to risk. Always verify terms before depositing funds.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
