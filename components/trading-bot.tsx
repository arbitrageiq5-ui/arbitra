'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Bot, Plus, Play, Pause, Square, Trash2, RefreshCw,
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Settings, BarChart3, Zap,
  ArrowDownCircle, ArrowUpCircle, Clock, Shield,
  Info, X, Activity, Sparkles, Target, Repeat2,
  LineChart, Cpu, Layers, FlameKindling, Rocket,
  Signal, GitCompareArrows, Grid2x2, Lock, Unlock,
  Star, ChevronRight, LayoutDashboard, BookOpen,
} from 'lucide-react'
import {
  createTradingBot, getMyBots, getBotOrders,
  startBot, stopBot, deleteBot, triggerSafetyOrder,
  simulateTakeProfit, getMyExchangeAccountsForBot,
} from '@/app/actions/trading-bot'
import { DCA_PAIRS, type DcaConfig } from '@/lib/trading-bot-constants'
import { SUPPORTED_EXCHANGES } from '@/lib/exchange-constants'
import { BotAiAdvisorModal } from '@/components/bot-ai-advisor-modal'

// ─── Types ──────────────────────────────────────────────────────────────────────

type Bot = Awaited<ReturnType<typeof getMyBots>>[number]
type Order = Awaited<ReturnType<typeof getBotOrders>>[number]
type ExchangeAccount = Awaited<ReturnType<typeof getMyExchangeAccountsForBot>>[number]
type MainTab = 'overview' | 'bots' | 'opportunities' | 'strategies'

// ─── Constants ──────────────────────────────────────────────────────────────────

const OPPORTUNITY_TYPES = [
  {
    id: 'dca',
    name: 'DCA Bot',
    icon: Repeat2,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    badge: 'Popular',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Dollar-cost average into any asset. Automatically buy more on dips to lower your average entry price.',
    features: ['Auto buy on dips', 'Configurable safety orders', 'Take profit targets', 'Spot & Futures'],
    risk: 'Low',
    returnRange: '5–30% monthly',
    timeframe: 'Any',
    locked: false,
  },
  {
    id: 'grid',
    name: 'Grid Bot',
    icon: Grid2x2,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    badge: 'Hot',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    description: 'Place a grid of buy/sell orders across a price range. Profit from sideways markets automatically.',
    features: ['Range-bound profits', 'Buy low sell high grid', 'Works 24/7', 'No prediction needed'],
    risk: 'Low–Med',
    returnRange: '10–50% monthly',
    timeframe: 'Sideways market',
    locked: false,
  },
  {
    id: 'arbitrage',
    name: 'Arbitrage Bot',
    icon: GitCompareArrows,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    badge: 'Advanced',
    badgeColor: 'bg-green-500/20 text-green-300 border-green-500/30',
    description: 'Exploit price differences across exchanges. Buy low on one exchange, sell high on another instantly.',
    features: ['Cross-exchange', 'Near risk-free', 'Micro-second execution', 'API key required'],
    risk: 'Very Low',
    returnRange: '0.1–3% per trade',
    timeframe: 'Seconds',
    locked: false,
  },
  {
    id: 'signal',
    name: 'Signal Bot',
    icon: Signal,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    badge: 'AI-Powered',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'React to AI-generated buy/sell signals based on technical indicators, volume and sentiment analysis.',
    features: ['AI signal generation', 'RSI + MACD + BB', 'Social sentiment', 'Custom alert triggers'],
    risk: 'Medium',
    returnRange: '15–60% monthly',
    timeframe: 'Hours–Days',
    locked: false,
  },
  {
    id: 'momentum',
    name: 'Momentum Bot',
    icon: Rocket,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    badge: 'Trending',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    description: 'Ride strong price breakouts. Enter on momentum confirmation and ride the trend with a trailing stop.',
    features: ['Trend following', 'Trailing stop-loss', 'Volume confirmation', 'Breakout detection'],
    risk: 'Medium–High',
    returnRange: '20–100%+ per trade',
    timeframe: 'Days–Weeks',
    locked: false,
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    icon: Target,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    badge: 'Pro',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    description: 'Buy oversold and sell overbought assets when they deviate significantly from their historical average.',
    features: ['Statistical edge', 'Bollinger Bands', 'Z-score deviation', 'High win rate'],
    risk: 'Medium',
    returnRange: '10–40% monthly',
    timeframe: 'Hours–Days',
    locked: false,
  },
  {
    id: 'scalping',
    name: 'Scalping Bot',
    icon: Zap,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    badge: 'Fast',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    description: 'Hundreds of small, fast trades per day capturing tiny price movements for consistent small profits.',
    features: ['High frequency', 'Tiny spreads', 'Low drawdown', 'Best on high-volume pairs'],
    risk: 'Low–Med',
    returnRange: '1–5% per day',
    timeframe: 'Seconds–Minutes',
    locked: true,
  },
  {
    id: 'martingale',
    name: 'Martingale Bot',
    icon: FlameKindling,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'High Risk',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
    description: 'Double position size after each loss. High risk / high reward strategy for experienced traders only.',
    features: ['Aggressive recovery', 'Compounding logic', 'Max loss limits', 'Not for beginners'],
    risk: 'Very High',
    returnRange: '50–500%',
    timeframe: 'Variable',
    locked: true,
  },
] as const

