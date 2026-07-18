'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { getMarketOpportunities } from '@/app/actions/arbitrage'
import { getDepositAddresses, submitFundRequest, getMyFundRequests } from '@/app/actions/deposits'
import { getWalletSummary } from '@/app/actions/wallet'
import { copyToClipboard } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  LogOut, Zap, Wallet, TrendingUp, RefreshCw, Search,
  Copy, Check, ChevronUp, ChevronDown, Filter, X,
  Clock, CheckCircle2, XCircle, PlusCircle, ArrowRightLeft,
  Activity, BarChart3, AlertTriangle, Shield, Link2, Gift, ArrowDownCircle,
  Eye, EyeOff, Bot,
} from 'lucide-react'
import { ExchangeConnectionManager } from '@/components/exchange-connection-manager'
import { TradeExecutionPanel } from '@/components/trade-execution-panel'
import { AutoTradePlatform } from '@/components/auto-trade-platform'
import { PassiveIncome } from '@/components/passive-income'
import { TraderWallet } from '@/components/trader-wallet'
import { ActivationFeeModal } from '@/components/activation-fee-modal'
import { TradingBot } from '@/components/trading-bot'

type Opportunity = Awaited<ReturnType<typeof getMarketOpportunities>>[number]
type DepositAddress = Awaited<ReturnType<typeof getDepositAddresses>>[number]
type FundRequest = Awaited<ReturnType<typeof getMyFundRequests>>[number]

type Network = 'TRC20' | 'BEP20' | 'ERC20'
type Tab = 'wallet' | 'opportunities' | 'funds' | 'exchanges' | 'trade' | 'auto-trade' | 'passive-income' | 'trading-bot'
type SortKey = 'netProfit' | 'spread' | 'volume24h' | 'symbol'
type SortDir = 'asc' | 'desc'

const NETWORK_META: Record<Network, { color: string; bg: string; border: string; chain: string }> = {
  TRC20: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', chain: 'TRON Network' },
  BEP20: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', chain: 'BNB Smart Chain' },
  ERC20: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', chain: 'Ethereum Network' },
}

