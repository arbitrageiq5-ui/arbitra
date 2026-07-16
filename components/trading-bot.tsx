'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Bot, Plus, Play, Pause, Square, Trash2, RefreshCw,
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Settings, BarChart3, Zap,
  ArrowDownCircle, ArrowUpCircle, Clock, Shield,
  Info, X, Activity,
} from 'lucide-react'
import {
  createTradingBot, getMyBots, getBotOrders,
  startBot, stopBot, deleteBot, triggerSafetyOrder,
  simulateTakeProfit, updateBotConfig, getMyExchangeAccountsForBot,
} from '@/app/actions/trading-bot'
import { DCA_PAIRS, type DcaConfig } from '@/lib/trading-bot-constants'
import { SUPPORTED_EXCHANGES } from '@/lib/exchange-constants'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Bot = Awaited<ReturnType<typeof getMyBots>>[number]
type Order = Awaited<ReturnType<typeof getBotOrders>>[number]
type ExchangeAccount = Awaited<ReturnType<typeof getMyExchangeAccountsForBot>>[number]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:  'bg-green-500/10 text-green-400 border-green-500/20',
    paused:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    stopped: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
    error:   'bg-red-500/10  text-red-400   border-red-500/20',
  }
  const icons: Record<string, React.ReactNode> = {
    active:  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />,
    paused:  <Pause className="w-3 h-3" />,
    stopped: <Square className="w-3 h-3" />,
    error:   <AlertCircle className="w-3 h-3" />,
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] ?? map.stopped}`}>
      {icons[status]}
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

// ─── DCA Info Card ─────────────────────────────────────────────────────────────

function DcaInfoBanner() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Info className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">What is a DCA Bot?</p>
            <p className="text-slate-500 text-xs mt-0.5">Dollar-Cost Averaging strategy — click to learn more</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && (
        <div className="border-t border-slate-800 px-5 py-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: ArrowDownCircle,
              color: 'text-blue-400',
              bg: 'bg-blue-500/10 border-blue-500/20',
              title: 'Base Order',
              desc: 'Bot places the first buy order immediately when started.',
            },
            {
              icon: TrendingDown,
              color: 'text-amber-400',
              bg: 'bg-amber-500/10 border-amber-500/20',
              title: 'Safety Orders',
              desc: 'When price drops by the set deviation %, the bot buys more — lowering your avg cost.',
            },
            {
              icon: BarChart3,
              color: 'text-green-400',
              bg: 'bg-green-500/10 border-green-500/20',
              title: 'Average Cost',
              desc: 'As safety orders fill, your average buy price improves, reducing the breakeven point.',
            },
            {
              icon: ArrowUpCircle,
              color: 'text-purple-400',
              bg: 'bg-purple-500/10 border-purple-500/20',
              title: 'Take Profit',
              desc: 'When price rises the set % above avg buy price, the bot sells all holdings for profit.',
            },
          ].map(item => (
            <div key={item.title} className="flex gap-3">
              <div className={`p-2 rounded-lg border h-fit shrink-0 ${item.bg}`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${item.color}`}>{item.title}</p>
                <p className="text-slate-400 text-xs leading-relaxed mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Create Bot Modal ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: DcaConfig = {
  baseOrderSize: 50,
  safetyOrderSize: 50,
  maxSafetyOrders: 5,
  priceDeviationPct: 2.5,
  safetyOrderVolumePct: 1,
  takeProfitPct: 3,
  interval: '1h',
  leverage: 1,
}

