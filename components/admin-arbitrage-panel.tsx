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
  Wallet, ChevronDown, History, Copy, ExternalLink, Loader2,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

type SubTab = 'live-scan' | 'exchange-connections' | 'ai-strategy' | 'transfer' | 'transfer-routes' | 'settings'

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

  // Transfer routes
  const [trFrom, setTrFrom] = useState('Binance')
  const [trTo, setTrTo] = useState('Kraken')
  const [trSymbol, setTrSymbol] = useState('USDT')
  const [routes, setRoutes] = useState<TransferRoute[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)

  // ── Load API keys when tab opens ─────────────────────────────────────────
  useEffect(() => {
    if (subTab === 'exchange-connections' && apiKeys.length === 0) {
      loadApiKeys()
    }
    if (subTab === 'ai-strategy' && !aiStrategy) {
      getSavedAiStrategy().then(s => { if (s) setAiStrategy(s) }).catch(() => {})
    }
  }, [subTab])

  async function loadApiKeys() {
    setLoadingKeys(true)
    try {
      const keys = await getExchangeApiKeys()
      setApiKeys(keys)
    } finally {
      setLoadingKeys(false)
    }
  }

  // ── Live scan ─────────────────────────────────────────────────────────────
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
    { key: 'live-scan',           label: 'Live Scan',         icon: Activity     },
    { key: 'exchange-connections',label: 'API Connections',   icon: Key          },
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-white font-semibold text-sm">Exchange API Connections</h3>
              <p className="text-slate-500 text-xs mt-0.5">Configure API keys for each exchange. Public REST APIs work without keys for price data.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleTestAll} disabled={testingAll}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white font-medium rounded-lg text-xs transition-colors border border-slate-600">
                <TestTube2 className={`w-3.5 h-3.5 ${testingAll ? 'animate-spin' : ''}`} />
                {testingAll ? 'Testing All...' : 'Test All Connections'}
              </button>
            </div>
          </div>

          {loadingKeys ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-slate-900 border-slate-800 p-4 animate-pulse h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {apiKeys.map(ex => {
                const keyResult = testResults[ex.exchange]
                const liveStatus = keyResult ?? (ex.lastTestStatus ? { ok: ex.lastTestStatus === 'ok', latencyMs: ex.lastTestMs ?? 0, message: '' } : null)
                return (
                  <Card key={ex.exchange}
                    className={`bg-slate-900 border p-4 transition-colors ${
                      liveStatus?.ok === true  ? 'border-green-500/20' :
                      liveStatus?.ok === false ? 'border-red-500/20'   :
                      'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border ${
                          EXCHANGE_COLORS[ex.exchange] ?? 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {EXCHANGE_ABBR[ex.exchange] ?? ex.label.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm leading-none">{ex.label}</p>
                          <p className="text-slate-600 text-[10px] mt-0.5">{ex.isPublicOnly ? 'Public API' : 'Authenticated'}</p>
                        </div>
                      </div>
                      {/* Enable/disable toggle */}
                      <button onClick={() => handleToggleEnabled(ex.exchange, ex.isEnabled)}
                        className="text-slate-400 hover:text-white transition-colors">
                        {ex.isEnabled
                          ? <ToggleRight className="w-6 h-6 text-green-400" />
                          : <ToggleLeft className="w-6 h-6 text-slate-600" />
                        }
                      </button>
                    </div>

                    {/* Status row */}
                    <div className="flex items-center gap-2 mb-3">
                      {liveStatus ? (
                        <>
                          <StatusDot ok={liveStatus.ok} />
                          <span className={`text-xs ${liveStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
                            {liveStatus.ok ? 'Online' : 'Offline'}
                          </span>
                          {liveStatus.latencyMs > 0 && <LatencyChip ms={liveStatus.latencyMs} />}
                        </>
                      ) : (
                        <>
                          <StatusDot idle />
                          <span className="text-slate-600 text-xs">Not tested</span>
                        </>
                      )}
                      <span className="ml-auto text-[10px] text-slate-600">
                        {ex.lastTestedAt ? new Date(ex.lastTestedAt).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    {/* API key indicator */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <Key className="w-3 h-3 text-slate-600" />
                      <span className="text-[11px] text-slate-500">
                        {ex.apiKey ? <span className="text-amber-400 font-mono">{ex.apiKey}</span> : 'No API key set'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestOne(ex.exchange)}
                        disabled={testingExchange === ex.exchange}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-300 transition-colors disabled:opacity-50"
                      >
                        <TestTube2 className={`w-3 h-3 ${testingExchange === ex.exchange ? 'animate-spin' : ''}`} />
                        {testingExchange === ex.exchange ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingExchange(ex.exchange)
                          setEditForm({ apiKey: '', apiSecret: '', passphrase: '', note: ex.note ?? '', isEnabled: ex.isEnabled, isPublicOnly: ex.isPublicOnly })
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded text-xs text-amber-400 transition-colors"
                      >
                        <Key className="w-3 h-3" />
                        Configure
                      </button>
                    </div>
                  </Card>
                )
              })}
            </div>
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