const STATUS_META = {
  pending:   { icon: Clock,          color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20',  label: 'Pending Review' },
  confirmed: { icon: CheckCircle2,   color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   label: 'Confirmed' },
  rejected:  { icon: XCircle,        color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: 'Rejected' },
}

function formatPrice(p: number) {
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(3)}`
  if (p >= 0.01) return `$${p.toFixed(4)}`
  if (p >= 0.0001) return `$${p.toFixed(6)}`
  return `$${p.toFixed(8)}`
}

function formatVolume(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${(v / 1e3).toFixed(0)}K`
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
      title="Copy address"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export function TraderClient({ user, isActivated }: { user: { id: string; name?: string | null; email?: string }; isActivated: boolean }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('opportunities')

  // Opportunities state
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loadingOpps, setLoadingOpps] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [minProfit, setMinProfit] = useState(0)
  const [selectedBuyExchanges, setSelectedBuyExchanges] = useState<string[]>([])
  const [selectedSellExchanges, setSelectedSellExchanges] = useState<string[]>([])
  const [selectedRisks, setSelectedRisks] = useState<string[]>([])
  const [minVolume, setMinVolume] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('netProfit')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [oppPage, setOppPage] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const OPP_PAGE_SIZE = 25

  // Wallet balance for header
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [walletBalanceVisible, setWalletBalanceVisible] = useState(true)

  // Funds state
  const [depositAddresses, setDepositAddresses] = useState<DepositAddress[]>([])
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([])
  const [loadingFunds, setLoadingFunds] = useState(false)

  // Deposit form
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Load wallet balance on mount and refresh every 60s
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const summary = await getWalletSummary()
        setWalletBalance(summary.available)
      } catch { /* silent */ }
    }
    fetchBalance()
    const interval = setInterval(fetchBalance, 60000)
    return () => clearInterval(interval)
  }, [])

  // Load opportunities on mount with live refresh (every 15 seconds for real-time rates)
  useEffect(() => {
    loadOpportunities()
    const interval = setInterval(() => loadOpportunities(true), 15000)
    return () => clearInterval(interval)
  }, [])

  // Load fund data when switching to funds tab
  useEffect(() => {
    if (activeTab === 'funds') loadFunds()
  }, [activeTab])

  const loadOpportunities = async (silent = false) => {
    if (!silent) setLoadingOpps(true)
    else setRefreshing(true)
    try {
      const data = await getMarketOpportunities()
      setOpportunities(data)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Failed to load opportunities:', e)
    } finally {
      setLoadingOpps(false)
      setRefreshing(false)
    }
  }

  const loadFunds = async () => {
    setLoadingFunds(true)
    try {
      const [addrs, reqs] = await Promise.all([getDepositAddresses(), getMyFundRequests()])
      setDepositAddresses(addrs as DepositAddress[])
      setFundRequests(reqs as FundRequest[])
    } catch (e) {
      console.error('Failed to load funds data:', e)
    } finally {
      setLoadingFunds(false)
    }
  }

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setOppPage(0)
  }

  const filtered = useMemo(() => {
    let data = opportunities
    if (searchQuery) {
      const q = searchQuery.toUpperCase()
      data = data.filter(o => o.symbol.includes(q) || o.buyExchange.toUpperCase().includes(q) || o.sellExchange.toUpperCase().includes(q))
    }
    if (minProfit > 0) data = data.filter(o => o.netProfit >= minProfit)
    if (selectedBuyExchanges.length > 0) {
      data = data.filter(o => selectedBuyExchanges.includes(o.buyExchange))
    }
    if (selectedSellExchanges.length > 0) {
      data = data.filter(o => selectedSellExchanges.includes(o.sellExchange))
    }
    if (selectedRisks.length > 0) {
      data = data.filter(o => selectedRisks.includes(o.risk))
    }
    if (minVolume > 0) data = data.filter(o => o.volume24h >= minVolume)
    return [...data].sort((a, b) => {
      const va = a[sortKey] as number | string
      const vb = b[sortKey] as number | string
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [opportunities, searchQuery, minProfit, selectedBuyExchanges, selectedSellExchanges, selectedRisks, minVolume, sortKey, sortDir])

  const paginated = filtered.slice(oppPage * OPP_PAGE_SIZE, (oppPage + 1) * OPP_PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / OPP_PAGE_SIZE)

  const stats = useMemo(() => ({
    total: filtered.length,
    avgProfit: filtered.length ? filtered.reduce((s, o) => s + o.netProfit, 0) / filtered.length : 0,
    topProfit: filtered[0]?.netProfit ?? 0,
  }), [filtered])

  const handleSubmitDeposit = async () => {
    if (!selectedNetwork || !amount) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitFundRequest(selectedNetwork, parseFloat(amount), txHash || undefined)
      setSubmitSuccess(true)
      setAmount('')
      setTxHash('')
      setSelectedNetwork(null)
      await loadFunds()
      setTimeout(() => setSubmitSuccess(false), 4000)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  const configuredNetworks = depositAddresses.map(a => a.network as Network)
  const selectedAddressData = depositAddresses.find(a => a.network === selectedNetwork)
  const pendingCount = fundRequests.filter(r => r.status === 'pending').length
  const confirmedTotal = fundRequests
    .filter(r => r.status === 'confirmed')
    .reduce((s, r) => s + parseFloat(r.amount as string), 0)

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 font-sans">
      {/* Activation Fee Modal — shown on first login until account is activated */}
      <ActivationFeeModal serverIsActivated={isActivated} />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-3 sm:px-4 md:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Left: logo */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <span className="text-white font-bold text-base sm:text-lg tracking-tight truncate">Arbitrage IQ</span>
            <span className="hidden sm:block text-slate-700">|</span>
            <span className="hidden sm:block text-slate-400 text-sm font-medium whitespace-nowrap">Trader Dashboard</span>
          </div>

          {/* Right: balance + actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Wallet Balance Chip */}
            <button
              onClick={() => setActiveTab('wallet')}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-amber-500/40 transition-all"
              title="Go to Wallet"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-slate-500 text-[9px] sm:text-[10px] font-medium uppercase tracking-wide">Bal</span>
                {walletBalance == null ? (
                  <span className="text-slate-500 text-xs mt-0.5 animate-pulse">...</span>
                ) : walletBalanceVisible ? (
                  <span className="text-amber-400 font-bold text-xs sm:text-sm font-mono">
                    ${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold text-xs sm:text-sm tracking-widest">••••</span>
                )}
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); setWalletBalanceVisible(v => !v) }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setWalletBalanceVisible(v => !v) } }}
                className="ml-0.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {walletBalanceVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </span>
            </button>

            {/* User Badge — desktop only */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-300 text-sm truncate max-w-[120px]">{user.name ?? user.email}</span>
              <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                TRADER
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-800 gap-1.5 px-2 sm:px-3"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation — horizontally scrollable on mobile */}
      <div className="border-b border-slate-800 bg-slate-900/60">
        <div className="max-w-screen-xl mx-auto px-0 sm:px-4 md:px-6 overflow-x-auto scrollbar-none">
          <div className="flex gap-0 sm:gap-1 min-w-max sm:min-w-0 px-3 sm:px-0">
            {([
              { key: 'wallet' as Tab, label: 'Wallet', icon: Wallet, count: null },
              { key: 'auto-trade' as Tab, label: 'Auto Trade', icon: Zap, count: null },
              { key: 'trading-bot' as Tab, label: 'Bots', icon: Bot, count: null },
              { key: 'passive-income' as Tab, label: 'Passive', icon: Gift, count: null },
              { key: 'opportunities' as Tab, label: 'Markets', icon: TrendingUp, count: null },
              { key: 'trade' as Tab, label: 'Trade', icon: ArrowRightLeft, count: null },
              { key: 'exchanges' as Tab, label: 'Exchanges', icon: Link2, count: null },
              { key: 'funds' as Tab, label: 'Deposits', icon: ArrowDownCircle, count: pendingCount || null },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-screen-xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 w-full">
        {/* ── TAB: WALLET ─��� */}
        {activeTab === 'wallet' && (
          <TraderWallet />
        )}

        {/* ── TAB: AUTO TRADE ── */}
        {activeTab === 'auto-trade' && (
          <AutoTradePlatform />
        )}

        {/* ── TAB: TRADING BOTS ── */}
        {activeTab === 'trading-bot' && (
          <TradingBot />
        )}

        {/* ── TAB: PASSIVE INCOME ── */}
        {activeTab === 'passive-income' && (
          <PassiveIncome />
        )}

        {/* ── TAB: TRADE OPPORTUNITIES ── */}
        {activeTab === 'opportunities' && (
          <div className="space-y-4">
            {/* Stats — 3-col on sm+, compact row on mobile */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { label: 'Opportunities', value: stats.total.toLocaleString(), icon: TrendingUp, color: 'text-amber-400' },
                { label: 'Avg Profit', value: `${stats.avgProfit.toFixed(2)}%`, icon: BarChart3, color: 'text-green-400' },
                { label: 'Best', value: `${stats.topProfit.toFixed(2)}%`, icon: Zap, color: 'text-cyan-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="bg-slate-900 border-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-slate-800 shrink-0">
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-slate-500 text-[10px] sm:text-xs leading-tight">{label}</p>
                    <p className={`text-lg sm:text-2xl font-bold ${color} leading-tight`}>{value}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Search + filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setOppPage(0) }}
                  placeholder="Search coin or exchange..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors shrink-0 ${
                  showFilters || minProfit > 0 || selectedBuyExchanges.length > 0 || selectedSellExchanges.length > 0 || selectedRisks.length > 0 || minVolume > 0
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filter</span>
              </button>
              <button
                onClick={() => loadOpportunities(true)}
                disabled={refreshing}
                className="shrink-0 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
              </button>
              {(searchQuery || minProfit > 0 || selectedBuyExchanges.length > 0 || selectedSellExchanges.length > 0 || selectedRisks.length > 0 || minVolume > 0) && (
                <button
                  onClick={() => { setSearchQuery(''); setMinProfit(0); setSelectedBuyExchanges([]); setSelectedSellExchanges([]); setSelectedRisks([]); setMinVolume(0); setOppPage(0) }}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>

            {showFilters && (
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Min Net Profit */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-medium">Min Net Profit %</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={minProfit}
                      onChange={e => { setMinProfit(parseFloat(e.target.value) || 0); setOppPage(0) }}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="0.0"
                    />
                  </div>

                  {/* Risk Level */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-medium">Risk Level</label>
                    <div className="flex gap-1.5">
                      {['Low', 'Medium', 'High'].map(risk => (
                        <button
                          key={risk}
                          onClick={() => {
                            setSelectedRisks(prev =>
                              prev.includes(risk)
                                ? prev.filter(r => r !== risk)
                                : [...prev, risk]
                            )
                            setOppPage(0)
                          }}
                          className={`flex-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                            selectedRisks.includes(risk)
                              ? risk === 'Low'
                                ? 'bg-green-500/30 border border-green-500/50 text-green-300'
                                : risk === 'Medium'
                                  ? 'bg-amber-500/30 border border-amber-500/50 text-amber-300'
                                  : 'bg-red-500/30 border border-red-500/50 text-red-300'
                              : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {risk}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Min Volume */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-medium">Min Volume 24h</label>
                    <select
                      value={minVolume}
                      onChange={e => { setMinVolume(parseFloat(e.target.value) || 0); setOppPage(0) }}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="0">Any</option>
                      <option value="1000000">$1M+</option>
                      <option value="5000000">$5M+</option>
                      <option value="10000000">$10M+</option>
                      <option value="50000000">$50M+</option>
                      <option value="100000000">$100M+</option>
                    </select>
                  </div>

                  {/* Buy Exchange */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-medium">Buy From</label>
                    <select
                      multiple
                      value={selectedBuyExchanges}
                      onChange={e => {
                        const selected = Array.from(e.target.selectedOptions, opt => opt.value)
                        setSelectedBuyExchanges(selected)
                        setOppPage(0)
                      }}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                      size={3}
                    >
                      {['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate.io', 'MEXC', 'HTX', 'Kraken', 'Coinbase', 'Gemini', 'Crypto.com', 'BingX'].map(exchange => (
                        <option key={exchange} value={exchange}>
                          {exchange}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                  </div>

                  {/* Sell Exchange */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block font-medium">Sell To</label>
                    <select
                      multiple
                      value={selectedSellExchanges}
                      onChange={e => {
                        const selected = Array.from(e.target.selectedOptions, opt => opt.value)
                        setSelectedSellExchanges(selected)
                        setOppPage(0)
                      }}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                      size={3}
                    >
                      {['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate.io', 'MEXC', 'HTX', 'Kraken', 'Coinbase', 'Gemini', 'Crypto.com', 'BingX'].map(exchange => (
                        <option key={exchange} value={exchange}>
                          {exchange}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Opportunities Table */}
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span className="text-white font-semibold">Live Arbitrage Opportunities</span>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-400/10 border border-green-400/20 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-xs font-semibold">LIVE RATES</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {lastUpdated && (
                    <span>Updated {lastUpdated.toLocaleTimeString()}</span>
                  )}
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500 font-medium">{filtered.length} results</span>
                </div>
              </div>

              {loadingOpps ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-7 h-7 text-amber-400 animate-spin mx-auto mb-3" />
                  <p className="text-slate-500">Scanning exchanges...</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/40">
                          {([
                            { label: 'Symbol', key: 'symbol' as SortKey },
                            { label: 'Buy Exchange', key: null },
                            { label: 'Buy Price', key: null },
                            { label: 'Sell Exchange', key: null },
                            { label: 'Sell Price', key: null },
                            { label: 'Spread', key: 'spread' as SortKey },
                            { label: 'Net Profit %', key: 'netProfit' as SortKey },
                            { label: '$ / $1k', key: null },
                            { label: 'Volume 24h', key: 'volume24h' as SortKey },
                            { label: 'Risk', key: null },
                            { label: 'Detected', key: null },
                          ]).map(({ label, key }) => (
                            <th key={label} className="px-4 py-3 text-left">
                              {key ? (
                                <button
                                  onClick={() => handleSort(key)}
                                  className="flex items-center gap-1 text-slate-500 hover:text-white text-xs uppercase tracking-wider font-semibold transition-colors"
                                >
                                  {label}
                                  <span className="flex flex-col -space-y-0.5">
                                    <ChevronUp className={`w-3 h-3 ${sortKey === key && sortDir === 'asc' ? 'text-amber-400' : 'text-slate-700'}`} />
                                    <ChevronDown className={`w-3 h-3 ${sortKey === key && sortDir === 'desc' ? 'text-amber-400' : 'text-slate-700'}`} />
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">{label}</span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((opp, i) => {
                          const riskColor = opp.risk === 'Low' ? 'text-green-400 bg-green-400/10' : opp.risk === 'Medium' ? 'text-amber-400 bg-amber-400/10' : 'text-red-400 bg-red-400/10'
                          const RiskIcon = opp.risk === 'Low' ? Shield : AlertTriangle
                          return (
                            <tr key={opp.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/30'}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{opp.symbol}</span>
                                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400">
                                    {opp.category.toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-300 font-medium">{opp.buyExchange}</td>
                              <td className="px-4 py-3 text-slate-400 font-mono text-xs">{formatPrice(opp.buyPrice)}</td>
                              <td className="px-4 py-3 text-slate-300 font-medium">{opp.sellExchange}</td>
                              <td className="px-4 py-3 text-slate-400 font-mono text-xs">{formatPrice(opp.sellPrice)}</td>
                              <td className="px-4 py-3 text-right"><span className="text-cyan-400 font-semibold">{opp.spread.toFixed(2)}%</span></td>
                              <td className="px-4 py-3 text-right"><span className="text-green-400 font-bold">{opp.netProfit.toFixed(2)}%</span></td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-amber-400 font-bold text-sm">
                                  +${((opp.netProfit / 100) * 1000).toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-slate-400 text-xs">{formatVolume(opp.volume24h)}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${riskColor}`}>
                                  <RiskIcon className="w-3 h-3" />{opp.risk}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{timeAgo(opp.detectedAt)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-slate-800">
                    {paginated.map(opp => {
                      const riskColor = opp.risk === 'Low' ? 'text-green-400 bg-green-400/10 border-green-400/20' : opp.risk === 'Medium' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'
                      const RiskIcon = opp.risk === 'Low' ? Shield : AlertTriangle
                      return (
                        <div key={opp.id} className="p-4 space-y-3">
                          {/* Top row: symbol + profit */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base">{opp.symbol}</span>
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400">{opp.category.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${riskColor}`}>
                                <RiskIcon className="w-3 h-3" />{opp.risk}
                              </span>
                              <span className="text-green-400 font-black text-base">{opp.netProfit.toFixed(2)}%</span>
                            </div>
                          </div>
                          {/* Exchange route */}
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex-1 bg-slate-800 rounded-lg px-3 py-2">
                              <p className="text-slate-500 mb-0.5">Buy on</p>
                              <p className="text-white font-semibold">{opp.buyExchange}</p>
                              <p className="text-slate-400 font-mono">{formatPrice(opp.buyPrice)}</p>
                            </div>
                            <ArrowRightLeft className="w-4 h-4 text-amber-400 shrink-0" />
                            <div className="flex-1 bg-slate-800 rounded-lg px-3 py-2">
                              <p className="text-slate-500 mb-0.5">Sell on</p>
                              <p className="text-white font-semibold">{opp.sellExchange}</p>
                              <p className="text-slate-400 font-mono">{formatPrice(opp.sellPrice)}</p>
                            </div>
                          </div>
                          {/* Stats row */}
                          <div className="flex gap-3 text-xs">
                            <div className="flex-1 text-center">
                              <p className="text-slate-500">Spread</p>
                              <p className="text-cyan-400 font-semibold">{opp.spread.toFixed(2)}%</p>
                            </div>
                            <div className="flex-1 text-center">
                              <p className="text-slate-500">$ / $1k</p>
                              <p className="text-amber-400 font-bold">+${((opp.netProfit / 100) * 1000).toFixed(2)}</p>
                            </div>
                            <div className="flex-1 text-center">
                              <p className="text-slate-500">Volume</p>
                              <p className="text-slate-300 font-medium">{formatVolume(opp.volume24h)}</p>
                            </div>
                            <div className="flex-1 text-center">
                              <p className="text-slate-500">Detected</p>
                              <p className="text-slate-400">{timeAgo(opp.detectedAt)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-4 sm:px-5 py-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-slate-500 text-sm">
                        Page {oppPage + 1} of {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={oppPage === 0}
                          onClick={() => setOppPage(p => p - 1)}
                          className="text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800"
                        >
                          Prev
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={oppPage >= totalPages - 1}
                          onClick={() => setOppPage(p => p + 1)}
                          className="text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        )}

        {/* ── TAB: EXCHANGES ── */}
        {activeTab === 'exchanges' && (
          <div className="space-y-6">
            <ExchangeConnectionManager />
          </div>
        )}

        {/* ── TAB: TRADE & TRANSFER ── */}
        {activeTab === 'trade' && (
          <div className="space-y-6">
            <TradeExecutionPanel />
          </div>
        )}

        {/* ── TAB: FUNDS & DEPOSITS ── */}
        {activeTab === 'funds' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { label: 'Confirmed', value: `$${confirmedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: CheckCircle2, color: 'text-green-400' },
                { label: 'Pending', value: pendingCount.toString(), icon: Clock, color: 'text-yellow-400' },
                { label: 'Total', value: fundRequests.length.toString(), icon: Wallet, color: 'text-amber-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="bg-slate-900 border-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                  <div className="p-2 sm:p-2.5 rounded-xl bg-slate-800 shrink-0">
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-slate-500 text-[10px] sm:text-xs">{label}</p>
                    <p className={`text-base sm:text-2xl font-bold ${color} leading-tight`}>{value}</p>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* ─── Deposit Form ─── */}
              <div className="space-y-4">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-amber-400" />
                  Add Funds (USDT)
                </h2>

                {loadingFunds ? (
                  <Card className="bg-slate-900 border-slate-800 p-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                    Loading deposit addresses...
                  </Card>
                ) : configuredNetworks.length === 0 ? (
                  <Card className="bg-slate-900 border-slate-800 p-8 text-center">
                    <Wallet className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No deposit networks configured</p>
                    <p className="text-slate-600 text-sm mt-1">Please contact the admin to set up deposit addresses.</p>
                  </Card>
                ) : (
                  <Card className="bg-slate-900 border-slate-800 p-5 space-y-5">
                    {/* Step 1: Choose network */}
                    <div>
                      <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3 block">
                        Step 1 — Select Network
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['TRC20', 'BEP20', 'ERC20'] as Network[]).map(network => {
                          const meta = NETWORK_META[network]
                          const available = configuredNetworks.includes(network)
                          const selected = selectedNetwork === network
                          return (
                            <button
                              key={network}
                              disabled={!available}
                              onClick={() => setSelectedNetwork(selected ? null : network)}
                              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                !available
                                  ? 'border-slate-800 opacity-30 cursor-not-allowed'
                                  : selected
                                    ? `${meta.border} ${meta.bg}`
                                    : 'border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              <span className={`text-sm font-bold ${selected ? meta.color : 'text-slate-300'}`}>{network}</span>
                              <span className="text-xs text-slate-500 text-center leading-tight">{meta.chain}</span>
                              {!available && <span className="text-xs text-slate-600">Not set</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Step 2: Show address */}
                    {selectedNetwork && selectedAddressData && (
                      <div>
                        <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3 block">
                          Step 2 — Send USDT to this address
                        </label>
                        <div className={`p-4 rounded-xl border ${NETWORK_META[selectedNetwork].border} ${NETWORK_META[selectedNetwork].bg} space-y-2`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-bold uppercase ${NETWORK_META[selectedNetwork].color}`}>
                              USDT {selectedNetwork} Address
                            </span>
                            <CopyButton text={selectedAddressData.address} />
                          </div>
                          <p className={`font-mono text-sm break-all ${NETWORK_META[selectedNetwork].color}`}>
                            {selectedAddressData.address}
                          </p>
                          {selectedAddressData.label && (
                            <p className="text-slate-500 text-xs">{selectedAddressData.label}</p>
                          )}
                        </div>
                        <p className="text-slate-600 text-xs mt-2">
                          Only send USDT on the {selectedNetwork} network. Sending other tokens may result in permanent loss.
                        </p>
                      </div>
                    )}

                    {/* Step 3: Enter amount + tx hash */}
                    {selectedNetwork && (
                      <div className="space-y-4">
                        <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider block">
                          Step 3 — Confirm Your Deposit
                        </label>
                        <div>
                          <label className="text-slate-400 text-xs mb-1.5 block">Amount (USDT) <span className="text-red-400">*</span></label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={amount}
                              onChange={e => setAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full pl-7 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1.5 block">Transaction Hash <span className="text-slate-500">(optional)</span></label>
                          <input
                            type="text"
                            value={txHash}
                            onChange={e => setTxHash(e.target.value)}
                            placeholder="0x... or TXID from your wallet"
                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-amber-500/50 transition-colors"
                          />
                        </div>

                        {submitError && (
                          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{submitError}</p>
                        )}
                        {submitSuccess && (
                          <p className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Deposit request submitted! Admin will review shortly.
                          </p>
                        )}

                        <Button
                          onClick={handleSubmitDeposit}
                          disabled={submitting || !amount || parseFloat(amount) <= 0}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-11 text-base"
                        >
                          {submitting ? 'Submitting...' : 'Submit Deposit Request'}
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* ─── Deposit History ─── */}
              <div className="space-y-4">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Deposit History
                </h2>
                <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                  {loadingFunds ? (
                    <div className="p-8 text-center text-slate-500">Loading history...</div>
                  ) : fundRequests.length === 0 ? (
                    <div className="p-10 text-center">
                      <Clock className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500">No deposit requests yet.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {fundRequests.map(req => {
                        const status = req.status as keyof typeof STATUS_META
                        const meta = STATUS_META[status] ?? STATUS_META.pending
                        const StatusIcon = meta.icon
                        const networkMeta = NETWORK_META[req.network as Network]
                        return (
                          <div key={req.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-2 rounded-lg border ${meta.bg} flex-shrink-0`}>
                                  <StatusIcon className={`w-4 h-4 ${meta.color}`} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-white font-bold text-base">
                                      ${parseFloat(req.amount as string).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${networkMeta?.border ?? ''} ${networkMeta?.color ?? 'text-slate-400'} ${networkMeta?.bg ?? ''}`}>
                                      {req.network}
                                    </span>
                                  </div>
                                  {req.txHash && (
                                    <p className="text-slate-500 text-xs font-mono mt-0.5 truncate" title={req.txHash}>
                                      TX: {req.txHash.slice(0, 24)}...
                                    </p>
                                  )}
                                  <p className="text-slate-600 text-xs mt-0.5">
                                    {new Date(req.createdAt as string | Date).toLocaleString('en-US')}
                                  </p>
                                  {req.note && (
                                    <p className="text-slate-400 text-xs mt-1 italic">&quot;{req.note}&quot;</p>
                                  )}
                                </div>
                              </div>
                              <span className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-semibold border ${meta.bg} ${meta.color}`}>
                                {meta.label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