function CreateBotModal({
  accounts,
  onClose,
  onCreate,
}: {
  accounts: ExchangeAccount[]
  onClose: () => void
  onCreate: () => void
}) {
  const [name, setName] = useState('')
  const [marketType, setMarketType] = useState<'spot' | 'futures'>('spot')
  const [exchange, setExchange] = useState(accounts[0]?.exchange ?? 'binance')
  const [accountId, setAccountId] = useState<number | null>(accounts[0]?.id ?? null)
  const [symbol, setSymbol] = useState('BTC/USDT')
  const [cfg, setCfg] = useState<DcaConfig>({ ...DEFAULT_CONFIG })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const pair = DCA_PAIRS.find(p => p.symbol === symbol)!
  const filteredAccounts = accounts.filter(a => a.exchange === exchange)

  // Calculated stats
  const maxInvestment = cfg.baseOrderSize + cfg.safetyOrderSize * cfg.maxSafetyOrders
  const estMonthlyProfit = maxInvestment * (cfg.takeProfitPct / 100)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await createTradingBot({
        name: name || `${pair.base} DCA Bot`,
        strategy: 'dca',
        marketType,
        exchange,
        exchangeAccountId: accountId,
        symbol,
        baseCurrency: pair.base,
        quoteCurrency: pair.quote,
        config: cfg,
      })
      onCreate()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bot')
    } finally {
      setSaving(false)
    }
  }

  function num(val: string) { return parseFloat(val) }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Bot className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-bold">Create DCA Bot</h2>
              <p className="text-slate-500 text-xs mt-0.5">Configure your Dollar-Cost Averaging strategy</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-6">

            {/* Bot Name */}
            <div>
              <label className="text-slate-400 text-xs font-medium mb-1.5 block">Bot Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`${pair.base} DCA Bot`}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            {/* Market Type */}
            <div>
              <label className="text-slate-400 text-xs font-medium mb-2 block">Market Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['spot', 'futures'] as const).map(mt => (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => setMarketType(mt)}
                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold border transition-all ${
                      marketType === mt
                        ? mt === 'spot' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-orange-600 border-orange-500 text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {mt === 'spot' ? 'Spot Trading' : 'Futures Trading'}
                    <span className="block text-xs font-normal opacity-70 mt-0.5">
                      {mt === 'spot' ? 'No leverage, own the asset' : 'Up to 10x leverage'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Exchange + Account */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Exchange</label>
                <select
                  value={exchange}
                  onChange={e => { setExchange(e.target.value); setAccountId(null) }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                >
                  {Object.entries(SUPPORTED_EXCHANGES).map(([key, ex]) => (
                    <option key={key} value={key}>{ex.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">API Account (optional)</label>
                <select
                  value={accountId ?? ''}
                  onChange={e => setAccountId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                >
                  <option value="">No API — Simulation mode</option>
                  {filteredAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.label ?? a.exchange} ({a.tradeMode})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Trading Pair */}
            <div>
              <label className="text-slate-400 text-xs font-medium mb-1.5 block">Trading Pair</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {DCA_PAIRS.map(p => (
                  <button
                    key={p.symbol}
                    type="button"
                    onClick={() => setSymbol(p.symbol)}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                      symbol === p.symbol
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                    }`}
                  >
                    <span className="block font-bold">{p.base}</span>
                    <span className="block text-slate-500 text-[10px]">/{p.quote}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* DCA Config */}
            <div className="space-y-4">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                DCA Strategy Settings
              </h3>

              <div className="grid sm:grid-cols-2 gap-3">
                {/* Base Order */}
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                    Base Order Size
                    <span className="text-amber-400 font-semibold">${cfg.baseOrderSize}</span>
                  </label>
                  <input
                    type="range" min="5" max="500" step="5"
                    value={cfg.baseOrderSize}
                    onChange={e => setCfg(c => ({ ...c, baseOrderSize: num(e.target.value) }))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-slate-600 text-[10px] mt-1"><span>$5</span><span>$500</span></div>
                </div>

                {/* Safety Order */}
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                    Safety Order Size
                    <span className="text-amber-400 font-semibold">${cfg.safetyOrderSize}</span>
                  </label>
                  <input
                    type="range" min="5" max="500" step="5"
                    value={cfg.safetyOrderSize}
                    onChange={e => setCfg(c => ({ ...c, safetyOrderSize: num(e.target.value) }))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-slate-600 text-[10px] mt-1"><span>$5</span><span>$500</span></div>
                </div>

                {/* Max Safety Orders */}
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                    Max Safety Orders
                    <span className="text-amber-400 font-semibold">{cfg.maxSafetyOrders}</span>
                  </label>
                  <input
                    type="range" min="1" max="10" step="1"
                    value={cfg.maxSafetyOrders}
                    onChange={e => setCfg(c => ({ ...c, maxSafetyOrders: num(e.target.value) }))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-slate-600 text-[10px] mt-1"><span>1</span><span>10</span></div>
                </div>

                {/* Price Deviation */}
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                    Price Deviation
                    <span className="text-amber-400 font-semibold">{cfg.priceDeviationPct}%</span>
                  </label>
                  <input
                    type="range" min="0.5" max="10" step="0.5"
                    value={cfg.priceDeviationPct}
                    onChange={e => setCfg(c => ({ ...c, priceDeviationPct: num(e.target.value) }))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-slate-600 text-[10px] mt-1"><span>0.5%</span><span>10%</span></div>
                </div>

                {/* Take Profit */}
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                    Take Profit
                    <span className="text-green-400 font-semibold">{cfg.takeProfitPct}%</span>
                  </label>
                  <input
                    type="range" min="0.5" max="20" step="0.5"
                    value={cfg.takeProfitPct}
                    onChange={e => setCfg(c => ({ ...c, takeProfitPct: num(e.target.value) }))}
                    className="w-full accent-green-400"
                  />
                  <div className="flex justify-between text-slate-600 text-[10px] mt-1"><span>0.5%</span><span>20%</span></div>
                </div>

                {/* Safety Order Volume Scale */}
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                    Safety Order Scale
                    <span className="text-amber-400 font-semibold">{cfg.safetyOrderVolumePct}x</span>
                  </label>
                  <input
                    type="range" min="1" max="3" step="0.1"
                    value={cfg.safetyOrderVolumePct}
                    onChange={e => setCfg(c => ({ ...c, safetyOrderVolumePct: num(e.target.value) }))}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between text-slate-600 text-[10px] mt-1"><span>1x flat</span><span>3x growing</span></div>
                </div>
              </div>

              {/* Futures leverage */}
              {marketType === 'futures' && (
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center justify-between">
                    Leverage
                    <span className="text-orange-400 font-semibold">{cfg.leverage ?? 1}x</span>
                  </label>
                  <input
                    type="range" min="1" max="10" step="1"
                    value={cfg.leverage ?? 1}
                    onChange={e => setCfg(c => ({ ...c, leverage: num(e.target.value) }))}
                    className="w-full accent-orange-400"
                  />
                  <div className="flex justify-between text-slate-600 text-[10px] mt-1"><span>1x</span><span>10x</span></div>
                  <p className="text-orange-400/80 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Futures trading carries liquidation risk. Use leverage carefully.
                  </p>
                </div>
              )}

              {/* Trigger Interval */}
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Order Check Interval</label>
                <div className="flex gap-2">
                  {['manual', '1h', '4h', '1d'].map(iv => (
                    <button
                      key={iv}
                      type="button"
                      onClick={() => setCfg(c => ({ ...c, interval: iv }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        cfg.interval === iv
                          ? 'bg-slate-700 border-slate-500 text-white'
                          : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {iv === 'manual' ? 'Manual' : iv}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
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
                <p className="text-green-400 font-bold text-lg">${estMonthlyProfit.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 px-6 py-4 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold">
              {saving ? 'Creating...' : 'Create Bot'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ─── Bot Card ──────────────────────────────────────────────────────────────────

function BotCard({
  bot,
  onRefresh,
  onToast,
}: {
  bot: Bot
  onRefresh: () => void
  onToast: (msg: string, type?: 'success' | 'error') => void
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

  async function loadOrders() {
    setLoadingOrders(true)
    try {
      const data = await getBotOrders(bot.id)
      setOrders(data)
    } catch { /* ignore */ }
    finally { setLoadingOrders(false) }
  }

  async function act(fn: () => Promise<unknown>, successMsg: string) {
    setActing(true)
    try {
      await fn()
      onRefresh()
      onToast(successMsg)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Action failed', 'error')
    } finally { setActing(false) }
  }

  useEffect(() => {
    if (showOrders) loadOrders()
  }, [showOrders])

  const orderTypeIcon = (type: string) => {
    if (type === 'buy')         return <ArrowDownCircle className="w-3.5 h-3.5 text-green-400" />
    if (type === 'take_profit') return <ArrowUpCircle className="w-3.5 h-3.5 text-blue-400" />
    return <ArrowUpCircle className="w-3.5 h-3.5 text-red-400" />
  }

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      {/* Top bar */}
      <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg border shrink-0 ${
            bot.status === 'active' ? 'bg-green-500/10 border-green-500/20' : 'bg-slate-800 border-slate-700'
          }`}>
            <Bot className={`w-5 h-5 ${bot.status === 'active' ? 'text-green-400' : 'text-slate-500'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold truncate">{bot.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-slate-500 text-xs font-mono">{bot.symbol}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                bot.marketType === 'futures' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {bot.marketType === 'futures' ? `FUTURES ${cfg.leverage ?? 1}x` : 'SPOT'}
              </span>
              <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                {SUPPORTED_EXCHANGES[bot.exchange]?.name ?? bot.exchange}
              </span>
            </div>
          </div>
        </div>
        <StatusBadge status={bot.status} />
      </div>

      {/* Metrics grid */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-800">
        <div>
          <p className="text-slate-500 text-xs">Invested</p>
          <p className="text-white font-bold text-sm font-mono">${totalInvested.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">Avg Buy</p>
          <p className="text-white font-bold text-sm font-mono">
            {avgPrice > 0 ? `$${avgPrice < 1 ? avgPrice.toFixed(6) : avgPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">Unrealized P&L</p>
          {bot.status === 'active' && totalInvested > 0
            ? <PnlChip value={unrealizedPnl} />
            : <span className="text-slate-500 text-sm">—</span>
          }
          {pnlPct !== 0 && (
            <p className={`text-xs ${pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </p>
          )}
        </div>
        <div>
          <p className="text-slate-500 text-xs">Realized P&L</p>
          {realizedPnl !== 0
            ? <PnlChip value={realizedPnl} />
            : <span className="text-slate-500 text-sm">—</span>
          }
        </div>
      </div>

      {/* Config strip */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-800/60">
        {[
          { label: 'Base', value: `$${cfg.baseOrderSize}` },
          { label: 'Safety', value: `$${cfg.safetyOrderSize}` },
          { label: 'Max SO', value: cfg.maxSafetyOrders },
          { label: 'Dev', value: `${cfg.priceDeviationPct}%` },
          { label: 'TP', value: `${cfg.takeProfitPct}%` },
          { label: 'Scale', value: `${cfg.safetyOrderVolumePct}x` },
          { label: 'Orders', value: bot.totalOrders },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <span className="text-slate-500 text-xs">{item.label}:</span>
            <span className="text-slate-300 text-xs font-semibold">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Actions row */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-2">
        {bot.status === 'stopped' || bot.status === 'paused' ? (
          <Button
            size="sm"
            onClick={() => act(() => startBot(bot.id), 'Bot started — base order placed')}
            disabled={acting}
            className="h-8 px-3 text-xs bg-green-700 hover:bg-green-600 text-white gap-1.5 font-semibold"
          >
            <Play className="w-3 h-3" />
            {bot.status === 'paused' ? 'Resume' : 'Start'}
          </Button>
        ) : null}

        {bot.status === 'active' && (
          <>
            <Button
              size="sm"
              onClick={() => act(() => triggerSafetyOrder(bot.id), 'Safety order triggered')}
              disabled={acting}
              className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-500 text-black gap-1.5 font-semibold"
            >
              <TrendingDown className="w-3 h-3" />
              Safety Order
            </Button>
            <Button
              size="sm"
              onClick={() => act(() => simulateTakeProfit(bot.id), 'Take-profit executed — position closed')}
              disabled={acting}
              className="h-8 px-3 text-xs bg-blue-700 hover:bg-blue-600 text-white gap-1.5 font-semibold"
            >
              <TrendingUp className="w-3 h-3" />
              Take Profit
            </Button>
            <Button
              size="sm"
              onClick={() => act(() => stopBot(bot.id, 'pause'), 'Bot paused')}
              disabled={acting}
              variant="ghost"
              className="h-8 px-3 text-xs border border-amber-500/30 text-amber-400 hover:bg-amber-900/20 gap-1.5"
            >
              <Pause className="w-3 h-3" />
              Pause
            </Button>
            <Button
              size="sm"
              onClick={() => act(() => stopBot(bot.id, 'stop'), 'Bot stopped')}
              disabled={acting}
              variant="ghost"
              className="h-8 px-3 text-xs border border-red-500/30 text-red-400 hover:bg-red-900/20 gap-1.5"
            >
              <Square className="w-3 h-3" />
              Stop
            </Button>
          </>
        )}

        <button
          onClick={() => { setShowOrders(v => !v) }}
          className="ml-auto h-8 px-3 text-xs border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md flex items-center gap-1.5 transition-colors"
        >
          <Activity className="w-3 h-3" />
          Orders ({bot.totalOrders})
          {showOrders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {bot.status === 'stopped' && (
          <button
            onClick={() => act(() => deleteBot(bot.id), 'Bot deleted')}
            disabled={acting}
            className="h-8 w-8 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded-md transition-colors border border-transparent hover:border-red-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Orders table */}
      {showOrders && (
        <div className="border-t border-slate-800">
          {loadingOrders ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
              Loading orders...
            </div>
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
                          {orderTypeIcon(o.orderType)}
                          <span className={`font-semibold capitalize ${
                            o.orderType === 'buy' ? 'text-green-400' :
                            o.orderType === 'take_profit' ? 'text-blue-400' : 'text-red-400'
                          }`}>
                            {o.orderType.replace('_', ' ')}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 font-mono">
                        ${parseFloat(String(o.price)) < 1
                          ? parseFloat(String(o.price)).toFixed(6)
                          : parseFloat(String(o.price)).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono">{parseFloat(String(o.qty)).toFixed(6)}</td>
                      <td className="px-4 py-2.5 text-slate-300 font-mono">${parseFloat(String(o.total)).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-[10px]">{o.triggerCondition ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-semibold ${o.status === 'filled' ? 'text-green-400' : o.status === 'pending' ? 'text-amber-400' : 'text-slate-500'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
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

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium max-w-sm w-full mx-4 ${
      type === 'error'
        ? 'bg-red-950 border-red-700 text-red-300'
        : 'bg-slate-800 border-slate-700 text-white'
    }`}>
      {type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 text-red-400" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function TradingBot() {
  const [bots, setBots] = useState<Bot[]>([])
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
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

  const activeBots = bots.filter(b => b.status === 'active')
  const totalRealized = bots.reduce((s, b) => s + parseFloat(String(b.realizedPnl)), 0)
  const totalUnrealized = bots.reduce((s, b) => s + parseFloat(String(b.unrealizedPnl)), 0)
  const totalInvested = bots.reduce((s, b) => s + parseFloat(String(b.totalInvested)), 0)

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <Bot className="w-5 h-5 text-amber-400" />
            Trading Bots
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Automated DCA strategy — Spot &amp; Futures with exchange API integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white border border-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2"
          >
            <Plus className="w-4 h-4" />
            New Bot
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      {bots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Bots',       value: bots.length,                       color: 'text-white',   icon: Bot },
            { label: 'Active Bots',      value: activeBots.length,                  color: 'text-green-400', icon: Activity },
            { label: 'Unrealized P&L',   value: `${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`, color: totalUnrealized >= 0 ? 'text-green-400' : 'text-red-400', icon: TrendingUp },
            { label: 'Realized P&L',     value: `${totalRealized >= 0 ? '+' : ''}$${totalRealized.toFixed(2)}`,     color: totalRealized >= 0 ? 'text-green-400' : 'text-red-400',     icon: CheckCircle2 },
          ].map(({ label, value, color, icon: Icon }) => (
            <Card key={label} className="bg-slate-900 border-slate-800 px-4 py-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 shrink-0">
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-slate-500 text-xs">{label}</p>
                <p className={`font-bold text-sm font-mono ${color}`}>{value}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* DCA info banner */}
      <DcaInfoBanner />

      {/* Bot list */}
      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-400" />
          Loading bots...
        </div>
      ) : bots.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 border-dashed py-16">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-7 h-7 text-amber-400" />
            </div>
            <p className="text-white font-semibold text-base">No bots yet</p>
            <p className="text-slate-500 text-sm mt-1 mb-5 max-w-xs mx-auto">
              Create your first DCA bot to start automated crypto trading on Spot or Futures markets.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Bot
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {bots.map(bot => (
            <BotCard
              key={bot.id}
              bot={bot}
              onRefresh={load}
              onToast={showToast}
            />
          ))}
        </div>
      )}

      {/* API integration notice */}
      <Card className="bg-slate-900/50 border-slate-800 px-5 py-4">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-slate-300 text-sm font-semibold">Connect Your Exchange API for Live Trading</p>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              Bots run in simulation mode by default. To place real orders, connect your exchange API keys in the
              <span className="text-amber-400 font-semibold"> Exchanges</span> tab, then select the account when creating a bot.
              Use read-only keys for monitoring or trade-mode keys for live execution.
              Supported exchanges: {Object.values(SUPPORTED_EXCHANGES).map(e => e.name).join(', ')}.
            </p>
          </div>
        </div>
      </Card>

      {/* Create modal */}
      {showCreate && (
        <CreateBotModal
          accounts={accounts}
          onClose={() => setShowCreate(false)}
          onCreate={load}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
