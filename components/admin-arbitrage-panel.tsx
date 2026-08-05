'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type {
  AdminLivePrice, AdminArbitrageOpp, ExchangeStatus, TransferRoute,
  ExchangeApiKey, AiArbitrageStrategy, ExchangeBalance, BotConfig,
  BotAnalytics, RiskFilterResult, TransferResult,
} from '@/lib/types/arbitrage-types'
import { SniperBotTab } from '@/components/sniper-bot-tab'
import { SUPPORTED_EXCHANGES } from '@/lib/exchange-constants'
import {
  Activity, RefreshCw, CheckCircle2, XCircle, Wifi, WifiOff,
  Zap, Settings, Key, Plus, Trash2, Eye, EyeOff, TestTube2,
  DollarSign, TrendingUp, BarChart3, Send, Loader2, AlertTriangle,
  ChevronDown, ArrowRight, Brain, Shield, Play, Pause, ToggleLeft, ToggleRight,
  Network, Wallet, BarChart2, Bot, List, Cpu, Clock, Globe, Users,
} from 'lucide-react'
import {
  adminFetchLivePrices, testExchangeConnection, testAllExchanges,
  getExchangeApiKeys, saveExchangeApiKey, toggleExchangeEnabled, deleteExchangeApiKey,
  generateAiArbitrageStrategy, getSavedAiStrategy, getTransferRoutes,
  getExchangeBalances, executeExchangeTransfer, getTransferHistory,
  getBotConfig, saveBotConfig, getBotAnalytics, executeBotTrade, evaluateRiskFilters,
  adminGetTradersWithExchanges, adminTestTraderExchange, adminFetchTraderBalance,
} from '@/app/actions/admin-arbitrage'

// Alias for convenience - all server actions are now statically imported above
// and called directly in handlers instead of via dynamic import.
const loadActions = () => Promise.resolve({
  adminFetchLivePrices, testExchangeConnection, testAllExchanges,
  getExchangeApiKeys, saveExchangeApiKey, toggleExchangeEnabled, deleteExchangeApiKey,
  generateAiArbitrageStrategy, getSavedAiStrategy, getTransferRoutes,
  getExchangeBalances, executeExchangeTransfer, getTransferHistory,
  getBotConfig, saveBotConfig, getBotAnalytics, executeBotTrade, evaluateRiskFilters,
  adminGetTradersWithExchanges, adminTestTraderExchange, adminFetchTraderBalance,
})

// ── Inline net-profit calculator (duplicated from server for client preview) ─
const _EXFEE: Record<string, number> = {
  binance: 0.1, okx: 0.08, bybit: 0.1, kucoin: 0.1, kraken: 0.16, coinbase: 0.6,
  htx: 0.2, bitfinex: 0.2, gateio: 0.2, gemini: 0.35, cryptocom: 0.075,
}
const _WDFEE: Record<string, Record<string, number>> = {
  USDT: { binance: 1, kucoin: 1, bybit: 1, okx: 1, kraken: 2, default: 1.5 },
  default: { default: 2 },
}
const _NETFEE: Record<string, number> = { TRC20: 1, BEP20: 0.5, ERC20: 5, SOL: 0.01, BTC: 3, default: 2 }
const _BESTNET: Record<string, string> = { USDT: 'TRC20', BTC: 'BTC', ETH: 'ERC20', BNB: 'BEP20', SOL: 'SOL', default: 'BEP20' }
const _XFERTIME: Record<string, number> = { TRC20: 2, BEP20: 3, ERC20: 8, SOL: 1, BTC: 30, default: 5 }

interface NetProfitBreakdown {
  tradingFeeBuy: number; tradingFeeSell: number; withdrawalFee: number
  networkFee: number; estimatedSlippage: number; safetyBuffer: number
  grossProfit: number; totalCosts: number; netProfit: number
  grossProfitPct: number; netProfitPct: number
}

function calcNetProfit(
  symbol: string, buyExchange: string, sellExchange: string,
  buyPrice: number, sellPrice: number, tradeAmountUsd: number,
  config: BotConfig,
): NetProfitBreakdown {
  const bEx = buyExchange.toLowerCase(), sEx = sellExchange.toLowerCase(), sym = symbol.toUpperCase()
  const qty = tradeAmountUsd / buyPrice, sv = qty * sellPrice, bv = tradeAmountUsd
  const tfBuy = bv * ((config.tradingFeePct ?? _EXFEE[bEx] ?? 0.1) / 100)
  const tfSell = sv * ((config.tradingFeePct ?? _EXFEE[sEx] ?? 0.1) / 100)
  const wdm = _WDFEE[sym] ?? _WDFEE['default']
  const wd = config.withdrawalFeeOverride ?? (wdm[bEx] ?? wdm['default'] ?? 2)
  const net0 = _BESTNET[sym] ?? _BESTNET['default']
  const nf = config.networkFeeOverride ?? (_NETFEE[net0] ?? 2)
  const slip = (bv + sv) * (0.05 / 100)
  const safe = tradeAmountUsd * ((config.safetyBufferPct ?? 0.1) / 100)
  const gross = sv - bv, costs = tfBuy + tfSell + wd + nf + slip + safe, net = gross - costs
  return {
    tradingFeeBuy: tfBuy, tradingFeeSell: tfSell, withdrawalFee: wd, networkFee: nf,
    estimatedSlippage: slip, safetyBuffer: safe, grossProfit: gross, totalCosts: costs,
    netProfit: net, grossProfitPct: ((sellPrice - buyPrice) / buyPrice) * 100,
    netProfitPct: (net / tradeAmountUsd) * 100,
  }
}

