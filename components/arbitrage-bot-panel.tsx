'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowRightLeft, Play, Clock, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronUp, Zap, Shield, TrendingUp,
  Activity, Info, Loader2, Ban, Copy, Check,
  Network, DollarSign, Bot, CircleDot, Wallet,
  AlertCircle, Settings, BarChart3, Timer, Percent, Eye,
  MoveRight, ChevronRight, FileCode2, FlaskConical, Hourglass,
  TrendingDown, Layers, Hash, BarChart2,
} from 'lucide-react'
import {
  executeBotTrade, getBotTradeHistory, cancelBotTrade,
  getEnabledExchangeKeys, fetchLivePricesForPair,
} from '@/app/actions/arbitrage-bot'
import type { arbitrageBotTrades } from '@/lib/db/schema'
type BotTradeRow = typeof arbitrageBotTrades.$inferSelect
import {
  computeProfitBreakdown, runSafetyChecks,
  type BotTradeInput, type SafetyCheck,
  NETWORK_SUPPORTED_COINS,
  checkContractAddress, validateVolume, getTransferTiming, getSpreadFreshness,
  NETWORK_MIN_CONFIRMATIONS, NETWORK_BLOCK_TIME_SECS, NETWORK_WITHDRAW_FEE_USD,
} from '@/lib/arb-bot-utils'
import { getMarketOpportunities } from '@/app/actions/arbitrage'
import { StatusBadge, RiskChip, CopyButton as CopyBtn } from '@/lib/trader-utils'

type Opportunity = Awaited<ReturnType<typeof getMarketOpportunities>>[number]
type ViewTab = 'setup' | 'history' | 'analytics'

// ── Constants ──────────────────────────────────────────────────────────────────

const NETWORKS = [
  { id: 'TRC20',     label: 'TRC20',      sub: 'TRON',       fee: '$1.0',  time: '~3m',  color: 'text-red-400',    bg: 'bg-red-500/10'     },
  { id: 'BEP20',     label: 'BEP20',      sub: 'BSC',        fee: '$0.5',  time: '~3m',  color: 'text-yellow-400', bg: 'bg-yellow-500/10'  },
  { id: 'ERC20',     label: 'ERC20',      sub: 'Ethereum',   fee: '$8.0',  time: '~12m', color: 'text-blue-400',   bg: 'bg-blue-500/10'    },
  { id: 'SOL',       label: 'SOL',        sub: 'Solana',     fee: '$0.1',  time: '~1m',  color: 'text-purple-400', bg: 'bg-purple-500/10'  },
  { id: 'Polygon',   label: 'Polygon',    sub: 'MATIC',      fee: '$0.2',  time: '~3m',  color: 'text-violet-400', bg: 'bg-violet-500/10'  },
  { id: 'Avalanche', label: 'Avalanche',  sub: 'AVAX',       fee: '$0.5',  time: '~5m',  color: 'text-pink-400',   bg: 'bg-pink-500/10'    },
  { id: 'XRP',       label: 'XRP',        sub: 'Ledger',     fee: '$0.5',  time: '~1m',  color: 'text-cyan-400',   bg: 'bg-cyan-500/10'    },
  { id: 'BTC',       label: 'BTC',        sub: 'Bitcoin',    fee: '$5.0',  time: '~40m', color: 'text-orange-400', bg: 'bg-orange-500/10'  },
]

const ALL_EXCHANGES = [
  'Binance', 'OKX', 'Bybit', 'KuCoin', 'Kraken', 'Coinbase', 'HTX',
  'Bitfinex', 'Gate.io', 'Gemini', 'Crypto.com', 'Bitget', 'MEXC',
  'Phemex', 'Poloniex', 'BingX', 'LBank', 'Upbit',
  'CoinDCX', 'CoinSwitch', 'WazirX', 'BitBns', 'ZebPay', 'Delta Exchange',
]

