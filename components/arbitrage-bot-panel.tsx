'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowRightLeft, Play, Clock, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronUp, Zap, Shield, TrendingUp,
  Activity, Info, Loader2, Ban, Eye, EyeOff, Copy, Check,
  Network, Coins, DollarSign, BarChart2, Bot,
} from 'lucide-react'
import {
  executeBotTrade, getBotTradeHistory, cancelBotTrade,
  getEnabledExchangeKeys, computeProfitBreakdown,
  type BotTradeRow, type BotTradeInput,
} from '@/app/actions/arbitrage-bot'
import { getMarketOpportunities } from '@/app/actions/arbitrage'

type Opportunity = Awaited<ReturnType<typeof getMarketOpportunities>>[number]

// ── Constants ──────────────────────────────────────────────────────────────────

const NETWORKS = [
  { id: 'TRC20',     label: 'TRC20 (TRON)',       fee: '$1.0',  time: '~3m',  color: 'text-red-400'     },
  { id: 'BEP20',     label: 'BEP20 (BSC)',         fee: '$0.5',  time: '~3m',  color: 'text-yellow-400'  },
  { id: 'ERC20',     label: 'ERC20 (Ethereum)',    fee: '$8.0',  time: '~12m', color: 'text-blue-400'    },
  { id: 'SOL',       label: 'Solana',              fee: '$0.1',  time: '~1m',  color: 'text-purple-400'  },
  { id: 'Polygon',   label: 'Polygon (MATIC)',     fee: '$0.2',  time: '~3m',  color: 'text-violet-400'  },
  { id: 'Avalanche', label: 'Avalanche (AVAX)',    fee: '$0.5',  time: '~5m',  color: 'text-pink-400'    },
  { id: 'XRP',       label: 'XRP Ledger',          fee: '$0.5',  time: '~1m',  color: 'text-cyan-400'    },
  { id: 'BTC',       label: 'Bitcoin',             fee: '$5.0',  time: '~40m', color: 'text-orange-400'  },
]

const ALL_EXCHANGES = [
  'Binance', 'OKX', 'Bybit', 'KuCoin', 'Kraken', 'Coinbase', 'HTX',
  'Bitfinex', 'Gate.io', 'Gemini', 'Crypto.com', 'Bitget', 'MEXC',
  'Phemex', 'Poloniex', 'BingX', 'LBank', 'Upbit',
  'CoinDCX', 'CoinSwitch', 'WazirX', 'BitBns', 'ZebPay', 'Delta Exchange',
]

