'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import {
  adminFetchLivePrices, testExchangeConnection, testAllExchanges,
  getExchangeApiKeys, saveExchangeApiKey, toggleExchangeEnabled,
  generateAiArbitrageStrategy, getSavedAiStrategy, getTransferRoutes,
  getExchangeBalances, executeExchangeTransfer, getTransferHistory,
  AdminLivePrice, AdminArbitrageOpp, ExchangeStatus, ExchangeApiKey,
  AiArbitrageStrategy, TransferRoute, ExchangeBalance, TransferLog,
} from '@/app/actions/admin-arbitrage'
import {
  Activity, RefreshCw, CheckCircle2, XCircle, Wifi, WifiOff,
  ArrowRightLeft, TrendingUp, Zap, Filter, Clock, AlertTriangle,
  Network, BarChart3, Search, Settings, Play, Pause, Key, Eye,
  EyeOff, Save, TestTube2, Bot, Sparkles, ChevronRight,
  ShieldCheck, ToggleLeft, ToggleRight, DollarSign, SendHorizonal,
  Wallet, ChevronDown, History, Copy, ExternalLink, Loader2, Link2,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

type SubTab = 'live-scan' | 'exchange-connections' | 'balances' | 'ai-strategy' | 'transfer' | 'transfer-routes' | 'settings'

const SCAN_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX',
  'LINK', 'MATIC', 'DOT', 'ATOM', 'UNI', 'LTC', 'NEAR', 'AAVE',
  'CRV', 'SHIB', 'PEPE', 'TON', 'FET', 'RENDER', 'ARB', 'OP', 'SUI',
]

const EXCHANGE_COLORS: Record<string, string> = {
  binance:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  kraken:    'bg-purple-500/20 text-purple-300 border-purple-500/30',
  coinbase:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  bybit:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  kucoin:    'bg-green-500/20 text-green-300 border-green-500/30',
  htx:       'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  bitfinex:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  okx:       'bg-slate-500/20 text-slate-300 border-slate-600',
  gateio:    'bg-red-500/20 text-red-300 border-red-500/30',
  gemini:    'bg-sky-500/20 text-sky-300 border-sky-500/30',
  cryptocom: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  bitget:    'bg-teal-500/20 text-teal-300 border-teal-500/30',
  coingecko: 'bg-lime-500/20 text-lime-300 border-lime-500/30',
}

const EXCHANGE_ABBR: Record<string, string> = {
  binance: 'BN', kraken: 'KR', coinbase: 'CB', bybit: 'BB',
  kucoin: 'KC', htx: 'HT', bitfinex: 'BFX', okx: 'OKX',
  gateio: 'GT', gemini: 'GM', cryptocom: 'CDC', bitget: 'BG',
  coingecko: 'CG',
}

// ── Shared small components ───────────────────────────────────────────────────

function ExchangeBadge({ exchange }: { exchange: string }) {
  const key = exchange.toLowerCase().replace(/[\s.]/g, '')
  const color = EXCHANGE_COLORS[key] ?? 'bg-slate-700 text-slate-300 border-slate-600'
  const abbr  = EXCHANGE_ABBR[key]  ?? exchange.slice(0, 2).toUpperCase()
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-bold tracking-wide ${color}`}>
      {abbr}
    </span>
  )
}

function ProfitBadge({ pct }: { pct: number }) {
  const color = pct >= 1.5 ? 'bg-green-500/20 text-green-300 border-green-500/30'
    : pct >= 0.8 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-slate-700/60 text-slate-400 border-slate-600'
  return <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${color}`}>+{pct.toFixed(3)}%</span>
}

