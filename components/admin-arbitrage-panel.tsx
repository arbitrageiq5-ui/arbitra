'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import {
  adminFetchLivePrices, testExchangeConnection, testAllExchanges,
  getExchangeApiKeys, saveExchangeApiKey, toggleExchangeEnabled, deleteExchangeApiKey,
  generateAiArbitrageStrategy, getSavedAiStrategy, getTransferRoutes,
  getExchangeBalances, executeExchangeTransfer, getTransferHistory,
  getBotConfig, saveBotConfig, getBotAnalytics, executeBotTrade, evaluateRiskFilters,
  AdminLivePrice, AdminArbitrageOpp, ExchangeStatus, ExchangeApiKey,
  AiArbitrageStrategy, TransferRoute, ExchangeBalance, TransferLog,
  BotConfig, BotAnalytics, RiskFilterResult,
} from '@/app/actions/admin-arbitrage'
import { calcNetProfit, type NetProfitBreakdown } from '@/lib/utils/arbitrage-calc'
import { SniperBotTab } from '@/components/sniper-bot-tab'
import {
  Activity, RefreshCw, CheckCircle2, XCircle, Wifi, WifiOff,
  ArrowRightLeft, TrendingUp, Zap, Filter, Clock, AlertTriangle,
  Network, BarChart3, Search, Settings, Play, Pause, Key, Eye,
  EyeOff, Save, TestTube2, Bot, Sparkles, ChevronRight,
  ShieldCheck, ToggleLeft, ToggleRight, DollarSign, SendHorizonal,
  Wallet, ChevronDown, History, Copy, ExternalLink, Loader2, Link2,
  FlaskConical, LineChart, Shield, Target, Cpu, TrendingDown,
  CheckCircle, XCircle as XCircleIcon, Minus, Percent, Timer,
  BadgeDollarSign, Layers, SlidersHorizontal,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

type SubTab = 'live-scan' | 'sniper-bot' | 'exchange-connections' | 'balances' | 'ai-strategy' | 'transfer' | 'transfer-routes' | 'bot-engine' | 'analytics' | 'settings'

const SCAN_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX',
  'LINK', 'MATIC', 'DOT', 'ATOM', 'UNI', 'LTC', 'NEAR', 'AAVE',
  'CRV', 'SHIB', 'PEPE', 'TON', 'FET', 'RENDER', 'ARB', 'OP', 'SUI',
]