const STATUS_META: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending:    { label: 'Queued',      icon: Clock,          color: 'text-slate-400',  bg: 'bg-slate-700/40 border-slate-600/40'  },
  buying:     { label: 'Buying',      icon: Activity,       color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25'    },
  withdrawing:{ label: 'Withdrawing', icon: ArrowRightLeft, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25'  },
  depositing: { label: 'Depositing',  icon: Loader2,        color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/25'},
  selling:    { label: 'Selling',     icon: TrendingUp,     color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/25'    },
  completed:  { label: 'Completed',   icon: CheckCircle2,   color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25'  },
  failed:     { label: 'Failed',      icon: XCircle,        color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25'      },
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
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-semibold ${m.color} ${m.bg}`}>
      <Icon className={`w-3 h-3 ${status === 'depositing' ? 'animate-spin' : ''}`} />
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

function ProfitPreview({ input }: { input: BotTradeInput | null }) {
  if (!input || input.amountUsd <= 0) return null
  const p = computeProfitBreakdown(input)
  const isPositive = p.netProfitUsd > 0
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${isPositive ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profit Preview</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <p className="text-[10px] text-slate-500">Gross Profit</p>
          <p className="text-sm font-bold text-slate-200">${p.grossProfitUsd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Buy Fee</p>
          <p className="text-sm font-medium text-red-400">-${p.feeBuyUsd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Sell Fee</p>
          <p className="text-sm font-medium text-red-400">-${p.feeSellUsd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">Network Fee</p>
          <p className="text-sm font-medium text-red-400">-${p.feeNetworkUsd.toFixed(2)}</p>
        </div>
        <div className="col-span-2 border-t border-slate-700 pt-2 mt-0.5">
          <p className="text-[10px] text-slate-500">Net Profit</p>
          <p className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}${p.netProfitUsd.toFixed(2)}
            <span className="text-sm ml-1.5 font-medium opacity-80">({p.netProfitPct.toFixed(2)}%)</span>
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-500">Est. transfer time: ~{p.transferMins}m via selected network</p>
    </div>
  )
}

// ── Trade History Row ──────────────────────────────────────────────────────────
function TradeRow({ trade }: { trade: BotTradeRow }) {
  const [expanded, setExpanded] = useState(false)
  const netProfit = parseFloat(trade.netProfitUsd ?? '0')
  const isProfit  = netProfit > 0

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-sm">{trade.symbol}</span>
            <span className="text-slate-500 text-[10px]">{trade.buyExchange} → {trade.sellExchange}</span>
            <StatusBadge status={trade.status} />
            <RiskChip level={trade.riskLevel ?? 'Medium'} score={trade.riskScore ?? 50} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-slate-500">Capital: <span className="text-slate-300">${parseFloat(trade.amountUsd ?? '0').toFixed(0)}</span></span>
            <span className="text-[10px] text-slate-500">Network: <span className="text-slate-300">{trade.network}</span></span>
            <span className="text-[10px] text-slate-500">{new Date(trade.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className={`font-bold text-sm ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
              {isProfit ? '+' : ''}${netProfit.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-500">{parseFloat(trade.netProfitPct ?? '0').toFixed(2)}%</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
          {trade.statusDetail && (
            <p className="text-xs text-slate-400 mt-3 bg-slate-800/50 rounded-lg p-2.5 leading-relaxed">{trade.statusDetail}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <p className="text-[10px] text-slate-500">Buy Price</p>
              <p className="text-xs font-bold text-slate-200">${parseFloat(trade.buyPrice ?? '0').toFixed(4)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <p className="text-[10px] text-slate-500">Sell Price</p>
              <p className="text-xs font-bold text-slate-200">${parseFloat(trade.sellPrice ?? '0').toFixed(4)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <p className="text-[10px] text-slate-500">Gross Profit</p>
              <p className="text-xs font-bold text-slate-200">${parseFloat(trade.grossProfitUsd ?? '0').toFixed(2)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2.5">
              <p className="text-[10px] text-slate-500">Total Fees</p>
              <p className="text-xs font-bold text-red-400">
                -${(parseFloat(trade.feeBuyUsd ?? '0') + parseFloat(trade.feeSellUsd ?? '0') + parseFloat(trade.feeNetworkUsd ?? '0')).toFixed(2)}
              </p>
            </div>
          </div>
          {/* Transaction IDs */}
          {(trade.buyOrderId || trade.sellOrderId || trade.withdrawTxId) && (
            <div className="space-y-1.5">
              {trade.buyOrderId && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 w-24 shrink-0">Buy Order ID</span>
                  <span className="text-slate-300 font-mono truncate">{trade.buyOrderId}</span>
                  <CopyBtn text={trade.buyOrderId} />
                </div>
              )}
              {trade.sellOrderId && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 w-24 shrink-0">Sell Order ID</span>
                  <span className="text-slate-300 font-mono truncate">{trade.sellOrderId}</span>
                  <CopyBtn text={trade.sellOrderId} />
                </div>
              )}
              {trade.withdrawTxId && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-500 w-24 shrink-0">Withdraw TX</span>
                  <span className="text-slate-300 font-mono truncate">{trade.withdrawTxId}</span>
                  <CopyBtn text={trade.withdrawTxId} />
                </div>
              )}
            </div>
          )}
          {trade.errorMessage && (
            <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{trade.errorMessage}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ArbitrageBotPanel() {
  const [view, setView]               = useState<'setup' | 'history'>('setup')
  const [opps, setOpps]               = useState<Opportunity[]>([])
  const [history, setHistory]         = useState<BotTradeRow[]>([])
  const [enabledKeys, setEnabledKeys] = useState<{ exchange: string; label: string; isPublicOnly: boolean }[]>([])
  const [loading, setLoading]         = useState(true)
  const [executing, setExecuting]     = useState(false)
  const [lastResult, setLastResult]   = useState<BotTradeRow | null>(null)

  // Form state
  const [selectedOpp,  setSelectedOpp]  = useState<Opportunity | null>(null)
  const [manualMode,   setManualMode]   = useState(false)
  const [buyExchange,  setBuyExchange]  = useState('')
  const [sellExchange, setSellExchange] = useState('')
  const [symbol,       setSymbol]       = useState('')
  const [network,      setNetwork]      = useState('TRC20')
  const [amountUsd,    setAmountUsd]    = useState('')
  const [showPreview,  setShowPreview]  = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [oppsData, histData, keysData] = await Promise.all([
        getMarketOpportunities(),
        getBotTradeHistory(30),
        getEnabledExchangeKeys(),
      ])
      setOpps(oppsData)
      setHistory(histData)
      setEnabledKeys(keysData)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Auto-fill form when an opportunity is selected
  useEffect(() => {
    if (selectedOpp && !manualMode) {
      setBuyExchange(selectedOpp.buyExchange)
      setSellExchange(selectedOpp.sellExchange)
      setSymbol(selectedOpp.symbol)
    }
  }, [selectedOpp, manualMode])

  const buildInput = (): BotTradeInput | null => {
    const amt = parseFloat(amountUsd)
    if (!symbol || !buyExchange || !sellExchange || !network || isNaN(amt) || amt <= 0) return null
    const opp = opps.find(o => o.symbol === symbol && o.buyExchange === buyExchange && o.sellExchange === sellExchange)
    const buyPrice  = opp?.buyPrice  ?? 1
    const sellPrice = opp?.sellPrice ?? 1
    const amount    = amt / buyPrice
    return {
      symbol, network, buyExchange, sellExchange,
      buyPrice, sellPrice, amount, amountUsd: amt,
      riskLevel: opp?.risk ?? 'Medium',
      riskScore: opp?.risk === 'Low' ? 15 : opp?.risk === 'High' ? 65 : 35,
    }
  }

  const handleExecute = async () => {
    const input = buildInput()
    if (!input) return
    setExecuting(true)
    setLastResult(null)
    try {
      const result = await executeBotTrade(input)
      setLastResult(result)
      await getBotTradeHistory(30).then(setHistory)
    } catch (err) {
      console.error('[ArbitrageBotPanel] execution error:', err)
    } finally {
      setExecuting(false)
    }
  }

  const topOpps = opps.filter(o => o.netProfit > 0).slice(0, 12)
  const input   = buildInput()

  const authenticatedCount = enabledKeys.filter(k => !k.isPublicOnly).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg leading-none">Arbitrage Bot</h2>
          <p className="text-slate-500 text-sm mt-0.5">Transfer coins between exchanges via API to capture arbitrage spreads</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setView('setup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${view === 'setup' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
            New Trade
          </button>
          <button
            onClick={() => { setView('history'); loadData() }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${view === 'history' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
            History {history.length > 0 && <span className="ml-1 text-[10px] bg-amber-500 text-black rounded-full px-1">{history.length}</span>}
          </button>
        </div>
      </div>

      {/* API Key status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs ${authenticatedCount > 0 ? 'bg-green-500/5 border-green-500/20 text-green-300' : 'bg-amber-500/5 border-amber-500/20 text-amber-300'}`}>
        <Shield className="w-4 h-4 shrink-0" />
        {authenticatedCount > 0
          ? `${authenticatedCount} exchange${authenticatedCount > 1 ? 's' : ''} connected with authenticated API keys — live trading enabled.`
          : 'No authenticated API keys configured. Trades will run in simulation mode. Ask your admin to connect exchange API keys for live execution.'}
      </div>

      {/* ── SETUP VIEW ── */}
      {view === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Opportunity picker + form */}
          <div className="space-y-4">
            {/* Quick-pick from live opportunities */}
            {!manualMode && (
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Opportunities</p>
                  <button onClick={() => setManualMode(true)} className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
                    Enter manually
                  </button>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading live rates...
                  </div>
                ) : topOpps.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No profitable opportunities detected right now.</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {topOpps.map(opp => {
                      const isSelected = selectedOpp?.id === opp.id
                      return (
                        <button
                          key={opp.id}
                          onClick={() => setSelectedOpp(isSelected ? null : opp)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${isSelected ? 'bg-amber-500/15 border-amber-500/40' : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold text-xs">{opp.symbol}</span>
                              <span className="text-[10px] text-slate-500">{opp.buyExchange} → {opp.sellExchange}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                                opp.risk === 'Low' ? 'text-green-400 bg-green-500/10 border-green-500/25' :
                                opp.risk === 'High' ? 'text-red-400 bg-red-500/10 border-red-500/25' :
                                'text-amber-400 bg-amber-500/10 border-amber-500/25'
                              }`}>{opp.risk}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Buy ${opp.buyPrice.toFixed(4)} &rarr; Sell ${opp.sellPrice.toFixed(4)}
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
            )}

            {/* Manual mode toggle */}
            {manualMode && (
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Manual Entry</p>
                  <button onClick={() => setManualMode(false)} className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
                    Use live opportunities
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1 block">Coin Symbol</label>
                    <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
                      placeholder="USDT, BTC..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-amber-500/50" />
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

            {/* Network + Capital form */}
            <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transfer Settings</p>

              {/* Network selector */}
              <div>
                <label className="text-[10px] text-slate-400 mb-1.5 block">Transfer Network</label>
                <div className="grid grid-cols-2 gap-2">
                  {NETWORKS.map(n => (
                    <button key={n.id}
                      onClick={() => setNetwork(n.id)}
                      className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${network === n.id ? 'bg-amber-500/15 border-amber-500/40' : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'}`}
                    >
                      <Network className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${n.color}`} />
                      <div className="min-w-0">
                        <p className="text-white text-[10px] font-semibold leading-none truncate">{n.id}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{n.fee} &bull; {n.time}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Capital input */}
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Capital to Deploy (USD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="number" min="10" step="10" value={amountUsd}
                    onChange={e => setAmountUsd(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 250, 500, 1000].map(v => (
                    <button key={v} onClick={() => setAmountUsd(String(v))}
                      className="flex-1 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:border-amber-500/40 text-slate-400 hover:text-amber-400 text-[10px] font-medium transition-colors">
                      ${v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Execute button */}
              <Button
                onClick={handleExecute}
                disabled={executing || !input}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {executing
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Executing Trade...</>
                  : <><Play className="w-4 h-4 mr-2" /> Execute Arbitrage</>}
              </Button>

              {!input && (buyExchange || sellExchange || symbol) && (
                <p className="text-[10px] text-slate-500 text-center">Select an opportunity or fill in all fields + capital to continue.</p>
              )}
            </Card>
          </div>

          {/* Right: Profit preview + last result */}
          <div className="space-y-4">
            {/* Selected opportunity details */}
            {selectedOpp && !manualMode && (
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selected Opportunity</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
                    {selectedOpp.symbol.slice(0, 2)}
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
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-slate-500">Buy Price</p>
                    <p className="text-xs font-bold text-slate-200">${selectedOpp.buyPrice.toFixed(4)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-slate-500">Sell Price</p>
                    <p className="text-xs font-bold text-slate-200">${selectedOpp.sellPrice.toFixed(4)}</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-slate-500">Spread</p>
                    <p className="text-xs font-bold text-amber-400">{selectedOpp.spread.toFixed(3)}%</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Profit preview */}
            {showPreview && <ProfitPreview input={input} />}
            {!showPreview && input && (
              <button onClick={() => setShowPreview(true)} className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
                Show profit preview
              </button>
            )}

            {/* Last result */}
            {lastResult && (
              <Card className={`border p-4 space-y-2 ${lastResult.status === 'completed' ? 'bg-green-500/5 border-green-500/25' : 'bg-red-500/5 border-red-500/25'}`}>
                <div className="flex items-center gap-2">
                  {lastResult.status === 'completed'
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                  <p className="text-xs font-bold text-white">Trade {lastResult.status === 'completed' ? 'Executed' : 'Failed'}</p>
                </div>
                {lastResult.statusDetail && <p className="text-[10px] text-slate-400 leading-relaxed">{lastResult.statusDetail}</p>}
                {lastResult.status === 'completed' && (
                  <p className={`text-sm font-bold ${parseFloat(lastResult.netProfitUsd ?? '0') > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Net: {parseFloat(lastResult.netProfitUsd ?? '0') > 0 ? '+' : ''}${parseFloat(lastResult.netProfitUsd ?? '0').toFixed(2)}
                  </p>
                )}
              </Card>
            )}

            {/* Info box */}
            <div className="flex gap-2.5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                The bot places a buy order on the source exchange, withdraws the coin via the selected network, deposits on the destination exchange, then places a sell order. Execution requires authenticated API keys — contact your admin to connect them.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY VIEW ── */}
      {view === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{history.length} trade{history.length !== 1 ? 's' : ''} in history</p>
            <button onClick={loadData} className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-amber-400 transition-colors">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading trade history...
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
            <>
              {/* Stats summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Trades',   value: history.length.toString(),                                                          color: 'text-white'       },
                  { label: 'Completed',       value: history.filter(t => t.status === 'completed').length.toString(),                   color: 'text-green-400'   },
                  { label: 'Failed',          value: history.filter(t => t.status === 'failed').length.toString(),                      color: 'text-red-400'     },
                  { label: 'Total Profit',    value: `$${history.reduce((s,t) => s + parseFloat(t.netProfitUsd ?? '0'), 0).toFixed(2)}`, color: 'text-amber-400'  },
                ].map(s => (
                  <Card key={s.label} className="bg-slate-900 border-slate-800 p-3 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
                    <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </Card>
                ))}
              </div>
              <div className="space-y-2">
                {history.map(trade => <TradeRow key={trade.id} trade={trade} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