const STRATEGY_TEMPLATES = [
  {
    id: 'btc-conservative',
    name: 'BTC Conservative DCA',
    icon: '₿',
    description: 'Safe, long-term accumulation of Bitcoin with tight safety orders.',
    config: { symbol: 'BTC/USDT', marketType: 'spot' as const, baseOrderSize: 100, safetyOrderSize: 100, maxSafetyOrders: 5, priceDeviationPct: 3, takeProfitPct: 2, safetyOrderVolumePct: 1.2, interval: '4h' },
    stats: { risk: 'Low', monthly: '+8–15%', winRate: '82%' },
    tags: ['HODLer', 'BTC', 'Beginner'],
    popular: true,
  },
  {
    id: 'eth-aggressive',
    name: 'ETH Aggressive DCA',
    icon: 'Ξ',
    description: 'High-frequency ETH bot with many safety orders for volatile dips.',
    config: { symbol: 'ETH/USDT', marketType: 'spot' as const, baseOrderSize: 80, safetyOrderSize: 120, maxSafetyOrders: 8, priceDeviationPct: 2, takeProfitPct: 3.5, safetyOrderVolumePct: 1.5, interval: '1h' },
    stats: { risk: 'Medium', monthly: '+15–35%', winRate: '76%' },
    tags: ['DeFi', 'ETH', 'Intermediate'],
    popular: true,
  },
  {
    id: 'sol-momentum',
    name: 'SOL Momentum Rider',
    icon: '◎',
    description: 'Captures Solana momentum swings with aggressive take-profit targets.',
    config: { symbol: 'SOL/USDT', marketType: 'spot' as const, baseOrderSize: 60, safetyOrderSize: 80, maxSafetyOrders: 6, priceDeviationPct: 2.5, takeProfitPct: 5, safetyOrderVolumePct: 1.3, interval: '1h' },
    stats: { risk: 'Medium', monthly: '+20–45%', winRate: '71%' },
    tags: ['Altcoin', 'SOL', 'Intermediate'],
    popular: false,
  },
  {
    id: 'btc-futures-low',
    name: 'BTC Futures 2x',
    icon: '⚡',
    description: 'Low leverage BTC futures DCA. Amplified returns with controlled risk.',
    config: { symbol: 'BTC/USDT', marketType: 'futures' as const, baseOrderSize: 50, safetyOrderSize: 50, maxSafetyOrders: 4, priceDeviationPct: 2, takeProfitPct: 2, safetyOrderVolumePct: 1.1, interval: '4h', leverage: 2 },
    stats: { risk: 'Medium', monthly: '+15–30%', winRate: '74%' },
    tags: ['Futures', 'BTC', 'Leverage'],
    popular: false,
  },
  {
    id: 'altcoin-basket',
    name: 'Altcoin Basket DCA',
    icon: '🎯',
    description: 'Balanced DCA across ADA, LINK, DOT. Diversified altcoin exposure.',
    config: { symbol: 'ADA/USDT', marketType: 'spot' as const, baseOrderSize: 40, safetyOrderSize: 60, maxSafetyOrders: 7, priceDeviationPct: 3.5, takeProfitPct: 4, safetyOrderVolumePct: 1.4, interval: '4h' },
    stats: { risk: 'Med–High', monthly: '+25–60%', winRate: '68%' },
    tags: ['Altcoins', 'Diversified', 'Advanced'],
    popular: false,
  },
  {
    id: 'doge-meme',
    name: 'Meme Coin Sniper',
    icon: '🐕',
    description: 'High-risk, high-reward DCA on DOGE capturing meme coin volatility swings.',
    config: { symbol: 'DOGE/USDT', marketType: 'spot' as const, baseOrderSize: 30, safetyOrderSize: 60, maxSafetyOrders: 10, priceDeviationPct: 5, takeProfitPct: 8, safetyOrderVolumePct: 2, interval: '1h' },
    stats: { risk: 'High', monthly: '+30–150%', winRate: '61%' },
    tags: ['Meme', 'DOGE', 'High Risk'],
    popular: false,
  },
] as const

