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
  MoveRight, ChevronRight,
} from 'lucide-react'
import {
  executeBotTrade, getBotTradeHistory, cancelBotTrade,
  getEnabledExchangeKeys, fetchLivePricesForPair,
  type BotTradeRow,
} from '@/app/actions/arbitrage-bot'
import {
  computeProfitBreakdown, runSafetyChecks,
  type BotTradeInput, type SafetyCheck,
  NETWORK_SUPPORTED_COINS,
} from '@/lib/arb-bot-utils'
import { getMarketOpportunities } from '@/app/actions/arbitrage'

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

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Queued',      color: 'text-slate-400',  bg: 'bg-slate-700/40 border-slate-600/40'   },
  buying:     { label: 'Buying',      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25'     },
  withdrawing:{ label: 'Withdrawing', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25'   },
  depositing: { label: 'Depositing',  color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/25' },
  selling:    { label: 'Selling',     color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/25'     },
  completed:  { label: 'Completed',   color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25'   },
  failed:     { label: 'Failed',      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25'       },
}

const RISK_META: Record<string, { color: string; dot: string }> = {
  Low:      { color: 'text-green-400', dot: 'bg-green-400' },
  Medium:   { color: 'text-amber-400', dot: 'bg-amber-400' },
  High:     { color: 'text-red-400',   dot: 'bg-red-400'   },
  Critical: { color: 'text-rose-400',  dot: 'bg-rose-400 animate-pulse' },
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.pending
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-semibold ${m.color} ${m.bg}`}>
      {m.label}
    </span>
  )
}

function RiskChip({ level, score }: { level: string; score: number }) {
  const m = RISK_META[level] ?? RISK_META.Medium
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${m.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {level} <span className="opacity-50 font-normal">({score})</span>
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="text-slate-500 hover:text-slate-300 transition-colors">
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

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
  const [showAdvanced, setShowAdvanced] = useState(false)

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

  useEffect(() => { loadData() }, [loadData])

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
    setSafetyChecks(runSafetyChecks(input))
    setShowChecklist(true)
  }

  const handleExecute = async () => {
    const input = buildInput()
    if (!input) return
    setExecuting(true)
    try {
      const result = await executeBotTrade(input)
      setLastResult(result)
      setShowChecklist(false)
      await getBotTradeHistory(50).then(setHistory)
    } catch (err) {
      console.error('[ArbitrageBotPanel] execution error:', err)
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

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg leading-none">Arbitrage Bot</h2>
          <p className="text-slate-500 text-xs mt-0.5">Buy on one exchange, transfer via blockchain, sell on another</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(['setup', 'history', 'analytics'] as ViewTab[]).map(v => (
            <button key={v} onClick={() => { setView(v); if (v !== 'setup') loadData() }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border capitalize ${
                view === v ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {v === 'history' && history.length > 0
                ? <>History <span className="ml-0.5 text-[9px] bg-amber-500 text-black rounded-full px-1">{history.length}</span></>
                : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
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
                  <button onClick={() => setManualMode(true)} className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
                    Enter manually
                  </button>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Fetching live rates...
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

          {/* RIGHT: Opp details + profit preview + last result */}
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

            <div className="flex gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                The bot verifies live prices before execution, runs a safety checklist, places a market buy, withdraws via the chosen network, auto-fetches the deposit address on the sell exchange, then places a market sell. Slippage is baked into the profit estimate. Funds are never left in an incomplete state on failure.
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