// ── Sub-tabs ───────────────────────────────────────────────────────────────
type SubTab = 'live-scan' | 'sniper-bot' | 'exchange-connections' | 'balances' | 'ai-strategy' | 'transfer' | 'transfer-routes' | 'bot-engine' | 'analytics' | 'settings'

const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'live-scan',            label: 'Live Scan',       icon: Activity },
  { key: 'sniper-bot',           label: 'Sniper Bot',      icon: Zap },
  { key: 'bot-engine',           label: 'Bot Engine',      icon: Bot },
  { key: 'exchange-connections', label: 'Exchanges',       icon: Globe },
  { key: 'balances',             label: 'Balances',        icon: Wallet },
  { key: 'transfer',             label: 'Transfer',        icon: Send },
  { key: 'transfer-routes',      label: 'Routes',          icon: Network },
  { key: 'ai-strategy',          label: 'AI Strategy',     icon: Brain },
  { key: 'analytics',            label: 'Analytics',       icon: BarChart2 },
  { key: 'settings',             label: 'Bot Settings',    icon: Settings },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function riskBadge(level: string) {
  const map: Record<string, string> = {
    Low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  return map[level] ?? map['Medium']
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AdminArbitragePanel() {
  const [subTab, setSubTab] = useState<SubTab>('live-scan')

  // ── Trader + Exchange Selection ───────────────────────────────────────────
  type TraderExchangeAcc = { id: number; exchange: string; label: string | null; tradeMode: string; testStatus: string | null }
  type TraderEntry = { userId: string; name: string | null; email: string; exchanges: TraderExchangeAcc[] }
  const [traders, setTraders] = useState<TraderEntry[]>([])
  const [loadingTraders, setLoadingTraders] = useState(false)
  const [selectedTraderId, setSelectedTraderId] = useState<string>('')
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [testingAccountId, setTestingAccountId] = useState<number | null>(null)
  const [accountTestResult, setAccountTestResult] = useState<{ ok: boolean; message: string; balances?: Record<string, number> } | null>(null)
  const [traderBalances, setTraderBalances] = useState<Record<string, number>>({})
  const [loadingTraderBal, setLoadingTraderBal] = useState(false)

  // Live-scan state
  const [prices, setPrices] = useState<AdminLivePrice[]>([])
  const [opportunities, setOpportunities] = useState<AdminArbitrageOpp[]>([])
  const [exchangeStatuses, setExchangeStatuses] = useState<ExchangeStatus[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP'])

  // Exchange API key state
  const [apiKeys, setApiKeys] = useState<ExchangeApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [editingExchange, setEditingExchange] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs: number; message: string }>>({})
  const [testingExchange, setTestingExchange] = useState<string | null>(null)
  const [testingAll, setTestingAll] = useState(false)
  const [savingExchange, setSavingExchange] = useState(false)
  const [confirmDeleteExchange, setConfirmDeleteExchange] = useState<string | null>(null)
  const [deletingExchange, setDeletingExchange] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ apiKey: '', apiSecret: '', passphrase: '', isEnabled: true, isPublicOnly: false, note: '' })
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  // Balances state
  const [allBalances, setAllBalances] = useState<Record<string, ExchangeBalance[]>>({})
  const [loadingAllBalances, setLoadingAllBalances] = useState(false)

  // Transfer state
  const [txFromEx, setTxFromEx] = useState('')
  const [txToEx, setTxToEx] = useState('')
  const [txSymbol, setTxSymbol] = useState('USDT')
  const [txNetwork, setTxNetwork] = useState('TRC20')
  const [txAmount, setTxAmount] = useState('')
  const [txAddress, setTxAddress] = useState('')
  const [txMemo, setTxMemo] = useState('')
  const [txBalances, setTxBalances] = useState<ExchangeBalance[]>([])
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [txSubmitting, setTxSubmitting] = useState(false)
  const [txResult, setTxResult] = useState<TransferResult | null>(null)
  const [txHistory, setTxHistory] = useState<Record<string, unknown>[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Transfer routes state
  const [trFrom, setTrFrom] = useState('')
  const [trTo, setTrTo] = useState('')
  const [trSymbol, setTrSymbol] = useState('USDT')
  const [routes, setRoutes] = useState<TransferRoute[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)

  // AI strategy state
  const [aiContext, setAiContext] = useState('')
  const [aiStrategy, setAiStrategy] = useState<AiArbitrageStrategy | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Bot engine state
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null)
  const [loadingBotConfig, setLoadingBotConfig] = useState(false)
  const [savingBotConfig, setSavingBotConfig] = useState(false)
  const [botRunning, setBotRunning] = useState(false)
  const [botLog, setBotLog] = useState<string[]>([])
  const [executingTrade, setExecutingTrade] = useState(false)
  const [execResult, setExecResult] = useState<{ success: boolean; message: string } | null>(null)
  const [selectedOppForExec, setSelectedOppForExec] = useState<AdminArbitrageOpp | null>(null)
  const [riskFilters, setRiskFilters] = useState<RiskFilterResult[]>([])
  const [loadingRisk, setLoadingRisk] = useState(false)
  const [netBreakdown, setNetBreakdown] = useState<NetProfitBreakdown | null>(null)

  // Analytics state
  const [analytics, setAnalytics] = useState<BotAnalytics | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // ── Data loaders ────────────────────────────────────────────────────────

  async function loadApiKeys() {
    setLoadingKeys(true)
    try {
      const { getExchangeApiKeys } = await loadActions()
      setApiKeys(await getExchangeApiKeys())
    } finally { setLoadingKeys(false) }
  }

  const runScan = useCallback(async () => {
    setScanError(null)
    setScanning(true)
    try {
      const { adminFetchLivePrices } = await loadActions()
      const result = await adminFetchLivePrices(selectedSymbols)
      setPrices(result.prices)
      setOpportunities(result.opportunities)
      setExchangeStatuses(result.exchangeStatuses)
      setLastScan(new Date().toLocaleTimeString())
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed')
    } finally { setScanning(false) }
  }, [selectedSymbols])

  async function loadAllExchangeBalances() {
    setLoadingAllBalances(true)
    try {
      const { getExchangeBalances } = await loadActions()
      const result: Record<string, ExchangeBalance[]> = {}
      for (const ex of apiKeys.filter(k => k.isEnabled)) {
        try { result[ex.exchange] = await getExchangeBalances(ex.exchange) }
        catch { result[ex.exchange] = [] }
      }
      setAllBalances(result)
    } finally { setLoadingAllBalances(false) }
  }

  async function loadBalances() {
    if (!txFromEx) return
    setLoadingBalances(true)
    try {
      const { getExchangeBalances } = await loadActions()
      setTxBalances(await getExchangeBalances(txFromEx))
    } catch { setTxBalances([]) }
    finally { setLoadingBalances(false) }
  }

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const { getTransferHistory } = await loadActions()
      setTxHistory(await getTransferHistory(30) as Record<string, unknown>[])
    } catch { setTxHistory([]) }
    finally { setLoadingHistory(false) }
  }

  async function loadBotConfig() {
    setLoadingBotConfig(true)
    try {
      const { getBotConfig } = await loadActions()
      const cfg = await getBotConfig()
      setBotConfig(cfg)
      setBotRunning(cfg.isRunning)
    } catch { /* ignore */ }
    finally { setLoadingBotConfig(false) }
  }

  async function loadAnalytics() {
    setLoadingAnalytics(true)
    try {
      const { getBotAnalytics } = await loadActions()
      setAnalytics(await getBotAnalytics())
    } catch { /* ignore */ }
    finally { setLoadingAnalytics(false) }
  }

  // ── Tab-driven loading ───────────────────────────────────────────────────
  useEffect(() => {
    if (subTab === 'exchange-connections' || subTab === 'live-scan') loadApiKeys()
    if (subTab === 'balances') { loadApiKeys().then(() => loadAllExchangeBalances()) }
    if (subTab === 'transfer') { loadApiKeys(); loadHistory() }
    if (subTab === 'bot-engine') loadBotConfig()
    if (subTab === 'analytics') loadAnalytics()
    if (subTab === 'ai-strategy') {
      loadActions().then(mod => mod.getSavedAiStrategy()).then(s => { if (s) setAiStrategy(s) }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab])

  useEffect(() => { if (txFromEx) loadBalances() }, [txFromEx])

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleTestOne(exchange: string) {
    setTestingExchange(exchange)
    try {
      const { testExchangeConnection } = await loadActions()
      const res = await testExchangeConnection(exchange)
      setTestResults(prev => ({ ...prev, [exchange]: res }))
      await loadApiKeys()
    } finally { setTestingExchange(null) }
  }

  async function handleTestAll() {
    setTestingAll(true)
    try {
      const { testAllExchanges } = await loadActions()
      setTestResults(await testAllExchanges())
      await loadApiKeys()
    } finally { setTestingAll(false) }
  }

  async function handleToggleEnabled(exchange: string, current: boolean) {
    const { toggleExchangeEnabled } = await loadActions()
    await toggleExchangeEnabled(exchange, !current)
    setApiKeys(prev => prev.map(k => k.exchange === exchange ? { ...k, isEnabled: !current } : k))
  }

  async function handleSaveApiKey() {
    if (!editingExchange) return
    setSavingExchange(true)
    try {
      const { saveExchangeApiKey } = await loadActions()
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
    } finally { setSavingExchange(false) }
  }

  async function handleDeleteApiKey(exchange: string) {
    setDeletingExchange(exchange)
    try {
      const { deleteExchangeApiKey } = await loadActions()
      await deleteExchangeApiKey(exchange)
      await loadApiKeys()
      setConfirmDeleteExchange(null)
    } finally { setDeletingExchange(null) }
  }

  async function handleGenerateStrategy() {
    setGeneratingAi(true); setAiError(null)
    try {
      const { generateAiArbitrageStrategy } = await loadActions()
      setAiStrategy(await generateAiArbitrageStrategy(aiContext || undefined))
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Generation failed')
    } finally { setGeneratingAi(false) }
  }

  async function handleLoadRoutes() {
    setLoadingRoutes(true)
    try {
      const { getTransferRoutes } = await loadActions()
      setRoutes(await getTransferRoutes(trFrom, trTo, trSymbol))
    } finally { setLoadingRoutes(false) }
  }

  async function handleTransferSubmit() {
    setTxSubmitting(true); setTxResult(null)
    try {
      const { executeExchangeTransfer } = await loadActions()
      const result = await executeExchangeTransfer({
        fromExchange: txFromEx, toExchange: txToEx, symbol: txSymbol,
        network: txNetwork, amount: parseFloat(txAmount), toAddress: txAddress,
        memo: txMemo || undefined,
      })
      setTxResult(result)
    } catch (e) {
      setTxResult({ success: false, message: e instanceof Error ? e.message : 'Transfer failed' })
    } finally { setTxSubmitting(false) }
  }

  async function handleSaveBotConfig(partial: Partial<BotConfig>) {
    if (!botConfig) return
    setBotConfig(prev => prev ? { ...prev, ...partial } : prev)
    setSavingBotConfig(true)
    try {
      const { saveBotConfig } = await loadActions()
      await saveBotConfig(partial)
    } catch { /* ignore */ }
    finally { setSavingBotConfig(false) }
  }

  async function handleToggleBot() {
    if (!botConfig) return
    const next = !botRunning
    setBotRunning(next)
    setBotLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Bot ${next ? 'started' : 'stopped'}`])
    await handleSaveBotConfig({ isRunning: next })
  }

  async function handleExecTrade(opp: AdminArbitrageOpp) {
    if (!botConfig) return
    setExecutingTrade(true); setExecResult(null)
    setBotLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Executing: ${opp.symbol} BUY ${opp.buyExchange} → SELL ${opp.sellExchange}`])
    try {
      const { executeBotTrade } = await loadActions()
      const res = await executeBotTrade(opp, botConfig)
      setExecResult({ success: res.success, message: res.message })
      setBotLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${res.success ? 'SUCCESS' : 'FAILED'}: ${res.message}`])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setExecResult({ success: false, message: msg })
    } finally { setExecutingTrade(false) }
  }

  async function handleEvalRisk(opp: AdminArbitrageOpp) {
    if (!botConfig) return
    setLoadingRisk(true); setSelectedOppForExec(opp)
    try {
      const { evaluateRiskFilters } = await loadActions()
      const filters = await evaluateRiskFilters(opp, botConfig)
      setRiskFilters(filters)
      setNetBreakdown(calcNetProfit(opp.symbol, opp.buyExchange, opp.sellExchange, opp.buyPrice, opp.sellPrice, botConfig.tradeAmountUsd, botConfig))
    } catch { /* ignore */ }
    finally { setLoadingRisk(false) }
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  const enabledKeys = useMemo(() => apiKeys.filter(k => k.isEnabled), [apiKeys])

  // Load all traders with their exchange accounts on mount
  useEffect(() => {
    setLoadingTraders(true)
    loadActions()
      .then(mod => (mod as unknown as { adminGetTradersWithExchanges: () => Promise<TraderEntry[]> }).adminGetTradersWithExchanges())
      .then(data => {
        setTraders(data)
        if (data.length > 0) {
          setSelectedTraderId(data[0].userId)
          if (data[0].exchanges.length > 0) setSelectedAccountId(data[0].exchanges[0].id)
        }
      })
      .catch(() => { /* no traders yet */ })
      .finally(() => setLoadingTraders(false))
  }, [])

  // When trader changes, auto-select their first exchange
  useEffect(() => {
    const trader = traders.find(t => t.userId === selectedTraderId)
    if (trader && trader.exchanges.length > 0) {
      setSelectedAccountId(trader.exchanges[0].id)
      setAccountTestResult(null)
      setTraderBalances({})
    } else {
      setSelectedAccountId(null)
    }
  }, [selectedTraderId, traders])

  const selectedTrader = traders.find(t => t.userId === selectedTraderId) ?? null
  const selectedAccount = selectedTrader?.exchanges.find(e => e.id === selectedAccountId) ?? null

  async function handleTestAccount() {
    if (!selectedAccountId) return
    setTestingAccountId(selectedAccountId)
    setAccountTestResult(null)
    try {
      const mod = await loadActions() as unknown as {
        adminTestTraderExchange: (id: number) => Promise<{ ok: boolean; message: string; balances?: Record<string, number> }>
      }
      const result = await mod.adminTestTraderExchange(selectedAccountId)
      setAccountTestResult(result)
    } catch (e) {
      setAccountTestResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed' })
    } finally {
      setTestingAccountId(null)
    }
  }

  async function handleLoadTraderBalance() {
    if (!selectedAccountId) return
    setLoadingTraderBal(true)
    try {
      const mod = await loadActions() as unknown as {
        adminFetchTraderBalance: (id: number) => Promise<{ ok: boolean; balances?: Record<string, number>; message: string }>
      }
      const result = await mod.adminFetchTraderBalance(selectedAccountId)
      if (result.ok && result.balances) setTraderBalances(result.balances)
    } catch { /* ignore */ }
    finally { setLoadingTraderBal(false) }
  }

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Trader / Exchange Selector ── */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 bg-slate-800/40">
          <div className="w-7 h-7 rounded-md bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
            <Key className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Trader Exchange Selection</p>
            <p className="text-xs text-slate-500 mt-0.5">Select a trader and their connected exchange to use for arbitrage operations</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => {
                setLoadingTraders(true)
                loadActions()
                  .then(mod => (mod as unknown as { adminGetTradersWithExchanges: () => Promise<TraderEntry[]> }).adminGetTradersWithExchanges())
                  .then(setTraders)
                  .catch(() => {})
                  .finally(() => setLoadingTraders(false))
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loadingTraders ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Step 1 — Select Trader */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Step 1 — Select Trader</label>
            {loadingTraders ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" />Loading traders...
              </div>
            ) : traders.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-slate-800/60 border border-slate-700">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-slate-400">No traders have connected exchange accounts yet.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {traders.map(t => (
                  <button
                    key={t.userId}
                    onClick={() => setSelectedTraderId(t.userId)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      selectedTraderId === t.userId
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {(t.name ?? t.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name ?? t.email}</p>
                      {t.name && <p className="text-xs text-slate-500 truncate">{t.email}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-500">{t.exchanges.length}</span>
                      <Globe className="w-3 h-3 text-slate-500" />
                    </div>
                    {selectedTraderId === t.userId && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 — Select Exchange Account */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Step 2 — Select Exchange</label>
            {!selectedTrader ? (
              <div className="flex items-center justify-center h-24 rounded-lg bg-slate-800/30 border border-slate-700/50 border-dashed">
                <p className="text-xs text-slate-500">Select a trader first</p>
              </div>
            ) : selectedTrader.exchanges.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-slate-800/60 border border-slate-700">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-xs text-slate-400">This trader has no connected exchanges.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {selectedTrader.exchanges.map(acc => {
                  const exInfo = SUPPORTED_EXCHANGES[acc.exchange]
                  const isLive = acc.tradeMode === 'live'
                  return (
                    <button
                      key={acc.id}
                      onClick={() => { setSelectedAccountId(acc.id); setAccountTestResult(null); setTraderBalances({}) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        selectedAccountId === acc.id
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                          : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-md bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{exInfo?.name ?? acc.exchange}</p>
                        <p className="text-xs text-slate-500 truncate">{acc.label ?? 'No label'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                          {isLive ? 'LIVE' : 'READ-ONLY'}
                        </span>
                        {acc.testStatus && (
                          <span className={`text-[10px] ${acc.testStatus === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {acc.testStatus === 'ok' ? 'Tested OK' : 'Test failed'}
                          </span>
                        )}
                      </div>
                      {selectedAccountId === acc.id && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active selection summary + actions */}
        {selectedAccount && (
          <div className="px-5 pb-4">
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700">
              <div className="flex items-center gap-2 text-sm text-slate-300 flex-1 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium text-white truncate">
                  {selectedTrader?.name ?? selectedTrader?.email}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">
                  {SUPPORTED_EXCHANGES[selectedAccount.exchange]?.name ?? selectedAccount.exchange}
                  {selectedAccount.label ? ` — ${selectedAccount.label}` : ''}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${selectedAccount.tradeMode === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {selectedAccount.tradeMode === 'live' ? 'LIVE' : 'READ-ONLY'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestAccount}
                  disabled={testingAccountId === selectedAccountId}
                  className="h-7 px-3 text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {testingAccountId === selectedAccountId
                    ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Testing...</>
                    : <><TestTube2 className="w-3 h-3 mr-1" />Test Connection</>
                  }
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLoadTraderBalance}
                  disabled={loadingTraderBal}
                  className="h-7 px-3 text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {loadingTraderBal
                    ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Loading...</>
                    : <><Wallet className="w-3 h-3 mr-1" />Fetch Balance</>
                  }
                </Button>
              </div>
            </div>

            {/* Test result */}
            {accountTestResult && (
              <div className={`mt-2 flex items-start gap-2 px-3 py-2 rounded-lg text-xs border ${accountTestResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                {accountTestResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <div>
                  <p>{accountTestResult.message}</p>
                  {accountTestResult.balances && Object.keys(accountTestResult.balances).length > 0 && (
                    <p className="mt-1 text-slate-400">
                      Balances: {Object.entries(accountTestResult.balances).slice(0, 8).map(([c, v]) => `${c}: ${v.toFixed(4)}`).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Fetched balances */}
            {Object.keys(traderBalances).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(traderBalances).slice(0, 12).map(([coin, amt]) => (
                  <div key={coin} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                    <span className="font-semibold text-white">{coin}</span>
                    <span className="text-slate-400">{amt < 0.0001 ? amt.toExponential(2) : amt.toFixed(4)}</span>
                  </div>
                ))}
                {Object.keys(traderBalances).length > 12 && (
                  <div className="flex items-center px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-500">
                    +{Object.keys(traderBalances).length - 12} more
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${subTab === key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── LIVE SCAN ── */}
      {subTab === 'live-scan' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runScan}
              disabled={scanning}
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {scanning ? 'Scanning...' : 'Scan Markets'}
            </Button>
            {lastScan && <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {lastScan}</span>}
          </div>

          {scanError && (
            <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />{scanError}
            </div>
          )}

          {/* Exchange statuses */}
          {exchangeStatuses.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {exchangeStatuses.map(ex => (
                <div key={ex.name} className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex items-center gap-2">
                  {ex.online ? <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs text-white font-medium truncate">{ex.label}</div>
                    <div className="text-xs text-slate-500">{ex.latencyMs}ms · {ex.pricesFetched} prices</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Opportunities */}
          {opportunities.length === 0 && !scanning ? (
            <div className="text-center py-10 text-slate-500">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No opportunities found. Click &quot;Scan Markets&quot; to start.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {opportunities.map(opp => (
                <div key={opp.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">{opp.symbol}</span>
                        <span className="text-xs text-slate-400">
                          BUY <span className="text-blue-400">{opp.buyExchange}</span>
                          {' → '}
                          SELL <span className="text-purple-400">{opp.sellExchange}</span>
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${riskBadge(opp.riskLevel)}`}>
                          {opp.riskLevel}
                        </span>
                        {!opp.viable && (
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-700/50 text-slate-400 border-slate-600">
                            Filtered
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>Gross: <span className="text-slate-200">+{opp.profitPct.toFixed(3)}%</span></span>
                        <span>Net: <span className="text-emerald-400 font-medium">+{opp.netProfitPct.toFixed(3)}%</span></span>
                        <span>Net $: <span className="text-emerald-400 font-medium">+${opp.netProfitUsd.toFixed(4)}</span></span>
                        <span>~{opp.estimatedTransferMin}m</span>
                      </div>
                      {opp.rejectReason && (
                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />{opp.rejectReason}
                        </p>
                      )}
                    </div>
                    {botConfig && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        onClick={() => handleEvalRisk(opp)}
                        disabled={loadingRisk}
                      >
                        {loadingRisk && selectedOppForExec?.id === opp.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Shield className="w-3.5 h-3.5 mr-1" />}
                        Evaluate
                      </Button>
                    )}
                  </div>

                  {/* Risk breakdown */}
                  {selectedOppForExec?.id === opp.id && riskFilters.length > 0 && (
                    <div className="mt-3 border-t border-slate-700 pt-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {riskFilters.map(f => (
                          <div key={f.filter} className="flex items-center gap-2 text-xs bg-slate-900 rounded p-2">
                            {f.passed
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                            <span className="text-slate-300">{f.filter}</span>
                            <span className="ml-auto text-slate-400">{f.value} / {f.threshold}</span>
                          </div>
                        ))}
                      </div>
                      {netBreakdown && (
                        <div className="bg-slate-900 rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {[
                            ['Buy fee', `$${netBreakdown.tradingFeeBuy.toFixed(4)}`],
                            ['Sell fee', `$${netBreakdown.tradingFeeSell.toFixed(4)}`],
                            ['Withdrawal', `$${netBreakdown.withdrawalFee.toFixed(4)}`],
                            ['Network', `$${netBreakdown.networkFee.toFixed(4)}`],
                            ['Slippage', `$${netBreakdown.estimatedSlippage.toFixed(4)}`],
                            ['Buffer', `$${netBreakdown.safetyBuffer.toFixed(4)}`],
                          ].map(([l, v]) => (
                            <div key={l} className="flex justify-between">
                              <span className="text-slate-500">{l}</span>
                              <span className="text-slate-300">{v}</span>
                            </div>
                          ))}
                          <div className="col-span-2 flex justify-between font-semibold pt-1 border-t border-slate-700">
                            <span className="text-emerald-400">Net profit</span>
                            <span className="text-emerald-400">
                              +${netBreakdown.netProfit.toFixed(4)} ({netBreakdown.netProfitPct.toFixed(3)}%)
                            </span>
                          </div>
                        </div>
                      )}
                      {botConfig?.executionMode !== 'monitor' && opp.viable && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                          onClick={() => handleExecTrade(opp)}
                          disabled={executingTrade}
                        >
                          {executingTrade ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                          Execute Trade
                        </Button>
                      )}
                      {execResult && selectedOppForExec?.id === opp.id && (
                        <div className={`text-xs p-2 rounded border ${execResult.success ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400' : 'bg-red-950/50 border-red-800 text-red-400'}`}>
                          {execResult.success ? <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" /> : <XCircle className="inline w-3.5 h-3.5 mr-1" />}
                          {execResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SNIPER BOT ── */}
      {subTab === 'sniper-bot' && <SniperBotTab />}

      {/* ── EXCHANGE CONNECTIONS ── */}
      {subTab === 'exchange-connections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Exchange API Keys</h3>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={handleTestAll}
              disabled={testingAll}
            >
              {testingAll ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5 mr-1" />}
              Test All
            </Button>
          </div>

          {loadingKeys && (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          )}

          <div className="space-y-2">
            {apiKeys.map(key => {
              const res = testResults[key.exchange]
              return (
                <div key={key.exchange} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${key.isEnabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      <div>
                        <div className="font-medium text-white capitalize">{key.exchange}</div>
                        <div className="text-xs text-slate-500">
                          {key.isPublicOnly ? 'Public Only' : 'Full Access'}
                          {key.lastTestedAt && ` · Tested ${new Date(key.lastTestedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      {res && (
                        <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border
                          ${res.ok ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                          {res.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {res.ok ? `${res.latencyMs}ms` : 'Failed'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleEnabled(key.exchange, key.isEnabled)}
                        className="text-slate-400 hover:text-white"
                        title={key.isEnabled ? 'Disable' : 'Enable'}
                      >
                        {key.isEnabled
                          ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                          : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-700 text-slate-400 hover:bg-slate-700"
                        onClick={() => handleTestOne(key.exchange)}
                        disabled={testingExchange === key.exchange}
                      >
                        {testingExchange === key.exchange ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube2 className="w-3 h-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-700 text-slate-400 hover:bg-slate-700"
                        onClick={() => {
                          setEditingExchange(key.exchange)
                          setEditForm({ apiKey: '', apiSecret: '', passphrase: '', isEnabled: key.isEnabled, isPublicOnly: key.isPublicOnly, note: key.note ?? '' })
                        }}
                      >
                        <Key className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-900 text-red-400 hover:bg-red-950"
                        onClick={() => setConfirmDeleteExchange(key.exchange)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Edit form */}
                  {editingExchange === key.exchange && (
                    <div className="mt-3 border-t border-slate-700 pt-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          { label: 'API Key', field: 'apiKey' },
                          { label: 'API Secret', field: 'apiSecret' },
                          { label: 'Passphrase', field: 'passphrase' },
                          { label: 'Note', field: 'note' },
                        ].map(({ label, field }) => (
                          <div key={field}>
                            <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                            <div className="relative">
                              <input
                                type={showSecrets[field] ? 'text' : 'password'}
                                value={(editForm as Record<string, string>)[field]}
                                onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                                placeholder={`Enter ${label.toLowerCase()}`}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white pr-8"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                              >
                                {showSecrets[field] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input type="checkbox" checked={editForm.isEnabled}
                            onChange={e => setEditForm(f => ({ ...f, isEnabled: e.target.checked }))}
                            className="accent-cyan-500" />
                          Enabled
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input type="checkbox" checked={editForm.isPublicOnly}
                            onChange={e => setEditForm(f => ({ ...f, isPublicOnly: e.target.checked }))}
                            className="accent-cyan-500" />
                          Public Only
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={handleSaveApiKey} disabled={savingExchange}>
                          {savingExchange ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                          Save
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-700 text-slate-400" onClick={() => setEditingExchange(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Confirm delete */}
                  {confirmDeleteExchange === key.exchange && (
                    <div className="mt-3 border-t border-red-900/50 pt-3 flex items-center gap-3">
                      <p className="text-xs text-red-400">Delete API keys for {key.exchange}?</p>
                      <Button size="sm" className="bg-red-700 hover:bg-red-600 text-white" onClick={() => handleDeleteApiKey(key.exchange)} disabled={deletingExchange === key.exchange}>
                        {deletingExchange === key.exchange ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
                      </Button>
                      <Button size="sm" variant="outline" className="border-slate-700 text-slate-400" onClick={() => setConfirmDeleteExchange(null)}>Cancel</Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BALANCES ── */}
      {subTab === 'balances' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={loadAllExchangeBalances} disabled={loadingAllBalances}>
              {loadingAllBalances ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh Balances
            </Button>
          </div>
          {Object.entries(allBalances).map(([exchange, bals]) => (
            <div key={exchange} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h4 className="font-medium text-white capitalize mb-3">{exchange}</h4>
              {bals.length === 0 ? (
                <p className="text-xs text-slate-500">No balances or failed to fetch</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {bals.map(b => (
                    <div key={b.symbol} className="bg-slate-900 rounded-lg p-2 text-xs">
                      <div className="font-medium text-white">{b.symbol}</div>
                      <div className="text-slate-400">{b.free.toFixed(4)} free</div>
                      <div className="text-slate-500">${b.usdValue.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {Object.keys(allBalances).length === 0 && !loadingAllBalances && (
            <div className="text-center py-8 text-slate-500">
              <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Click &quot;Refresh Balances&quot; to load exchange balances</p>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSFER ── */}
      {subTab === 'transfer' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300">New Transfer</h3>
              {[
                { label: 'From Exchange', val: txFromEx, set: setTxFromEx },
                { label: 'To Exchange', val: txToEx, set: setTxToEx },
                { label: 'Symbol', val: txSymbol, set: setTxSymbol },
                { label: 'Network', val: txNetwork, set: setTxNetwork },
                { label: 'Amount', val: txAmount, set: setTxAmount },
                { label: 'Destination Address', val: txAddress, set: setTxAddress },
                { label: 'Memo (optional)', val: txMemo, set: setTxMemo },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  <input
                    value={val}
                    onChange={e => set(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                    placeholder={label}
                  />
                </div>
              ))}
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleTransferSubmit}
                disabled={txSubmitting || !txFromEx || !txToEx || !txAmount || !txAddress}
              >
                {txSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Execute Transfer
              </Button>
              {txResult && (
                <div className={`text-sm p-3 rounded-lg border ${txResult.success ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400' : 'bg-red-950/50 border-red-800 text-red-400'}`}>
                  {txResult.success ? <CheckCircle2 className="inline w-4 h-4 mr-1" /> : <XCircle className="inline w-4 h-4 mr-1" />}
                  {txResult.message}
                  {txResult.txId && <div className="mt-1 font-mono text-xs break-all">TX: {txResult.txId}</div>}
                </div>
              )}
            </div>

            {/* History */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">Transfer History</h3>
                <Button size="sm" variant="outline" className="border-slate-700 text-slate-400" onClick={loadHistory} disabled={loadingHistory}>
                  {loadingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {txHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No recent transfers</p>
                ) : (
                  txHistory.map((tx, i) => (
                    <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{String(tx['symbol'])} — {String(tx['amount'])}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${tx['status'] === 'completed' ? 'text-emerald-400' : tx['status'] === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>
                          {String(tx['status'])}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-0.5">{String(tx['fromExchange'])} → {String(tx['toExchange'])} · {String(tx['network'])}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSFER ROUTES ── */}
      {subTab === 'transfer-routes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {[
              { label: 'From', val: trFrom, set: setTrFrom },
              { label: 'To', val: trTo, set: setTrTo },
              { label: 'Symbol', val: trSymbol, set: setTrSymbol },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                <input
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white w-40"
                  placeholder={label}
                />
              </div>
            ))}
            <Button className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={handleLoadRoutes} disabled={loadingRoutes}>
              {loadingRoutes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Network className="w-4 h-4 mr-2" />}
              Find Routes
            </Button>
          </div>
          {routes.length > 0 && (
            <div className="space-y-2">
              {routes.map((r, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-4 text-sm">
                  <span className="text-blue-400 font-medium">{r.fromExchange}</span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="text-purple-400 font-medium">{r.toExchange}</span>
                  <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">{r.network}</span>
                  <span className="text-slate-400 text-xs">${r.estimatedFee.toFixed(2)} fee</span>
                  <span className="text-slate-400 text-xs">~{r.estimatedTimeMin}m</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AI STRATEGY ── */}
      {subTab === 'ai-strategy' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Context / preferences (optional)</label>
            <textarea
              value={aiContext}
              onChange={e => setAiContext(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white resize-none"
              placeholder="e.g. Focus on low-fee networks, prefer USDT, avoid ERC20..."
            />
          </div>
          <Button className="bg-purple-600 hover:bg-purple-500 text-white" onClick={handleGenerateStrategy} disabled={generatingAi}>
            {generatingAi ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
            {generatingAi ? 'Generating...' : 'Generate AI Strategy'}
          </Button>
          {aiError && <p className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{aiError}</p>}
          {aiStrategy && (
            <div className="space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h4 className="font-semibold text-white mb-2">Summary</h4>
                <p className="text-sm text-slate-300">{aiStrategy.summary}</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h4 className="font-semibold text-white mb-3">Recommended Pairs</h4>
                <div className="space-y-2">
                  {aiStrategy.recommendedPairs.map((p, i) => (
                    <div key={i} className="bg-slate-900 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{p.symbol}</span>
                        <span className="text-xs text-slate-400">{p.buyExchange} → {p.sellExchange}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${riskBadge(p.risk)}`}>{p.risk}</span>
                        <span className="ml-auto text-emerald-400 text-xs">{p.estimatedSpread}</span>
                      </div>
                      <p className="text-xs text-slate-400">{p.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
              {aiStrategy.warnings.length > 0 && (
                <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
                  <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Warnings</h4>
                  <ul className="space-y-1">
                    {aiStrategy.warnings.map((w, i) => <li key={i} className="text-xs text-amber-300">{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BOT ENGINE ── */}
      {subTab === 'bot-engine' && (
        <div className="space-y-4">
          {loadingBotConfig ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : botConfig ? (
            <>
              {/* Status bar */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center gap-4">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                  ${botRunning ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}>
                  <span className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {botRunning ? 'Bot Running' : 'Bot Stopped'}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Mode:</span>
                  <span className="text-white capitalize">{botConfig.executionMode}</span>
                </div>
                <Button
                  size="sm"
                  className={botRunning ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}
                  onClick={handleToggleBot}
                >
                  {botRunning ? <><Pause className="w-3.5 h-3.5 mr-1" />Stop</> : <><Play className="w-3.5 h-3.5 mr-1" />Start</>}
                </Button>
              </div>

              {/* Config controls */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-white text-sm">Bot Settings</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Trade Amount ($)', field: 'tradeAmountUsd' },
                    { label: 'Min Profit (%)', field: 'minProfitPct' },
                    { label: 'Min Profit ($)', field: 'minProfitUsd' },
                    { label: 'Max Slippage (%)', field: 'maxSlippagePct' },
                    { label: 'Max Transfer (min)', field: 'maxTransferTimeMin' },
                    { label: 'Safety Buffer (%)', field: 'safetyBufferPct' },
                  ].map(({ label, field }) => (
                    <div key={field}>
                      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                      <input
                        type="number"
                        value={(botConfig as Record<string, unknown>)[field] as number}
                        onChange={e => setBotConfig(c => c ? { ...c, [field]: parseFloat(e.target.value) || 0 } : c)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Execution Mode</label>
                  <div className="flex gap-2">
                    {(['monitor', 'semi-auto', 'full-auto'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setBotConfig(c => c ? { ...c, executionMode: m } : c)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize
                          ${botConfig.executionMode === m ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                      >{m}</button>
                    ))}
                  </div>
                </div>
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={() => handleSaveBotConfig(botConfig)} disabled={savingBotConfig}>
                  {savingBotConfig ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                  Save Settings
                </Button>
              </div>

              {/* Bot log */}
              {botLog.length > 0 && (
                <div className="bg-black border border-slate-800 rounded-xl p-3 font-mono text-xs max-h-40 overflow-y-auto space-y-0.5">
                  {botLog.map((line, i) => (
                    <div key={i} className="text-emerald-400">{line}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-500 text-sm">Failed to load bot config</p>
          )}
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {subTab === 'analytics' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={loadAnalytics} disabled={loadingAnalytics}>
              {loadingAnalytics ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
          </div>
          {analytics ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Opps', val: analytics.totalOpportunities, icon: Activity },
                { label: 'Executed', val: analytics.executedTrades, icon: Zap },
                { label: 'Win Rate', val: `${analytics.winRate.toFixed(1)}%`, icon: TrendingUp },
                { label: 'Net Profit', val: `$${analytics.netProfitUsd.toFixed(2)}`, icon: DollarSign },
                { label: 'Total Fees', val: `$${analytics.totalFeesUsd.toFixed(2)}`, icon: BarChart3 },
                { label: 'Successful', val: analytics.successfulTrades, icon: CheckCircle2 },
                { label: 'Failed', val: analytics.failedTrades, icon: XCircle },
                { label: 'Total Profit', val: `$${analytics.totalProfitUsd.toFixed(2)}`, icon: BarChart2 },
              ].map(({ label, val, icon: Icon }) => (
                <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-slate-400">{label}</span>
                  </div>
                  <div className="text-xl font-bold text-white">{val}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500">
              <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Click &quot;Refresh&quot; to load analytics</p>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {subTab === 'settings' && (
        <div className="space-y-4">
          {loadingBotConfig ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : botConfig ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
              <h4 className="font-semibold text-white">Advanced Bot Settings</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Max Order Size ($)', field: 'maxOrderSizeUsd' },
                  { label: 'Min Liquidity ($)', field: 'minLiquidityUsd' },
                  { label: 'Max Daily Loss ($)', field: 'maxDailyLossUsd' },
                  { label: 'Max Open Positions', field: 'maxOpenPositions' },
                  { label: 'Max API Latency (ms)', field: 'maxApiLatencyMs' },
                  { label: 'Scan Interval (s)', field: 'scanIntervalSeconds' },
                ].map(({ label, field }) => (
                  <div key={field}>
                    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                    <input
                      type="number"
                      value={(botConfig as Record<string, unknown>)[field] as number}
                      onChange={e => setBotConfig(c => c ? { ...c, [field]: parseFloat(e.target.value) || 0 } : c)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Alert on Opportunity', field: 'alertOnOpportunity' },
                  { label: 'Alert on Execution', field: 'alertOnExecution' },
                  { label: 'Alert on Failure', field: 'alertOnFailure' },
                  { label: 'Alert on Low Balance', field: 'alertOnLowBalance' },
                  { label: 'Pre-Funded Mode', field: 'preFundedMode' },
                ].map(({ label, field }) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(botConfig as Record<string, unknown>)[field] as boolean}
                      onChange={e => setBotConfig(c => c ? { ...c, [field]: e.target.checked } : c)}
                      className="accent-cyan-500 w-4 h-4"
                    />
                    <span className="text-sm text-slate-300">{label}</span>
                  </label>
                ))}
              </div>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" onClick={() => handleSaveBotConfig(botConfig)} disabled={savingBotConfig}>
                {savingBotConfig ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                Save All Settings
              </Button>
            </div>
          ) : (
            <Button size="sm" className="bg-slate-700 hover:bg-slate-600 text-white" onClick={loadBotConfig}>
              Load Bot Config
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
