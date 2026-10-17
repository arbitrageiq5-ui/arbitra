'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, RefreshCw, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { BASE_PRICES } from '@/lib/constants/prices'

interface Opportunity {
  id: number
  coin: string
  buyExchange: string
  sellExchange: string
  buyPrice: number
  sellPrice: number
  spread: number
  fee: number
  netSpread: number
  profitPer1k: number
  liquidity: 'High' | 'Medium' | 'Low'
  network: string
  updated: number
}

const COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX', 'MATIC', 'DOGE', 'ADA', 'LINK', 'DOT', 'UNI', 'ATOM', 'LTC', 'NEAR', 'ARB', 'OP', 'AAVE', 'PEPE', 'TON']
const EXCHANGES = ['Binance', 'Coinbase', 'Kraken', 'Bybit', 'KuCoin', 'OKX', 'Gate.io', 'Bitget', 'Gemini', 'Bitfinex']
const NETWORKS = ['ERC-20', 'BEP-20', 'TRC-20', 'Solana', 'Polygon', 'Bitcoin', 'Avalanche', 'Arbitrum', 'Optimism']
const LIQUIDITY: Array<'High' | 'Medium' | 'Low'> = ['High', 'High', 'Medium', 'Medium', 'Low']

const MAJOR_COINS = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE'])

function generateRow(id: number): Opportunity {
  const coin = COINS[id % COINS.length]
  const base = BASE_PRICES[coin] ?? 1
  const isMajor = MAJOR_COINS.has(coin)
  const buyEx = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)]
  let sellEx = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)]
  while (sellEx === buyEx) sellEx = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)]
  // Tighter, more realistic spread: majors 0.05-0.8%, alts 0.2-1.8%
  const spreadMin = isMajor ? 0.05 : 0.2
  const spreadMax = isMajor ? 0.8  : 1.8
  const spread = spreadMin + Math.random() * (spreadMax - spreadMin)
  const buyPrice = base * (1 - spread / 200)
  const sellPrice = base * (1 + spread / 200)
  const fee = isMajor ? 0.06 + Math.random() * 0.10 : 0.08 + Math.random() * 0.18
  const netSpread = spread - fee
  const profitPer1k = (netSpread / 100) * 1000
  return {
    id,
    coin,
    buyExchange: buyEx,
    sellExchange: sellEx,
    buyPrice,
    sellPrice,
    spread,
    fee,
    netSpread,
    profitPer1k,
    liquidity: LIQUIDITY[Math.floor(Math.random() * LIQUIDITY.length)],
    network: NETWORKS[Math.floor(Math.random() * NETWORKS.length)],
    updated: 0,
  }
}

function buildData(): Opportunity[] {
  const now = Date.now()
  return Array.from({ length: 48 }, (_, i) => ({ ...generateRow(i), updated: now }))
}

function SpreadBadge({ value }: { value: number }) {
  const color = value >= 0.8 ? '#00FF99' : value >= 0.4 ? '#00D4FF' : '#98A2B3'
  return (
    <span
      className="font-bold text-sm"
      style={{ color, textShadow: `0 0 10px ${color}60` }}
    >
      {value.toFixed(2)}%
    </span>
  )
}