const PIPELINE_STEPS = [
  { key: 'pending',     label: 'Queued',      icon: Clock,          desc: 'Trade is queued'                        },
  { key: 'buying',      label: 'Buying',       icon: DollarSign,     desc: 'Placing buy order'                     },
  { key: 'withdrawing', label: 'Withdrawing',  icon: ArrowRightLeft, desc: 'Withdrawing coin from buy exchange'    },
  { key: 'depositing',  label: 'Depositing',   icon: Loader2,        desc: 'Waiting for deposit confirmation'      },
  { key: 'selling',     label: 'Selling',      icon: TrendingUp,     desc: 'Placing sell order'                    },
  { key: 'completed',   label: 'Completed',    icon: CheckCircle2,   desc: 'Trade completed'                       },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

// ── Safety Check Panel ────────────────────────────────────────────────────────
function SafetyChecklist({ checks, onConfirm, onCancel, executing }: {
  checks: SafetyCheck[]
  onConfirm: () => void
  onCancel: () => void
  executing: boolean
}) {
  const allPass = checks.every(c => c.status === 'pass' || c.status === 'warn')
  const hasFail = checks.some(c => c.status === 'fail')

  const icon = (status: SafetyCheck['status']) => {
    if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
    if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
    if (status === 'fail') return <XCircle className="w-4 h-4 text-red-400 shrink-0" />
    return <CircleDot className="w-4 h-4 text-slate-500 shrink-0" />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-md shadow-2xl">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Pre-Trade Safety Check</h3>
              <p className="text-slate-500 text-[11px]">Review all checks before executing</p>
            </div>
          </div>

          <div className="space-y-2">
            {checks.map(c => (
              <div key={c.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${
                c.status === 'fail' ? 'bg-red-500/5 border-red-500/20' :
                c.status === 'warn' ? 'bg-amber-500/5 border-amber-500/20' :
                'bg-slate-800/40 border-slate-700/40'
              }`}>
                {icon(c.status)}
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold leading-none">{c.label}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5 leading-relaxed">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {hasFail && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-300 text-[11px]">One or more checks failed. This trade may result in a loss.</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-xs font-semibold hover:border-slate-600 transition-colors">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={executing || !allPass}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                hasFail ? 'bg-red-500/20 border border-red-500/40 text-red-300' : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm & Execute'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Pipeline Tracker ──────────────────────────────────────────────────────────
function PipelineTracker({ status }: { status: string }) {
  const stepIndex = PIPELINE_STEPS.findIndex(s => s.key === status)
  const isCompleted = status === 'completed'
  const isFailed    = status === 'failed'

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Execution Pipeline</p>
      <div className="flex items-center gap-1">
        {PIPELINE_STEPS.map((step, idx) => {
          const Icon = step.icon
          const done    = isCompleted || (idx < stepIndex)
          const active  = !isFailed && idx === stepIndex
          const pending = isFailed ? false : idx > stepIndex
          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full border shrink-0 transition-all ${
                done    ? 'bg-green-500/20 border-green-500/40 text-green-400' :
                active  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' :
                isFailed && idx === stepIndex ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                'bg-slate-800 border-slate-700 text-slate-600'
              }`}>
                <Icon className={`w-3 h-3 ${active && step.key === 'depositing' ? 'animate-spin' : ''}`} />
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${done ? 'bg-green-500/40' : active ? 'bg-amber-500/30' : 'bg-slate-700'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5">
        {isFailed
          ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          : isCompleted
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
          : <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />}
        <p className="text-[11px] text-slate-400">
          {isFailed ? 'Trade failed' : isCompleted ? 'Trade completed successfully' : `Step: ${PIPELINE_STEPS[stepIndex]?.label ?? status}`}
        </p>
      </div>
    </div>
  )
}

// ── Profit Preview Card ───────────────────────────────────────────────────────
function ProfitPreview({ input }: { input: BotTradeInput | null }) {
  if (!input || input.amountUsd <= 0) return null
  const p = computeProfitBreakdown(input)
  const isPositive = p.netProfitUsd > 0
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isPositive ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Profit Preview</p>
        <span className="text-[9px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
          {input.slippagePct ?? 0.1}% slippage baked in
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <p className="text-[10px] text-slate-500">Gross Profit</p>
          <p className="text-sm font-bold text-slate-200">${p.grossProfitUsd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Buy Fee ({input.buyExchange})</p>
          <p className="text-sm font-medium text-red-400">-${p.feeBuyUsd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Sell Fee ({input.sellExchange})</p>
          <p className="text-sm font-medium text-red-400">-${p.feeSellUsd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Network Fee ({input.network})</p>
          <p className="text-sm font-medium text-red-400">-${p.feeNetworkUsd.toFixed(2)}</p>
        </div>
        <div className="col-span-2 border-t border-slate-700/60 pt-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-slate-500">Net Profit</p>
              <p className={`text-xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}${p.netProfitUsd.toFixed(2)}
                <span className="text-sm ml-1.5 font-medium opacity-80">({p.netProfitPct.toFixed(2)}%)</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">Break-even spread</p>
              <p className="text-xs font-bold text-slate-400">{p.breakEvenSpreadPct.toFixed(3)}%</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
        <Timer className="w-3 h-3" /> Est. transfer: ~{p.transferMins}m via {input.network}
      </p>
    </div>
  )
}

// ── Live Price Ticker ─────────────────────────────────────────────────────────
function LivePriceTicker({ buyExchange, sellExchange, symbol, onPricesUpdate }: {
  buyExchange: string; sellExchange: string; symbol: string
  onPricesUpdate?: (buy: number, sell: number) => void
}) {
  const [prices, setPrices]   = useState<{ buy: number | null; sell: number | null }>({ buy: null, sell: null })
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    if (!buyExchange || !sellExchange || !symbol) return
    setLoading(true)
    try {
      const r = await fetchLivePricesForPair(buyExchange, sellExchange, symbol)
      setPrices({ buy: r.buyPrice, sell: r.sellPrice })
      setLastUpdate(new Date())
      if (r.buyPrice && r.sellPrice) onPricesUpdate?.(r.buyPrice, r.sellPrice)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [buyExchange, sellExchange, symbol, onPricesUpdate])

  useEffect(() => {
    if (!buyExchange || !sellExchange || !symbol) return
    refresh()
    intervalRef.current = setInterval(refresh, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [refresh])

  if (!buyExchange || !sellExchange || !symbol) return null

  const spread = prices.buy && prices.sell ? ((prices.sell - prices.buy) / prices.buy) * 100 : null

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
        <span className="text-[10px] text-slate-500 shrink-0">Live prices</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        {prices.buy !== null
          ? <span className="text-slate-300 font-mono">{buyExchange.split(' ')[0]}: <span className="text-white font-bold">${prices.buy.toFixed(4)}</span></span>
          : <span className="text-slate-600">Fetching...</span>}
        {prices.buy && prices.sell && <ChevronRight className="w-3 h-3 text-slate-600" />}
        {prices.sell !== null
          ? <span className="text-slate-300 font-mono">{sellExchange.split(' ')[0]}: <span className="text-white font-bold">${prices.sell.toFixed(4)}</span></span>
          : null}
        {spread !== null && (
          <span className={`font-bold px-1.5 py-0.5 rounded ${spread > 0 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {spread > 0 ? '+' : ''}{spread.toFixed(2)}%
          </span>
        )}
      </div>
      <button onClick={refresh} className="text-slate-600 hover:text-slate-400 transition-colors">
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}

// ── Trade History Row ──────────────────────────────────────────────────────────
function TradeRow({ trade, onCancel }: { trade: BotTradeRow; onCancel?: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const netProfit = parseFloat(trade.netProfitUsd ?? '0')
  const isProfit  = netProfit > 0
  const isPending = ['pending', 'buying', 'withdrawing', 'depositing', 'selling'].includes(trade.status)

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-sm">{trade.symbol}</span>
            <span className="text-slate-500 text-[10px]">{trade.buyExchange}</span>
            <MoveRight className="w-3 h-3 text-slate-600" />
            <span className="text-slate-500 text-[10px]">{trade.sellExchange}</span>
            <StatusBadge status={trade.status} />
            <RiskChip level={trade.riskLevel ?? 'Medium'} score={trade.riskScore ?? 50} />
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[10px] text-slate-500">Capital: <span className="text-slate-300">${parseFloat(trade.amountUsd ?? '0').toFixed(0)}</span></span>
            <span className="text-[10px] text-slate-500">Network: <span className="text-slate-300">{trade.network}</span></span>
            <span className="text-[10px] text-slate-600">{new Date(trade.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isPending && onCancel && (
            <button onClick={e => { e.stopPropagation(); onCancel(trade.id) }}
              className="px-2 py-1 text-[10px] text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors font-semibold">
              Cancel
            </button>
          )}
          <div className="text-right">
            <p className={`font-bold text-sm ${isProfit ? 'text-green-400' : trade.status === 'failed' ? 'text-red-400' : 'text-slate-400'}`}>
              {isProfit ? '+' : ''}${netProfit.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500">{parseFloat(trade.netProfitPct ?? '0').toFixed(2)}%</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
          <PipelineTracker status={trade.status} />

          {trade.statusDetail && (
            <p className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-2.5 leading-relaxed">{trade.statusDetail}</p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Buy Price',    value: `$${parseFloat(trade.buyPrice ?? '0').toFixed(4)}` },
              { label: 'Sell Price',   value: `$${parseFloat(trade.sellPrice ?? '0').toFixed(4)}` },
              { label: 'Gross Profit', value: `$${parseFloat(trade.grossProfitUsd ?? '0').toFixed(2)}` },
              { label: 'Total Fees',   value: `-$${(parseFloat(trade.feeBuyUsd ?? '0') + parseFloat(trade.feeSellUsd ?? '0') + parseFloat(trade.feeNetworkUsd ?? '0')).toFixed(2)}`, red: true },
            ].map(item => (
              <div key={item.label} className="bg-slate-800/50 rounded-lg p-2.5">
                <p className="text-[10px] text-slate-500">{item.label}</p>
                <p className={`text-xs font-bold ${(item as {red?: boolean}).red ? 'text-red-400' : 'text-slate-200'}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {(trade.buyOrderId || trade.sellOrderId || trade.withdrawTxId || trade.destinationAddr) && (
            <div className="space-y-1.5 bg-slate-800/30 rounded-xl p-3">
              {trade.buyOrderId && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 w-28 shrink-0">Buy Order ID</span>
                  <span className="text-slate-300 font-mono truncate flex-1">{trade.buyOrderId}</span>
                  <CopyBtn text={trade.buyOrderId} />
                </div>
              )}
              {trade.sellOrderId && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 w-28 shrink-0">Sell Order ID</span>
                  <span className="text-slate-300 font-mono truncate flex-1">{trade.sellOrderId}</span>
                  <CopyBtn text={trade.sellOrderId} />
                </div>
              )}
              {trade.withdrawTxId && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 w-28 shrink-0">Withdraw TX</span>
                  <span className="text-slate-300 font-mono truncate flex-1">{trade.withdrawTxId}</span>
                  <CopyBtn text={trade.withdrawTxId} />
                </div>
              )}
              {trade.destinationAddr && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 w-28 shrink-0">Dest. Address</span>
                  <span className="text-slate-300 font-mono truncate flex-1">{trade.destinationAddr}</span>
                  <CopyBtn text={trade.destinationAddr} />
                </div>
              )}
            </div>
          )}

          {trade.errorMessage && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-300 leading-relaxed">{trade.errorMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Analytics View ─────────────────────────────────────────────────────────────
function AnalyticsView({ history }: { history: BotTradeRow[] }) {
  const completed  = history.filter(t => t.status === 'completed')
  const failed     = history.filter(t => t.status === 'failed')
  const totalProfit = history.reduce((s, t) => s + parseFloat(t.netProfitUsd ?? '0'), 0)
  const winRate     = history.length > 0 ? (completed.length / history.length) * 100 : 0
  const avgProfit   = completed.length > 0
    ? completed.reduce((s, t) => s + parseFloat(t.netProfitUsd ?? '0'), 0) / completed.length
    : 0
  const totalCapital = history.reduce((s, t) => s + parseFloat(t.amountUsd ?? '0'), 0)
  const overallROI   = totalCapital > 0 ? (totalProfit / totalCapital) * 100 : 0

  // Exchange pair breakdown
  const pairMap: Record<string, { count: number; profit: number }> = {}
  for (const t of completed) {
    const key = `${t.buyExchange} → ${t.sellExchange}`
    if (!pairMap[key]) pairMap[key] = { count: 0, profit: 0 }
    pairMap[key].count++
    pairMap[key].profit += parseFloat(t.netProfitUsd ?? '0')
  }
  const topPairs = Object.entries(pairMap).sort((a, b) => b[1].profit - a[1].profit).slice(0, 5)

  // Symbol breakdown
  const symMap: Record<string, { count: number; profit: number }> = {}
  for (const t of completed) {
    if (!symMap[t.symbol]) symMap[t.symbol] = { count: 0, profit: 0 }
    symMap[t.symbol].count++
    symMap[t.symbol].profit += parseFloat(t.netProfitUsd ?? '0')
  }
  const topSymbols = Object.entries(symMap).sort((a, b) => b[1].profit - a[1].profit).slice(0, 5)

  const statCards = [
    { label: 'Total Trades',  value: history.length.toString(),         sub: 'all time',                      color: 'text-white'     },
    { label: 'Win Rate',      value: `${winRate.toFixed(1)}%`,          sub: `${completed.length} completed`,  color: 'text-green-400' },
    { label: 'Total Profit',  value: `$${totalProfit.toFixed(2)}`,      sub: `ROI ${overallROI.toFixed(2)}%`,  color: totalProfit >= 0 ? 'text-green-400' : 'text-red-400' },
    { label: 'Avg Profit',    value: `$${avgProfit.toFixed(2)}`,        sub: 'per completed trade',            color: avgProfit >= 0 ? 'text-amber-400' : 'text-red-400' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(s => (
          <Card key={s.label} className="bg-slate-900 border-slate-800 p-4 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {topPairs.length > 0 && (
          <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Exchange Pairs</p>
            <div className="space-y-2">
              {topPairs.map(([pair, stats]) => {
                const maxProfit = topPairs[0][1].profit
                return (
                  <div key={pair} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-300 font-medium">{pair}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{stats.count}x</span>
                        <span className="text-green-400 font-bold">+${stats.profit.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500/60 rounded-full" style={{ width: `${(stats.profit / maxProfit) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {topSymbols.length > 0 && (
          <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Coins by Profit</p>
            <div className="space-y-2">
              {topSymbols.map(([sym, stats]) => {
                const maxProfit = topSymbols[0][1].profit
                return (
                  <div key={sym} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-300 font-bold">{sym}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{stats.count} trades</span>
                        <span className="text-amber-400 font-bold">+${stats.profit.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500/60 rounded-full" style={{ width: `${(stats.profit / maxProfit) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm font-medium">No analytics yet</p>
          <p className="text-slate-600 text-xs mt-1">Execute trades to see performance analytics.</p>
        </div>
      )}
    </div>
  )
}

// ── Network Fee Comparison Table ──────────────────────────────────────────────
function NetworkFeeComparison({ symbol, amountUsd }: { symbol: string; amountUsd: number }) {
  if (!symbol || amountUsd <= 0) return null
  const rows = NETWORKS.map(n => {
    const withdrawFee = NETWORK_WITHDRAW_FEE_USD[n.id] ?? 2
    const totalFeeEst = withdrawFee + (amountUsd * 0.002) // rough taker fee both sides
    const isSupported = !symbol || (NETWORK_SUPPORTED_COINS[n.id] ?? []).includes(symbol) || (NETWORK_SUPPORTED_COINS[n.id] ?? []).length === 0
    return { ...n, withdrawFee, totalFeeEst, isSupported }
  })
  const cheapest = rows.filter(r => r.isSupported).sort((a, b) => a.totalFeeEst - b.totalFeeEst)[0]

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50">
        <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-1">Network Fee Comparison</p>
        <span className="text-[9px] text-slate-600">for ${amountUsd.toLocaleString()} capital</span>
      </div>
      <div className="divide-y divide-slate-800/60">
        {rows.map(n => (
          <div key={n.id} className={`flex items-center gap-3 px-3 py-2 ${!n.isSupported ? 'opacity-30' : n.id === cheapest?.id ? 'bg-green-500/5' : ''}`}>
            <span className={`text-[10px] font-bold w-16 shrink-0 ${n.color}`}>{n.label}</span>
            <span className="text-[9px] text-slate-600 flex-1">{n.sub}</span>
            <span className="text-[10px] text-slate-400 font-mono w-12 text-right">{n.time}</span>
            <span className="text-[10px] text-slate-300 font-mono w-12 text-right">${n.withdrawFee.toFixed(1)}</span>
            {n.id === cheapest?.id && n.isSupported && (
              <span className="text-[9px] text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1.5 font-bold shrink-0">CHEAPEST</span>
            )}
            {!n.isSupported && (
              <span className="text-[9px] text-slate-600 border border-slate-700/40 rounded px-1.5 shrink-0">N/A</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Execution Log Feed ─────────────────────────────────────────────────────────
type LogEntry = { ts: Date; level: 'info' | 'warn' | 'error' | 'success'; msg: string }

function ExecutionLog({ entries }: { entries: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [entries])

  if (entries.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-950 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500/60" />
          <span className="w-2 h-2 rounded-full bg-amber-500/60" />
          <span className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <p className="text-[10px] font-mono text-slate-500 flex-1">execution.log</p>
        <span className="text-[9px] text-slate-600">{entries.length} entries</span>
      </div>
      <div ref={scrollRef} className="max-h-48 overflow-y-auto p-3 space-y-1 font-mono scrollbar-thin">
        {entries.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-[10px] leading-relaxed">
            <span className="text-slate-600 shrink-0 select-none">
              {e.ts.toTimeString().slice(0, 8)}
            </span>
            <span className={`font-bold shrink-0 w-12 ${
              e.level === 'success' ? 'text-green-400' :
              e.level === 'error'   ? 'text-red-400'   :
              e.level === 'warn'    ? 'text-amber-400'  :
              'text-slate-500'
            }`}>[{e.level.toUpperCase().slice(0,4)}]</span>
            <span className={`${
              e.level === 'success' ? 'text-green-300' :
              e.level === 'error'   ? 'text-red-300'   :
              e.level === 'warn'    ? 'text-amber-300'  :
              'text-slate-400'
            }`}>{e.msg}</span>
          </div>
        ))}
        {entries[entries.length - 1]?.level !== 'success' && entries[entries.length - 1]?.level !== 'error' && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-slate-600">
              {new Date().toTimeString().slice(0, 8)}
            </span>
            <span className="text-amber-400 font-bold">[INFO]</span>
            <span className="text-slate-500 animate-pulse">waiting...</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Opportunity Refresh Ticker ─────────────────────────────────────────────────
function RefreshCountdown({ onRefresh, intervalSecs = 30 }: { onRefresh: () => void; intervalSecs?: number }) {
  const [remaining, setRemaining] = useState(intervalSecs)
  useEffect(() => {
    const tick = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { onRefresh(); return intervalSecs }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [onRefresh, intervalSecs])
  const pct = ((intervalSecs - remaining) / intervalSecs) * 100

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <div className="relative w-3.5 h-3.5 shrink-0">
        <svg className="w-3.5 h-3.5 -rotate-90" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5" strokeWidth="1.5" className="stroke-slate-700" fill="none" />
          <circle cx="7" cy="7" r="5" strokeWidth="1.5"
            stroke="#f59e0b" fill="none" strokeDasharray={`${2 * Math.PI * 5}`}
            strokeDashoffset={`${2 * Math.PI * 5 * (1 - pct / 100)}`}
            strokeLinecap="round" />
        </svg>
      </div>
      <span className="text-[10px] text-slate-600">Auto-refresh in <span className="text-amber-400 font-mono font-bold">{remaining}s</span></span>
    </div>
  )
}

// ── Post-Trade Next Opportunity Recommender ────────────────────────────────────
function NextOpportunityCard({ opps, lastTrade, onSelect }: {
  opps: Opportunity[]
  lastTrade: BotTradeRow
  onSelect: (opp: Opportunity) => void
}) {
  const next = opps
    .filter(o => o.netProfit > 0 && !(o.buyExchange === lastTrade.buyExchange && o.sellExchange === lastTrade.sellExchange && o.symbol === lastTrade.symbol))
    .sort((a, b) => b.netProfit - a.netProfit)[0]

  if (!next) return null

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">Next Best Opportunity</p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">{next.symbol}</p>
          <p className="text-[10px] text-slate-500">{next.buyExchange} &rarr; {next.sellExchange}</p>
          <p className="text-[10px] text-slate-500 font-mono">${next.buyPrice.toFixed(4)} &rarr; ${next.sellPrice.toFixed(4)}</p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-green-400 font-bold">+{next.netProfit.toFixed(2)}%</p>
          <button onClick={() => onSelect(next)}
            className="text-[10px] px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors">
            Load Trade
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Triangle Arbitrage Route ───────────────────────────────────────────────────
function TriangleRouteCard({ symbol, buyExchange, sellExchange, opps }: {
  symbol: string; buyExchange: string; sellExchange: string; opps: Opportunity[]
}) {
  if (!symbol || !buyExchange || !sellExchange) return null

  // Find a 3rd exchange that has a better sell rate creating a triangle
  const thirdLeg = opps
    .filter(o => o.symbol === symbol && o.buyExchange === sellExchange && o.sellExchange !== buyExchange)
    .sort((a, b) => b.netProfit - a.netProfit)[0]

  if (!thirdLeg) return null

  const totalProfit = opps.find(o =>
    o.symbol === symbol && o.buyExchange === buyExchange && o.sellExchange === sellExchange
  )?.netProfit ?? 0

  const triangleProfit = (totalProfit + thirdLeg.netProfit) * 0.7 // conservative estimate

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <p className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Triangle Route Detected</p>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/25 text-purple-300 font-bold">3-LEG</span>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <div className="flex-1 text-center">
          <p className="text-slate-400 font-semibold">{buyExchange}</p>
          <p className="text-[9px] text-slate-600">Buy {symbol}</p>
        </div>
        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
        <div className="flex-1 text-center">
          <p className="text-slate-400 font-semibold">{sellExchange}</p>
          <p className="text-[9px] text-slate-600">Sell / Re-buy</p>
        </div>
        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
        <div className="flex-1 text-center">
          <p className="text-slate-400 font-semibold">{thirdLeg.sellExchange}</p>
          <p className="text-[9px] text-slate-600">Final Sell</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">Est. combined net profit</span>
        <span className="text-purple-400 font-bold">+{triangleProfit.toFixed(2)}%</span>
      </div>
      <p className="text-[9px] text-slate-600">Triangle route requires 2 sequential trades and 2 network transfers — higher fees but potentially greater return. Execute as two separate bot trades.</p>
    </div>
  )
}

// ── Contract Address Verifier ──────────────────────────────────────────────────
function ContractAddressPanel({ symbol, network }: { symbol: string; network: string }) {
  const [copied, setCopied] = useState(false)
  if (!symbol || !network) return null
  const result = checkContractAddress(symbol, network)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${result.isVerified ? 'bg-slate-800/40 border-slate-700/60' : 'bg-amber-500/5 border-amber-500/20'}`}>
      <div className="flex items-center gap-2">
        <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${result.isVerified ? 'text-green-400' : 'text-amber-400'}`} />
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-1">Contract Address — {symbol} on {network}</p>
        {result.isVerified
          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
      </div>
      {result.isNative && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/25 text-blue-400 font-semibold">NATIVE COIN</span>
          <span className="text-[10px] text-slate-500">{symbol} is the base currency on {network} — no contract risk</span>
        </div>
      )}
      {!result.isNative && result.address && (
        <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2 font-mono">
          <Hash className="w-3 h-3 text-slate-600 shrink-0" />
          <span className="text-[10px] text-slate-300 flex-1 truncate">{result.address}</span>
          <button onClick={() => copy(result.address!)} className="text-slate-500 hover:text-white transition-colors shrink-0">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
      {result.warning && (
        <p className="text-[10px] text-amber-400 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          {result.warning}
        </p>
      )}
      {result.isVerified && !result.isNative && result.address && (
        <p className="text-[10px] text-slate-500">Verify this matches the contract on both {'{'}buy{'}'} and {'{'}sell{'}'} exchange deposit pages before executing.</p>
      )}
    </div>
  )
}

// ── Volume Validator Panel ─────────────────────────────────────────────────────
function VolumeValidatorPanel({ symbol, capitalUsd, volume24hUsd, buyExchange, sellExchange }: {
  symbol: string; capitalUsd: number; volume24hUsd: number; buyExchange: string; sellExchange: string
}) {
  if (!symbol || capitalUsd <= 0) return null
  const result = validateVolume(capitalUsd, volume24hUsd)
  const pct = result.pct

  return (
    <div className={`rounded-xl border p-3 space-y-2.5 ${!result.safe ? 'bg-red-500/5 border-red-500/20' : result.warning ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-800/40 border-slate-700/60'}`}>
      <div className="flex items-center gap-2">
        <BarChart2 className={`w-3.5 h-3.5 shrink-0 ${!result.safe ? 'text-red-400' : result.warning ? 'text-amber-400' : 'text-green-400'}`} />
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-1">Volume Impact Check</p>
        {!result.safe
          ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/25 text-red-400 font-bold">HIGH IMPACT</span>
          : result.warning
          ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-amber-400 font-bold">CAUTION</span>
          : <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/25 text-green-400 font-bold">SAFE</span>}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500">Capital / 24h Volume</span>
          <span className={`font-bold font-mono ${pct > 5 ? 'text-red-400' : pct > 1 ? 'text-amber-400' : 'text-green-400'}`}>
            {pct.toFixed(3)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct > 5 ? 'bg-red-400' : pct > 1 ? 'bg-amber-400' : 'bg-green-400'}`}
            style={{ width: `${Math.min(100, pct * 10)}%` }} />
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-600">Safe: under 1%</span>
          <span className="text-slate-600">
            24h vol: ${volume24hUsd >= 1_000_000 ? `${(volume24hUsd / 1_000_000).toFixed(1)}M` : `${(volume24hUsd / 1000).toFixed(0)}K`}
          </span>
        </div>
      </div>
      {result.warning && (
        <p className="text-[10px] text-amber-400">{result.warning}</p>
      )}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        {[
          { label: `${buyExchange} volume`, value: volume24hUsd > 0 ? `$${((volume24hUsd * 0.45) / 1_000_000).toFixed(1)}M` : 'N/A' },
          { label: `${sellExchange} volume`, value: volume24hUsd > 0 ? `$${((volume24hUsd * 0.38) / 1_000_000).toFixed(1)}M` : 'N/A' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 rounded-lg px-2.5 py-2">
            <p className="text-[9px] text-slate-600 truncate">{s.label}</p>
            <p className="text-xs font-bold text-slate-300 font-mono">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Blockchain Transfer Timer ──────────────────────────────────────────────────
function TransferTimerPanel({ network, startedAt }: { network: string; startedAt: Date | null }) {
  const [elapsed, setElapsed] = useState(0)
  const timing = getTransferTiming(network)

  useEffect(() => {
    if (!startedAt) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  const pct           = startedAt ? timing.progressPct(elapsed) : 0
  const blocksElapsed = startedAt ? Math.floor(elapsed / timing.blockTimeSecs) : 0
  const confirmations = Math.min(blocksElapsed, timing.minConfirmations)
  const isSettled     = startedAt ? timing.isSettled(elapsed) : false

  return (
    <div className={`rounded-xl border p-3 space-y-3 ${isSettled ? 'bg-green-500/5 border-green-500/20' : startedAt ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-800/40 border-slate-700/60'}`}>
      <div className="flex items-center gap-2">
        <Hourglass className={`w-3.5 h-3.5 shrink-0 ${isSettled ? 'text-green-400' : startedAt ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-1">Blockchain Transfer Timer</p>
        {isSettled
          ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/25 text-green-400 font-bold">SETTLED</span>
          : startedAt
          ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-amber-400 font-bold animate-pulse">IN TRANSIT</span>
          : <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/40 border border-slate-600/40 text-slate-500 font-bold">IDLE</span>}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-500 font-mono">{confirmations}/{timing.minConfirmations} confirmations</span>
          <span className={`font-bold ${isSettled ? 'text-green-400' : startedAt ? 'text-amber-400' : 'text-slate-600'}`}>
            {startedAt ? timing.etaText(elapsed) : `~${timing.estimatedMins}m est.`}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${isSettled ? 'bg-green-400' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Network stats grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Network',      value: network                           },
          { label: 'Block Time',   value: `${timing.blockTimeSecs}s`        },
          { label: 'Min Confirms', value: String(timing.minConfirmations)   },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 rounded-lg px-2 py-1.5 text-center">
            <p className="text-[9px] text-slate-600">{s.label}</p>
            <p className="text-[11px] font-bold text-slate-300 font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {!startedAt && (
        <p className="text-[10px] text-slate-500 text-center">Timer starts automatically when a trade is executed.</p>
      )}
    </div>
  )
}

// ── Spread Freshness Indicator ─────────────────────────────────────────────────
function SpreadFreshnessBar({ detectedAt }: { detectedAt: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(i)
  }, [])

  const f = getSpreadFreshness(detectedAt)
  const maxWindow = 15 * 60 // 15 min window
  const pct = Math.max(0, 100 - (f.ageSeconds / maxWindow) * 100)

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <Activity className={`w-3.5 h-3.5 shrink-0 ${f.color}`} />
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Spread detected</span>
          <span className={`text-[10px] font-bold ${f.color}`}>{f.label}</span>
        </div>
        <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${f.isExpired ? 'bg-red-400' : f.isStale ? 'bg-orange-400' : f.isFresh ? 'bg-green-400' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>
      {f.isExpired && (
        <span className="text-[9px] text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 font-bold shrink-0">RESCAN</span>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ArbitrageBotPanel() {
  const [view, setView]               = useState<ViewTab>('setup')
  const [opps, setOpps]               = useState<Opportunity[]>([])
  const [history, setHistory]         = useState<BotTradeRow[]>([])
  const [enabledKeys, setEnabledKeys] = useState<{ exchange: string; label: string; isPublicOnly: boolean }[]>([])
  const [loading, setLoading]         = useState(true)
  const [executing, setExecuting]     = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [safetyChecks, setSafetyChecks]   = useState<SafetyCheck[]>([])
  const [lastResult, setLastResult]   = useState<BotTradeRow | null>(null)
  const [showAdvanced, setShowAdvanced]               = useState(false)
  const [transferStartedAt, setTransferStartedAt]     = useState<Date | null>(null)
  const [executionLog, setExecutionLog]               = useState<LogEntry[]>([])
  const [showFeeTable, setShowFeeTable]               = useState(false)

  const addLog = useCallback((level: LogEntry['level'], msg: string) => {
    setExecutionLog(prev => [...prev, { ts: new Date(), level, msg }])
  }, [])

  // Form state
  const [selectedOpp,    setSelectedOpp]    = useState<Opportunity | null>(null)
  const [manualMode,     setManualMode]     = useState(false)
  const [buyExchange,    setBuyExchange]    = useState('')
  const [sellExchange,   setSellExchange]   = useState('')
  const [symbol,         setSymbol]         = useState('')
  const [network,        setNetwork]        = useState('TRC20')
  const [amountUsd,      setAmountUsd]      = useState('')
  const [slippage,       setSlippage]       = useState('0.1')
  const [minProfit,      setMinProfit]      = useState('0.5')
  const [destAddr,       setDestAddr]       = useState('')
  const [liveBuyPrice,   setLiveBuyPrice]   = useState<number | null>(null)
  const [liveSellPrice,  setLiveSellPrice]  = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [oppsData, histData, keysData] = await Promise.all([
        getMarketOpportunities(),
        getBotTradeHistory(50),
        getEnabledExchangeKeys(),
      ])
      setOpps(oppsData)
      setHistory(histData)
      setEnabledKeys(keysData)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  // No auto-load — user triggers manually to avoid duplicate scanning

  // Auto-fill from selected opportunity
  useEffect(() => {
    if (selectedOpp && !manualMode) {
      setBuyExchange(selectedOpp.buyExchange)
      setSellExchange(selectedOpp.sellExchange)
      setSymbol(selectedOpp.symbol)
    }
  }, [selectedOpp, manualMode])

  const buildInput = useCallback((): BotTradeInput | null => {
    const amt = parseFloat(amountUsd)
    if (!symbol || !buyExchange || !sellExchange || !network || isNaN(amt) || amt <= 0) return null
    const opp       = opps.find(o => o.symbol === symbol && o.buyExchange === buyExchange && o.sellExchange === sellExchange)
    const bp        = liveBuyPrice  ?? opp?.buyPrice  ?? 1
    const sp        = liveSellPrice ?? opp?.sellPrice ?? 1
    const amount    = amt / bp
    return {
      symbol, network, buyExchange, sellExchange,
      buyPrice: bp, sellPrice: sp, amount, amountUsd: amt,
      riskLevel:         opp?.risk ?? 'Medium',
      riskScore:         opp?.risk === 'Low' ? 15 : opp?.risk === 'High' ? 65 : 35,
      slippagePct:       parseFloat(slippage) || 0.1,
      minNetProfitUsd:   parseFloat(minProfit) || 0.5,
      destinationAddr:   destAddr || undefined,
    }
  }, [symbol, network, buyExchange, sellExchange, amountUsd, slippage, minProfit, destAddr, liveBuyPrice, liveSellPrice, opps])

  const handleRunChecks = () => {
    const input = buildInput()
    if (!input) return
    const opp = selectedOpp ?? opps.find(o => o.symbol === symbol && o.buyExchange === buyExchange && o.sellExchange === sellExchange)
    const volume24hUsd     = opp ? opp.volume24h * (opp.buyPrice || 1) : 0
    const spreadAgeSeconds = opp ? Math.floor((Date.now() - new Date(opp.detectedAt).getTime()) / 1000) : undefined
    const checks = runSafetyChecks({ ...input, volume24hUsd, spreadAgeSeconds })
    setSafetyChecks(checks)
    setExecutionLog([])
    addLog('info', `Safety check initiated — ${input.symbol} ${input.buyExchange} → ${input.sellExchange}`)
    addLog('info', `Capital: $${input.amountUsd} | Network: ${input.network} | Slippage: ${input.slippagePct}%`)
    addLog('info', `Live buy: $${input.buyPrice.toFixed(4)} | Live sell: $${input.sellPrice.toFixed(4)}`)
    checks.forEach(c => {
      if (c.status === 'fail')  addLog('error', `[FAIL] ${c.label}: ${c.detail}`)
      else if (c.status === 'warn') addLog('warn', `[WARN] ${c.label}: ${c.detail}`)
      else addLog('info', `[PASS] ${c.label}`)
    })
    const fails = checks.filter(c => c.status === 'fail').length
    const warns = checks.filter(c => c.status === 'warn').length
    addLog(fails > 0 ? 'error' : warns > 0 ? 'warn' : 'success',
      `Check complete — ${checks.length - fails - warns} pass, ${warns} warn, ${fails} fail`)
    setShowChecklist(true)
  }

  const handleExecute = async () => {
    const input = buildInput()
    if (!input) return
    setExecuting(true)
    setShowChecklist(false)
    try {
      addLog('info', `Executing trade — sending to server...`)
      addLog('info', `Re-fetching live prices to guard against stale data...`)
      const result = await executeBotTrade(input)
      setLastResult(result)
      setTransferStartedAt(new Date())
      if (result.status === 'completed') {
        addLog('success', `Trade completed — Net: $${parseFloat(result.netProfitUsd ?? '0').toFixed(2)} (${parseFloat(result.netProfitPct ?? '0').toFixed(2)}%)`)
        addLog('success', `Buy order: ${result.buyOrderId} | Sell order: ${result.sellOrderId}`)
        if (result.withdrawTxId) addLog('info', `Withdraw TX: ${result.withdrawTxId}`)
      } else if (result.status === 'failed') {
        addLog('error', `Trade failed: ${result.errorMessage ?? result.statusDetail ?? 'Unknown error'}`)
      } else {
        addLog('info', `Trade status: ${result.status} — ${result.statusDetail ?? ''}`)
        addLog('info', `Transfer in progress via ${input.network} — timer started`)
      }
      await getBotTradeHistory(50).then(setHistory)
    } catch (err) {
      addLog('error', `Execution error: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setExecuting(false)
    }
  }

  const handleCancel = async (tradeId: number) => {
    await cancelBotTrade(tradeId)
    await getBotTradeHistory(50).then(setHistory)
  }

  const topOpps          = opps.filter(o => o.netProfit > 0).sort((a, b) => b.netProfit - a.netProfit).slice(0, 15)
  const input            = buildInput()
  const authenticatedCount = enabledKeys.filter(k => !k.isPublicOnly).length
  const coinNetworks     = symbol ? Object.entries(NETWORK_SUPPORTED_COINS).filter(([, coins]) => coins.includes(symbol)).map(([n]) => n) : []

  return (
    <div className="space-y-4">
      {/* Safety checklist modal */}
      {showChecklist && (
        <SafetyChecklist
          checks={safetyChecks}
          onConfirm={handleExecute}
          onCancel={() => setShowChecklist(false)}
          executing={executing}
        />
      )}

      {/* Compact tab bar — no duplicate title */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {(['setup', 'history', 'analytics'] as ViewTab[]).map(v => (
            <button key={v} onClick={() => { setView(v); if (v !== 'setup') loadData() }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border capitalize ${
                view === v ? 'bg-slate-800 text-white border-slate-700' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {v === 'history' && history.length > 0
                ? <span className="flex items-center gap-1.5">History <span className="text-[10px] bg-amber-500 text-black rounded-full px-1.5 py-0.5 font-bold">{history.length}</span></span>
                : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={loadData} disabled={loading}
          className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 transition-colors disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* API Key status banner */}
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs ${authenticatedCount > 0 ? 'bg-green-500/5 border-green-500/20 text-green-300' : 'bg-amber-500/5 border-amber-500/20 text-amber-300'}`}>
        <Shield className="w-4 h-4 shrink-0" />
        <span className="flex-1">
          {authenticatedCount > 0
            ? `${authenticatedCount} exchange${authenticatedCount > 1 ? 's' : ''} connected with live API keys — real trading enabled.`
            : 'No authenticated API keys. Trades run in simulation mode. Add exchange keys in Admin > Exchange Keys.'}
        </span>
        {authenticatedCount === 0 && <span className="text-[10px] opacity-60 shrink-0">Paper trading</span>}
      </div>

      {/* ── SETUP VIEW ── */}
      {view === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT: Opportunity picker + form */}
          <div className="space-y-3">
            {!manualMode ? (
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Opportunities</p>
                  <div className="flex items-center gap-2">
                    {opps.length > 0 && <RefreshCountdown onRefresh={loadData} intervalSecs={30} />}
                    <button onClick={() => setManualMode(true)} className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
                      Manual
                    </button>
                  </div>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Fetching live rates...
                  </div>
                ) : opps.length === 0 ? (
                  <div className="py-5 flex flex-col items-center gap-3">
                    <p className="text-xs text-slate-500 text-center">Opportunities not loaded yet.</p>
                    <button onClick={loadData}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-xs transition-all">
                      <Activity className="w-3.5 h-3.5" /> Load Opportunities
                    </button>
                  </div>
                ) : topOpps.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No profitable opportunities right now.</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5 scrollbar-thin">
                    {topOpps.map(opp => {
                      const isSelected = selectedOpp?.id === opp.id
                      return (
                        <button key={opp.id} onClick={() => setSelectedOpp(isSelected ? null : opp)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                            isSelected ? 'bg-amber-500/15 border-amber-500/40' : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-bold text-xs">{opp.symbol}</span>
                              <span className="text-[10px] text-slate-500">{opp.buyExchange}</span>
                              <ChevronRight className="w-3 h-3 text-slate-600" />
                              <span className="text-[10px] text-slate-500">{opp.sellExchange}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                                opp.risk === 'Low' ? 'text-green-400 bg-green-500/10 border-green-500/25' :
                                opp.risk === 'High' ? 'text-red-400 bg-red-500/10 border-red-500/25' :
                                'text-amber-400 bg-amber-500/10 border-amber-500/25'
                              }`}>{opp.risk}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                              ${opp.buyPrice.toFixed(4)} &rarr; ${opp.sellPrice.toFixed(4)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-green-400 font-bold text-xs">+{opp.netProfit.toFixed(2)}%</p>
                            <p className="text-[10px] text-slate-500">{opp.spread.toFixed(3)}% spread</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Manual Entry</p>
                  <button onClick={() => { setManualMode(false); setSelectedOpp(null) }} className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
                    Use live opportunities
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] text-slate-400 mb-1 block">Coin Symbol</label>
                    <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
                      placeholder="USDT, BTC, ETH..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-amber-500/50 font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1 block">Buy Exchange</label>
                    <select value={buyExchange} onChange={e => setBuyExchange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-amber-500/50">
                      <option value="">Select...</option>
                      {ALL_EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1 block">Sell Exchange</label>
                    <select value={sellExchange} onChange={e => setSellExchange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-amber-500/50">
                      <option value="">Select...</option>
                      {ALL_EXCHANGES.filter(ex => ex !== buyExchange).map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                  </div>
                </div>
              </Card>
            )}

            {/* Live price ticker */}
            {buyExchange && sellExchange && symbol && (
              <LivePriceTicker
                buyExchange={buyExchange}
                sellExchange={sellExchange}
                symbol={symbol}
                onPricesUpdate={(buy, sell) => { setLiveBuyPrice(buy); setLiveSellPrice(sell) }}
              />
            )}

            {/* Network + Capital */}
            <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transfer Network</p>
              <div className="grid grid-cols-4 gap-1.5">
                {NETWORKS.map(n => {
                  const supported = coinNetworks.length === 0 || coinNetworks.includes(n.id)
                  return (
                    <button key={n.id} onClick={() => setNetwork(n.id)} disabled={!supported}
                      className={`flex flex-col items-center px-2 py-2.5 rounded-xl border transition-colors text-center ${
                        network === n.id ? 'bg-amber-500/15 border-amber-500/40' :
                        !supported ? 'bg-slate-800/30 border-slate-800 opacity-40 cursor-not-allowed' :
                        'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <Network className={`w-3 h-3 mb-1 ${n.color}`} />
                      <p className="text-white text-[9px] font-bold leading-none">{n.label}</p>
                      <p className="text-[8px] text-slate-500 mt-0.5">{n.fee}</p>
                      <p className="text-[8px] text-slate-600">{n.time}</p>
                    </button>
                  )
                })}
              </div>

              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Capital to Deploy (USD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input type="number" min="50" step="50" value={amountUsd} onChange={e => setAmountUsd(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 250, 500, 1000, 2500].map(v => (
                    <button key={v} onClick={() => setAmountUsd(String(v))}
                      className="flex-1 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-500/40 text-slate-400 hover:text-amber-400 text-[10px] font-medium transition-colors">
                      ${v >= 1000 ? `${v/1000}k` : v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee comparison table toggle */}
              {symbol && parseFloat(amountUsd) > 0 && (
                <div>
                  <button onClick={() => setShowFeeTable(v => !v)}
                    className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors w-full justify-between">
                    <span className="flex items-center gap-1.5">
                      <BarChart3 className="w-3 h-3" /> Compare network fees
                    </span>
                    {showFeeTable ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showFeeTable && (
                    <div className="mt-2">
                      <NetworkFeeComparison symbol={symbol} amountUsd={parseFloat(amountUsd) || 0} />
                    </div>
                  )}
                </div>
              )}

              {/* Advanced settings */}
              <button onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                <Settings className="w-3 h-3" />
                Advanced settings
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-1 border-t border-slate-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1 block flex items-center gap-1">
                        <Percent className="w-3 h-3" /> Max Slippage %
                      </label>
                      <input type="number" min="0.01" max="5" step="0.05" value={slippage}
                        onChange={e => setSlippage(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 mb-1 block flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Min Net Profit ($)
                      </label>
                      <input type="number" min="0" step="0.5" value={minProfit}
                        onChange={e => setMinProfit(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1 block flex items-center gap-1">
                      <Wallet className="w-3 h-3" /> Destination Wallet Address (optional — fetched automatically if blank)
                    </label>
                    <input value={destAddr} onChange={e => setDestAddr(e.target.value)}
                      placeholder="TRX address, BEP20 address..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-amber-500/50 font-mono" />
                  </div>
                </div>
              )}

              {/* Execute */}
              <Button onClick={handleRunChecks} disabled={!input || executing}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed">
                {executing
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Executing...</>
                  : <><Shield className="w-4 h-4 mr-2" /> Run Safety Check &amp; Execute</>}
              </Button>

              {!input && (buyExchange || sellExchange || symbol) && (
                <p className="text-[10px] text-slate-500 text-center">Fill in all fields and enter capital to continue.</p>
              )}
            </Card>
          </div>

          {/* RIGHT: Opp details + new intelligence panels + profit preview */}
          <div className="space-y-3">
            {selectedOpp && !manualMode && (
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selected Opportunity</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
                    {selectedOpp.symbol.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold">{selectedOpp.symbol}</p>
                    <p className="text-[10px] text-slate-500">{selectedOpp.buyExchange} &rarr; {selectedOpp.sellExchange}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">+{selectedOpp.netProfit.toFixed(2)}%</p>
                    <p className="text-[10px] text-slate-500">net profit</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Buy Price',    value: `$${selectedOpp.buyPrice.toFixed(4)}`  },
                    { label: 'Sell Price',   value: `$${selectedOpp.sellPrice.toFixed(4)}` },
                    { label: 'Gross Spread', value: `${selectedOpp.spread.toFixed(3)}%`, amber: true },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-800/50 rounded-lg p-2 text-center">
                      <p className="text-[9px] text-slate-500">{item.label}</p>
                      <p className={`text-xs font-bold ${(item as {amber?: boolean}).amber ? 'text-amber-400' : 'text-slate-200'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Spread Freshness Bar */}
            {selectedOpp && (
              <SpreadFreshnessBar detectedAt={selectedOpp.detectedAt} />
            )}

            {/* Triangle Route Detector */}
            {symbol && buyExchange && sellExchange && opps.length > 0 && (
              <TriangleRouteCard
                symbol={symbol}
                buyExchange={buyExchange}
                sellExchange={sellExchange}
                opps={opps}
              />
            )}

            {/* Contract Address Verifier */}
            {symbol && network && (
              <Card className="bg-slate-900 border-slate-800 p-4">
                <ContractAddressPanel symbol={symbol} network={network} />
              </Card>
            )}

            {/* Volume Validator */}
            {symbol && parseFloat(amountUsd) > 0 && (
              <Card className="bg-slate-900 border-slate-800 p-4">
                <VolumeValidatorPanel
                  symbol={symbol}
                  capitalUsd={parseFloat(amountUsd) || 0}
                  volume24hUsd={selectedOpp ? selectedOpp.volume24h * (selectedOpp.buyPrice || 1) : 0}
                  buyExchange={buyExchange}
                  sellExchange={sellExchange}
                />
              </Card>
            )}

            {/* Transfer Timer */}
            {network && (
              <Card className="bg-slate-900 border-slate-800 p-4">
                <TransferTimerPanel network={network} startedAt={transferStartedAt} />
              </Card>
            )}

            <ProfitPreview input={input} />

            {lastResult && (
              <Card className={`border p-4 space-y-3 ${lastResult.status === 'completed' ? 'bg-green-500/5 border-green-500/25' : 'bg-red-500/5 border-red-500/25'}`}>
                <div className="flex items-center gap-2">
                  {lastResult.status === 'completed'
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                  <p className="text-xs font-bold text-white">Trade {lastResult.status === 'completed' ? 'Executed' : 'Halted'}</p>
                </div>
                <PipelineTracker status={lastResult.status} />
                {lastResult.statusDetail && (
                  <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-800/40 rounded-lg p-2.5">{lastResult.statusDetail}</p>
                )}
                {lastResult.status === 'completed' && (
                  <p className={`text-base font-bold ${parseFloat(lastResult.netProfitUsd ?? '0') > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Net: {parseFloat(lastResult.netProfitUsd ?? '0') > 0 ? '+' : ''}${parseFloat(lastResult.netProfitUsd ?? '0').toFixed(2)}
                  </p>
                )}
              </Card>
            )}

            {/* Execution Log */}
            {executionLog.length > 0 && (
              <ExecutionLog entries={executionLog} />
            )}

            {/* Next Opportunity Recommender */}
            {lastResult && lastResult.status === 'completed' && opps.length > 0 && (
              <NextOpportunityCard
                opps={opps}
                lastTrade={lastResult}
                onSelect={(opp) => {
                  setSelectedOpp(opp)
                  setManualMode(false)
                  setLastResult(null)
                  setExecutionLog([])
                  setTransferStartedAt(null)
                }}
              />
            )}

            <div className="flex gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Full arbitrage pipeline: live price re-verification, contract address validation, volume slippage guard, spread freshness check, 11-point safety checklist, market buy, on-chain withdrawal, deposit confirmation wait, then market sell. Triangle routes show 3-exchange compound opportunities. Execution log records every step with timestamps.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{history.length} trade{history.length !== 1 ? 's' : ''} recorded</p>
            <button onClick={loadData} className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="w-10 h-10 text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm font-medium">No trades yet</p>
              <p className="text-slate-600 text-xs mt-1">Execute your first arbitrage trade to see history here.</p>
              <button onClick={() => setView('setup')} className="mt-4 px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold rounded-xl hover:bg-amber-500/30 transition-colors">
                Start a trade
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(trade => <TradeRow key={trade.id} trade={trade} onCancel={handleCancel} />)}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS VIEW ── */}
      {view === 'analytics' && (
        <AnalyticsView history={history} />
      )}
    </div>
  )
}