// ─── Helpers ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:  'bg-green-500/10 text-green-400 border-green-500/20',
    paused:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    stopped: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
    error:   'bg-red-500/10  text-red-400   border-red-500/20',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] ?? map.stopped}`}>
      {status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
      {status === 'paused' && <Pause className="w-3 h-3" />}
      {status === 'stopped' && <Square className="w-3 h-3" />}
      {status === 'error' && <AlertCircle className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function PnlChip({ value }: { value: number }) {
  const pos = value >= 0
  return (
    <span className={`font-bold text-sm font-mono ${pos ? 'text-green-400' : 'text-red-400'}`}>
      {pos ? '+' : ''}${value.toFixed(2)}
    </span>
  )
}

function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    'Low':       'bg-green-500/10 text-green-400 border-green-500/20',
    'Very Low':  'bg-teal-500/10 text-teal-400 border-teal-500/20',
    'Low–Med':   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'Medium':    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Med–High':  'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Medium–High':'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'High':      'bg-red-500/10 text-red-400 border-red-500/20',
    'Very High': 'bg-red-600/20 text-red-300 border-red-600/30',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[risk] ?? map.Medium}`}>
      {risk} Risk
    </span>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium max-w-sm w-full mx-4 ${
      type === 'error' ? 'bg-red-950 border-red-700 text-red-300' : 'bg-slate-800 border-slate-700 text-white'
    }`}>
      {type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 text-red-400" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose}><X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" /></button>
    </div>
  )
}

// ─── Create Bot Modal ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: DcaConfig = {
  baseOrderSize: 50, safetyOrderSize: 50, maxSafetyOrders: 5,
  priceDeviationPct: 2.5, safetyOrderVolumePct: 1, takeProfitPct: 3, interval: '1h', leverage: 1,
}

function CreateBotModal({
  accounts, prefillConfig, onClose, onCreate,
}: {
  accounts: ExchangeAccount[]
  prefillConfig?: Partial<DcaConfig & { name?: string; symbol?: string; marketType?: 'spot' | 'futures' }> | null
  onClose: () => void
  onCreate: () => void
}) {
  const [name, setName] = useState(prefillConfig?.name ?? '')
  const [marketType, setMarketType] = useState<'spot' | 'futures'>(prefillConfig?.marketType ?? 'spot')
  const [exchange, setExchange] = useState(accounts[0]?.exchange ?? 'binance')
  const [accountId, setAccountId] = useState<number | null>(accounts[0]?.id ?? null)
  const [symbol, setSymbol] = useState(prefillConfig?.symbol ?? 'BTC/USDT')
  const [cfg, setCfg] = useState<DcaConfig>({
    ...DEFAULT_CONFIG,
    ...(prefillConfig ? {
      baseOrderSize: prefillConfig.baseOrderSize ?? DEFAULT_CONFIG.baseOrderSize,
      safetyOrderSize: prefillConfig.safetyOrderSize ?? DEFAULT_CONFIG.safetyOrderSize,
      maxSafetyOrders: prefillConfig.maxSafetyOrders ?? DEFAULT_CONFIG.maxSafetyOrders,
      priceDeviationPct: prefillConfig.priceDeviationPct ?? DEFAULT_CONFIG.priceDeviationPct,
      safetyOrderVolumePct: prefillConfig.safetyOrderVolumePct ?? DEFAULT_CONFIG.safetyOrderVolumePct,
      takeProfitPct: prefillConfig.takeProfitPct ?? DEFAULT_CONFIG.takeProfitPct,
      interval: prefillConfig.interval ?? DEFAULT_CONFIG.interval,
      leverage: prefillConfig.leverage ?? DEFAULT_CONFIG.leverage,
    } : {}),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pair = DCA_PAIRS.find(p => p.symbol === symbol)!
  const filteredAccounts = accounts.filter(a => a.exchange === exchange)
  const maxInvestment = cfg.baseOrderSize + cfg.safetyOrderSize * cfg.maxSafetyOrders
  const estProfit = maxInvestment * (cfg.takeProfitPct / 100)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await createTradingBot({
        name: name || `${pair.base} DCA Bot`,
        strategy: 'dca', marketType, exchange,
        exchangeAccountId: accountId, symbol,
        baseCurrency: pair.base, quoteCurrency: pair.quote, config: cfg,
      })
      onCreate(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bot')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Bot className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold">Create DCA Bot</h2>
                {prefillConfig && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase">
                    <Sparkles className="w-2.5 h-2.5" /> AI Setup
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Configure your Dollar-Cost Averaging strategy</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-5">
            <div>
              <label className="text-slate-400 text-xs font-medium mb-1.5 block">Bot Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={`${pair.base} DCA Bot`}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors" />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium mb-2 block">Market Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['spot', 'futures'] as const).map(mt => (
                  <button key={mt} type="button" onClick={() => setMarketType(mt)}
                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold border transition-all ${
                      marketType === mt
                        ? mt === 'spot' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-orange-600 border-orange-500 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    {mt === 'spot' ? 'Spot Trading' : 'Futures Trading'}
                    <span className="block text-xs font-normal opacity-70 mt-0.5">{mt === 'spot' ? 'No leverage' : 'Up to 10x leverage'}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Exchange</label>
                <select value={exchange} onChange={e => { setExchange(e.target.value); setAccountId(null) }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                  {Object.entries(SUPPORTED_EXCHANGES).map(([key, ex]) => (
                    <option key={key} value={key}>{ex.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">API Account</label>
                <select value={accountId ?? ''} onChange={e => setAccountId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                  <option value="">No API — Simulation</option>
                  {filteredAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.label ?? a.exchange} ({a.tradeMode})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium mb-1.5 block">Trading Pair</label>
              <div className="grid grid-cols-5 gap-2">
                {DCA_PAIRS.map(p => (
                  <button key={p.symbol} type="button" onClick={() => setSymbol(p.symbol)}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                      symbol === p.symbol ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}>
                    <span className="block font-bold">{p.base}</span>
                    <span className="block text-slate-500 text-[10px]">/{p.quote}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" /> DCA Strategy Settings
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { key: 'baseOrderSize', label: 'Base Order Size', min: 5, max: 500, step: 5, fmt: (v: number) => `$${v}`, color: 'accent-amber-400' },
                  { key: 'safetyOrderSize', label: 'Safety Order Size', min: 5, max: 500, step: 5, fmt: (v: number) => `$${v}`, color: 'accent-amber-400' },
                  { key: 'maxSafetyOrders', label: 'Max Safety Orders', min: 1, max: 10, step: 1, fmt: (v: number) => `${v}`, color: 'accent-amber-400' },
                  { key: 'priceDeviationPct', label: 'Price Deviation', min: 0.5, max: 10, step: 0.5, fmt: (v: number) => `${v}%`, color: 'accent-amber-400' },
                  { key: 'takeProfitPct', label: 'Take Profit', min: 0.5, max: 20, step: 0.5, fmt: (v: number) => `${v}%`, color: 'accent-green-400' },
                  { key: 'safetyOrderVolumePct', label: 'Safety Order Scale', min: 1, max: 3, step: 0.1, fmt: (v: number) => `${v}x`, color: 'accent-amber-400' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                      {field.label}
                      <span className={field.color === 'accent-green-400' ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'}>
                        {field.fmt(cfg[field.key as keyof DcaConfig] as number)}
                      </span>
                    </label>
                    <input type="range" min={field.min} max={field.max} step={field.step}
                      value={cfg[field.key as keyof DcaConfig] as number}
                      onChange={e => setCfg(c => ({ ...c, [field.key]: parseFloat(e.target.value) }))}
                      className={`w-full ${field.color}`} />
                  </div>
                ))}
              </div>
              {marketType === 'futures' && (
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                    Leverage <span className="text-orange-400 font-bold">{cfg.leverage ?? 1}x</span>
                  </label>
                  <input type="range" min="1" max="10" step="1" value={cfg.leverage ?? 1}
                    onChange={e => setCfg(c => ({ ...c, leverage: parseFloat(e.target.value) }))}
                    className="w-full accent-orange-400" />
                  <p className="text-orange-400/70 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Futures trading carries liquidation risk.
                  </p>
                </div>
              )}
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Check Interval</label>
                <div className="flex gap-2">
                  {['manual', '1h', '4h', '1d'].map(iv => (
                    <button key={iv} type="button" onClick={() => setCfg(c => ({ ...c, interval: iv }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        cfg.interval === iv ? 'bg-slate-700 border-slate-500 text-white' : 'border-slate-700 text-slate-500 hover:border-slate-600'
                      }`}>
                      {iv === 'manual' ? 'Manual' : iv}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-slate-500 text-xs">Max Investment</p>
                <p className="text-white font-bold text-lg">${maxInvestment.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="text-center border-x border-slate-800">
                <p className="text-slate-500 text-xs">Safety Orders</p>
                <p className="text-amber-400 font-bold text-lg">{cfg.maxSafetyOrders}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-xs">Target Profit/Cycle</p>
                <p className="text-green-400 font-bold text-lg">${estProfit.toFixed(2)}</p>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}
          </div>
          <div className="border-t border-slate-800 px-6 py-4 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold">
              {saving ? 'Creating...' : 'Create Bot'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ─── Bot Card ────────────────────────────────────────────────────────────────────

function BotCard({ bot, onRefresh, onToast }: {
  bot: Bot; onRefresh: () => void; onToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [orders, setOrders] = useState<Order[]>([])
  const [showOrders, setShowOrders] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [acting, setActing] = useState(false)

  const cfg = bot.config as DcaConfig
  const avgPrice = parseFloat(String(bot.avgBuyPrice))
  const currentPrice = parseFloat(String(bot.currentPrice))
  const unrealizedPnl = parseFloat(String(bot.unrealizedPnl))
  const realizedPnl = parseFloat(String(bot.realizedPnl))
  const totalInvested = parseFloat(String(bot.totalInvested))
  const pnlPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0
  const maxInvestment = cfg.baseOrderSize + cfg.safetyOrderSize * cfg.maxSafetyOrders
  const investedPct = maxInvestment > 0 ? Math.min((totalInvested / maxInvestment) * 100, 100) : 0

  async function loadOrders() {
    setLoadingOrders(true)
    try { const data = await getBotOrders(bot.id); setOrders(data) }
    catch { /* ignore */ }
    finally { setLoadingOrders(false) }
  }

  async function act(fn: () => Promise<unknown>, successMsg: string) {
    setActing(true)
    try { await fn(); onRefresh(); onToast(successMsg) }
    catch (err) { onToast(err instanceof Error ? err.message : 'Action failed', 'error') }
    finally { setActing(false) }
  }

  useEffect(() => { if (showOrders) loadOrders() }, [showOrders])

  return (
    <Card className={`border overflow-hidden transition-all ${
      bot.status === 'active' ? 'bg-slate-900 border-slate-700/60' :
      bot.status === 'error'  ? 'bg-slate-900 border-red-500/20' : 'bg-slate-900 border-slate-800'
    }`}>
      {/* Active indicator bar */}
      {bot.status === 'active' && (
        <div className="h-0.5 bg-gradient-to-r from-green-500 via-cyan-500 to-green-500 animate-pulse" />
      )}

      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-xl border shrink-0 ${
            bot.status === 'active' ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-800 border-slate-700'
          }`}>
            <Bot className={`w-5 h-5 ${bot.status === 'active' ? 'text-green-400' : 'text-slate-500'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold">{bot.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-slate-500 text-xs font-mono">{bot.symbol}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                bot.marketType === 'futures' ? 'bg-orange-500/15 text-orange-400' : 'bg-blue-500/15 text-blue-400'
              }`}>
                {bot.marketType === 'futures' ? `FUTURES ${cfg.leverage ?? 1}x` : 'SPOT'}
              </span>
              <span className="text-xs text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded">
                {SUPPORTED_EXCHANGES[bot.exchange]?.name ?? bot.exchange}
              </span>
            </div>
          </div>
        </div>
        <StatusBadge status={bot.status} />
      </div>

      {/* Metrics grid */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-800">
        <div>
          <p className="text-slate-500 text-xs mb-1">Invested</p>
          <p className="text-white font-bold text-sm font-mono">${totalInvested.toFixed(2)}</p>
          {maxInvestment > 0 && (
            <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${investedPct}%` }} />
            </div>
          )}
          <p className="text-slate-600 text-[10px] mt-0.5">{investedPct.toFixed(0)}% of ${maxInvestment} max</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-1">Avg Buy Price</p>
          <p className="text-white font-bold text-sm font-mono">
            {avgPrice > 0 ? `$${avgPrice < 1 ? avgPrice.toFixed(6) : avgPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
          </p>
          {pnlPct !== 0 && (
            <p className={`text-xs mt-0.5 ${pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pnlPct >= 0 ? '▲' : '▼'} {Math.abs(pnlPct).toFixed(2)}% from entry
            </p>
          )}
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-1">Unrealized P&amp;L</p>
          {bot.status === 'active' && totalInvested > 0 ? <PnlChip value={unrealizedPnl} /> : <span className="text-slate-500 text-sm">—</span>}
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-1">Realized P&amp;L</p>
          {realizedPnl !== 0 ? <PnlChip value={realizedPnl} /> : <span className="text-slate-500 text-sm">—</span>}
          {bot.totalOrders > 0 && <p className="text-slate-600 text-[10px] mt-0.5">{bot.totalOrders} orders executed</p>}
        </div>
      </div>

      {/* Config params */}
      <div className="px-5 py-3 flex flex-wrap gap-x-5 gap-y-1.5 border-b border-slate-800/60 bg-slate-950/30">
        {[
          { label: 'Base', value: `$${cfg.baseOrderSize}` },
          { label: 'Safety', value: `$${cfg.safetyOrderSize}` },
          { label: 'Max SO', value: cfg.maxSafetyOrders },
          { label: 'Deviation', value: `${cfg.priceDeviationPct}%` },
          { label: 'Take Profit', value: `${cfg.takeProfitPct}%` },
          { label: 'Scale', value: `${cfg.safetyOrderVolumePct}x` },
          { label: 'Interval', value: cfg.interval },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="text-slate-600 text-[10px] uppercase tracking-wide">{item.label}</span>
            <span className="text-slate-300 text-xs font-bold">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-2">
        {(bot.status === 'stopped' || bot.status === 'paused') && (
          <Button size="sm" onClick={() => act(() => startBot(bot.id), 'Bot started')} disabled={acting}
            className="h-8 px-3 text-xs bg-green-700 hover:bg-green-600 text-white gap-1.5 font-bold">
            <Play className="w-3 h-3" />{bot.status === 'paused' ? 'Resume' : 'Start'}
          </Button>
        )}
        {bot.status === 'active' && (
          <>
            <Button size="sm" onClick={() => act(() => triggerSafetyOrder(bot.id), 'Safety order triggered')} disabled={acting}
              className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-500 text-black gap-1.5 font-bold">
              <TrendingDown className="w-3 h-3" /> Safety Order
            </Button>
            <Button size="sm" onClick={() => act(() => simulateTakeProfit(bot.id), 'Take-profit executed')} disabled={acting}
              className="h-8 px-3 text-xs bg-blue-700 hover:bg-blue-600 text-white gap-1.5 font-bold">
              <TrendingUp className="w-3 h-3" /> Take Profit
            </Button>
            <Button size="sm" onClick={() => act(() => stopBot(bot.id, 'pause'), 'Bot paused')} disabled={acting} variant="ghost"
              className="h-8 px-3 text-xs border border-amber-500/30 text-amber-400 hover:bg-amber-900/20 gap-1.5">
              <Pause className="w-3 h-3" /> Pause
            </Button>
            <Button size="sm" onClick={() => act(() => stopBot(bot.id, 'stop'), 'Bot stopped')} disabled={acting} variant="ghost"
              className="h-8 px-3 text-xs border border-red-500/30 text-red-400 hover:bg-red-900/20 gap-1.5">
              <Square className="w-3 h-3" /> Stop
            </Button>
          </>
        )}
        <button onClick={() => setShowOrders(v => !v)}
          className="ml-auto h-8 px-3 text-xs border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md flex items-center gap-1.5 transition-colors">
          <Activity className="w-3 h-3" /> Orders ({bot.totalOrders})
          {showOrders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {bot.status === 'stopped' && (
          <button onClick={() => act(() => deleteBot(bot.id), 'Bot deleted')} disabled={acting}
            className="h-8 w-8 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors border border-transparent hover:border-red-500/20">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Orders table */}
      {showOrders && (
        <div className="border-t border-slate-800">
          {loadingOrders ? (
            <div className="p-6 text-center text-slate-500 text-sm"><RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40">
                    {['Type', 'Price', 'Qty', 'Total', 'Condition', 'Status', 'Time'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1">
                          {o.orderType === 'buy' ? <ArrowDownCircle className="w-3.5 h-3.5 text-green-400" /> :
                           o.orderType === 'take_profit' ? <ArrowUpCircle className="w-3.5 h-3.5 text-blue-400" /> :
                           <ArrowUpCircle className="w-3.5 h-3.5 text-red-400" />}
                          <span className={`font-semibold capitalize ${o.orderType === 'buy' ? 'text-green-400' : o.orderType === 'take_profit' ? 'text-blue-400' : 'text-red-400'}`}>
                            {o.orderType.replace('_', ' ')}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 font-mono">${parseFloat(String(o.price)).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono">{parseFloat(String(o.qty)).toFixed(6)}</td>
                      <td className="px-4 py-2.5 text-slate-300 font-mono">${parseFloat(String(o.total)).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">{o.triggerCondition ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${o.status === 'filled' ? 'text-green-400' : o.status === 'pending' ? 'text-amber-400' : 'text-slate-500'}`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Opportunities Panel ─────────────────────────────────────────────────────────

function OpportunitiesPanel({ onLaunchBot }: { onLaunchBot: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white font-bold text-base">Bot Opportunities</h3>
        <p className="text-slate-500 text-sm mt-1">Choose a bot type that matches your trading style and risk appetite.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OPPORTUNITY_TYPES.map(opp => {
          const Icon = opp.icon
          const isOpen = selected === opp.id

          return (
            <Card key={opp.id}
              className={`border transition-all cursor-pointer overflow-hidden ${
                opp.locked ? 'opacity-60' :
                isOpen ? 'border-slate-600 bg-slate-900' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
              }`}
              onClick={() => !opp.locked && setSelected(isOpen ? null : opp.id)}
            >
              {/* Card header */}
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${opp.bg} ${opp.border}`}>
                    <Icon className={`w-5 h-5 ${opp.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm">{opp.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${opp.badgeColor}`}>
                        {opp.badge}
                      </span>
                      {opp.locked && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-700/40 text-slate-400 border-slate-600/40 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{opp.description}</p>
                  </div>
                </div>
                {!opp.locked && (
                  <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </div>

              {/* Stats row */}
              <div className="px-4 pb-4 flex items-center gap-4 flex-wrap">
                <RiskBadge risk={opp.risk} />
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400 font-semibold">{opp.returnRange}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400">{opp.timeframe}</span>
                </div>
              </div>

              {/* Expanded features */}
              {isOpen && (
                <div className="border-t border-slate-800 px-4 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {opp.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${opp.color}`} />
                        {f}
                      </div>
                    ))}
                  </div>
                  {opp.id === 'dca' ? (
                    <Button onClick={e => { e.stopPropagation(); onLaunchBot(opp.id) }}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2 mt-2">
                      <Plus className="w-4 h-4" /> Launch DCA Bot
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg mt-1">
                      <Info className="w-4 h-4 text-slate-500 shrink-0" />
                      <p className="text-slate-500 text-xs">
                        {opp.id === 'grid' || opp.id === 'arbitrage' || opp.id === 'signal' || opp.id === 'momentum' || opp.id === 'mean-reversion'
                          ? 'Create a DCA bot now. More bot types launching soon — stay tuned.'
                          : 'This bot type is coming in a future update.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Strategy Templates Panel ────────────────────────────────────────────────────

function StrategiesPanel({ accounts, onLaunch }: {
  accounts: ExchangeAccount[]
  onLaunch: (cfg: Partial<DcaConfig & { name?: string; symbol?: string; marketType?: 'spot' | 'futures' }>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white font-bold text-base">Strategy Templates</h3>
        <p className="text-slate-500 text-sm mt-1">Pre-configured, battle-tested strategies. One click to deploy.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {STRATEGY_TEMPLATES.map(strat => (
          <Card key={strat.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all overflow-hidden flex flex-col">
            {strat.popular && (
              <div className="h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
            )}
            <div className="p-4 flex-1">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                    {strat.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-white font-bold text-sm leading-tight">{strat.name}</p>
                      {strat.popular && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">{strat.config.symbol} • {strat.config.marketType}</p>
                  </div>
                </div>
              </div>

              <p className="text-slate-400 text-xs leading-relaxed mb-3">{strat.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-[9px] uppercase tracking-wide">Return</p>
                  <p className="text-green-400 font-bold text-xs mt-0.5">{strat.stats.monthly}</p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-[9px] uppercase tracking-wide">Win Rate</p>
                  <p className="text-cyan-400 font-bold text-xs mt-0.5">{strat.stats.winRate}</p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-[9px] uppercase tracking-wide">Risk</p>
                  <p className={`font-bold text-xs mt-0.5 ${strat.stats.risk === 'Low' ? 'text-green-400' : strat.stats.risk === 'High' ? 'text-red-400' : 'text-amber-400'}`}>{strat.stats.risk}</p>
                </div>
              </div>

              {/* Config preview */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
                {[
                  { k: 'Base', v: `$${strat.config.baseOrderSize}` },
                  { k: 'Safety', v: `$${strat.config.safetyOrderSize}` },
                  { k: 'Max SO', v: strat.config.maxSafetyOrders },
                  { k: 'TP', v: `${strat.config.takeProfitPct}%` },
                  ...('leverage' in strat.config && strat.config.leverage ? [{ k: 'Lev', v: `${strat.config.leverage}x` }] : []),
                ].map(item => (
                  <span key={item.k} className="text-[10px]">
                    <span className="text-slate-600">{item.k}: </span>
                    <span className="text-slate-300 font-semibold">{item.v}</span>
                  </span>
                ))}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {strat.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">{tag}</span>
                ))}
              </div>
            </div>

            <div className="px-4 pb-4">
              <Button
                onClick={() => onLaunch({ ...strat.config, name: strat.name })}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2 text-sm"
              >
                <Rocket className="w-3.5 h-3.5" /> Deploy Strategy
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Overview Panel ───────────────────────────────────────────────────────────────

function OverviewPanel({ bots, onNewBot, onGoTab }: {
  bots: Bot[]
  onNewBot: () => void
  onGoTab: (tab: MainTab) => void
}) {
  const activeBots = bots.filter(b => b.status === 'active')
  const totalRealized = bots.reduce((s, b) => s + parseFloat(String(b.realizedPnl)), 0)
  const totalUnrealized = bots.reduce((s, b) => s + parseFloat(String(b.unrealizedPnl)), 0)
  const totalInvested = bots.reduce((s, b) => s + parseFloat(String(b.totalInvested)), 0)
  const totalOrders = bots.reduce((s, b) => s + b.totalOrders, 0)

  return (
    <div className="space-y-5">
      {/* Portfolio stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Invested', value: `$${totalInvested.toFixed(2)}`, sub: `${bots.length} bots total`, icon: BarChart3, color: 'text-white', iconBg: 'bg-slate-800' },
          { label: 'Active Now', value: activeBots.length.toString(), sub: `${bots.length - activeBots.length} inactive`, icon: Activity, color: 'text-green-400', iconBg: 'bg-green-500/10' },
          { label: 'Unrealized P&L', value: `${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`, sub: 'Open positions', icon: LineChart, color: totalUnrealized >= 0 ? 'text-green-400' : 'text-red-400', iconBg: totalUnrealized >= 0 ? 'bg-green-500/10' : 'bg-red-500/10' },
          { label: 'Realized P&L', value: `${totalRealized >= 0 ? '+' : ''}$${totalRealized.toFixed(2)}`, sub: `${totalOrders} total orders`, icon: CheckCircle2, color: totalRealized >= 0 ? 'text-green-400' : 'text-red-400', iconBg: totalRealized >= 0 ? 'bg-green-500/10' : 'bg-red-500/10' },
        ].map(({ label, value, sub, icon: Icon, color, iconBg }) => (
          <Card key={label} className="bg-slate-900 border-slate-800 p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg shrink-0 ${iconBg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-slate-500 text-xs">{label}</p>
                <p className={`font-bold text-lg font-mono ${color}`}>{value}</p>
                <p className="text-slate-600 text-[10px] mt-0.5">{sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button onClick={onNewBot}
          className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/15 transition-all text-left group">
          <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 shrink-0">
            <Plus className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">New DCA Bot</p>
            <p className="text-amber-400/70 text-xs mt-0.5">Start automated trading</p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400/40 ml-auto group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button onClick={() => onGoTab('opportunities')}
          className="flex items-center gap-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/15 transition-all text-left group">
          <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 shrink-0">
            <Layers className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Explore Bots</p>
            <p className="text-cyan-400/70 text-xs mt-0.5">8 bot types available</p>
          </div>
          <ChevronRight className="w-4 h-4 text-cyan-400/40 ml-auto group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button onClick={() => onGoTab('strategies')}
          className="flex items-center gap-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 hover:border-green-500/40 hover:bg-green-500/15 transition-all text-left group">
          <div className="p-3 rounded-xl bg-green-500/20 border border-green-500/30 shrink-0">
            <BookOpen className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Strategy Templates</p>
            <p className="text-green-400/70 text-xs mt-0.5">6 ready-to-deploy</p>
          </div>
          <ChevronRight className="w-4 h-4 text-green-400/40 ml-auto group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Recent bots */}
      {activeBots.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-bold text-sm">Active Bots</p>
            <button onClick={() => onGoTab('bots')} className="text-cyan-400 text-xs hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {activeBots.slice(0, 3).map(bot => {
              const cfg = bot.config as DcaConfig
              const realizedPnl = parseFloat(String(bot.realizedPnl))
              const unrealizedPnl = parseFloat(String(bot.unrealizedPnl))
              return (
                <div key={bot.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold text-sm truncate">{bot.name}</p>
                    <p className="text-slate-500 text-xs">{bot.symbol} • {bot.marketType === 'futures' ? `${cfg.leverage ?? 1}x Futures` : 'Spot'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold font-mono ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
                    </p>
                    <p className="text-slate-600 text-[10px]">Realized: ${realizedPnl.toFixed(2)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info notice */}
      <Card className="bg-slate-900/50 border-slate-800 px-5 py-4">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-300 text-sm font-semibold">Connect Exchange API for Live Trading</p>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              Bots run in <span className="text-amber-400 font-semibold">simulation mode</span> by default. Connect your exchange API keys in the
              <span className="text-amber-400 font-semibold"> Exchanges</span> tab to place real orders.
              Supported: {Object.values(SUPPORTED_EXCHANGES).map(e => e.name).join(', ')}.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────────

export function TradingBot() {
  const [bots, setBots] = useState<Bot[]>([])
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [mainTab, setMainTab] = useState<MainTab>('overview')
  const [showCreate, setShowCreate] = useState(false)
  const [showAiAdvisor, setShowAiAdvisor] = useState(false)
  const [aiPrefillConfig, setAiPrefillConfig] = useState<Partial<DcaConfig & { name?: string; symbol?: string; marketType?: 'spot' | 'futures' }> | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  const load = useCallback(async () => {
    try {
      const [botsData, acctData] = await Promise.all([getMyBots(), getMyExchangeAccountsForBot()])
      setBots(botsData)
      setAccounts(acctData)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function handleLaunchTemplate(cfg: Partial<DcaConfig & { name?: string; symbol?: string; marketType?: 'spot' | 'futures' }>) {
    setAiPrefillConfig(cfg)
    setShowCreate(true)
  }

  const TABS: { key: MainTab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'overview',     label: 'Overview',     icon: LayoutDashboard },
    { key: 'bots',         label: 'My Bots',      icon: Bot,              count: bots.length },
    { key: 'opportunities',label: 'Opportunities', icon: Layers },
    { key: 'strategies',   label: 'Strategies',    icon: BookOpen },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            Trading Bots
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Automated strategies — DCA, Grid, Arbitrage, Signal &amp; more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white border border-slate-800 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowAiAdvisor(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-500/40 hover:bg-slate-700 text-slate-300 hover:text-amber-300 text-sm font-semibold transition-all">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI Setup
          </button>
          <Button onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2">
            <Plus className="w-4 h-4" /> New Bot
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = mainTab === tab.key
          return (
            <button key={tab.key} onClick={() => setMainTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                active ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-500 hover:text-slate-300'
              }`}>
              <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : ''}`} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {loading && mainTab !== 'opportunities' && mainTab !== 'strategies' ? (
        <div className="py-16 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-400" />
          Loading...
        </div>
      ) : (
        <>
          {mainTab === 'overview' && (
            <OverviewPanel bots={bots} onNewBot={() => setShowCreate(true)} onGoTab={setMainTab} />
          )}

          {mainTab === 'bots' && (
            <div className="space-y-4">
              {bots.length === 0 ? (
                <Card className="bg-slate-900 border-slate-800 border-dashed py-16">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                      <Bot className="w-7 h-7 text-amber-400" />
                    </div>
                    <p className="text-white font-semibold text-base">No bots yet</p>
                    <p className="text-slate-500 text-sm mt-1 mb-5 max-w-xs mx-auto">Create your first DCA bot or deploy a strategy template to start automated crypto trading.</p>
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <Button onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2">
                        <Plus className="w-4 h-4" /> Create Bot
                      </Button>
                      <Button onClick={() => setMainTab('strategies')} variant="ghost" className="border border-slate-700 text-slate-300 hover:text-white gap-2">
                        <BookOpen className="w-4 h-4" /> Browse Strategies
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                bots.map(bot => (
                  <BotCard key={bot.id} bot={bot} onRefresh={load} onToast={showToast} />
                ))
              )}
            </div>
          )}

          {mainTab === 'opportunities' && (
            <OpportunitiesPanel onLaunchBot={() => setShowCreate(true)} />
          )}

          {mainTab === 'strategies' && (
            <StrategiesPanel accounts={accounts} onLaunch={handleLaunchTemplate} />
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateBotModal
          accounts={accounts}
          prefillConfig={aiPrefillConfig}
          onClose={() => { setShowCreate(false); setAiPrefillConfig(null) }}
          onCreate={load}
        />
      )}

      {/* AI Advisor */}
      <BotAiAdvisorModal
        open={showAiAdvisor}
        onClose={() => setShowAiAdvisor(false)}
        onApplyConfig={cfg => { setAiPrefillConfig(cfg); setShowAiAdvisor(false); setShowCreate(true) }}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
