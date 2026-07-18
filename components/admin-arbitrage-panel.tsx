'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import {
  adminFetchLivePrices, getTransferRoutes,
  AdminLivePrice, AdminArbitrageOpp, ExchangeStatus, TransferRoute,
} from '@/app/actions/admin-arbitrage'
import {
  Activity, RefreshCw, CheckCircle2, XCircle, Wifi, WifiOff,
  ArrowRightLeft, TrendingUp, TrendingDown, Zap, Filter,
  ChevronDown, ChevronUp, Clock, DollarSign, AlertTriangle,
  Network, BarChart3, Search, Settings, Play, Pause,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
type SubTab = 'live-scan' | 'exchange-status' | 'transfer-routes' | 'settings'

const SCAN_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX',
  'LINK', 'MATIC', 'DOT', 'ATOM', 'UNI', 'LTC', 'NEAR', 'AAVE',
  'CRV', 'SHIB', 'PEPE', 'TON', 'FET', 'RENDER', 'ARB', 'OP', 'SUI',
]

const EXCHANGE_LOGOS: Record<string, string> = {
  binance: 'BN', kraken: 'KR', coinbase: 'CB', bybit: 'BB',
  kucoin: 'KC', 'htx (huobi)': 'HT', bitfinex: 'BFX', okx: 'OKX',
  'gate.io': 'GT', gemini: 'GM', 'crypto.com': 'CDC', bitget: 'BG',
  coingecko: 'CG',
}

const EXCHANGE_COLORS: Record<string, string> = {
  binance: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  kraken: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  coinbase: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  bybit: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  kucoin: 'bg-green-500/20 text-green-300 border-green-500/30',
  'htx (huobi)': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  bitfinex: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  okx: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'gate.io': 'bg-red-500/20 text-red-300 border-red-500/30',
  gemini: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'crypto.com': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  bitget: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  coingecko: 'bg-lime-500/20 text-lime-300 border-lime-500/30',
}

function ExchangeBadge({ name }: { name: string }) {
  const key = name.toLowerCase()
  const color = EXCHANGE_COLORS[key] ?? 'bg-slate-700 text-slate-300 border-slate-600'
  const abbr = EXCHANGE_LOGOS[key] ?? name.slice(0, 2).toUpperCase()
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold ${color}`}>
      {abbr}
    </span>
  )
}

function ProfitBadge({ pct }: { pct: number }) {
  const color = pct >= 1.5 ? 'bg-green-500/20 text-green-300 border-green-500/30'
    : pct >= 0.8 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : 'bg-slate-700 text-slate-400 border-slate-600'
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-bold ${color}`}>
      +{pct.toFixed(3)}%
    </span>
  )
}

