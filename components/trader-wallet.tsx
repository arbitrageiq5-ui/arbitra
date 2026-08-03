'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw,
  TrendingUp, Gift, ShieldCheck, Clock, CheckCircle2,
  XCircle, Copy, Check, X, AlertCircle, DollarSign,
  ChevronDown, ChevronUp, Zap, ArrowRight, Info,
} from 'lucide-react'
import { copyToClipboard as copyUtil } from '@/lib/utils'
import {
  getWalletSummary,
  requestWithdrawal,
  cancelWithdrawal,
} from '@/app/actions/wallet'
import { selfFundAutoTrade } from '@/app/actions/auto-trade'
import {
  submitFundRequest,
  getDepositAddresses,
} from '@/app/actions/deposits'

type WalletSummary = Awaited<ReturnType<typeof getWalletSummary>>
type DepositAddress = { network: string; address: string; label: string | null }
type Network = 'TRC20' | 'BEP20' | 'ERC20'
type ActivePanel = 'deposit' | 'withdraw' | 'shift' | null

const NETWORKS: Network[] = ['TRC20', 'BEP20', 'ERC20']

const NETWORK_META: Record<Network, { color: string; bg: string; border: string; dot: string }> = {
  TRC20: { color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/25',   dot: 'bg-red-400' },
  BEP20: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', dot: 'bg-amber-400' },
  ERC20: { color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/25',  dot: 'bg-blue-400' },
}

function NetworkBadge({ network }: { network: string }) {
  const meta = NETWORK_META[network as Network]
  if (!meta) return <span className="text-xs font-mono text-slate-500">{network}</span>
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${meta.color} ${meta.bg} ${meta.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {network}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    pending:   { label: 'Pending',   cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20',  icon: Clock },
    confirmed: { label: 'Confirmed', cls: 'text-green-400 bg-green-500/10 border-green-500/20',  icon: CheckCircle2 },
    approved:  { label: 'Approved',  cls: 'text-green-400 bg-green-500/10 border-green-500/20',  icon: CheckCircle2 },
    rejected:  { label: 'Rejected',  cls: 'text-red-400 bg-red-500/10 border-red-500/20',        icon: XCircle },
  }
  const s = map[status] ?? { label: status, cls: 'text-slate-400 bg-slate-500/10 border-slate-500/20', icon: Info }
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  )
}

function SectionHeader({ title, icon: Icon, iconColor }: { title: string; icon: React.ElementType; iconColor: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor} bg-current/10`} style={{ background: 'transparent' }}>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
      <h3 className="text-white font-bold text-sm">{title}</h3>
    </div>
  )
}

export function TraderWallet() {
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [addresses, setAddresses] = useState<DepositAddress[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  // Deposit form
  const [depNetwork, setDepNetwork] = useState<Network>('TRC20')
  const [depAmount, setDepAmount] = useState('')
  const [depTxHash, setDepTxHash] = useState('')
  const [submittingDep, setSubmittingDep] = useState(false)
  const [showAllDeposits, setShowAllDeposits] = useState(false)

  // Shift form
  const [shiftAmount, setShiftAmount] = useState('')
  const [submittingShift, setSubmittingShift] = useState(false)

  // Withdraw form
  const [withNetwork, setWithNetwork] = useState<Network>('TRC20')
  const [withAmount, setWithAmount] = useState('')
  const [withAddress, setWithAddress] = useState('')
  const [withTxHash, setWithTxHash] = useState('')
  const [submittingWith, setSubmittingWith] = useState(false)
  const [showAllWith, setShowAllWith] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, addrs] = await Promise.all([getWalletSummary(), getDepositAddresses()])
      setSummary(s)
      setAddresses(addrs as DepositAddress[])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load wallet', 'error')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [])

  const copyToClipboard = async (text: string, key: string) => {
    await copyUtil(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const togglePanel = (panel: ActivePanel) =>
    setActivePanel(prev => prev === panel ? null : panel)

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmittingDep(true)
      await submitFundRequest(depNetwork, parseFloat(depAmount), depTxHash || undefined)
      await load()
      setDepAmount(''); setDepTxHash(''); setActivePanel(null)
      showToast('Deposit request submitted. Admin will confirm shortly.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit', 'error')
    } finally { setSubmittingDep(false) }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withTxHash.trim()) { showToast('Transaction Hash ID is required', 'error'); return }
    try {
      setSubmittingWith(true)
      await requestWithdrawal(parseFloat(withAmount), withNetwork, withAddress, withTxHash.trim())
      await load()
      setWithAmount(''); setWithAddress(''); setWithTxHash(''); setActivePanel(null)
      showToast('Withdrawal request submitted. Admin will process within 24 hours.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit', 'error')
    } finally { setSubmittingWith(false) }
  }

  const handleCancelWithdrawal = async (id: number) => {
    try {
      await cancelWithdrawal(id)
      await load()
      showToast('Withdrawal cancelled.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to cancel', 'error')
    }
  }

  const handleShift = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(shiftAmount)
    try {
      setSubmittingShift(true)
      await selfFundAutoTrade(amt)
      await load()
      setShiftAmount(''); setActivePanel(null)
      showToast(`$${amt.toFixed(2)} shifted to Auto-Trade successfully!`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to shift funds', 'error')
    } finally { setSubmittingShift(false) }
  }

  const depositAddr = addresses.find(a => a.network === depNetwork)
  const s = summary
  const available = s?.available ?? 0
  const visibleDeposits = showAllDeposits ? s?.recentDeposits : s?.recentDeposits?.slice(0, 4)
  const visibleWith = showAllWith ? s?.recentWithdrawals : s?.recentWithdrawals?.slice(0, 4)

  // Balance breakdown for progress bar
  const totalIn = (s?.totalDeposited ?? 0) + (s?.tradeProfits ?? 0) + (s?.referralEarnings ?? 0)
  const depPct   = totalIn > 0 ? ((s?.totalDeposited ?? 0) / totalIn) * 100 : 0
  const profPct  = totalIn > 0 ? ((s?.tradeProfits ?? 0) / totalIn) * 100 : 0
  const refPct   = totalIn > 0 ? ((s?.referralEarnings ?? 0) / totalIn) * 100 : 0

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
        <p className="text-slate-500 text-sm">Loading wallet...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2.5 border ${
          toast.type === 'success'
            ? 'bg-slate-900 border-green-700/50 text-green-300'
            : 'bg-slate-900 border-red-700/50 text-red-300'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── BALANCE HERO ── */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        {/* Top: balance + refresh */}
        <div className="px-5 sm:px-6 pt-5 pb-4">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-bold text-base leading-none">My Wallet</p>
                <p className="text-slate-500 text-xs mt-0.5">USDT • All networks</p>
              </div>
            </div>
            <button
              onClick={load}
              className="p-2 rounded-lg border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {/* Balance + withdrawal window badge */}
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <p className="text-slate-500 text-xs mb-1">Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-amber-400 text-3xl font-black">$</span>
                <span className="text-white text-4xl sm:text-5xl font-black tracking-tight tabular-nums">
                  {available.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-slate-600 text-sm font-medium">USDT</span>
              </div>
            </div>
            <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
              s?.canWithdrawNow !== false
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${s?.canWithdrawNow !== false ? 'bg-green-400' : 'bg-slate-600'}`} />
              {s?.canWithdrawNow !== false ? 'Withdrawal Open' : 'Weekly Gate Closed'}
            </div>
          </div>

          {/* Income breakdown bar */}
          {totalIn > 0 && (
            <div className="mb-5">
              <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                {depPct > 0 && <div className="bg-green-500 rounded-full" style={{ width: `${depPct}%` }} />}
                {profPct > 0 && <div className="bg-amber-400 rounded-full" style={{ width: `${profPct}%` }} />}
                {refPct > 0  && <div className="bg-purple-400 rounded-full" style={{ width: `${refPct}%` }} />}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Deposits</span>
                <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Profits</span>
                <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />Referrals</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'deposit',  label: 'Deposit',    icon: ArrowDownCircle, active: 'bg-green-600 border-green-600 text-white', idle: 'bg-slate-800 border-slate-700 text-slate-300 hover:border-green-700/60 hover:text-green-400' },
              { key: 'shift',    label: 'Auto-Trade', icon: Zap,             active: 'bg-amber-500 border-amber-500 text-black', idle: 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-400' },
              { key: 'withdraw', label: 'Withdraw',   icon: ArrowUpCircle,   active: 'bg-red-600 border-red-600 text-white',    idle: 'bg-slate-800 border-slate-700 text-slate-300 hover:border-red-700/60 hover:text-red-400' },
            ] as const).map(btn => {
              const Icon = btn.icon
              const isActive = activePanel === btn.key
              return (
                <button
                  key={btn.key}
                  onClick={() => togglePanel(btn.key)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm border transition-all active:scale-95 ${isActive ? btn.active : btn.idle}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{btn.label}</span>
                  <span className="sm:hidden text-xs">{btn.label.split('-')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── DEPOSIT PANEL ── */}
        {activePanel === 'deposit' && (
          <div className="border-t border-slate-800 bg-slate-950/50">
            <div className="px-5 sm:px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-green-400" />
                  Deposit USDT
                </h3>
                <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Network tabs */}
              <div className="flex gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
                {NETWORKS.map(n => {
                  const meta = NETWORK_META[n]
                  return (
                    <button
                      key={n}
                      onClick={() => setDepNetwork(n)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        depNetwork === n
                          ? `${meta.color} ${meta.bg} ${meta.border}`
                          : 'text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {n}
                    </button>
                  )
                })}
              </div>

              {/* Address box */}
              {depositAddr ? (
                <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
                    <p className="text-slate-400 text-xs font-medium">Send USDT ({depNetwork}) to this address</p>
                    <button
                      onClick={() => copyToClipboard(depositAddr.address, 'dep-addr')}
                      className={`flex items-center gap-1 text-xs font-semibold transition-colors ${copied === 'dep-addr' ? 'text-green-400' : 'text-slate-400 hover:text-white'}`}
                    >
                      {copied === 'dep-addr' ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <code className="text-amber-300 text-xs sm:text-sm font-mono break-all leading-relaxed select-all">
                      {depositAddr.address}
                    </code>
                    {depositAddr.label && <p className="text-slate-600 text-xs mt-1.5">{depositAddr.label}</p>}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 flex items-center gap-2 text-slate-500 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No deposit address configured for {depNetwork}. Contact admin.
                </div>
              )}

              <form onSubmit={handleDeposit} className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-xs font-medium mb-1.5 block">Amount (USDT)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                      <input
                        type="number" min="1" step="0.01"
                        value={depAmount} onChange={e => setDepAmount(e.target.value)}
                        required placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs font-medium mb-1.5 block">
                      TX Hash <span className="text-slate-600">(optional)</span>
                    </label>
                    <input
                      type="text" value={depTxHash} onChange={e => setDepTxHash(e.target.value)}
                      placeholder="Paste tx hash for faster confirmation"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-green-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/5 border border-green-500/15 text-xs text-slate-400">
                  <Info className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  After sending, submit this form. Admin confirms within 1–24 hours.
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setActivePanel(null)}
                    className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingDep}
                    className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl disabled:opacity-50">
                    {submittingDep ? 'Submitting...' : 'Submit Deposit'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── SHIFT TO AUTO-TRADE PANEL ── */}
        {activePanel === 'shift' && (
          <div className="border-t border-slate-800 bg-slate-950/50">
            <div className="px-5 sm:px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Shift to Auto-Trade
                </h3>
                <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Rate cards */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Gross Return', value: '10%/mo', color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
                  { label: 'Platform Fee', value: '2%/mo',  color: 'text-red-400',   border: 'border-red-500/20',   bg: 'bg-red-500/5' },
                  { label: 'Net Profit',   value: '8%/mo',  color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/5' },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border ${item.border} ${item.bg} px-3 py-2.5 text-center`}>
                    <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wide">{item.label}</p>
                    <p className={`font-black text-lg ${item.color} leading-tight mt-0.5`}>{item.value}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleShift} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-400 text-xs font-medium">Amount to shift (USDT)</label>
                    <span className="text-xs text-slate-500">
                      Available: <span className="text-white font-semibold">${available.toFixed(2)}</span>
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                    <input
                      type="number" min="100" max={Math.min(5000, available)} step="0.01"
                      value={shiftAmount} onChange={e => setShiftAmount(e.target.value)}
                      required placeholder="Min $100"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-24 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShiftAmount(Math.min(5000, available).toFixed(2))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                    >
                      Max ${Math.min(5000, available).toFixed(0)}
                    </button>
                  </div>
                  <p className="text-slate-600 text-xs mt-1">Range: $100 – $5,000 per plan</p>
                </div>

                {/* Live profit preview */}
                {shiftAmount && !isNaN(parseFloat(shiftAmount)) && parseFloat(shiftAmount) >= 100 && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <div>
                      <p className="text-slate-400 text-xs">Estimated monthly profit</p>
                      <p className="text-slate-500 text-xs">at 8% net return</p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-400 font-black text-xl">
                        +${((parseFloat(shiftAmount) * 8) / 100).toFixed(2)}
                      </p>
                      <p className="text-slate-600 text-xs">/ month</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 px-3 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <p className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    Funds shift instantly. Daily profits return to your wallet automatically.
                  </p>
                  <p className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Only one active plan at a time. Principal is locked until plan ends.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setActivePanel(null); setShiftAmount('') }}
                    className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingShift || available < 100}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl disabled:opacity-40">
                    {submittingShift ? 'Shifting...' : 'Shift Funds'}
                    {!submittingShift && <ArrowRight className="w-4 h-4 ml-1.5" />}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── WITHDRAW PANEL ── */}
        {activePanel === 'withdraw' && (
          <div className="border-t border-slate-800 bg-slate-950/50">
            <div className="px-5 sm:px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-red-400" />
                  Withdraw USDT
                </h3>
                <button onClick={() => setActivePanel(null)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Weekly gate banner */}
              {s?.canWithdrawNow === false && s.nextWithdrawalAvailable ? (
                <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 text-sm font-bold">Withdrawal window not open</p>
                    <p className="text-amber-300/70 text-xs mt-0.5 leading-relaxed">
                      One withdrawal per week. Your next window opens on{' '}
                      <span className="text-amber-300 font-semibold">
                        {new Date(s.nextWithdrawalAvailable).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric',
                        })}
                      </span>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/5 border border-green-500/15 text-xs text-green-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Weekly withdrawal window is open &mdash; min. $100 USDT
                </div>
              )}

              {s?.canWithdrawNow !== false && (
                <form onSubmit={handleWithdraw} className="space-y-3">
                  {/* Network */}
                  <div className="flex gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
                    {NETWORKS.map(n => {
                      const meta = NETWORK_META[n]
                      return (
                        <button type="button" key={n} onClick={() => setWithNetwork(n)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            withNetwork === n
                              ? `${meta.color} ${meta.bg} ${meta.border}`
                              : 'text-slate-500 border-transparent hover:text-slate-300'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {n}
                        </button>
                      )
                    })}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-slate-400 text-xs font-medium">Amount (USDT)</label>
                        <button type="button" onClick={() => setWithAmount(available.toFixed(2))}
                          className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors">
                          Max ${available.toFixed(2)}
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                        <input
                          type="number" min="100" step="0.01" max={available}
                          value={withAmount} onChange={e => setWithAmount(e.target.value)}
                          required placeholder="Min $100"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs font-medium mb-1.5 block">Your {withNetwork} Address</label>
                      <input
                        type="text" value={withAddress} onChange={e => setWithAddress(e.target.value)}
                        required placeholder="Wallet address"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 text-xs font-medium mb-1.5 flex items-center gap-1">
                      Transaction Hash ID <span className="text-red-400 text-xs">*required</span>
                    </label>
                    <input
                      type="text" value={withTxHash} onChange={e => setWithTxHash(e.target.value)}
                      required placeholder="TX hash / TXID from your exchange"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-amber-200 placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                    <p className="text-slate-600 text-xs mt-1">Copy from your exchange or wallet after initiating the withdrawal.</p>
                  </div>

                  <div className="space-y-1.5 px-3 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <p className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      Processed within 24 hours. Minimum $100 per request.
                    </p>
                    <p className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      Double-check address — crypto transfers are irreversible.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setActivePanel(null)}
                      className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submittingWith || available < 100}
                      className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl disabled:opacity-40">
                      {submittingWith ? 'Submitting...' : 'Request Withdrawal'}
                    </Button>
                  </div>
                </form>
              )}

              {s?.canWithdrawNow === false && (
                <Button type="button" variant="ghost" onClick={() => setActivePanel(null)}
                  className="w-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl">
                  Close
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── BALANCE BREAKDOWN ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[
          {
            label: 'Deposited',
            value: s?.totalDeposited ?? 0,
            sub: s?.pendingDeposit ? `+$${s.pendingDeposit.toFixed(2)} pending` : 'Confirmed',
            icon: ArrowDownCircle, dot: 'bg-green-400', color: 'text-green-400',
          },
          {
            label: 'Trade Profits',
            value: s?.tradeProfits ?? 0,
            sub: '8% net monthly',
            icon: TrendingUp, dot: 'bg-amber-400', color: 'text-amber-400',
          },
          {
            label: 'Referral Income',
            value: s?.referralEarnings ?? 0,
            sub: 'L1 $30 · L2 $10 · L3 $5',
            icon: Gift, dot: 'bg-purple-400', color: 'text-purple-400',
          },
          {
            label: 'Auto-Trade Locked',
            value: -(s?.autoTradeShifted ?? 0),
            sub: 'Principal in plan',
            icon: Zap, dot: 'bg-amber-500', color: 'text-amber-500',
          },
          {
            label: 'Withdrawn',
            value: s?.totalWithdrawn ?? 0,
            sub: s?.pendingWithdrawal ? `$${s.pendingWithdrawal.toFixed(2)} pending` : 'All-time payouts',
            icon: ArrowUpCircle, dot: 'bg-red-400', color: 'text-red-400',
          },
        ].map(({ label, value, sub, icon: Icon, dot, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
              <p className="text-slate-500 text-xs leading-none truncate">{label}</p>
            </div>
            <p className={`text-base font-black tabular-nums ${color}`}>
              {value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-slate-600 text-[10px] leading-none">{sub}</p>
          </div>
        ))}
      </div>

      {/* Activation badge */}
      {s?.activationDebit ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
          <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-slate-400 text-sm">
            <span className="text-green-400 font-semibold">Account activated</span>
            {' '}— $100 one-time activation fee deducted.
          </p>
        </div>
      ) : null}

      {/* ── DEPOSIT HISTORY ── */}
      {(s?.recentDeposits?.length ?? 0) > 0 && (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <SectionHeader title="Deposit History" icon={ArrowDownCircle} iconColor="text-green-400" />
          <div className="divide-y divide-slate-800/70">
            {visibleDeposits?.map(dep => (
              <div key={dep.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <NetworkBadge network={dep.network} />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-bold tabular-nums">
                      ${parseFloat(String(dep.amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-slate-600 text-xs">
                      {new Date(dep.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {dep.txHash && (
                    <code className="hidden sm:block text-slate-600 text-xs font-mono">
                      {dep.txHash.slice(0, 8)}…{dep.txHash.slice(-6)}
                    </code>
                  )}
                  <StatusPill status={dep.status} />
                </div>
              </div>
            ))}
          </div>
          {(s?.recentDeposits?.length ?? 0) > 4 && (
            <button
              onClick={() => setShowAllDeposits(v => !v)}
              className="w-full py-3 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 border-t border-slate-800 transition-colors"
            >
              {showAllDeposits
                ? <><ChevronUp className="w-3.5 h-3.5" />Show less</>
                : <><ChevronDown className="w-3.5 h-3.5" />Show all {s?.recentDeposits?.length} deposits</>}
            </button>
          )}
        </Card>
      )}

      {/* ── WITHDRAWAL HISTORY ── */}
      {(s?.recentWithdrawals?.length ?? 0) > 0 && (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <SectionHeader title="Withdrawal History" icon={ArrowUpCircle} iconColor="text-red-400" />
          <div className="divide-y divide-slate-800/70">
            {visibleWith?.map(w => (
              <div key={w.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <NetworkBadge network={w.network} />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-bold tabular-nums">
                      ${parseFloat(String(w.amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-slate-600 text-xs font-mono truncate max-w-[140px]">
                      {w.walletAddress?.slice(0, 8)}…{w.walletAddress?.slice(-6)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill status={w.status} />
                  {w.status === 'pending' && (
                    <button
                      onClick={() => handleCancelWithdrawal(w.id)}
                      title="Cancel withdrawal"
                      className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {(s?.recentWithdrawals?.length ?? 0) > 4 && (
            <button
              onClick={() => setShowAllWith(v => !v)}
              className="w-full py-3 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 border-t border-slate-800 transition-colors"
            >
              {showAllWith
                ? <><ChevronUp className="w-3.5 h-3.5" />Show less</>
                : <><ChevronDown className="w-3.5 h-3.5" />Show all {s?.recentWithdrawals?.length} withdrawals</>}
            </button>
          )}
        </Card>
      )}
    </div>
  )
}