function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    Low:    'text-green-400 bg-green-500/10 border-green-500/20',
    Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    High:   'text-red-400 bg-red-500/10 border-red-500/20',
  }
  return <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${colors[risk] ?? colors.Medium}`}>{risk}</span>
}

function StatusDot({ ok, idle }: { ok?: boolean; idle?: boolean }) {
  if (idle) return <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
  return ok
    ? <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
    : <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
}

function LatencyChip({ ms }: { ms: number }) {
  const color = ms < 300 ? 'text-green-400' : ms < 800 ? 'text-amber-400' : 'text-red-400'
  return <span className={`text-[11px] font-mono ${color}`}>{ms}ms</span>
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function AdminArbitragePanel() {
  const [subTab, setSubTab] = useState<SubTab>('live-scan')

  // Live scan
  const [scanning, setScanning] = useState(false)
  const [autoScan, setAutoScan] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [prices, setPrices] = useState<AdminLivePrice[]>([])
  const [opportunities, setOpportunities] = useState<AdminArbitrageOpp[]>([])
  const [exchangeStatuses, setExchangeStatuses] = useState<ExchangeStatus[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [filterSymbol, setFilterSymbol] = useState('')
  const [filterMinProfit, setFilterMinProfit] = useState(0)
  const [filterBuyEx, setFilterBuyEx] = useState('')
  const [filterSellEx, setFilterSellEx] = useState('')
  const [sortByProfit, setSortByProfit] = useState<'asc' | 'desc'>('desc')
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(SCAN_SYMBOLS.slice(0, 15))
  const [minProfitThreshold, setMinProfitThreshold] = useState(0.3)
  const [autoScanInterval, setAutoScanInterval] = useState(30)

  // Exchange connections
  const [apiKeys, setApiKeys] = useState<ExchangeApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [editingExchange, setEditingExchange] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ apiKey: '', apiSecret: '', passphrase: '', note: '', isEnabled: true, isPublicOnly: true })
  const [testingExchange, setTestingExchange] = useState<string | null>(null)
  const [testingAll, setTestingAll] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs: number; message: string }>>({})
  const [savingExchange, setSavingExchange] = useState(false)

  // AI strategy
  const [aiStrategy, setAiStrategy] = useState<AiArbitrageStrategy | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiContext, setAiContext] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)

  // Transfer routes (route planner tab)
  const [trFrom, setTrFrom] = useState('Binance')
  const [trTo, setTrTo] = useState('Kraken')
  const [trSymbol, setTrSymbol] = useState('USDT')
  const [routes, setRoutes] = useState<TransferRoute[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)

  // Transfer execution tab
  const [txFromEx, setTxFromEx] = useState('binance')
  const [txToEx, setTxToEx] = useState('kraken')
  const [txSymbol, setTxSymbol] = useState('USDT')
  const [txNetwork, setTxNetwork] = useState('TRC20')
  const [txAmount, setTxAmount] = useState('')
  const [txAddress, setTxAddress] = useState('')
  const [txMemo, setTxMemo] = useState('')
  const [txBalances, setTxBalances] = useState<ExchangeBalance[]>([])
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [txSubmitting, setTxSubmitting] = useState(false)
  const [txResult, setTxResult] = useState<{ success: boolean; message: string; txId?: string } | null>(null)
  const [txHistory, setTxHistory] = useState<TransferLog[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [txConfirmOpen, setTxConfirmOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const COIN_NETWORKS: Record<string, string[]> = {
    USDT: ['TRC20','BEP20','ERC20','SOL'],
    BTC:  ['BTC'],
    ETH:  ['ERC20'],
    BNB:  ['BEP20'],
    SOL:  ['SOL'],
    XRP:  ['XRP'],
    DOGE: ['DOGE'],
    ADA:  ['ADA'],
    AVAX: ['AVAX-C'],
    MATIC:['MATIC'],
    LINK: ['ERC20','BEP20'],
    LTC:  ['LTC'],
    TRX:  ['TRC20'],
  }
  const EXCHANGE_LIST = [
    { value: 'binance',  label: 'Binance'    },
    { value: 'kucoin',   label: 'KuCoin'     },
    { value: 'bybit',    label: 'Bybit'      },
    { value: 'okx',      label: 'OKX'        },
    { value: 'kraken',   label: 'Kraken'     },
    { value: 'bitget',   label: 'Bitget'     },
    { value: 'coinbase', label: 'Coinbase'   },
    { value: 'gateio',   label: 'Gate.io'    },
    { value: 'bitfinex', label: 'Bitfinex'   },
    { value: 'gemini',   label: 'Gemini'     },
    { value: 'htx',      label: 'HTX'        },
    { value: 'cryptocom',label: 'Crypto.com' },
  ]
  const ALL_COINS = ['USDT','BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','MATIC','LINK','LTC','TRX','DOT','ATOM','UNI']

  // Balances tab state
  const [allBalances, setAllBalances] = useState<Record<string, ExchangeBalance[]>>({})
  const [loadingAllBalances, setLoadingAllBalances] = useState(false)
  const [selectedExchangeForBalance, setSelectedExchangeForBalance] = useState<string | null>(null)

  async function loadAllExchangeBalances() {
    setLoadingAllBalances(true)
    const result: Record<string, ExchangeBalance[]> = {}
    for (const ex of apiKeys.filter(k => k.isEnabled)) {
      try {
        const bals = await getExchangeBalances(ex.exchange)
        result[ex.exchange] = bals
      } catch {
        result[ex.exchange] = []
      }
    }
    setAllBalances(result)
    setLoadingAllBalances(false)
  }

  async function loadBalances() {
    setLoadingBalances(true)
    try {
      const bal = await getExchangeBalances(txFromEx)
      setTxBalances(bal)
    } catch { setTxBalances([]) }
    finally { setLoadingBalances(false) }
  }

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const h = await getTransferHistory(30)
      setTxHistory(h)
    } catch { setTxHistory([]) }
    finally { setLoadingHistory(false) }
  }

  async function handleTransferSubmit() {
    setTxSubmitting(true)
    setTxResult(null)
    try {
      const result = await executeExchangeTransfer({
        fromExchange: txFromEx,
        toExchange:   txToEx,
        symbol:       txSymbol,
        network:      txNetwork,
        amount:       parseFloat(txAmount),
        toAddress:    txAddress,
        ...(txMemo ? { memo: txMemo } : {}),
      })
      setTxResult(result)
      if (result.success) {
        setTxAmount('')
        setTxAddress('')
        setTxMemo('')
        loadHistory()
      }
    } catch (err) {
      setTxResult({ success: false, message: err instanceof Error ? err.message : 'Unknown error' })
    }
    setTxSubmitting(false)
    setTxConfirmOpen(false)
  }

  // ── Load data when tab opens ──────────────────────────────────────────────
  useEffect(() => {
    if (subTab === 'exchange-connections' && apiKeys.length === 0) {
      loadApiKeys()
    }
    if (subTab === 'ai-strategy' && !aiStrategy) {
      getSavedAiStrategy().then(s => { if (s) setAiStrategy(s) }).catch(() => {})
    }
    if (subTab === 'balances') {
      loadAllExchangeBalances()
    }
    if (subTab === 'transfer') {
      loadHistory()
    }
  }, [subTab])

  useEffect(() => {
    if (subTab === 'transfer') loadBalances()
  }, [txFromEx, subTab])

  async function loadApiKeys() {
    setLoadingKeys(true)
    try {
      const keys = await getExchangeApiKeys()
      setApiKeys(keys)
    } finally {
      setLoadingKeys(false)
    }
  }

  // ── Live scan ────────────────────────────────────────────────────���────────
  const runScan = useCallback(async () => {
    setScanError(null)
    setScanning(true)
    try {
      const result = await adminFetchLivePrices(selectedSymbols)
      setPrices(result.prices)
      setOpportunities(result.opportunities)
      setExchangeStatuses(result.exchangeStatuses)
      setLastScan(new Date().toLocaleTimeString())
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [selectedSymbols])

  useEffect(() => {
    if (!autoScan) return
    const id = setInterval(runScan, autoScanInterval * 1000)
    return () => clearInterval(id)
  }, [autoScan, autoScanInterval, runScan])

  // ── Exchange connection test ──────────────────────────────────────────────
  async function handleTestOne(exchange: string) {
    setTestingExchange(exchange)
    try {
      const res = await testExchangeConnection(exchange)
      setTestResults(prev => ({ ...prev, [exchange]: res }))
      await loadApiKeys()
    } finally {
      setTestingExchange(null)
    }
  }

  async function handleTestAll() {
    setTestingAll(true)
    try {
      const res = await testAllExchanges()
      setTestResults(res)
      await loadApiKeys()
    } finally {
      setTestingAll(false)
    }
  }

  async function handleToggleEnabled(exchange: string, current: boolean) {
    await toggleExchangeEnabled(exchange, !current)
    setApiKeys(prev => prev.map(k => k.exchange === exchange ? { ...k, isEnabled: !current } : k))
  }

  async function handleSaveApiKey() {
    if (!editingExchange) return
    setSavingExchange(true)
    try {
      await saveExchangeApiKey({
        exchange: editingExchange,
        apiKey: editForm.apiKey || undefined,
        apiSecret: editForm.apiSecret || undefined,
        passphrase: editForm.passphrase || undefined,
        isEnabled: editForm.isEnabled,
        isPublicOnly: editForm.isPublicOnly,
        note: editForm.note || undefined,
      })
      await loadApiKeys()
      setEditingExchange(null)
    } finally {
      setSavingExchange(false)
    }
  }

  // ── AI strategy ───────────────────────────────────────────────────────────
  async function handleGenerateStrategy() {
    setGeneratingAi(true)
    setAiError(null)
    try {
      const strategy = await generateAiArbitrageStrategy(aiContext || undefined)
      setAiStrategy(strategy)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGeneratingAi(false)
    }
  }

  // ── Transfer routes ───────────────────────────────────────────────────────
  async function handleLoadRoutes() {
    setLoadingRoutes(true)
    try {
      const r = await getTransferRoutes(trFrom, trTo, trSymbol)
      setRoutes(r)
    } finally {
      setLoadingRoutes(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = opportunities
    .filter(o => {
      if (filterSymbol && !o.symbol.toUpperCase().includes(filterSymbol.toUpperCase())) return false
      if (o.netProfitPct < filterMinProfit) return false
      if (filterBuyEx  && !o.buyExchange.toLowerCase().includes(filterBuyEx.toLowerCase()))  return false
      if (filterSellEx && !o.sellExchange.toLowerCase().includes(filterSellEx.toLowerCase())) return false
      return true
    })
    .sort((a, b) => sortByProfit === 'desc' ? b.netProfitPct - a.netProfitPct : a.netProfitPct - b.netProfitPct)

  const onlineCount  = exchangeStatuses.filter(e => e.online).length
  const totalPrices  = prices.length

  const KNOWN_EXCHANGES_LIST = [
    'binance','kraken','coinbase','bybit','kucoin','htx','bitfinex','okx','gateio','gemini','cryptocom','bitget',
  ]

  const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
    { key: 'live-scan',               label: 'Live Scan',          icon: Activity         },
    { key: 'exchange-connections',label: 'API Connections',   icon: Key          },
    { key: 'balances',            label: 'Balances',          icon: Wallet       },
    { key: 'ai-strategy',         label: 'AI Auto Setup',     icon: Bot          },
    { key: 'transfer',            label: 'Transfer',          icon: SendHorizonal},
    { key: 'transfer-routes',     label: 'Routes',            icon: ArrowRightLeft},
    { key: 'settings',            label: 'Settings',          icon: Settings     },
  ]

  return (
    <div className="space-y-4">

      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-slate-900/60 rounded-xl border border-slate-800 p-1 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              subTab === t.key
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ LIVE SCAN TAB ══════════════════════════════════════════════════ */}
      {subTab === 'live-scan' && (
        <div className="space-y-4">

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold rounded-lg text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning 12 exchanges...' : 'Run Live Scan'}
            </button>
            <button
              onClick={() => setAutoScan(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                autoScan
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {autoScan ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {autoScan ? `Auto ON (${autoScanInterval}s)` : 'Auto-Scan'}
            </button>
            <div className="ml-auto flex items-center gap-4 text-xs">
              {lastScan && <span className="text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {lastScan}</span>}
              {onlineCount > 0 && <span className="text-green-400 flex items-center gap-1.5"><StatusDot ok />{onlineCount}/13 online</span>}
              {totalPrices > 0 && <span className="text-slate-500">{totalPrices} price pts</span>}
            </div>
          </div>

          {scanError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {scanError}
            </div>
          )}

          {/* Live stats row */}
          {opportunities.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Opportunities',  value: filtered.length.toString(),                              color: 'text-amber-400' },
                { label: 'Best Spread',    value: `+${(filtered[0]?.netProfitPct ?? 0).toFixed(3)}%`,     color: 'text-green-400' },
                { label: 'Best $ / 1k',    value: `$${(filtered[0]?.profitPer1k ?? 0).toFixed(2)}`,       color: 'text-green-400' },
                { label: 'Exchanges Live', value: `${onlineCount} / 13`,                                   color: 'text-cyan-400'  },
              ].map(stat => (
                <Card key={stat.label} className="bg-slate-900 border-slate-800 p-3 text-center">
                  <p className="text-slate-500 text-xs mb-1">{stat.label}</p>
                  <p className={`font-bold text-lg ${stat.color}`}>{stat.value}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Filters */}
          <Card className="bg-slate-900 border-slate-800 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Coin</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)}
                    placeholder="BTC, ETH..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Min Profit %</label>
                <input type="number" min="0" step="0.1" value={filterMinProfit}
                  onChange={e => setFilterMinProfit(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Buy Exchange</label>
                <input value={filterBuyEx} onChange={e => setFilterBuyEx(e.target.value)}
                  placeholder="Binance..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Sort</label>
                <select value={sortByProfit} onChange={e => setSortByProfit(e.target.value as 'asc' | 'desc')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50">
                  <option value="desc">Highest profit first</option>
                  <option value="asc">Lowest profit first</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Opportunities table */}
          {filtered.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 p-12 text-center">
              <Activity className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">
                {opportunities.length === 0 ? 'Click "Run Live Scan" to fetch live prices from all 13 sources including CoinGecko' : 'No opportunities match your filters'}
              </p>
              {opportunities.length === 0 && (
                <p className="text-slate-600 text-xs mt-2">
                  Sources: Binance · Kraken · Coinbase · Bybit · KuCoin · HTX · Bitfinex · OKX · Gate.io · Gemini · Crypto.com · Bitget · CoinGecko
                </p>
              )}
            </Card>
          ) : (
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-left">
                      <th className="px-4 py-3 font-medium">Symbol</th>
                      <th className="px-4 py-3 font-medium">Buy From</th>
                      <th className="px-4 py-3 font-medium text-right">Buy Price</th>
                      <th className="px-4 py-3 font-medium">Sell To</th>
                      <th className="px-4 py-3 font-medium text-right">Sell Price</th>
                      <th className="px-4 py-3 font-medium text-right">Spread</th>
                      <th className="px-4 py-3 font-medium text-right">Net Profit</th>
                      <th className="px-4 py-3 font-medium text-right">$ / 1k</th>
                      <th className="px-4 py-3 font-medium text-right">Detected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filtered.map(opp => (
                      <tr key={opp.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-white font-bold">{opp.symbol}</span>
                          <span className="text-slate-600">/USDT</span>
                        </td>
                        <td className="px-4 py-3"><ExchangeBadge exchange={opp.buyExchange} /></td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">
                          ${opp.buyPrice < 1 ? opp.buyPrice.toFixed(6) : opp.buyPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-4 py-3"><ExchangeBadge exchange={opp.sellExchange} /></td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300">
                          ${opp.sellPrice < 1 ? opp.sellPrice.toFixed(6) : opp.sellPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-4 py-3 text-right"><span className="text-cyan-400 font-semibold">+{opp.profitPct.toFixed(3)}%</span></td>
                        <td className="px-4 py-3 text-right"><ProfitBadge pct={opp.netProfitPct} /></td>
                        <td className="px-4 py-3 text-right"><span className="text-green-400 font-bold">+${opp.profitPer1k.toFixed(2)}</span></td>
                        <td className="px-4 py-3 text-right text-slate-500">{new Date(opp.detectedAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Exchange status mini-grid (below table) */}
          {exchangeStatuses.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-2 font-medium uppercase tracking-wider">Exchange Connectivity</p>
              <div className="flex flex-wrap gap-2">
                {exchangeStatuses.map(ex => (
                  <div key={ex.name}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                      ex.online ? 'bg-green-500/5 border-green-500/20 text-green-300' : 'bg-red-500/5 border-red-500/20 text-red-400'
                    }`}
                  >
                    <StatusDot ok={ex.online} />
                    {ex.label}
                    {ex.pricesFetched > 0 && <span className="text-slate-600 font-normal">({ex.pricesFetched})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ EXCHANGE API CONNECTIONS TAB ═══════════════════════════════════ */}
      {subTab === 'exchange-connections' && (
        <div className="space-y-4">
          {/* Header section */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                Exchange API Connections
              </h3>
              <p className="text-slate-500 text-xs mt-2">Connect and manage your exchange API keys for automated trading and data fetching. Test connections regularly.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleTestAll} disabled={testingAll}
                className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold rounded-lg text-xs transition-colors">
                <TestTube2 className={`w-4 h-4 ${testingAll ? 'animate-spin' : ''}`} />
                {testingAll ? 'Testing...' : 'Test All'}
              </button>
            </div>
          </div>

          {loadingKeys ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-slate-900 border-slate-800 p-5 animate-pulse h-40" />
              ))}
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(() => {
                  const connected = apiKeys.filter(k => k.apiKey && k.isEnabled).length
                  const total = apiKeys.length
                  const online = Object.values(testResults).filter(r => r?.ok).length
                  return (
                    <>
                      <Card className="bg-slate-900 border-slate-800 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                            <Key className="w-5 h-5 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Configured</p>
                            <p className="text-white font-bold text-lg">{connected}/{total}</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="bg-slate-900 border-slate-800 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                            <Wifi className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Online</p>
                            <p className="text-white font-bold text-lg">{online}</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="bg-slate-900 border-slate-800 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Enabled</p>
                            <p className="text-white font-bold text-lg">{apiKeys.filter(k => k.isEnabled).length}</p>
                          </div>
                        </div>
                      </Card>
                    </>
                  )
                })()}
              </div>

              {/* Exchanges grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {apiKeys.map(ex => {
                  const keyResult = testResults[ex.exchange]
                  const liveStatus = keyResult ?? (ex.lastTestStatus ? { ok: ex.lastTestStatus === 'ok', latencyMs: ex.lastTestMs ?? 0, message: '' } : null)
                  const hasKeys = !!ex.apiKey
                  const isOnline = liveStatus?.ok === true
                  const isFailing = liveStatus?.ok === false

                  return (
                    <Card key={ex.exchange}
                      className={`border transition-all ${
                        isOnline  ? 'bg-slate-900 border-green-500/30' :
                        isFailing ? 'bg-slate-900 border-red-500/30'   :
                        'bg-slate-900 border-slate-800'
                      }`}
                    >
                      {/* Card header */}
                      <div className="flex items-center justify-between p-5 border-b border-slate-800">
                        <div className="flex items-center gap-3.5">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black border ${
                            EXCHANGE_COLORS[ex.exchange] ?? 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {EXCHANGE_ABBR[ex.exchange] ?? ex.label.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{ex.label}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                ex.isPublicOnly
                                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              }`}>
                                {ex.isPublicOnly ? 'Public API' : 'Authenticated'}
                              </span>
                              {ex.note && <span className="text-slate-600 text-[10px]">{ex.note}</span>}
                            </div>
                          </div>
                        </div>
                        {/* Enable/disable toggle */}
                        <button onClick={() => handleToggleEnabled(ex.exchange, ex.isEnabled)}
                          className="text-slate-400 hover:text-white transition-colors p-1.5">
                          {ex.isEnabled
                            ? <ToggleRight className="w-6 h-6 text-green-400" />
                            : <ToggleLeft className="w-6 h-6 text-slate-600" />
                          }
                        </button>
                      </div>

                      {/* Card body */}
                      <div className="p-5 space-y-3">
                        {/* Status indicator */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isOnline ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-green-400 font-semibold text-xs">Online & Ready</span>
                              </>
                            ) : isFailing ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                <span className="text-red-400 font-semibold text-xs">Connection Failed</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 rounded-full bg-slate-600" />
                                <span className="text-slate-400 font-semibold text-xs">Not Tested</span>
                              </>
                            )}
                          </div>
                          {liveStatus?.latencyMs ? (
                            <span className="text-[10px] text-slate-500 font-mono">{liveStatus.latencyMs}ms</span>
                          ) : null}
                        </div>

                        {/* API key status */}
                        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-slate-600" />
                            <div>
                              <p className="text-slate-400 text-xs">API Key</p>
                              {hasKeys && ex.apiKey ? (
                                <p className="text-amber-400 font-mono text-[10px]">{ex.apiKey.slice(0, 8)}...{ex.apiKey.slice(-4)}</p>
                              ) : (
                                <p className="text-slate-600 text-xs italic">Not configured</p>
                              )}
                            </div>
                          </div>
                          {hasKeys && (
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                          )}
                        </div>

                        {/* Last tested */}
                        {ex.lastTestedAt && (
                          <div className="text-[10px] text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last tested: {new Date(ex.lastTestedAt).toLocaleTimeString()}
                          </div>
                        )}

                        {/* Error message if any */}
                        {liveStatus?.message && (
                          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-xs">
                            {liveStatus.message}
                          </div>
                        )}
                      </div>

                      {/* Card footer - Actions */}
                      <div className="flex gap-2 p-5 border-t border-slate-800">
                        <button
                          onClick={() => handleTestOne(ex.exchange)}
                          disabled={testingExchange === ex.exchange}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          <TestTube2 className={`w-3.5 h-3.5 ${testingExchange === ex.exchange ? 'animate-spin' : ''}`} />
                          {testingExchange === ex.exchange ? 'Testing' : 'Test'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingExchange(ex.exchange)
                            setEditForm({ apiKey: '', apiSecret: '', passphrase: '', note: ex.note ?? '', isEnabled: ex.isEnabled, isPublicOnly: ex.isPublicOnly })
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 text-xs font-medium rounded-lg transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Configure
                        </button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          )}

          {/* Edit modal */}
          {editingExchange && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <Card className="bg-[#0E1324] border-slate-700 p-6 w-full max-w-md space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    Configure {apiKeys.find(k => k.exchange === editingExchange)?.label}
                  </h3>
                  <button onClick={() => setEditingExchange(null)} className="text-slate-400 hover:text-white text-lg leading-none">&times;</button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">API Key <span className="text-slate-600">(optional — leave blank to keep existing)</span></label>
                    <input type="password" value={editForm.apiKey} onChange={e => setEditForm(p => ({ ...p, apiKey: e.target.value }))}
                      placeholder="Enter API key..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">API Secret</label>
                    <input type="password" value={editForm.apiSecret} onChange={e => setEditForm(p => ({ ...p, apiSecret: e.target.value }))}
                      placeholder="Enter API secret..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Passphrase <span className="text-slate-600">(KuCoin, OKX, Bitget)</span></label>
                    <input type="password" value={editForm.passphrase} onChange={e => setEditForm(p => ({ ...p, passphrase: e.target.value }))}
                      placeholder="Enter passphrase..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 font-mono" />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-400">Public API Only (no trading)</label>
                    <button onClick={() => setEditForm(p => ({ ...p, isPublicOnly: !p.isPublicOnly }))}
                      className="text-slate-400 hover:text-white">
                      {editForm.isPublicOnly
                        ? <ToggleRight className="w-6 h-6 text-green-400" />
                        : <ToggleLeft className="w-6 h-6 text-slate-600" />
                      }
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Note</label>
                    <input value={editForm.note} onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                      placeholder="Optional note..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setEditingExchange(null)}
                    className="flex-1 py-2 border border-slate-700 text-slate-400 rounded-lg text-sm hover:text-white hover:border-slate-500 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSaveApiKey} disabled={savingExchange}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-60">
                    <Save className="w-3.5 h-3.5" />
                    {savingExchange ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ══ BALANCES TAB ═════════════════════════════════════════════════════ */}
      {subTab === 'balances' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyan-400" /> Exchange Balances & Portfolio
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Real-time balances from all connected exchanges</p>
            </div>
            <button onClick={loadAllExchangeBalances} disabled={loadingAllBalances}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold rounded-lg text-xs transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAllBalances ? 'animate-spin' : ''}`} />
              {loadingAllBalances ? 'Loading...' : 'Refresh All'}
            </button>
          </div>

          {loadingAllBalances && Object.keys(allBalances).length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 p-12 text-center">
              <Loader2 className="w-8 h-8 text-slate-500 mx-auto mb-3 animate-spin" />
              <p className="text-slate-400 text-sm">Loading balances from all exchanges...</p>
            </Card>
          ) : Object.keys(allBalances).length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 p-12 text-center">
              <Wallet className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No balances available</p>
              <p className="text-slate-600 text-xs mt-2">
                Enable and test exchanges in the <button onClick={() => setSubTab('exchange-connections')} className="text-cyan-400 hover:underline font-medium">API Connections</button> tab first
              </p>
            </Card>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(() => {
                  let totalCoins = 0; let totalValue = 0; let enabledEx = 0
                  Object.entries(allBalances).forEach(([_, bals]) => {
                    totalCoins += bals.filter(b => b.total > 0).length
                    totalValue += bals.reduce((s, b) => s + (b.usdValue || 0), 0)
                    enabledEx++
                  })
                  return [
                    { label: 'Total USD Value', value: `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-green-400' },
                    { label: 'Active Exchanges', value: enabledEx, icon: Link2, color: 'text-blue-400' },
                    { label: 'Coins Held', value: totalCoins, icon: TrendingUp, color: 'text-amber-400' },
                    { label: 'Last Updated', value: new Date().toLocaleTimeString(), icon: Clock, color: 'text-slate-400' },
                  ].map((stat, i) => (
                    <Card key={i} className="bg-slate-900 border-slate-800 p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 ${stat.color}`}>
                          <stat.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs font-medium">{stat.label}</p>
                          <p className={`text-white font-bold text-lg mt-1 ${stat.color}`}>{stat.value}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                })()}
              </div>

              {/* Exchange balances - grid view */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(allBalances)
                  .filter(([_, bals]) => bals.length > 0 && bals[0].symbol !== 'N/A')
                  .map(([exchange, balances]) => {
                    const totalValue = balances.reduce((s, b) => s + (b.usdValue || 0), 0)
                    const coinCount = balances.filter(b => b.total > 0).length
                    const exMeta = EXCHANGE_LIST.find(e => e.value === exchange)
                    const exLabel = exMeta?.label || exchange

                    return (
                      <Card key={exchange}
                        className={`bg-slate-900 border transition-all cursor-pointer ${
                          selectedExchangeForBalance === exchange
                            ? 'border-cyan-500/40 ring-2 ring-cyan-500/20'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                        onClick={() => setSelectedExchangeForBalance(selectedExchangeForBalance === exchange ? null : exchange)}
                      >
                        {/* Exchange header */}
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black border ${EXCHANGE_COLORS[exchange] ?? 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                              {EXCHANGE_ABBR[exchange] ?? exchange.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm">{exLabel}</p>
                              <p className="text-slate-600 text-[11px]">{coinCount} coins</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-cyan-400 font-bold text-sm">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            <ChevronDown className={`w-4 h-4 text-slate-500 ml-auto mt-1 transition-transform ${selectedExchangeForBalance === exchange ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Coins list - expandable */}
                        {selectedExchangeForBalance === exchange && (
                          <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                            {balances
                              .filter(b => b.total > 0)
                              .sort((a, b) => b.total - a.total)
                              .map((bal, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-md bg-slate-700 flex items-center justify-center text-[10px] font-black text-white">
                                      {bal.symbol.slice(0, 3)}
                                    </div>
                                    <div>
                                      <p className="text-white font-semibold text-sm">{bal.symbol}</p>
                                      {bal.locked > 0 && (
                                        <p className="text-slate-600 text-[10px]">
                                          Free: {bal.free.toLocaleString(undefined, { maximumFractionDigits: 6 })} | Locked: {bal.locked.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-slate-300 font-mono text-sm">{bal.total.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                                    {bal.usdValue > 0 && (
                                      <p className="text-slate-600 text-[10px] font-mono">≈ ${bal.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            {balances.filter(b => b.total > 0).length === 0 && (
                              <p className="text-center text-slate-500 text-sm py-4">No coins with balance</p>
                            )}
                          </div>
                        )}
                      </Card>
                    )
                  })}
              </div>

              {/* Detailed table view */}
              <Card className="bg-slate-900 border-slate-800 p-5">
                <h4 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-400" /> All Balances Detailed View
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500">
                        <th className="px-4 py-3 text-left font-medium">Exchange</th>
                        <th className="px-4 py-3 text-left font-medium">Coin</th>
                        <th className="px-4 py-3 text-right font-medium">Free</th>
                        <th className="px-4 py-3 text-right font-medium">Locked</th>
                        <th className="px-4 py-3 text-right font-medium">Total</th>
                        <th className="px-4 py-3 text-right font-medium">USD Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {Object.entries(allBalances)
                        .flatMap(([exName, bals]) =>
                          bals
                            .filter(b => b.total > 0)
                            .map(bal => ({ ...bal, exchangeName: exName }))
                        )
                        .sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0))
                        .slice(0, 100)
                        .map((item, i) => (
                          <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3"><ExchangeBadge exchange={item.exchangeName} /></td>
                            <td className="px-4 py-3"><span className="text-white font-semibold">{item.symbol}</span></td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">
                              {item.free.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">
                              {item.locked > 0 ? item.locked.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-amber-400 font-bold">
                              {item.total.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-cyan-400">
                              {item.usdValue > 0 ? `$${item.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ══ AI AUTO SETUP TAB ══════════════════════════════════════════════ */}
      {subTab === 'ai-strategy' && (
        <div className="space-y-4">

          {/* Generator card */}
          <Card className="bg-slate-900 border-slate-800 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                  AI Arbitrage Auto-Setup
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold">GPT-4o</span>
                </h3>
                <p className="text-slate-400 text-xs mb-4">
                  AI analyzes current market conditions across all 13 exchanges and recommends optimal coin pairs, exchanges, transfer networks, and scan settings.
                </p>
                <div className="mb-3">
                  <label className="text-xs text-slate-400 mb-1.5 block">Context for AI <span className="text-slate-600">(optional)</span></label>
                  <textarea
                    value={aiContext}
                    onChange={e => setAiContext(e.target.value)}
                    rows={2}
                    placeholder="e.g. Focus on low-risk opportunities, budget is $5000 per trade, prefer USDT stablecoin arbitrage..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-purple-500/50 resize-none placeholder-slate-600"
                  />
                </div>
                <button
                  onClick={handleGenerateStrategy} disabled={generatingAi}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-colors"
                >
                  <Sparkles className={`w-4 h-4 ${generatingAi ? 'animate-pulse' : ''}`} />
                  {generatingAi ? 'AI is analyzing markets...' : aiStrategy ? 'Regenerate Strategy' : 'Generate Strategy'}
                </button>
              </div>
            </div>
            {aiError && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {aiError}
              </div>
            )}
          </Card>

          {/* Strategy result */}
          {aiStrategy && (
            <div className="space-y-4">
              {/* Summary */}
              <Card className="bg-slate-900 border-purple-500/20 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-400 text-xs font-semibold uppercase tracking-wider">AI Strategy Summary</span>
                  <span className="ml-auto text-slate-600 text-[10px]">
                    Generated: {new Date(aiStrategy.generatedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-200 text-sm leading-relaxed">{aiStrategy.summary}</p>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recommended pairs */}
                <Card className="bg-slate-900 border-slate-800 p-5">
                  <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" /> Recommended Pairs ({aiStrategy.recommendedPairs.length})
                  </h4>
                  <div className="space-y-2.5">
                    {aiStrategy.recommendedPairs.map((pair, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/60 rounded-lg">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <span className="text-amber-400 text-[10px] font-black">{pair.symbol.slice(0, 3)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white font-bold text-xs">{pair.symbol}</span>
                            <ExchangeBadge exchange={pair.buyExchange} />
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                            <ExchangeBadge exchange={pair.sellExchange} />
                            <span className="text-green-400 text-xs font-semibold ml-1">{pair.estimatedSpread}</span>
                            <RiskBadge risk={pair.risk} />
                          </div>
                          <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">{pair.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Recommended networks */}
                <Card className="bg-slate-900 border-slate-800 p-5">
                  <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                    <Network className="w-4 h-4 text-cyan-400" /> Transfer Networks
                  </h4>
                  <div className="space-y-2.5">
                    {aiStrategy.recommendedNetworks.map((net, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${i === 0 ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-slate-800/60 border-slate-700/60'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {i === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold rounded">BEST</span>}
                            <span className="text-white font-bold text-xs">{net.network}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-slate-400">Fee: <span className="text-amber-400 font-semibold">{net.avgFeeUsd}</span></span>
                            <span className="text-slate-400">Time: <span className="text-green-400 font-semibold">{net.avgTimeMin}m</span></span>
                          </div>
                        </div>
                        <p className="text-slate-500 text-[11px]">{net.useCase}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Scan settings recommendation */}
              <Card className="bg-slate-900 border-slate-800 p-5">
                <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-400" /> Recommended Scan Settings
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Scan Interval',    value: `${aiStrategy.scanSettings.intervalSeconds}s`  },
                    { label: 'Min Profit',        value: `${aiStrategy.scanSettings.minProfitPct}%`    },
                    { label: 'Max Risk',          value: aiStrategy.scanSettings.maxRisk              },
                    { label: 'Coins to Focus',    value: `${aiStrategy.scanSettings.coinsToFocus.length} coins` },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800 rounded-lg p-3 text-center">
                      <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                      <p className="text-white font-bold text-sm">{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {aiStrategy.scanSettings.coinsToFocus.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded text-xs font-medium">{c}</span>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setSelectedSymbols(aiStrategy.scanSettings.coinsToFocus)
                    setMinProfitThreshold(aiStrategy.scanSettings.minProfitPct)
                    setAutoScanInterval(aiStrategy.scanSettings.intervalSeconds)
                    setSubTab('settings')
                  }}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-medium transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" /> Apply These Settings
                </button>
              </Card>

              {/* Warnings */}
              {aiStrategy.warnings.length > 0 && (
                <Card className="bg-amber-500/5 border-amber-500/20 p-4">
                  <h4 className="text-amber-400 font-semibold text-xs mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Important Warnings
                  </h4>
                  <ul className="space-y-1">
                    {aiStrategy.warnings.map((w, i) => (
                      <li key={i} className="text-amber-300/70 text-xs flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">•</span>{w}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ TRANSFER TAB ══════════════════════════════════════════════════ */}
      {subTab === 'transfer' && (
        <div className="space-y-4">

          {/* Header row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <SendHorizonal className="w-4 h-4 text-cyan-400" /> Cross-Exchange Transfer
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Move USDT and any coin between exchanges using saved API keys</p>
            </div>
            <button
              onClick={() => { setShowHistory(v => !v); if (!showHistory) loadHistory() }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-medium transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              {showHistory ? 'Hide History' : 'Transfer History'}
            </button>
          </div>

          {/* Transfer form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left — form */}
            <Card className="bg-slate-900 border-slate-800 p-5 space-y-4">
              <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                <SendHorizonal className="w-4 h-4 text-cyan-400" /> Transfer Details
              </h4>

              {/* From / To exchange row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">From Exchange</label>
                  <select value={txFromEx} onChange={e => { setTxFromEx(e.target.value); setTxResult(null) }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 appearance-none">
                    {EXCHANGE_LIST.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">To Exchange</label>
                  <select value={txToEx} onChange={e => { setTxToEx(e.target.value); setTxResult(null) }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 appearance-none">
                    {EXCHANGE_LIST.filter(e => e.value !== txFromEx).map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Coin + Network */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Coin</label>
                  <select value={txSymbol} onChange={e => {
                    setTxSymbol(e.target.value)
                    const nets = COIN_NETWORKS[e.target.value]
                    if (nets) setTxNetwork(nets[0])
                  }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 appearance-none">
                    {ALL_COINS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Network</label>
                  <select value={txNetwork} onChange={e => setTxNetwork(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 appearance-none">
                    {(COIN_NETWORKS[txSymbol] ?? ['ERC20','BEP20','TRC20']).map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400">Amount</label>
                  {txBalances.length > 0 && (
                    <button
                      onClick={() => {
                        const bal = txBalances.find(b => b.symbol === txSymbol || b.symbol === txSymbol.replace('USDT','') )
                        if (bal) setTxAmount(bal.free.toString())
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      Max: {(txBalances.find(b => b.symbol === txSymbol)?.free ?? 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} {txSymbol}
                    </button>
                  )}
                </div>
                <input
                  type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 placeholder-slate-600"
                />
              </div>

              {/* Destination address */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Destination Address <span className="text-red-400">*</span></label>
                <input
                  type="text" value={txAddress} onChange={e => setTxAddress(e.target.value)}
                  placeholder={`${txNetwork} wallet address on ${EXCHANGE_LIST.find(e => e.value === txToEx)?.label}`}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 placeholder-slate-600 font-mono text-xs"
                />
              </div>

              {/* Memo (optional) */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Memo / Tag <span className="text-slate-600">(optional — required for XRP, ATOM, etc.)</span></label>
                <input
                  type="text" value={txMemo} onChange={e => setTxMemo(e.target.value)}
                  placeholder="Destination tag or memo"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 placeholder-slate-600"
                />
              </div>

              {/* Result banner */}
              {txResult && (
                <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                  txResult.success
                    ? 'bg-green-500/10 border-green-500/25 text-green-300'
                    : 'bg-red-500/10 border-red-500/25 text-red-300'
                }`}>
                  {txResult.success
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  }
                  <div className="min-w-0">
                    <p className="font-semibold">{txResult.success ? 'Transfer Submitted' : 'Transfer Failed'}</p>
                    <p className="text-xs mt-0.5 opacity-80">{txResult.message}</p>
                    {txResult.txId && (
                      <p className="text-xs mt-1 font-mono opacity-70 truncate">TX: {txResult.txId}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300/70 text-[11px] leading-relaxed">
                  This sends a real withdrawal via the exchange API. Double-check the address and network before confirming. Incorrect addresses may result in permanent loss of funds.
                </p>
              </div>

              {/* Submit button */}
              {!txConfirmOpen ? (
                <button
                  onClick={() => setTxConfirmOpen(true)}
                  disabled={!txAmount || !txAddress || parseFloat(txAmount) <= 0}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm transition-colors"
                >
                  <SendHorizonal className="w-4 h-4" />
                  Review Transfer
                </button>
              ) : (
                <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/5 space-y-3">
                  <p className="text-white font-bold text-sm text-center">Confirm Transfer</p>
                  <div className="text-center space-y-1 text-sm">
                    <p className="text-slate-300">
                      Send <span className="text-white font-bold">{txAmount} {txSymbol}</span> via <span className="text-cyan-400 font-semibold">{txNetwork}</span>
                    </p>
                    <p className="text-slate-400 text-xs">
                      From <span className="text-white">{EXCHANGE_LIST.find(e=>e.value===txFromEx)?.label}</span> → <span className="text-white">{EXCHANGE_LIST.find(e=>e.value===txToEx)?.label}</span>
                    </p>
                    <p className="text-slate-600 text-[10px] font-mono truncate">{txAddress}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setTxConfirmOpen(false)}
                      className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-sm transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleTransferSubmit} disabled={txSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-colors">
                      {txSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                      {txSubmitting ? 'Sending...' : 'Confirm & Send'}
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Right — balances */}
            <Card className="bg-slate-900 border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-400" />
                  {EXCHANGE_LIST.find(e => e.value === txFromEx)?.label} Balances
                </h4>
                <button onClick={loadBalances} disabled={loadingBalances}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingBalances ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingBalances ? (
                <div className="flex items-center justify-center py-10 text-slate-500 text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading balances...
                </div>
              ) : txBalances.length === 0 ? (
                <div className="py-10 text-center">
                  <Wallet className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No balances loaded</p>
                  <p className="text-slate-600 text-xs mt-1">Configure API keys in the <button onClick={() => setSubTab('exchange-connections')} className="text-cyan-400 hover:underline">Connections tab</button>, then click refresh</p>
                </div>
              ) : txBalances[0]?.symbol === 'N/A' ? (
                <div className="py-10 text-center">
                  <Key className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">API key not configured</p>
                  <p className="text-slate-600 text-xs mt-1">
                    <button onClick={() => setSubTab('exchange-connections')} className="text-cyan-400 hover:underline">Add API keys</button> for {EXCHANGE_LIST.find(e=>e.value===txFromEx)?.label} to view live balances
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {txBalances
                    .sort((a, b) => b.total - a.total)
                    .map((bal, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setTxSymbol(bal.symbol === 'USDT' || ALL_COINS.includes(bal.symbol) ? bal.symbol : txSymbol)
                          setTxAmount(bal.free.toString())
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-transparent hover:border-slate-600 transition-all text-left group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-slate-700 flex items-center justify-center text-[10px] font-black text-white">
                            {bal.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{bal.symbol}</p>
                            {bal.locked > 0 && <p className="text-slate-600 text-[10px]">{bal.locked.toFixed(4)} locked</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-mono text-sm">{bal.free.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                          <p className="text-slate-500 text-[10px] group-hover:text-cyan-400 transition-colors">click to fill</p>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </Card>
          </div>

          {/* Transfer History */}
          {showHistory && (
            <Card className="bg-slate-900 border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" /> Transfer History
                </h4>
                <button onClick={loadHistory} disabled={loadingHistory}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading history...
                </div>
              ) : txHistory.length === 0 ? (
                <div className="py-8 text-center">
                  <History className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No transfers yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800">
                        {['Time','From','To','Coin','Network','Amount','Status','TX ID'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {txHistory.map(row => {
                        const statusColor =
                          row.status === 'submitted' || row.status === 'completed' ? 'text-green-400 bg-green-500/10 border-green-500/20'
                          : row.status === 'failed' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        return (
                          <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                            </td>
                            <td className="px-3 py-2.5"><ExchangeBadge exchange={row.fromExchange} /></td>
                            <td className="px-3 py-2.5"><ExchangeBadge exchange={row.toExchange} /></td>
                            <td className="px-3 py-2.5 text-white font-bold">{row.symbol}</td>
                            <td className="px-3 py-2.5 text-slate-400 font-mono">{row.network}</td>
                            <td className="px-3 py-2.5 text-white font-mono">{parseFloat(row.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold capitalize ${statusColor}`}>
                                {row.status}
                              </span>
                              {row.errorMessage && (
                                <p className="text-red-400/60 text-[10px] mt-0.5 max-w-[180px] truncate">{row.errorMessage}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {row.txId ? (
                                <span className="text-cyan-400 font-mono text-[10px] truncate max-w-[100px] inline-block" title={row.txId}>
                                  {row.txId.slice(0, 12)}...
                                </span>
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ══ TRANSFER ROUTES TAB ════════════════════════════════════════════ */}
      {subTab === 'transfer-routes' && (
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800 p-5">
            <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" /> Transfer Route Planner
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {[
                { label: 'From Exchange', value: trFrom, setter: setTrFrom },
                { label: 'To Exchange',   value: trTo,   setter: setTrTo   },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
                  <select value={value} onChange={e => setter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50">
                    {['Binance','Kraken','Coinbase','Bybit','KuCoin','HTX','Bitfinex','OKX','Gate.io','Gemini','Crypto.com','Bitget'].map(e => (
                      <option key={e}>{e}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Asset</label>
                <select value={trSymbol} onChange={e => setTrSymbol(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50">
                  {['USDT','BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','LINK','MATIC','LTC'].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={handleLoadRoutes} disabled={loadingRoutes}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold rounded-lg text-sm transition-colors">
              <Network className={`w-4 h-4 ${loadingRoutes ? 'animate-spin' : ''}`} />
              {loadingRoutes ? 'Calculating...' : 'Calculate Routes'}
            </button>
          </Card>

          {routes.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">
                Available Networks: {trFrom} → {trTo} ({trSymbol})
              </p>
              {routes.map((r, i) => (
                <Card key={i} className={`bg-slate-900 p-4 border ${i === 0 ? 'border-amber-500/30 bg-amber-500/[0.02]' : 'border-slate-800'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      {i === 0 && (
                        <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black rounded">FASTEST</span>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{r.network}</span>
                          <span className="text-slate-500 text-xs">({r.symbol})</span>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">{r.fromExchange} → {r.toExchange}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-slate-500 text-[10px]">Est. Fee</p>
                        <p className="text-amber-400 font-bold text-sm">{r.estimatedFee} {r.symbol}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-[10px]">Transfer Time</p>
                        <p className="text-green-400 font-bold text-sm">~{r.estimatedTimeMin} min</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ SETTINGS TAB ══════════════════════════════════════════════════ */}
      {subTab === 'settings' && (
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-5">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" /> Scan Configuration
            </h3>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Minimum Profit Threshold (%)</label>
              <input type="number" min="0.1" step="0.1" value={minProfitThreshold}
                onChange={e => setMinProfitThreshold(parseFloat(e.target.value) || 0.3)}
                className="w-40 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
              <p className="text-slate-500 text-xs mt-1">Only surface opportunities with spread above this value after fees.</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Auto-Scan Interval</label>
              <select value={autoScanInterval} onChange={e => setAutoScanInterval(parseInt(e.target.value))}
                className="w-40 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50">
                {[15, 30, 60, 120, 300].map(v => <option key={v} value={v}>{v}s — {v < 60 ? 'Aggressive' : v < 120 ? 'Balanced' : 'Conservative'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-2 block font-medium">
                Coins to Scan ({selectedSymbols.length} / {SCAN_SYMBOLS.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {SCAN_SYMBOLS.map(s => (
                  <button key={s}
                    onClick={() => setSelectedSymbols(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      selectedSymbols.includes(s)
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'
                    }`}
                  >{s}</button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setSelectedSymbols(SCAN_SYMBOLS)} className="text-xs text-amber-400 hover:text-amber-300">Select All</button>
                <span className="text-slate-700">|</span>
                <button onClick={() => setSelectedSymbols([])} className="text-xs text-slate-500 hover:text-white">Clear All</button>
              </div>
            </div>
          </Card>

          {/* API endpoint reference */}
          <Card className="bg-slate-900 border-slate-800 p-5">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-400" /> Connected Data Sources (13 APIs)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { name: 'CoinGecko',  api: 'api.coingecko.com/api/v3',  type: 'Aggregator', highlight: true },
                { name: 'Binance',    api: 'api.binance.com',            type: 'Exchange'  },
                { name: 'Kraken',     api: 'api.kraken.com',             type: 'Exchange'  },
                { name: 'Coinbase',   api: 'api.coinbase.com',           type: 'Exchange'  },
                { name: 'Bybit',      api: 'api.bybit.com',              type: 'Exchange'  },
                { name: 'KuCoin',     api: 'api.kucoin.com',             type: 'Exchange'  },
                { name: 'HTX',        api: 'api.huobi.pro',              type: 'Exchange'  },
                { name: 'Bitfinex',   api: 'api.bitfinex.com/v1',        type: 'Exchange'  },
                { name: 'OKX',        api: 'okx.com/api/v5',             type: 'Exchange'  },
                { name: 'Gate.io',    api: 'api.gateio.ws/api/v4',       type: 'Exchange'  },
                { name: 'Gemini',     api: 'api.gemini.com/v1',          type: 'Exchange'  },
                { name: 'Crypto.com', api: 'api.crypto.com/v2',          type: 'Exchange'  },
                { name: 'Bitget',     api: 'api.bitget.com/v2',          type: 'Exchange'  },
              ].map(ex => (
                <div key={ex.name} className={`rounded-lg p-2.5 border ${ex.highlight ? 'bg-lime-500/5 border-lime-500/20' : 'bg-slate-800 border-slate-700'}`}>
                  <p className={`text-xs font-semibold ${ex.highlight ? 'text-lime-400' : 'text-white'}`}>{ex.name}</p>
                  <p className="text-slate-600 text-[10px] font-mono truncate mt-0.5">{ex.api}</p>
                  <span className={`text-[10px] font-medium ${ex.highlight ? 'text-lime-500' : 'text-green-400'}`}>{ex.type}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}