export default function AdminArbitragePanel() {
  const [subTab, setSubTab] = useState<SubTab>('live-scan')

  // Live scan state
  const [scanning, setScanning] = useState(false)
  const [autoScan, setAutoScan] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [prices, setPrices] = useState<AdminLivePrice[]>([])
  const [opportunities, setOpportunities] = useState<AdminArbitrageOpp[]>([])
  const [exchangeStatuses, setExchangeStatuses] = useState<ExchangeStatus[]>([])
  const [scanError, setScanError] = useState<string | null>(null)

  // Filters
  const [filterSymbol, setFilterSymbol] = useState('')
  const [filterMinProfit, setFilterMinProfit] = useState(0)
  const [filterBuyEx, setFilterBuyEx] = useState('')
  const [filterSellEx, setFilterSellEx] = useState('')
  const [sortByProfit, setSortByProfit] = useState<'asc' | 'desc'>('desc')

  // Transfer route state
  const [trFrom, setTrFrom] = useState('Binance')
  const [trTo, setTrTo] = useState('Kraken')
  const [trSymbol, setTrSymbol] = useState('USDT')
  const [routes, setRoutes] = useState<TransferRoute[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)

  // Scan settings
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(SCAN_SYMBOLS.slice(0, 15))
  const [minProfitThreshold, setMinProfitThreshold] = useState(0.3)
  const [autoScanInterval, setAutoScanInterval] = useState(30)

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

  // Auto scan
  useEffect(() => {
    if (!autoScan) return
    const id = setInterval(runScan, autoScanInterval * 1000)
    return () => clearInterval(id)
  }, [autoScan, autoScanInterval, runScan])

  const loadRoutes = async () => {
    setLoadingRoutes(true)
    try {
      const r = await getTransferRoutes(trFrom, trTo, trSymbol)
      setRoutes(r)
    } finally {
      setLoadingRoutes(false)
    }
  }

  // Filtered + sorted opportunities
  const filtered = opportunities
    .filter(o => {
      if (filterSymbol && !o.symbol.toUpperCase().includes(filterSymbol.toUpperCase())) return false
      if (o.netProfitPct < filterMinProfit) return false
      if (filterBuyEx && !o.buyExchange.toLowerCase().includes(filterBuyEx.toLowerCase())) return false
      if (filterSellEx && !o.sellExchange.toLowerCase().includes(filterSellEx.toLowerCase())) return false
      return true
    })
    .sort((a, b) => sortByProfit === 'desc' ? b.netProfitPct - a.netProfitPct : a.netProfitPct - b.netProfitPct)

  const onlineCount = exchangeStatuses.filter(e => e.online).length
  const totalPrices = prices.length

  const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
    { key: 'live-scan',       label: 'Live Arbitrage Scan',  icon: Activity },
    { key: 'exchange-status', label: 'Exchange Status',       icon: Wifi },
    { key: 'transfer-routes', label: 'Transfer Routes',       icon: ArrowRightLeft },
    { key: 'settings',        label: 'Scan Settings',         icon: Settings },
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

      {/* ── LIVE SCAN TAB ─────────────────────────────────────────────────── */}
      {subTab === 'live-scan' && (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold rounded-lg text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Run Scan Now'}
            </button>
            <button
              onClick={() => setAutoScan(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                autoScan
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {autoScan ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {autoScan ? `Auto-Scan ON (${autoScanInterval}s)` : 'Enable Auto-Scan'}
            </button>
            {lastScan && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last scan: {lastScan}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {onlineCount > 0 && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {onlineCount} exchanges online
                </span>
              )}
              {totalPrices > 0 && (
                <span className="text-xs text-slate-500">{totalPrices} price points</span>
              )}
            </div>
          </div>

          {scanError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {scanError}
            </div>
          )}

          {/* Filters */}
          <Card className="bg-slate-900 border-slate-800 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Symbol Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={filterSymbol}
                    onChange={e => setFilterSymbol(e.target.value)}
                    placeholder="BTC, ETH..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Min Net Profit %</label>
                <input
                  type="number" min="0" step="0.1"
                  value={filterMinProfit}
                  onChange={e => setFilterMinProfit(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Buy From Exchange</label>
                <input
                  value={filterBuyEx}
                  onChange={e => setFilterBuyEx(e.target.value)}
                  placeholder="e.g. Binance"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Sell To Exchange</label>
                <input
                  value={filterSellEx}
                  onChange={e => setFilterSellEx(e.target.value)}
                  placeholder="e.g. Kraken"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
          </Card>

          {/* Opportunities table */}
          {opportunities.length === 0 && !scanning ? (
            <Card className="bg-slate-900 border-slate-800 p-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                <Activity className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-slate-400 font-medium">No scan results yet</p>
              <p className="text-slate-600 text-sm">Click "Run Scan Now" to fetch live prices from all 12 exchanges and detect arbitrage opportunities.</p>
            </Card>
          ) : (
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span className="text-white font-semibold text-sm">
                    {filtered.length} Arbitrage Opportunities
                  </span>
                  {autoScan && (
                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSortByProfit(p => p === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  Profit {sortByProfit === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5">Symbol</th>
                      <th className="text-left px-4 py-2.5">Buy From</th>
                      <th className="text-right px-4 py-2.5">Buy Price</th>
                      <th className="text-left px-4 py-2.5">Sell To</th>
                      <th className="text-right px-4 py-2.5">Sell Price</th>
                      <th className="text-right px-4 py-2.5">Spread</th>
                      <th className="text-right px-4 py-2.5">Net Profit</th>
                      <th className="text-right px-4 py-2.5">$ / $1k</th>
                      <th className="text-right px-4 py-2.5">Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(opp => (
                      <tr key={opp.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-white font-bold">{opp.symbol}</span>
                        </td>
                        <td className="px-4 py-3">
                          <ExchangeBadge name={opp.buyExchange} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300 text-xs">
                          ${opp.buyPrice < 0.01
                            ? opp.buyPrice.toExponential(4)
                            : opp.buyPrice.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-3">
                          <ExchangeBadge name={opp.sellExchange} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-300 text-xs">
                          ${opp.sellPrice < 0.01
                            ? opp.sellPrice.toExponential(4)
                            : opp.sellPrice.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-amber-400 font-mono text-xs">+{opp.profitPct.toFixed(3)}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ProfitBadge pct={opp.netProfitPct} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-green-400 font-bold text-xs">
                            +${((opp.netProfitPct / 100) * 1000).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500">
                          {new Date(opp.detectedAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── EXCHANGE STATUS TAB ───────────────────────────────────────────── */}
      {subTab === 'exchange-status' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">
              Real-time connection status for all 12 integrated exchanges.
              Run a scan first to populate live status.
            </p>
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Refreshing...' : 'Refresh Status'}
            </button>
          </div>

          {(() => {
            const KNOWN_EXCHANGES = [
              { name: 'binance',      label: 'Binance' },
              { name: 'coinbase',     label: 'Coinbase' },
              { name: 'kraken',       label: 'Kraken' },
              { name: 'bybit',        label: 'Bybit' },
              { name: 'kucoin',       label: 'KuCoin' },
              { name: 'htx (huobi)',  label: 'HTX (Huobi)' },
              { name: 'bitfinex',     label: 'Bitfinex' },
              { name: 'okx',          label: 'OKX' },
              { name: 'gate.io',      label: 'Gate.io' },
              { name: 'gemini',       label: 'Gemini' },
              { name: 'crypto.com',   label: 'Crypto.com' },
              { name: 'bitget',       label: 'Bitget' },
            ]
            // Merge scan results with known list so idle state still shows all exchanges
            const displayList = KNOWN_EXCHANGES.map(ke => {
              const live = exchangeStatuses.find(e => e.name === ke.name)
              return live ?? { name: ke.name, label: ke.label, online: null as unknown as boolean, pricesFetched: null as unknown as number }
            })
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displayList.map(ex => {
                  const isUnknown = ex.online === null
                  return (
                    <Card key={ex.name} className={`bg-slate-900 border p-4 transition-colors ${isUnknown ? 'border-slate-700/60' : ex.online ? 'border-green-500/20' : 'border-red-500/20'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                            EXCHANGE_COLORS[ex.name] ?? 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {EXCHANGE_LOGOS[ex.name] ?? ex.label.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-white font-semibold text-sm">{ex.label}</span>
                        </div>
                        {isUnknown
                          ? <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="w-3.5 h-3.5" /> Not checked</span>
                          : ex.online
                          ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> Online</span>
                          : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" /> Offline</span>
                        }
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">Prices Fetched</p>
                          <p className="text-white font-bold">{isUnknown ? '—' : ex.pricesFetched}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">API Type</p>
                          <p className="text-slate-300">Public REST</p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── TRANSFER ROUTES TAB ───────────────────────────────────────────── */}
      {subTab === 'transfer-routes' && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Calculate optimal transfer routes between exchanges for moving funds to execute arbitrage.
          </p>

          {/* Route planner */}
          <Card className="bg-slate-900 border-slate-800 p-5">
            <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              Transfer Route Planner
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">From Exchange</label>
                <select
                  value={trFrom}
                  onChange={e => setTrFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                >
                  {['Binance','Kraken','Coinbase','Bybit','KuCoin','HTX','Bitfinex','OKX','Gate.io','Gemini','Crypto.com','Bitget'].map(e => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">To Exchange</label>
                <select
                  value={trTo}
                  onChange={e => setTrTo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                >
                  {['Kraken','Binance','Coinbase','Bybit','KuCoin','HTX','Bitfinex','OKX','Gate.io','Gemini','Crypto.com','Bitget'].map(e => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Asset</label>
                <select
                  value={trSymbol}
                  onChange={e => setTrSymbol(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                >
                  {['USDT','BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','LINK','MATIC','LTC'].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={loadRoutes}
              disabled={loadingRoutes}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold rounded-lg text-sm transition-colors"
            >
              <Network className={`w-4 h-4 ${loadingRoutes ? 'animate-spin' : ''}`} />
              {loadingRoutes ? 'Calculating...' : 'Calculate Routes'}
            </button>
          </Card>

          {routes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-slate-400 text-xs uppercase tracking-wider">Available Transfer Networks</h4>
              {routes.map((r, i) => (
                <Card key={i} className={`bg-slate-900 border-slate-800 p-4 ${i === 0 ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      {i === 0 && (
                        <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold rounded">
                          RECOMMENDED
                        </span>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{r.network}</span>
                          <span className="text-slate-400 text-xs">— {r.symbol}</span>
                        </div>
                        <p className="text-slate-500 text-xs mt-0.5">{r.fromExchange} → {r.toExchange}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs">
                      <div className="text-center">
                        <p className="text-slate-500">Est. Fee</p>
                        <p className="text-amber-400 font-bold">{r.estimatedFee} {r.symbol}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500">Transfer Time</p>
                        <p className="text-green-400 font-bold">~{r.estimatedTimeMin} min</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ──────────────────────────────────────────────────── */}
      {subTab === 'settings' && (
        <div className="space-y-4">
          <Card className="bg-slate-900 border-slate-800 p-5 space-y-5">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              Scan Configuration
            </h3>

            {/* Min profit threshold */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">
                Minimum Profit Threshold (%)
              </label>
              <input
                type="number" min="0.1" step="0.1"
                value={minProfitThreshold}
                onChange={e => setMinProfitThreshold(parseFloat(e.target.value) || 0.3)}
                className="w-40 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
              />
              <p className="text-slate-500 text-xs mt-1">Only show opportunities with spread above this value.</p>
            </div>

            {/* Auto scan interval */}
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">
                Auto-Scan Interval (seconds)
              </label>
              <select
                value={autoScanInterval}
                onChange={e => setAutoScanInterval(parseInt(e.target.value))}
                className="w-40 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
              >
                {[15, 30, 60, 120, 300].map(v => (
                  <option key={v} value={v}>{v}s</option>
                ))}
              </select>
            </div>

            {/* Symbol selection */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block font-medium">
                Coins to Scan ({selectedSymbols.length}/{SCAN_SYMBOLS.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {SCAN_SYMBOLS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSymbols(prev =>
                      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                    )}
                    className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                      selectedSymbols.includes(s)
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setSelectedSymbols(SCAN_SYMBOLS)}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  Select All
                </button>
                <span className="text-slate-700">|</span>
                <button
                  onClick={() => setSelectedSymbols([])}
                  className="text-xs text-slate-500 hover:text-white"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Exchange API reference */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block font-medium">Connected Exchange APIs (12 Sources)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[
                  { name: 'Binance', api: 'api.binance.com', type: 'Public REST' },
                  { name: 'Kraken', api: 'api.kraken.com', type: 'Public REST' },
                  { name: 'Coinbase', api: 'api.coinbase.com', type: 'Public REST' },
                  { name: 'Bybit', api: 'api.bybit.com', type: 'Public REST' },
                  { name: 'KuCoin', api: 'api.kucoin.com', type: 'Public REST' },
                  { name: 'HTX', api: 'api.huobi.pro', type: 'Public REST' },
                  { name: 'Bitfinex', api: 'api.bitfinex.com', type: 'Public REST' },
                  { name: 'OKX', api: 'okx.com/api/v5', type: 'Public REST' },
                  { name: 'Gate.io', api: 'api.gateio.ws', type: 'Public REST' },
                  { name: 'Gemini', api: 'api.gemini.com', type: 'Public REST' },
                  { name: 'Crypto.com', api: 'api.crypto.com', type: 'Public REST' },
                  { name: 'Bitget', api: 'api.bitget.com', type: 'Public REST' },
                  { name: 'CoinGecko', api: 'api.coingecko.com', type: 'Aggregator' },
                ].map(ex => (
                  <div key={ex.name} className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
                    <p className="text-white text-xs font-semibold">{ex.name}</p>
                    <p className="text-slate-500 text-[10px] font-mono truncate">{ex.api}</p>
                    <span className="text-[10px] text-green-400">{ex.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