function LiquidityBadge({ value }: { value: 'High' | 'Medium' | 'Low' }) {
  const map = { High: 'text-[#00FF99] bg-[#00FF99]/10', Medium: 'text-[#00D4FF] bg-[#00D4FF]/10', Low: 'text-[#98A2B3] bg-white/5' }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[value]}`}>{value}</span>
  )
}

const PAGE_SIZE = 8

export function LiveMarket() {
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<Opportunity[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pulse, setPulse] = useState<number[]>([])

  // Only run on client — avoids all SSR/client Math.random() hydration mismatches
  useEffect(() => {
    setData(buildData())
    setMounted(true)
  }, [])

  // Simulate live ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        if (prev.length === 0) return prev
        const updateCount = 2 + Math.floor(Math.random() * 4)
        const indices = Array.from({ length: updateCount }, () =>
          Math.floor(Math.random() * prev.length)
        )
        setPulse(indices)
        setTimeout(() => setPulse([]), 600)
        const next = [...prev]
        indices.forEach((i) => {
          const row = next[i]
          if (!row) return
          // Tiny drift: 0.01-0.05% per tick — much more realistic
          const drift = (Math.random() - 0.5) * 0.0004
          const newBuy = row.buyPrice * (1 + drift)
          const newSpread = Math.max(0.04, row.spread + (Math.random() - 0.5) * 0.02)
          const newSell = newBuy * (1 + newSpread / 100)
          const newNet = newSpread - row.fee
          next[i] = {
            ...row,
            buyPrice: newBuy,
            sellPrice: newSell,
            spread: newSpread,
            netSpread: newNet,
            profitPer1k: (newNet / 100) * 1000,
            updated: Date.now(),
          }
        })
        return next
      })
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  const filtered = data.filter((r) =>
    r.coin.toLowerCase().includes(query.toLowerCase()) ||
    r.buyExchange.toLowerCase().includes(query.toLowerCase()) ||
    r.sellExchange.toLowerCase().includes(query.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const handleSearch = useCallback((v: string) => {
    setQuery(v)
    setPage(0)
  }, [])

  return (
    <section id="markets" className="py-28 relative">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#00D4FF]/4 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/5 text-[#00D4FF] text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
            Live Market Data
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
            Live Market Preview
          </h2>
          <p className="text-[#98A2B3] text-lg max-w-xl mx-auto">
            Real-time arbitrage opportunities updated every second across 12+ exchanges.
          </p>
        </motion.div>

        {/* Table card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="rounded-2xl border border-white/[0.08] bg-[#0E1324]/80 backdrop-blur-xl overflow-hidden shadow-[0_0_60px_rgba(0,212,255,0.06)]"
        >
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00D4FF]" />
              <span className="text-sm font-semibold text-white">Arbitrage Scanner</span>
              <span className="text-xs text-[#98A2B3] ml-2">{filtered.length} opportunities</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#98A2B3]" />
                <input
                  type="text"
                  placeholder="Search coin or exchange..."
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full sm:w-64 pl-8 pr-4 py-2 text-sm rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#98A2B3] focus:outline-none focus:border-[#00D4FF]/40 transition-colors"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#00FF99]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                Live
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Coin', 'Buy Exchange', 'Sell Exchange', 'Buy Price', 'Sell Price', 'Spread', 'Est. Fees', 'Net Spread', '$ /1k', 'Liquidity', 'Network', 'Updated'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#98A2B3] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!mounted && Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {Array.from({ length: 11 }, (_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-white/[0.05] animate-pulse" style={{ width: `${40 + (j * 13) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}
                {mounted && pageData.map((row, i) => {
                  const isUpdating = pulse.includes(data.indexOf(row))
                  return (
                    <motion.tr
                      key={row.id}
                      className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${
                        isUpdating ? 'bg-[#00D4FF]/5' : ''
                      }`}
                      animate={isUpdating ? { backgroundColor: ['rgba(0,212,255,0.08)', 'rgba(0,212,255,0)'] } : {}}
                      transition={{ duration: 0.6 }}
                    >
                      <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/20 flex items-center justify-center text-[10px] font-bold text-[#00D4FF]">
                            {row.coin.slice(0, 1)}
                          </div>
                          {row.coin}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#98A2B3] whitespace-nowrap">{row.buyExchange}</td>
                      <td className="px-4 py-3 text-[#98A2B3] whitespace-nowrap">{row.sellExchange}</td>
                      <td className="px-4 py-3 text-white whitespace-nowrap font-mono text-xs">
                        ${row.buyPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-white whitespace-nowrap font-mono text-xs">
                        ${row.sellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><SpreadBadge value={row.spread} /></td>
                      <td className="px-4 py-3 text-[#98A2B3] whitespace-nowrap text-xs">{row.fee.toFixed(2)}%</td>
                      <td className="px-4 py-3 whitespace-nowrap"><SpreadBadge value={row.netSpread} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-bold text-sm ${row.profitPer1k > 0 ? 'text-[#00FF99]' : 'text-red-400'}`}>
                          {row.profitPer1k > 0 ? '+' : ''}{row.profitPer1k.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><LiquidityBadge value={row.liquidity} /></td>
                      <td className="px-4 py-3 text-[#98A2B3] whitespace-nowrap text-xs">{row.network}</td>
                      <td className="px-4 py-3 text-[#98A2B3] whitespace-nowrap text-xs">
                        {new Date(row.updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-white/[0.06]">
            <span className="text-xs text-[#98A2B3]">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-white/[0.08] text-[#98A2B3] hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-7 h-7 text-xs rounded-lg transition-all ${
                    page === i
                      ? 'bg-[#00D4FF] text-[#050816] font-bold'
                      : 'text-[#98A2B3] hover:text-white border border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-white/[0.08] text-[#98A2B3] hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-[#98A2B3]/60 mt-6 max-w-2xl mx-auto">
          Crypto markets involve significant risk. Arbitrage opportunities depend on market conditions, liquidity, transfer times, fees, and exchange availability.
          This platform provides market intelligence and analytics only. Users are responsible for their own trading decisions.
        </p>
      </div>
    </section>
  )
}
