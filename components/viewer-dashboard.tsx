'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import {
  LogOut, TrendingUp, Globe, Bell, Shield, Eye,
  BarChart3, Zap, Lock, ChevronRight, User, Star,
} from 'lucide-react'
import Link from 'next/link'
import { BASE_PRICES } from '@/lib/constants/prices'

interface ViewerDashboardProps {
  user: {
    id: string
    name: string | null
    email: string
    country: string | null
    tradingExperienceLevel: string | null
    createdAt: string
  }
}

interface LiveTicker {
  pair: string
  symbol: string
  buyEx: string
  sellEx: string
  buyPrice: number
  sellPrice: number
  spread: number
  profit: number
  risk: 'Low' | 'Medium'
}

const TICKER_SEEDS: Array<{ symbol: string; buyEx: string; sellEx: string }> = [
  { symbol: 'BTC', buyEx: 'Binance',  sellEx: 'Kraken'  },
  { symbol: 'ETH', buyEx: 'Coinbase', sellEx: 'OKX'     },
  { symbol: 'SOL', buyEx: 'Bybit',    sellEx: 'Binance'  },
  { symbol: 'XRP', buyEx: 'KuCoin',   sellEx: 'Bitget'   },
  { symbol: 'BNB', buyEx: 'Gate.io',  sellEx: 'Bybit'    },
]

function buildTickers(): LiveTicker[] {
  return TICKER_SEEDS.map(({ symbol, buyEx, sellEx }) => {
    const base = BASE_PRICES[symbol] ?? 1
    const spread = 0.35 + Math.random() * 0.75
    const buyPrice = base * (1 - spread / 200)
    const sellPrice = base * (1 + spread / 200)
    const netSpread = spread - 0.15
    return {
      pair: `${symbol}/USDT`, symbol, buyEx, sellEx,
      buyPrice, sellPrice,
      spread: parseFloat(netSpread.toFixed(3)),
      profit: parseFloat(((netSpread / 100) * 1000).toFixed(2)),
      risk: netSpread > 0.7 ? 'Medium' : 'Low',
    }
  })
}

const UPGRAGE_PERKS = [
  { icon: BarChart3, title: 'Real-time Alerts',   desc: 'Telegram, WhatsApp & email notifications for every opportunity.' },
  { icon: Zap,       title: 'API Trading',         desc: 'Connect exchange keys and execute trades automatically.' },
  { icon: Globe,     title: 'All 12+ Exchanges',   desc: 'Unlock full cross-exchange scanning beyond preview data.' },
  { icon: Star,      title: 'AI Scoring',          desc: 'Every opportunity scored by our AI with confidence rating.' },
]

const RISK_COLOR: Record<string, string> = {
  Low:    'text-green-400 bg-green-400/10',
  Medium: 'text-amber-400 bg-amber-400/10',
  High:   'text-red-400   bg-red-400/10',
}