const EXCHANGE_COLORS: Record<string, string> = {
  // Global Tier-1
  binance:       'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  okx:           'bg-blue-500/20 text-blue-300 border-blue-500/30',
  bybit:         'bg-orange-500/20 text-orange-300 border-orange-500/30',
  kucoin:        'bg-green-500/20 text-green-300 border-green-500/30',
  kraken:        'bg-purple-500/20 text-purple-300 border-purple-500/30',
  coinbase:      'bg-sky-500/20 text-sky-300 border-sky-500/30',
  htx:           'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  bitfinex:      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  gateio:        'bg-red-500/20 text-red-300 border-red-500/30',
  gemini:        'bg-teal-500/20 text-teal-300 border-teal-500/30',
  cryptocom:     'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  bitget:        'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  mexc:          'bg-blue-400/20 text-blue-200 border-blue-400/30',
  phemex:        'bg-violet-500/20 text-violet-300 border-violet-500/30',
  bitstamp:      'bg-rose-500/20 text-rose-300 border-rose-500/30',
  poloniex:      'bg-teal-400/20 text-teal-200 border-teal-400/30',
  upbit:         'bg-blue-600/20 text-blue-300 border-blue-600/30',
  deribit:       'bg-orange-400/20 text-orange-200 border-orange-400/30',
  // India
  coindcx:       'bg-blue-700/20 text-blue-300 border-blue-700/30',
  coinswitch:    'bg-purple-600/20 text-purple-300 border-purple-600/30',
  wazirx:        'bg-cyan-600/20 text-cyan-300 border-cyan-600/30',
  bitbns:        'bg-amber-500/20 text-amber-300 border-amber-500/30',
  zebpay:        'bg-sky-600/20 text-sky-300 border-sky-600/30',
  // Data
  coingecko:     'bg-lime-500/20 text-lime-300 border-lime-500/30',
  coinmarketcap: 'bg-green-400/20 text-green-200 border-green-400/30',
  // From fetchers
  mexc:             'bg-blue-400/20 text-blue-200 border-blue-400/30',
  phemex:           'bg-violet-500/20 text-violet-300 border-violet-500/30',
  upbit:            'bg-blue-600/20 text-blue-300 border-blue-600/30',
  // India
  coindcx:          'bg-blue-700/20 text-blue-300 border-blue-700/30',
  coinswitch:       'bg-purple-600/20 text-purple-300 border-purple-600/30',
  wazirx:           'bg-teal-500/20 text-teal-300 border-teal-500/30',
  'delta exchange': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  delta:            'bg-orange-500/20 text-orange-300 border-orange-500/30',
  bitbns:           'bg-amber-600/20 text-amber-300 border-amber-600/30',
  zebpay:           'bg-sky-600/20 text-sky-300 border-sky-600/30',
  mudrex:           'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

const EXCHANGE_ABBR: Record<string, string> = {
  // Global
  binance: 'BN', okx: 'OKX', bybit: 'BB', kucoin: 'KC',
  kraken: 'KR', coinbase: 'CB', htx: 'HT', bitfinex: 'BFX',
  gateio: 'GT', gemini: 'GM', cryptocom: 'CDC', bitget: 'BG',
  mexc: 'MX', phemex: 'PH', bitstamp: 'BS', poloniex: 'PX',
  upbit: 'UP', deribit: 'DR',
  // India
  coindcx: 'DCX', coinswitch: 'CSW', wazirx: 'WRX', bitbns: 'BNS', zebpay: 'ZBP',
  delta: 'DEL', 'delta exchange': 'DEL', mudrex: 'MUX',
  // Data
  coingecko: 'CG', coinmarketcap: 'CMC',
  // From fetchers
  mexc: 'MX', phemex: 'PH', upbit: 'UP',
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
  const [filterBlockchain, setFilterBlockchain] = useState('')
  const [sortByProfit, setSortByProfit] = useState<'asc' | 'desc'>('desc')
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(SCAN_SYMBOLS)
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
  const [deletingExchange, setDeletingExchange] = useState<string | null>(null)
  const [confirmDeleteExchange, setConfirmDeleteExchange] = useState<string | null>(null)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [regionFilter, setRegionFilter] = useState<string>('All')
  const [searchExchange, setSearchExchange] = useState('')

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
    // Global
    { value: 'binance',   label: 'Binance'         },
    { value: 'bybit',     label: 'Bybit'           },
    { value: 'kucoin',    label: 'KuCoin'          },
    { value: 'okx',       label: 'OKX'             },
    { value: 'kraken',    label: 'Kraken'          },
    { value: 'coinbase',  label: 'Coinbase'        },
    { value: 'bitget',    label: 'Bitget'          },
    { value: 'gateio',    label: 'Gate.io'         },
    { value: 'mexc',      label: 'MEXC'            },
    { value: 'htx',       label: 'HTX'             },
    { value: 'bitfinex',  label: 'Bitfinex'        },
    { value: 'gemini',    label: 'Gemini'          },
    { value: 'cryptocom', label: 'Crypto.com'      },
    { value: 'phemex',    label: 'Phemex'          },
    { value: 'upbit',     label: 'Upbit'           },
    // India
    { value: 'coindcx',   label: 'CoinDCX'         },
    { value: 'coinswitch',label: 'CoinSwitch'      },
    { value: 'wazirx',    label: 'WazirX'          },
    { value: 'delta',     label: 'Delta Exchange'  },
    { value: 'bitbns',    label: 'BitBns'          },
    { value: 'zebpay',    label: 'ZebPay'          },
    { value: 'mudrex',    label: 'Mudrex'          },
  ]
  const ALL_COINS = ['USDT','BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','MATIC','LINK','LTC','TRX','DOT','ATOM','UNI']

  // Bot engine state
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null)
  const [loadingBotConfig, setLoadingBotConfig] = useState(false)
  const [savingBotConfig, setSavingBotConfig] = useState(false)
  const [botRunning, setBotRunning] = useState(false)
  const [botLog, setBotLog] = useState<string[]>([])
  const [selectedOppForExec, setSelectedOppForExec] = useState<AdminArbitrageOpp | null>(null)
  const [execResult, setExecResult] = useState<{ success: boolean; message: string } | null>(null)
  const [executingTrade, setExecutingTrade] = useState(false)
  const [riskFilters, setRiskFilters] = useState<RiskFilterResult[]>([])
  const [loadingRisk, setLoadingRisk] = useState(false)
  const [netBreakdown, setNetBreakdown] = useState<NetProfitBreakdown | null>(null)

  // Analytics state
  const [analytics, setAnalytics] = useState<BotAnalytics | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

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

  async function loadBotConfig() {
    setLoadingBotConfig(true)
    try {
      const cfg = await getBotConfig()
      setBotConfig(cfg)
      setBotRunning(cfg.isRunning)
    } catch { /* ignore */ }
    finally { setLoadingBotConfig(false) }
  }

  async function handleSaveBotConfig(partial: Partial<BotConfig>) {
    if (!botConfig) return
    const updated = { ...botConfig, ...partial }
    setBotConfig(updated)
    setSavingBotConfig(true)
    try { await saveBotConfig(partial) } catch { /* ignore */ }
    finally { setSavingBotConfig(false) }
  }

  async function handleToggleBot() {
    if (!botConfig) return
    const next = !botRunning
    setBotRunning(next)
    setBotLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Bot ${next ? 'started' : 'stopped'} in ${botConfig.executionMode} mode`])
    await handleSaveBotConfig({ isRunning: next })
  }

  async function handleExecTrade(opp: AdminArbitrageOpp) {
    if (!botConfig) return
    setExecutingTrade(true)
    setExecResult(null)
    setBotLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Executing trade: ${opp.symbol} BUY ${opp.buyExchange} → SELL ${opp.sellExchange}`])
    try {
      const res = await executeBotTrade(opp, botConfig)
      setExecResult({ success: res.success, message: res.message })
      setBotLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${res.success ? 'SUCCESS' : 'FAILED'}: ${res.message}`])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setExecResult({ success: false, message: msg })
    } finally {
      setExecutingTrade(false)
    }
  }

  async function handleEvalRisk(opp: AdminArbitrageOpp) {
    if (!botConfig) return
    setLoadingRisk(true)
    setSelectedOppForExec(opp)
    try {
      const filters = await evaluateRiskFilters(opp, botConfig)
      setRiskFilters(filters)
      const bd = calcNetProfit(
        opp.symbol, opp.buyExchange, opp.sellExchange,
        opp.buyPrice, opp.sellPrice, botConfig.tradeAmountUsd, botConfig,
      )
      setNetBreakdown(bd)
    } catch { /* ignore */ }
    finally { setLoadingRisk(false) }
  }

  async function loadAnalytics() {
    setLoadingAnalytics(true)
    try {
      const a = await getBotAnalytics()
      setAnalytics(a)
    } catch { /* ignore */ }
    finally { setLoadingAnalytics(false) }
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
    if (subTab === 'bot-engine' && !botConfig) {
      loadBotConfig()
    }
    if (subTab === 'analytics' && !analytics) {
      loadAnalytics()
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

  // ── Live scan ───────────────────────────────────��────────────────���────────
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

  async function handleDeleteApiKey(exchange: string) {
    setDeletingExchange(exchange)
    try {
      await deleteExchangeApiKey(exchange)
      await loadApiKeys()
      setConfirmDeleteExchange(null)
    } finally {
      setDeletingExchange(null)
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
      // Blockchain filter: check if the symbol/coin exists on that blockchain
      if (filterBlockchain) {
        const coinBlockchains: Record<string, string[]> = {
          'BTC':   ['BTC', 'Polygon', 'Avalanche'],
          'ETH':   ['ERC20', 'Polygon', 'BSC', 'Avalanche'],
          'USDT':  ['ERC20', 'TRC20', 'BEP20', 'SOL', 'Polygon', 'Avalanche'],
          'BNB':   ['BEP20', 'ERC20'],
          'SOL':   ['SOL'],
          'XRP':   ['XRP', 'ERC20'],
          'ADA':   ['ADA'],
          'DOGE':  ['DOGE'],
          'MATIC': ['Polygon'],
          'LINK':  ['ERC20', 'BEP20', 'Polygon'],
        }
        const available = coinBlockchains[o.symbol] || []
        if (!available.some(b => b.toUpperCase().includes(filterBlockchain.toUpperCase()))) return false
      }
      return true
    })
    .sort((a, b) => sortByProfit === 'desc' ? b.netProfitPct - a.netProfitPct : a.netProfitPct - b.netProfitPct)

  const onlineCount  = exchangeStatuses.filter(e => e.online).length
  const totalPrices  = prices.length

  const KNOWN_EXCHANGES_LIST = [
    'binance','kraken','coinbase','bybit','kucoin','htx','bitfinex','okx','gateio','gemini','cryptocom','bitget',
  ]

  const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
    { key: 'live-scan',            label: 'Live Scan',       icon: Activity          },
    { key: 'sniper-bot',           label: 'Bot 2 — Sniper',  icon: Target            },
    { key: 'bot-engine',           label: 'Bot 1 — Engine',  icon: Cpu               },
    { key: 'analytics',            label: 'Analytics',       icon: LineChart         },
    { key: 'exchange-connections', label: 'API Keys',        icon: Key               },
    { key: 'balances',             label: 'Balances',        icon: Wallet            },
    { key: 'ai-strategy',          label: 'AI Strategy',     icon: Bot               },
    { key: 'transfer',             label: 'Transfer',        icon: SendHorizonal     },
    { key: 'transfer-routes',      label: 'Routes',          icon: ArrowRightLeft    },
    { key: 'settings',             label: 'Settings',        icon: Settings          },
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

      {/* ══ LIVE SCAN TAB ════════════��═�����═══════════════════════════════════ */}
      {subTab === 'live-scan' && (
        <div className="space-y-4">

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold rounded-lg text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning 21 exchanges...' : 'Run Full Market Scan'}
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
              {onlineCount > 0 && <span className="text-green-400 flex items-center gap-1.5"><StatusDot ok />{onlineCount}/21 online</span>}
              {totalPrices > 0 && <span className="text-slate-500">{totalPrices} price pts</span>}
            </div>
          </div>

          {scanError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {scanError}
            </div>
          )}

          {/* Live stats row */}
          {(opportunities.length > 0 || prices.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Total Opps',     value: opportunities.length.toString(),                          color: 'text-amber-400' },
                { label: 'Filtered',       value: filtered.length.toString(),                               color: 'text-white'     },
                { label: 'Best Spread',    value: `+${(filtered[0]?.netProfitPct ?? 0).toFixed(3)}%`,       color: 'text-green-400' },
                { label: 'Best $ / 1k',    value: `$${(filtered[0]?.profitPer1k ?? 0).toFixed(2)}`,         color: 'text-green-400' },
                { label: 'Exchanges Live', value: `${onlineCount} / 21`,                                    color: 'text-cyan-400'  },
              ].map(stat => (
                <Card key={stat.label} className="bg-slate-900 border-slate-800 p-3 text-center">
                  <p className="text-slate-500 text-xs mb-1">{stat.label}</p>
                  <p className={`font-bold text-lg ${stat.color}`}>{stat.value}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Filters */}
          <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-slate-400 font-semibold">Market Filters</p>
              {(filterSymbol || filterMinProfit > 0 || filterBuyEx || filterSellEx || filterBlockchain) && (
                <button onClick={() => { setFilterSymbol(''); setFilterMinProfit(0); setFilterBuyEx(''); setFilterSellEx(''); setFilterBlockchain('') }}
                  className="ml-auto text-xs text-slate-500 hover:text-amber-400 transition-colors">
                  Clear all filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Coin</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)}
                    placeholder="BTC, ETH..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Min Profit %</label>
                <input type="number" min="0" step="0.1" value={filterMinProfit}
                  onChange={e => setFilterMinProfit(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Buy Exchange</label>
                <select value={filterBuyEx} onChange={e => setFilterBuyEx(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50">
                  <option value="">All exchanges</option>
                  <option value="binance">Binance</option>
                  <option value="okx">OKX</option>
                  <option value="bybit">Bybit</option>
                  <option value="kucoin">KuCoin</option>
                  <option value="kraken">Kraken</option>
                  <option value="coinbase">Coinbase</option>
                  <option value="gateio">Gate.io</option>
                  <option value="bitfinex">Bitfinex</option>
                  <option value="coinswitch">CoinSwitch</option>
                  <option value="delta">Delta</option>
                  <option value="wazirx">WazirX</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Sell Exchange</label>
                <select value={filterSellEx} onChange={e => setFilterSellEx(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50">
                  <option value="">All exchanges</option>
                  <option value="binance">Binance</option>
                  <option value="okx">OKX</option>
                  <option value="bybit">Bybit</option>
                  <option value="kucoin">KuCoin</option>
                  <option value="kraken">Kraken</option>
                  <option value="coinbase">Coinbase</option>
                  <option value="gateio">Gate.io</option>
                  <option value="bitfinex">Bitfinex</option>
                  <option value="coinswitch">CoinSwitch</option>
                  <option value="delta">Delta</option>
                  <option value="wazirx">WazirX</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Blockchain</label>
                <select value={filterBlockchain} onChange={e => setFilterBlockchain(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50">
                  <option value="">All blockchains</option>
                  <option value="ERC20">Ethereum (ERC20)</option>
                  <option value="BEP20">Binance (BEP20)</option>
                  <option value="TRC20">TRON (TRC20)</option>
                  <option value="SOL">Solana (SOL)</option>
                  <option value="Polygon">Polygon</option>
                  <option value="Avalanche">Avalanche</option>
                  <option value="BTC">Bitcoin</option>
                  <option value="XRP">XRP Ledger</option>
                  <option value="ADA">Cardano</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">Sort</label>
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
                {opportunities.length === 0
                  ? 'Click "Run Full Market Scan" to scan live prices across all exchange pairs'
                  : `${opportunities.length} total opportunities found — adjust filters to show more`}
              </p>
              {opportunities.length === 0 && (
                <p className="text-slate-600 text-xs mt-2">
                  Global: Binance · Bybit · KuCoin · OKX · Gate.io · Kraken · Coinbase · Bitget · MEXC · HTX · Bitfinex · Gemini · Upbit · Phemex &nbsp;|&nbsp; India: CoinDCX · CoinSwitch · WazirX · Delta Exchange · BitBns · ZebPay · Mudrex
                </p>
              )}
            </Card>
          ) : (
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-left">
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Symbol</th>
                      <th className="px-3 py-3 font-medium">Route</th>
                      <th className="px-3 py-3 font-medium text-right">Buy</th>
                      <th className="px-3 py-3 font-medium text-right">Sell</th>
                      <th className="px-3 py-3 font-medium text-right">Spread</th>
                      <th className="px-3 py-3 font-medium text-right">Fees</th>
                      <th className="px-3 py-3 font-medium text-right">Slippage</th>
                      <th className="px-3 py-3 font-medium text-right">Net Profit</th>
                      <th className="px-3 py-3 font-medium text-right">Transfer</th>
                      <th className="px-3 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filtered.map(opp => (
                      <tr key={opp.id} className={`hover:bg-slate-800/40 transition-colors ${!opp.viable ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-3">
                          {opp.viable
                            ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3.5 h-3.5" /><span className="text-[10px] font-bold">VIABLE</span></span>
                            : <span className="flex items-center gap-1 text-red-400"><XCircleIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold">REJECT</span></span>
                          }
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-white font-bold">{opp.symbol}</span>
                          <span className="text-slate-600">/USDT</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <ExchangeBadge exchange={opp.buyExchange} />
                            <ArrowRightLeft className="w-3 h-3 text-slate-600" />
                            <ExchangeBadge exchange={opp.sellExchange} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-400 text-[11px]">
                          ${opp.buyPrice < 1 ? opp.buyPrice.toFixed(5) : opp.buyPrice.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-400 text-[11px]">
                          ${opp.sellPrice < 1 ? opp.sellPrice.toFixed(5) : opp.sellPrice.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </td>
                        <td className="px-3 py-3 text-right"><span className="text-cyan-400 font-semibold">+{opp.profitPct.toFixed(3)}%</span></td>
                        <td className="px-3 py-3 text-right">
                          <div className="text-right">
                            <span className="text-red-400 font-mono text-[10px]">-${opp.tradingFeeUsd.toFixed(2)}</span>
                            <span className="text-slate-600 text-[9px] block">+wd ${opp.withdrawalFeeUsd.toFixed(2)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-orange-400 font-mono text-[10px]">-${opp.slippageUsd.toFixed(2)}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <ProfitBadge pct={opp.netProfitPct} />
                          <span className={`block text-[10px] font-mono mt-0.5 ${opp.netProfitUsd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {opp.netProfitUsd >= 0 ? '+' : ''}${opp.netProfitUsd.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-slate-400 text-[10px] flex items-center justify-end gap-1">
                            <Timer className="w-3 h-3" />{opp.estimatedTransferMin}m
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => { setSubTab('bot-engine'); loadBotConfig().then(() => { setSelectedOppForExec(opp); handleEvalRisk(opp) }) }}
                            className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap"
                          >
                            Evaluate
                          </button>
                        </td>
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

      {/* ══ BOT 2 — SNIPER TAB ════════════════════════════════════════════ */}
      {subTab === 'sniper-bot' && <SniperBotTab />}

      {/* ══ BOT ENGINE TAB ════════════════════════════════════════════════ */}
      {subTab === 'bot-engine' && (
        <div className="space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Cpu className="w-5 h-5 text-amber-400" />
                Arbitrage Bot Engine
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Configure execution parameters, risk filters, and net profit formula. Monitor and control live bot operation.</p>
            </div>
            <div className="flex items-center gap-2">
              {savingBotConfig && <span className="text-slate-500 text-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
              <button
                onClick={() => loadBotConfig()}
                disabled={loadingBotConfig}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBotConfig ? 'animate-spin' : ''}`} />
                Reload
              </button>
            </div>
          </div>

          {loadingBotConfig ? (
            <Card className="bg-slate-900 border-slate-800 p-12 text-center">
              <Loader2 className="w-8 h-8 text-slate-500 mx-auto mb-3 animate-spin" />
              <p className="text-slate-400 text-sm">Loading bot configuration...</p>
            </Card>
          ) : botConfig && (
            <div className="space-y-4">

              {/* Bot status + master controls */}
              <Card className={`border-2 p-5 ${botRunning ? 'bg-green-950/30 border-green-500/40' : 'bg-slate-900 border-slate-700'}`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${botRunning ? 'bg-green-500/20' : 'bg-slate-800'}`}>
                      <Cpu className={`w-6 h-6 ${botRunning ? 'text-green-400' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-base">Arbitrage Bot</span>
                        {botRunning
                          ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-bold animate-pulse">RUNNING</span>
                          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600 font-bold">STOPPED</span>
                        }
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">Mode: <span className="text-amber-400 font-medium capitalize">{botConfig.executionMode}</span> · Order: <span className="text-cyan-400 font-medium capitalize">{botConfig.orderType}</span> · Pre-funded: <span className={`font-medium ${botConfig.preFundedMode ? 'text-green-400' : 'text-slate-500'}`}>{botConfig.preFundedMode ? 'On' : 'Off'}</span></p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleToggleBot}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                        botRunning
                          ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                          : 'bg-green-500 hover:bg-green-400 text-black'
                      }`}
                    >
                      {botRunning ? <><Pause className="w-4 h-4" /> Stop Bot</> : <><Play className="w-4 h-4" /> Start Bot</>}
                    </button>
                  </div>
                </div>
              </Card>

              {/* Bot log */}
              {botLog.length > 0 && (
                <Card className="bg-slate-950 border-slate-800 p-4">
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5"><Activity className="w-3 h-3" /> Bot Log</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {botLog.slice(-10).reverse().map((line, i) => (
                      <p key={i} className="text-xs font-mono text-slate-400">{line}</p>
                    ))}
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Execution Mode + Order Settings */}
                <Card className="bg-slate-900 border-slate-800 p-5 space-y-4">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><Target className="w-4 h-4 text-amber-400" /> Execution Engine</h4>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Execution Mode</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['monitor','semi-auto','full-auto'] as const).map(mode => (
                        <button key={mode} onClick={() => handleSaveBotConfig({ executionMode: mode })}
                          className={`py-2 rounded-lg text-xs font-semibold border transition-colors capitalize ${
                            botConfig.executionMode === mode
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >{mode}</button>
                      ))}
                    </div>
                    <p className="text-slate-600 text-[10px] mt-1.5">
                      {botConfig.executionMode === 'monitor' && 'Monitor only — no trades executed. Alerts still fire.'}
                      {botConfig.executionMode === 'semi-auto' && 'Requires manual confirm per trade before execution.'}
                      {botConfig.executionMode === 'full-auto' && 'Fully autonomous — executes trades automatically when filters pass.'}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Order Type</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['market','limit'] as const).map(ot => (
                        <button key={ot} onClick={() => handleSaveBotConfig({ orderType: ot })}
                          className={`py-2 rounded-lg text-xs font-semibold border transition-colors capitalize ${
                            botConfig.orderType === ot
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >{ot} Orders</button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg">
                    <div>
                      <p className="text-white text-xs font-semibold">Pre-Funded Mode</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">Accounts funded on all exchanges — buy and sell simultaneously without waiting for transfers</p>
                    </div>
                    <button onClick={() => handleSaveBotConfig({ preFundedMode: !botConfig.preFundedMode })} className="ml-3">
                      {botConfig.preFundedMode
                        ? <ToggleRight className="w-7 h-7 text-green-400" />
                        : <ToggleLeft className="w-7 h-7 text-slate-600" />
                      }
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Trade Amount ($)</label>
                      <input type="number" min="10" value={botConfig.tradeAmountUsd}
                        onChange={e => handleSaveBotConfig({ tradeAmountUsd: parseFloat(e.target.value) || 1000 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Max Order Size ($)</label>
                      <input type="number" min="100" value={botConfig.maxOrderSizeUsd}
                        onChange={e => handleSaveBotConfig({ maxOrderSizeUsd: parseFloat(e.target.value) || 10000 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Scan Interval (seconds)</label>
                    <input type="number" min="5" max="300" value={botConfig.scanIntervalSeconds}
                      onChange={e => handleSaveBotConfig({ scanIntervalSeconds: parseInt(e.target.value) || 30 })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                  </div>
                </Card>

                {/* Net Profit Formula */}
                <Card className="bg-slate-900 border-slate-800 p-5 space-y-4">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><BadgeDollarSign className="w-4 h-4 text-green-400" /> Net Profit Formula</h4>

                  <div className="bg-slate-950/80 rounded-lg p-3 text-xs font-mono space-y-1.5 border border-slate-800">
                    <p className="text-slate-300">Net Profit =</p>
                    <p className="text-green-400 pl-2">Sell Value</p>
                    <p className="text-red-400 pl-2">− Buy Value</p>
                    <p className="text-red-400 pl-2">− Trading Fees</p>
                    <p className="text-red-400 pl-2">− Withdrawal Fees</p>
                    <p className="text-red-400 pl-2">− Network Fees</p>
                    <p className="text-red-400 pl-2">− Estimated Slippage</p>
                    <p className="text-orange-400 pl-2">− Safety Buffer ({botConfig.safetyBufferPct}%)</p>
                    <p className="text-slate-500 mt-1 border-t border-slate-800 pt-1">Execute only if:</p>
                    <p className="text-amber-400 pl-2">Net Profit % &gt;= {botConfig.minProfitPct}%</p>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Min Profit % (Net)</label>
                        <input type="number" step="0.01" min="0" value={botConfig.minProfitPct}
                          onChange={e => handleSaveBotConfig({ minProfitPct: parseFloat(e.target.value) || 0.5 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Min Profit USD</label>
                        <input type="number" step="1" min="0" value={botConfig.minProfitUsd}
                          onChange={e => handleSaveBotConfig({ minProfitUsd: parseFloat(e.target.value) || 5 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Safety Buffer % (of trade size)</label>
                      <input type="number" step="0.01" min="0" max="2" value={botConfig.safetyBufferPct}
                        onChange={e => handleSaveBotConfig({ safetyBufferPct: parseFloat(e.target.value) || 0.1 })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Fee Override % <span className="text-slate-600">(blank=auto)</span></label>
                        <input type="number" step="0.01" min="0" placeholder="auto"
                          value={botConfig.tradingFeePct ?? ''}
                          onChange={e => handleSaveBotConfig({ tradingFeePct: e.target.value ? parseFloat(e.target.value) : null })}
                          className="w-full px-2 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">WD Fee $ <span className="text-slate-600">(blank=auto)</span></label>
                        <input type="number" step="0.1" min="0" placeholder="auto"
                          value={botConfig.withdrawalFeeOverride ?? ''}
                          onChange={e => handleSaveBotConfig({ withdrawalFeeOverride: e.target.value ? parseFloat(e.target.value) : null })}
                          className="w-full px-2 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Net Fee $ <span className="text-slate-600">(blank=auto)</span></label>
                        <input type="number" step="0.1" min="0" placeholder="auto"
                          value={botConfig.networkFeeOverride ?? ''}
                          onChange={e => handleSaveBotConfig({ networkFeeOverride: e.target.value ? parseFloat(e.target.value) : null })}
                          className="w-full px-2 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Risk Filters */}
                <Card className="bg-slate-900 border-slate-800 p-5 space-y-4">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-red-400" /> Risk Filters</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Max Slippage %</label>
                        <input type="number" step="0.01" min="0" value={botConfig.maxSlippagePct}
                          onChange={e => handleSaveBotConfig({ maxSlippagePct: parseFloat(e.target.value) || 0.3 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-red-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Max Transfer Time (min)</label>
                        <input type="number" min="1" value={botConfig.maxTransferTimeMin}
                          onChange={e => handleSaveBotConfig({ maxTransferTimeMin: parseInt(e.target.value) || 30 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-red-500/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Max API Latency (ms)</label>
                        <input type="number" min="100" value={botConfig.maxApiLatencyMs}
                          onChange={e => handleSaveBotConfig({ maxApiLatencyMs: parseInt(e.target.value) || 2000 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-red-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Min Liquidity ($)</label>
                        <input type="number" min="1000" value={botConfig.minLiquidityUsd}
                          onChange={e => handleSaveBotConfig({ minLiquidityUsd: parseFloat(e.target.value) || 50000 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-red-500/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Max Daily Loss ($)</label>
                        <input type="number" min="0" value={botConfig.maxDailyLossUsd}
                          onChange={e => handleSaveBotConfig({ maxDailyLossUsd: parseFloat(e.target.value) || 500 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-red-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Max Open Positions</label>
                        <input type="number" min="1" max="20" value={botConfig.maxOpenPositions}
                          onChange={e => handleSaveBotConfig({ maxOpenPositions: parseInt(e.target.value) || 3 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-red-500/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Max Position Size ($)</label>
                        <input type="number" min="100" value={botConfig.maxPositionSizeUsd}
                          onChange={e => handleSaveBotConfig({ maxPositionSizeUsd: parseFloat(e.target.value) || 5000 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-red-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Min Exchange Risk Score (0-10)</label>
                        <input type="number" min="0" max="10" step="0.5" value={botConfig.minExchangeRiskScore}
                          onChange={e => handleSaveBotConfig({ minExchangeRiskScore: parseFloat(e.target.value) || 7 })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-red-500/50" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Risk filter evaluator */}
                <Card className="bg-slate-900 border-slate-800 p-5 space-y-4">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><FlaskConical className="w-4 h-4 text-purple-400" /> Risk Filter Evaluator</h4>
                  <p className="text-slate-500 text-xs">Select an opportunity from Live Scan then evaluate all risk filters against it.</p>

                  {opportunities.length === 0 ? (
                    <div className="p-3 bg-slate-800/60 rounded-lg text-slate-500 text-xs">
                      Run a Live Scan first to load opportunities, then return here to evaluate.
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-slate-400 mb-1.5 block">Choose Opportunity</label>
                      <select
                        value={selectedOppForExec?.id ?? ''}
                        onChange={e => {
                          const opp = opportunities.find(o => o.id === e.target.value) ?? null
                          setSelectedOppForExec(opp)
                          setRiskFilters([])
                          setNetBreakdown(null)
                        }}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="">-- Select opportunity --</option>
                        {opportunities.slice(0, 20).map(o => (
                          <option key={o.id} value={o.id}>
                            {o.symbol}: {o.buyExchange} → {o.sellExchange} (+{o.profitPct.toFixed(3)}%)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedOppForExec && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEvalRisk(selectedOppForExec)}
                        disabled={loadingRisk}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        <FlaskConical className={`w-3.5 h-3.5 ${loadingRisk ? 'animate-spin' : ''}`} />
                        Evaluate Risk Filters
                      </button>
                      <button
                        onClick={() => handleExecTrade(selectedOppForExec)}
                        disabled={executingTrade || botConfig.executionMode === 'monitor'}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold rounded-lg transition-colors"
                      >
                        <Zap className={`w-3.5 h-3.5 ${executingTrade ? 'animate-spin' : ''}`} />
                        {executingTrade ? 'Executing...' : 'Execute Trade'}
                      </button>
                    </div>
                  )}

                  {execResult && (
                    <div className={`p-3 rounded-lg border text-xs ${execResult.success ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                      {execResult.success ? <CheckCircle className="w-3.5 h-3.5 inline mr-1.5" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />}
                      {execResult.message}
                    </div>
                  )}

                  {/* Net profit breakdown */}
                  {netBreakdown && (
                    <div className="space-y-2">
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Net Profit Breakdown</p>
                      <div className="bg-slate-950/80 rounded-lg p-3 space-y-1.5 border border-slate-800 text-xs font-mono">
                        <div className="flex justify-between text-slate-300"><span>Trade Size</span><span>${netBreakdown.tradeAmountUsd.toLocaleString()}</span></div>
                        <div className="flex justify-between text-green-400"><span>+ Gross Profit</span><span>+${netBreakdown.grossProfit.toFixed(2)}</span></div>
                        <div className="border-t border-slate-800 my-1" />
                        <div className="flex justify-between text-red-400"><span>��� Trading Fees</span><span>-${(netBreakdown.tradingFeeBuy + netBreakdown.tradingFeeSell).toFixed(2)}</span></div>
                        <div className="flex justify-between text-red-400"><span>− Withdrawal Fee</span><span>-${netBreakdown.withdrawalFee.toFixed(2)}</span></div>
                        <div className="flex justify-between text-red-400"><span>− Network Fee</span><span>-${netBreakdown.networkFee.toFixed(2)}</span></div>
                        <div className="flex justify-between text-red-400"><span>− Slippage</span><span>-${netBreakdown.estimatedSlippage.toFixed(2)}</span></div>
                        <div className="flex justify-between text-orange-400"><span>− Safety Buffer</span><span>-${netBreakdown.safetyBuffer.toFixed(2)}</span></div>
                        <div className="border-t border-slate-700 my-1" />
                        <div className={`flex justify-between font-bold text-sm ${netBreakdown.viable ? 'text-green-400' : 'text-red-400'}`}>
                          <span>= Net Profit</span>
                          <span>{netBreakdown.netProfit >= 0 ? '+' : ''}${netBreakdown.netProfit.toFixed(2)} ({netBreakdown.netProfitPct.toFixed(3)}%)</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[10px]"><span>Transfer Time</span><span>~{netBreakdown.estimatedTransferMin}m</span></div>
                      </div>
                      {netBreakdown.rejectReason && (
                        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[10px] flex items-start gap-1.5">
                          <XCircleIcon className="w-3 h-3 mt-0.5 shrink-0" />
                          {netBreakdown.rejectReason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Risk filters table */}
                  {riskFilters.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Risk Filter Results</p>
                      <div className="rounded-lg border border-slate-800 overflow-hidden">
                        {riskFilters.map((f, i) => (
                          <div key={i} className={`flex items-start gap-3 px-3 py-2.5 border-b border-slate-800/60 last:border-0 ${f.passed ? '' : 'bg-red-950/20'}`}>
                            {f.passed
                              ? <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                              : <XCircleIcon className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-medium ${f.passed ? 'text-slate-300' : 'text-red-300'}`}>{f.filter}</span>
                                <span className="text-[10px] font-mono text-slate-500">{f.value}</span>
                              </div>
                              <p className="text-slate-600 text-[10px] truncate">{f.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

              </div>

              {/* Alerts config */}
              <Card className="bg-slate-900 border-slate-800 p-5">
                <h4 className="text-white font-bold text-sm flex items-center gap-2 mb-4"><Zap className="w-4 h-4 text-yellow-400" /> Alert Configuration</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {([
                    { label: 'On Opportunity', key: 'alertOnOpportunity' as keyof BotConfig },
                    { label: 'On Execution',   key: 'alertOnExecution'  as keyof BotConfig },
                    { label: 'On Failure',     key: 'alertOnFailure'    as keyof BotConfig },
                    { label: 'Low Balance',    key: 'alertOnLowBalance' as keyof BotConfig },
                  ] as const).map(({ label, key }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg">
                      <span className="text-slate-400 text-xs">{label}</span>
                      <button onClick={() => handleSaveBotConfig({ [key]: !botConfig[key] } as Partial<BotConfig>)}>
                        {botConfig[key]
                          ? <ToggleRight className="w-5 h-5 text-green-400" />
                          : <ToggleLeft className="w-5 h-5 text-slate-600" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Telegram Chat ID</label>
                    <input value={botConfig.telegramChatId ?? ''}
                      onChange={e => handleSaveBotConfig({ telegramChatId: e.target.value || null })}
                      placeholder="-100123456789"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Discord Webhook URL</label>
                    <input value={botConfig.discordWebhook ?? ''}
                      onChange={e => handleSaveBotConfig({ discordWebhook: e.target.value || null })}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                  </div>
                </div>
              </Card>

            </div>
          )}
        </div>
      )}

      {/* ══ ANALYTICS TAB ═════════════════════════════════════════════════════ */}
      {subTab === 'analytics' && (
        <div className="space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <LineChart className="w-5 h-5 text-amber-400" />
                Bot Analytics & P&L
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Performance metrics, profitability stats, and trading history.</p>
            </div>
            <button onClick={loadAnalytics} disabled={loadingAnalytics}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingAnalytics ? (
            <Card className="bg-slate-900 border-slate-800 p-12 text-center">
              <Loader2 className="w-8 h-8 text-slate-500 mx-auto mb-3 animate-spin" />
              <p className="text-slate-400 text-sm">Loading analytics...</p>
            </Card>
          ) : analytics && (
            <div className="space-y-4">

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Net P&L',          value: `$${analytics.netProfitUsd.toFixed(2)}`,      sub: `Gross $${analytics.totalProfitUsd.toFixed(2)}`,       color: analytics.netProfitUsd >= 0 ? 'text-green-400' : 'text-red-400', icon: TrendingUp  },
                  { label: 'Win Rate',          value: `${analytics.winRate.toFixed(1)}%`,           sub: `${analytics.successfulTrades}/${analytics.executedTrades} trades`,  color: 'text-amber-400',  icon: Target    },
                  { label: 'Sharpe Ratio',      value: analytics.sharpeRatio.toFixed(2),             sub: '> 1.0 is good',                                       color: analytics.sharpeRatio > 1 ? 'text-green-400' : analytics.sharpeRatio > 0 ? 'text-amber-400' : 'text-red-400', icon: BarChart3 },
                  { label: 'Max Drawdown',      value: `${analytics.maxDrawdownPct.toFixed(1)}%`,    sub: 'Peak-to-trough',                                      color: analytics.maxDrawdownPct > 20 ? 'text-red-400' : 'text-cyan-400', icon: TrendingDown },
                ].map(stat => (
                  <Card key={stat.label} className="bg-slate-900 border-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">{stat.label}</p>
                        <p className={`font-bold text-xl leading-none ${stat.color}`}>{stat.value}</p>
                        <p className="text-slate-600 text-[10px] mt-1">{stat.sub}</p>
                      </div>
                      <stat.icon className={`w-5 h-5 ${stat.color} opacity-50`} />
                    </div>
                  </Card>
                ))}
              </div>

              {/* Secondary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Opportunities', value: analytics.totalOpportunities.toString(),  color: 'text-slate-300' },
                  { label: 'Executed Trades',      value: analytics.executedTrades.toString(),      color: 'text-slate-300' },
                  { label: 'Avg ROI Per Trade',    value: `${analytics.avgRoiPct.toFixed(3)}%`,    color: analytics.avgRoiPct > 0 ? 'text-green-400' : 'text-slate-400' },
                  { label: 'Best Trade',           value: `$${analytics.bestTradeProfitUsd.toFixed(2)}`, color: 'text-green-400' },
                ].map(s => (
                  <Card key={s.label} className="bg-slate-900 border-slate-800 p-3 text-center">
                    <p className="text-slate-500 text-xs mb-1">{s.label}</p>
                    <p className={`font-bold text-lg ${s.color}`}>{s.value}</p>
                  </Card>
                ))}
              </div>

              {/* Daily P&L chart (text-based sparkline) */}
              <Card className="bg-slate-900 border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><LineChart className="w-4 h-4 text-cyan-400" /> Daily P&L (14 days)</h4>
                  <span className="text-slate-500 text-xs">
                    Total: <span className={analytics.dailyProfit.reduce((s, d) => s + d.profit, 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ${analytics.dailyProfit.reduce((s, d) => s + d.profit, 0).toFixed(2)}
                    </span>
                  </span>
                </div>
                {/* Visual bar chart */}
                <div className="flex items-end gap-1 h-24">
                  {analytics.dailyProfit.map((d, i) => {
                    const maxAbs = Math.max(...analytics.dailyProfit.map(x => Math.abs(x.profit)), 1)
                    const heightPct = Math.abs(d.profit) / maxAbs * 100
                    const isPos = d.profit >= 0
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                        <div
                          style={{ height: `${Math.max(heightPct, 2)}%` }}
                          className={`w-full rounded-sm transition-all ${isPos ? 'bg-green-500/60 group-hover:bg-green-400' : 'bg-red-500/60 group-hover:bg-red-400'}`}
                        />
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {d.date.slice(5)}: {isPos ? '+' : ''}${d.profit.toFixed(0)} ({d.trades} trades)
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-600 text-[9px]">{analytics.dailyProfit[0]?.date.slice(5)}</span>
                  <span className="text-slate-600 text-[9px]">{analytics.dailyProfit.at(-1)?.date.slice(5)}</span>
                </div>
              </Card>

              {/* Top pairs + summary row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                <Card className="bg-slate-900 border-slate-800 p-5">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2 mb-3"><Layers className="w-4 h-4 text-amber-400" /> Top Trading Pairs</h4>
                  {analytics.topPairs.length === 0 ? (
                    <p className="text-slate-500 text-xs">No executed trades yet. Run the bot to generate data.</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics.topPairs.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 text-xs w-4">{i + 1}</span>
                            <span className="text-white text-xs font-bold">{p.symbol}</span>
                            <ExchangeBadge exchange={p.buyEx} />
                            <ArrowRightLeft className="w-3 h-3 text-slate-600" />
                            <ExchangeBadge exchange={p.sellEx} />
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-bold ${p.totalProfit > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                              {p.totalProfit > 0 ? '+' : ''}${p.totalProfit.toFixed(2)}
                            </p>
                            <p className="text-slate-600 text-[10px]">{p.count} trades</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="bg-slate-900 border-slate-800 p-5 space-y-3">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-400" /> Risk Summary</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Total Fees Paid',       value: `$${analytics.totalFeesUsd.toFixed(2)}`,        color: 'text-red-400'    },
                      { label: 'Avg Transfer Time',     value: `${analytics.avgTransferTimeMin}m`,              color: 'text-slate-300'  },
                      { label: 'Failed Trades',         value: analytics.failedTrades.toString(),              color: analytics.failedTrades > 0 ? 'text-red-400' : 'text-green-400' },
                      { label: 'Max Drawdown',          value: `${analytics.maxDrawdownPct.toFixed(1)}%`,      color: analytics.maxDrawdownPct > 15 ? 'text-red-400' : 'text-amber-400' },
                      { label: 'Sharpe Ratio',          value: analytics.sharpeRatio.toFixed(2),               color: analytics.sharpeRatio > 1 ? 'text-green-400' : 'text-amber-400' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">{r.label}</span>
                        <span className={`text-xs font-bold ${r.color}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

            </div>
          )}

          {!analytics && !loadingAnalytics && (
            <Card className="bg-slate-900 border-slate-800 p-12 text-center">
              <BarChart3 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">Click Refresh to load analytics data</p>
            </Card>
          )}
        </div>
      )}

      {/* ══ EXCHANGE API CONNECTIONS TAB ═══════════════════════════════════ */}
      {subTab === 'exchange-connections' && (
        <div className="space-y-4">

          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                Exchange API Connections
              </h3>
              <p className="text-slate-500 text-xs mt-1">Connect API keys for automated trading. Enable Public API for price data only. Add full credentials for trade execution and withdrawals.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => loadApiKeys()} disabled={loadingKeys}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded-lg transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingKeys ? 'animate-spin' : ''}`} /> Reload
              </button>
              <button onClick={handleTestAll} disabled={testingAll}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold rounded-lg text-xs transition-colors">
                <TestTube2 className={`w-3.5 h-3.5 ${testingAll ? 'animate-spin' : ''}`} />
                {testingAll ? 'Testing All...' : 'Test All'}
              </button>
            </div>
          </div>

          {loadingKeys ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="bg-slate-900 border-slate-800 p-5 animate-pulse h-44" />
              ))}
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(() => {
                  const withKeys = apiKeys.filter(k => k.apiKey).length
                  const online   = Object.values(testResults).filter(r => r?.ok).length
                  const failing  = Object.values(testResults).filter(r => r?.ok === false).length
                  const enabled  = apiKeys.filter(k => k.isEnabled).length
                  return [
                    { label: 'With API Keys',  value: `${withKeys}/${apiKeys.length}`, icon: Key,      color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Online',         value: online.toString(),               icon: Wifi,     color: 'text-green-400', bg: 'bg-green-500/10' },
                    { label: 'Failed',         value: failing.toString(),              icon: WifiOff,  color: failing > 0 ? 'text-red-400' : 'text-slate-500', bg: failing > 0 ? 'bg-red-500/10' : 'bg-slate-800' },
                    { label: 'Enabled',        value: enabled.toString(),              icon: Activity, color: 'text-cyan-400',  bg: 'bg-cyan-500/10'  },
                  ].map(s => (
                    <Card key={s.label} className="bg-slate-900 border-slate-800 p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                          <s.icon className={`w-4 h-4 ${s.color}`} />
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px]">{s.label}</p>
                          <p className={`font-bold text-base leading-none mt-0.5 ${s.color}`}>{s.value}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                })()}
              </div>

              {/* Search + Region Filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={searchExchange}
                    onChange={e => setSearchExchange(e.target.value)}
                    placeholder="Search exchange..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg focus:outline-none focus:border-slate-500"
                  />
                </div>
                {['All', 'Global', 'India', 'Korea', 'Data'].map(r => (
                  <button key={r} onClick={() => setRegionFilter(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      regionFilter === r
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}>
                    {r}
                  </button>
                ))}
                <span className="text-slate-600 text-xs ml-auto">
                  {apiKeys.filter(k =>
                    (regionFilter === 'All' || k.region === regionFilter) &&
                    (searchExchange === '' || k.label.toLowerCase().includes(searchExchange.toLowerCase()) || k.exchange.includes(searchExchange.toLowerCase()))
                  ).length} exchanges
                </span>
              </div>

              {/* Exchanges grid — grouped by region */}
              <div className="space-y-6">
              {(() => {
                const regions = regionFilter === 'All'
                  ? ['Global', 'India', 'Korea', 'Data']
                  : [regionFilter]
                const filtered = apiKeys.filter(k =>
                  (regionFilter === 'All' || k.region === regionFilter) &&
                  (searchExchange === '' || k.label.toLowerCase().includes(searchExchange.toLowerCase()) || k.exchange.includes(searchExchange.toLowerCase()))
                )
                if (filtered.length === 0) return (
                  <div className="text-center text-slate-500 py-10 text-sm">No exchanges match your filter.</div>
                )
                return regions.map(region => {
                  const group = filtered.filter(k => k.region === region)
                  if (group.length === 0) return null
                  const REGION_LABELS: Record<string, string> = { Global: 'Global Exchanges', India: 'India Exchanges', Korea: 'Korea Exchanges', Data: 'Data & Reference APIs' }
                  return (
                    <div key={region} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{REGION_LABELS[region] ?? region}</span>
                        <div className="flex-1 h-px bg-slate-800" />
                        <span className="text-[10px] text-slate-600">{group.filter(k => k.apiKey).length}/{group.length} configured</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {group.map(ex => {
                  const keyResult  = testResults[ex.exchange]
                  const liveStatus = keyResult ?? (ex.lastTestStatus ? { ok: ex.lastTestStatus === 'ok', latencyMs: ex.lastTestMs ?? 0, message: '' } : null)
                  const hasKeys    = !!ex.apiKey
                  const isOnline   = liveStatus?.ok === true
                  const isFailing  = liveStatus?.ok === false
                  const isTesting  = testingExchange === ex.exchange

                  return (
                    <Card key={ex.exchange} className={`border transition-all duration-200 overflow-hidden ${
                      isOnline  ? 'bg-slate-900 border-green-500/30'  :
                      isFailing ? 'bg-slate-900 border-red-500/30'    :
                      hasKeys   ? 'bg-slate-900 border-amber-500/20'  :
                      'bg-slate-900 border-slate-800'
                    }`}>

                      {/* Top accent bar */}
                      <div className="h-0.5 w-full" style={{ background: ex.color + '40' }} />

                      {/* Card header */}
                      <div className="flex items-center justify-between px-4 pt-4 pb-3">
                        <div className="flex items-center gap-3">
                          {/* Exchange logo square */}
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black border border-slate-700 bg-slate-800 shrink-0"
                            style={{ color: ex.color }}>
                            {EXCHANGE_ABBR[ex.exchange] ?? ex.label.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold text-sm">{ex.label}</span>
                              {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />}
                              {isFailing && <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                                ex.isPublicOnly
                                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              }`}>
                                {ex.isPublicOnly ? 'Public Only' : 'Authenticated'}
                              </span>
                              <span className="text-[9px] text-slate-600 font-mono">Fee: {ex.tradingFee}</span>
                              {ex.requiresIpWhitelist && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded border bg-orange-500/10 border-orange-500/30 text-orange-300 font-semibold">IP Whitelist</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Enable toggle */}
                        <button onClick={() => handleToggleEnabled(ex.exchange, ex.isEnabled)}
                          title={ex.isEnabled ? 'Disable exchange' : 'Enable exchange'}
                          className="shrink-0 transition-colors">
                          {ex.isEnabled
                            ? <ToggleRight className="w-6 h-6 text-green-400" />
                            : <ToggleLeft  className="w-6 h-6 text-slate-600" />
                          }
                        </button>
                      </div>

                      {/* Body */}
                      <div className="px-4 pb-3 space-y-2.5">

                        {/* Connection test status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {isOnline ? (
                              <><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400 text-xs font-semibold">Online</span></>
                            ) : isFailing ? (
                              <><XCircleIcon className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400 text-xs font-semibold">Failed</span></>
                            ) : (
                              <><Minus className="w-3.5 h-3.5 text-slate-600" /><span className="text-slate-500 text-xs">Not tested</span></>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {liveStatus?.latencyMs ? (
                              <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{liveStatus.latencyMs}ms</span>
                            ) : null}
                            {ex.lastTestedAt && (
                              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                <Clock className="w-3 h-3" />{new Date(ex.lastTestedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Error message */}
                        {isFailing && liveStatus?.message && (
                          <div className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-red-300 text-[10px] font-mono">
                            {liveStatus.message}
                          </div>
                        )}

                        {/* API credentials status row */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className={`px-2 py-1.5 rounded text-center border ${ex.apiKey ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-800/60 border-slate-700'}`}>
                            <p className="text-[9px] text-slate-500">API Key</p>
                            {ex.apiKey
                              ? <p className="text-[10px] text-green-400 font-mono font-bold">••••{ex.apiKey.slice(-4)}</p>
                              : <p className="text-[10px] text-slate-600 italic">none</p>
                            }
                          </div>
                          <div className={`px-2 py-1.5 rounded text-center border ${ex.apiSecret ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-800/60 border-slate-700'}`}>
                            <p className="text-[9px] text-slate-500">Secret</p>
                            <p className={`text-[10px] font-bold ${ex.apiSecret ? 'text-green-400' : 'text-slate-600 italic'}`}>{ex.apiSecret ? 'Set' : 'none'}</p>
                          </div>
                          <div className={`px-2 py-1.5 rounded text-center border ${ex.passphrase ? 'bg-green-500/5 border-green-500/20' : ex.hasPassphrase ? 'bg-orange-500/5 border-orange-500/20' : 'bg-slate-800/60 border-slate-700'}`}>
                            <p className="text-[9px] text-slate-500">Phrase</p>
                            <p className={`text-[10px] font-bold ${ex.passphrase ? 'text-green-400' : ex.hasPassphrase ? 'text-orange-400 italic' : 'text-slate-600 italic'}`}>
                              {ex.passphrase ? 'Set' : ex.hasPassphrase ? 'Required' : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Required permissions */}
                        <div>
                          <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Required Permissions</p>
                          <div className="flex flex-wrap gap-1">
                            {ex.permissions.map(p => (
                              <span key={p} className="text-[9px] px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded">{p}</span>
                            ))}
                          </div>
                        </div>

                        {/* Note if any */}
                        {ex.note && (
                          <p className="text-[10px] text-slate-500 italic">{ex.note}</p>
                        )}
                      </div>

                      {/* Footer actions */}
                      <div className="flex gap-1.5 px-4 pb-4">
                        <button
                          onClick={() => handleTestOne(ex.exchange)}
                          disabled={isTesting}
                          title="Test public API connectivity"
                          className="flex items-center justify-center gap-1 py-2 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          <TestTube2 className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                          {isTesting ? 'Testing' : 'Test'}
                        </button>

                        <a
                          href={ex.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open ${ex.docsLabel}`}
                          className="flex items-center justify-center gap-1 py-2 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Get Keys
                        </a>

                        <button
                          onClick={() => {
                            setEditingExchange(ex.exchange)
                            setEditForm({ apiKey: '', apiSecret: '', passphrase: '', note: ex.note ?? '', isEnabled: ex.isEnabled, isPublicOnly: ex.isPublicOnly })
                          }}
                          title="Configure API credentials"
                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 text-xs font-medium rounded-lg transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          Configure
                        </button>

                        {/* Delete — only show if key exists in DB */}
                        {ex.id > 0 && (
                          <button
                            onClick={() => setConfirmDeleteExchange(ex.exchange)}
                            title="Delete API key from database"
                            className="flex items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors"
                          >
                            <XCircleIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </Card>
                  )
                })}
                      </div>
                    </div>
                  )
                })
              })()}
              </div>
            </>
          )}

          {/* Configure modal */}
          {editingExchange && (() => {
            const ex = apiKeys.find(k => k.exchange === editingExchange)
            if (!ex) return null
            return (
              <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <Card className="bg-[#0D1117] border-slate-700 w-full max-w-lg overflow-hidden">

                  {/* Modal header with accent */}
                  <div className="h-1 w-full" style={{ background: ex.color }} />
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black" style={{ color: ex.color }}>
                        {EXCHANGE_ABBR[ex.exchange] ?? ex.label.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-sm">{ex.label} — API Configuration</h3>
                        <a href={ex.docsUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mt-0.5">
                          <ExternalLink className="w-3 h-3" /> {ex.docsLabel}
                        </a>
                      </div>
                    </div>
                    <button onClick={() => setEditingExchange(null)} className="text-slate-400 hover:text-white p-1">
                      <XCircleIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {/* Info banner */}
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-blue-300 text-[10px] font-medium mb-1.5">Required permissions when creating your API key:</p>
                      <div className="flex flex-wrap gap-1">
                        {ex.permissions.map(p => (
                          <span key={p} className="text-[9px] px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-200 rounded">{p}</span>
                        ))}
                      </div>
                      {ex.requiresIpWhitelist && (
                        <p className="text-orange-300 text-[10px] mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          This exchange requires IP whitelisting. Add your server IP to the allowlist.
                        </p>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1.5">
                          API Key
                          {ex.apiKey && <span className="text-[10px] text-green-400 font-mono">(current: ••••{ex.apiKey.slice(-4)})</span>}
                        </label>
                        <div className="relative">
                          <input
                            type={showSecrets[ex.exchange + '_key'] ? 'text' : 'password'}
                            value={editForm.apiKey}
                            onChange={e => setEditForm(p => ({ ...p, apiKey: e.target.value }))}
                            placeholder="Leave blank to keep existing..."
                            className="w-full px-3 py-2.5 pr-10 bg-slate-900 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 font-mono" />
                          <button type="button" onClick={() => setShowSecrets(p => ({ ...p, [ex.exchange + '_key']: !p[ex.exchange + '_key'] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                            {showSecrets[ex.exchange + '_key'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1.5">
                          API Secret
                          {ex.apiSecret && <span className="text-[10px] text-green-400">(currently set)</span>}
                        </label>
                        <div className="relative">
                          <input
                            type={showSecrets[ex.exchange + '_secret'] ? 'text' : 'password'}
                            value={editForm.apiSecret}
                            onChange={e => setEditForm(p => ({ ...p, apiSecret: e.target.value }))}
                            placeholder="Leave blank to keep existing..."
                            className="w-full px-3 py-2.5 pr-10 bg-slate-900 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 font-mono" />
                          <button type="button" onClick={() => setShowSecrets(p => ({ ...p, [ex.exchange + '_secret']: !p[ex.exchange + '_secret'] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                            {showSecrets[ex.exchange + '_secret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {ex.hasPassphrase && (
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1.5">
                            Passphrase
                            <span className="text-orange-400 text-[10px]">(required for {ex.label})</span>
                            {ex.passphrase && <span className="text-[10px] text-green-400">(currently set)</span>}
                          </label>
                          <div className="relative">
                            <input
                              type={showSecrets[ex.exchange + '_phrase'] ? 'text' : 'password'}
                              value={editForm.passphrase}
                              onChange={e => setEditForm(p => ({ ...p, passphrase: e.target.value }))}
                              placeholder="Enter passphrase..."
                              className="w-full px-3 py-2.5 pr-10 bg-slate-900 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50 font-mono" />
                            <button type="button" onClick={() => setShowSecrets(p => ({ ...p, [ex.exchange + '_phrase']: !p[ex.exchange + '_phrase'] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                              {showSecrets[ex.exchange + '_phrase'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg">
                        <div>
                          <p className="text-white text-xs font-semibold">Public API Only</p>
                          <p className="text-slate-500 text-[10px] mt-0.5">When ON: price data only. When OFF: enables live trading and withdrawals.</p>
                        </div>
                        <button onClick={() => setEditForm(p => ({ ...p, isPublicOnly: !p.isPublicOnly }))}>
                          {editForm.isPublicOnly
                            ? <ToggleRight className="w-7 h-7 text-blue-400" />
                            : <ToggleLeft  className="w-7 h-7 text-slate-600" />
                          }
                        </button>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Note (optional)</label>
                        <input value={editForm.note} onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                          placeholder="e.g. Read-only key, main account..."
                          className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50" />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => setEditingExchange(null)}
                        className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-lg text-sm hover:text-white hover:border-slate-500 transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleSaveApiKey} disabled={savingExchange}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-60">
                        <Save className="w-3.5 h-3.5" />
                        {savingExchange ? 'Saving...' : 'Save Credentials'}
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            )
          })()}

          {/* Delete confirmation modal */}
          {confirmDeleteExchange && (() => {
            const ex = apiKeys.find(k => k.exchange === confirmDeleteExchange)
            if (!ex) return null
            return (
              <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <Card className="bg-[#0D1117] border-red-500/40 w-full max-w-sm p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                      <XCircleIcon className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Delete API Keys</h3>
                      <p className="text-slate-400 text-xs mt-0.5">{ex.label}</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm">
                    This will permanently delete all saved API credentials for <span className="text-white font-semibold">{ex.label}</span> from the database. The exchange will revert to Public API mode.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setConfirmDeleteExchange(null)}
                      className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-lg text-sm hover:text-white transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteApiKey(confirmDeleteExchange)}
                      disabled={deletingExchange === confirmDeleteExchange}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-60"
                    >
                      {deletingExchange === confirmDeleteExchange
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</>
                        : <><XCircleIcon className="w-3.5 h-3.5" /> Delete Keys</>
                      }
                    </button>
                  </div>
                </Card>
              </div>
            )
          })()}

        </div>
      )}

      {/* ══ BALANCES TAB ══════════════════════���══════════════════════════════ */}
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

      {/* ══ AI AUTO SETUP TAB ═════════════════════════���══════════════��═════ */}
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