export function ViewerDashboard({ user }: ViewerDashboardProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [tickers, setTickers] = useState<LiveTicker[]>([])
  const [pulse, setPulse] = useState<number>(-1)

  useEffect(() => {
    setTickers(buildTickers())
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * TICKER_SEEDS.length)
      setPulse(idx)
      setTickers(prev => prev.map((t, i) => {
        if (i !== idx) return t
        const drift = (Math.random() - 0.5) * 0.0004
        const newBuy = t.buyPrice * (1 + drift)
        const newSpread = Math.max(0.1, t.spread + (Math.random() - 0.5) * 0.015)
        const newSell = newBuy * (1 + newSpread / 100)
        return {
          ...t,
          buyPrice: newBuy, sellPrice: newSell, spread: newSpread,
          profit: parseFloat(((newSpread / 100) * 1000).toFixed(2)),
        }
      }))
      setTimeout(() => setPulse(-1), 600)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    await authClient.signOut()
    router.push('/')
  }

  const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#050816', color: '#FFFFFF' }}>
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0A0F23]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00D4FF]/15 border border-[#00D4FF]/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#00D4FF]" />
            </div>
            <span className="font-bold text-white text-sm">ArbitrageIQ</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20 ml-1">
              Viewer
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-[#98A2B3]">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{user.name ?? user.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#98A2B3] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Welcome banner */}
        <div className="mb-8 p-6 rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/[0.04] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00D4FF]/5 blur-[80px] pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Welcome, {user.name?.split(' ')[0] ?? 'Trader'}
              </h1>
              <p className="text-sm text-[#98A2B3]">
                You have a free Viewer account. Explore live arbitrage data below, then upgrade to trade.
              </p>
              <p className="text-xs text-[#98A2B3]/60 mt-1">Member since {joinedDate}</p>
            </div>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#050816] bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-all shadow-[0_0_24px_rgba(0,212,255,0.3)] whitespace-nowrap"
            >
              Upgrade to Trader
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Live Opportunities',  value: '2,847', icon: TrendingUp, color: '#00D4FF' },
            { label: 'Exchanges Monitored', value: '12+',   icon: Globe,      color: '#00FF99' },
            { label: 'Avg Spread',          value: '0.74%', icon: BarChart3,  color: '#F59E0B' },
            { label: 'Alerts Available',    value: 'Locked', icon: Bell,      color: '#98A2B3' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-xs text-[#98A2B3]">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Live market preview */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0A0F23]/60 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#00D4FF]" />
                  <h2 className="text-sm font-semibold text-white">Live Arbitrage Preview</h2>
                  <span className="flex items-center gap-1 text-xs text-[#00FF99]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
                    Live
                  </span>
                </div>
                <span className="text-xs text-[#98A2B3]">Showing 5 of 2,847</span>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {(tickers.length ? tickers : TICKER_SEEDS.map(s => ({ pair: `${s.symbol}/USDT`, symbol: s.symbol, buyEx: s.buyEx, sellEx: s.sellEx, buyPrice: 0, sellPrice: 0, spread: 0, profit: 0, risk: 'Low' as const }))).map((row, i) => (
                  <div
                    key={row.pair}
                    className={`px-5 py-3.5 flex items-center gap-3 transition-colors duration-300 ${i >= 3 ? 'opacity-40 blur-[2px] select-none pointer-events-none' : ''} ${pulse === i ? 'bg-[#00D4FF]/5' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {row.symbol.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{row.pair}</p>
                      <p className="text-xs text-[#98A2B3] truncate">{row.buyEx} → {row.sellEx}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#00FF99]">
                        {row.profit > 0 ? `+$${row.profit.toFixed(2)}` : '—'}<span className="text-[10px] text-[#98A2B3] ml-1">/1k</span>
                      </p>
                      <p className="text-xs text-[#98A2B3]">{row.spread > 0 ? `${row.spread.toFixed(3)}%` : '—'} net</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLOR[row.risk]}`}>
                      {row.risk}
                    </span>
                  </div>
                ))}
              </div>

              {/* Locked overlay */}
              <div className="px-5 py-4 border-t border-white/[0.06] bg-[#050816]/40 text-center">
                <p className="text-xs text-[#98A2B3] mb-2">
                  <Lock className="w-3 h-3 inline mr-1 mb-0.5" />
                  2,842 more opportunities locked. Upgrade to view all.
                </p>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00D4FF] hover:underline"
                >
                  Get full access <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Upgrade panel + profile */}
          <div className="flex flex-col gap-5">
            {/* Account info */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0A0F23]/60 p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#98A2B3]" />
                Account
              </h3>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#98A2B3]">Plan</span>
                  <span className="text-white font-medium">Free Viewer</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#98A2B3]">Email</span>
                  <span className="text-white truncate max-w-[140px]">{user.email}</span>
                </div>
                {user.country && (
                  <div className="flex justify-between">
                    <span className="text-[#98A2B3]">Country</span>
                    <span className="text-white">{user.country}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#98A2B3]">Experience</span>
                  <span className="text-white capitalize">{user.tradingExperienceLevel ?? 'Beginner'}</span>
                </div>
              </div>
            </div>

            {/* Upgrade perks */}
            <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Unlock with Trader Account</h3>
              <div className="flex flex-col gap-3 mb-5">
                {UPGRAGE_PERKS.map((perk) => (
                  <div key={perk.title} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <perk.icon className="w-3.5 h-3.5 text-[#00D4FF]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{perk.title}</p>
                      <p className="text-xs text-[#98A2B3]">{perk.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/sign-up"
                className="block w-full py-2.5 rounded-xl text-sm font-semibold text-[#050816] bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-all text-center shadow-[0_0_20px_rgba(0,212,255,0.25)]"
              >
                Upgrade Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
