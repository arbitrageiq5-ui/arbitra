'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw,
  TrendingUp, Gift, ShieldCheck, Clock, CheckCircle2,
  XCircle, Copy, Check, X, AlertCircle, DollarSign, ChevronDown, ChevronUp, Zap,
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

const NETWORKS: Network[] = ['TRC20', 'BEP20', 'ERC20']

const NETWORK_COLORS: Record<string, string> = {
  TRC20: 'text-red-400 bg-red-500/10 border-red-500/20',
  BEP20: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ERC20: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 text-xs">{label}</p>
        <p className="text-white font-bold text-lg leading-tight">{value}</p>
        {sub && <p className="text-slate-600 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export function TraderWallet() {
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [addresses, setAddresses] = useState<DepositAddress[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Panel state
  const [activePanel, setActivePanel] = useState<'deposit' | 'withdraw' | 'shift' | null>(null)

  // Deposit form
  const [depNetwork, setDepNetwork] = useState<Network>('TRC20')
  const [depAmount, setDepAmount] = useState('')
  const [depTxHash, setDepTxHash] = useState('')
  const [submittingDep, setSubmittingDep] = useState(false)
  const [showAllDeposits, setShowAllDeposits] = useState(false)

  // Shift to auto-trade form
  const [shiftAmount, setShiftAmount] = useState('')
  const [submittingShift, setSubmittingShift] = useState(false)

  // Withdraw form
  const [withNetwork, setWithNetwork] = useState<Network>('TRC20')
  const [withAmount, setWithAmount] = useState('')
  const [withAddress, setWithAddress] = useState('')
  const [submittingWith, setSubmittingWith] = useState(false)
  const [showAllWith, setShowAllWith] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
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

  // Load on first render
  useState(() => { load() })

  const copyToClipboard = async (text: string, key: string) => {
    await copyUtil(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmittingDep(true)
      await submitFundRequest(depNetwork, parseFloat(depAmount), depTxHash || undefined)
      await load()
      setDepAmount(''); setDepTxHash('')
      setActivePanel(null)
      showToast('Deposit request submitted. Admin will confirm shortly.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit', 'error')
    } finally { setSubmittingDep(false) }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmittingWith(true)
      await requestWithdrawal(parseFloat(withAmount), withNetwork, withAddress)
      await load()
      setWithAmount(''); setWithAddress('')
      setActivePanel(null)
      showToast('Withdrawal request submitted. Admin will process it shortly.')
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
      setShiftAmount('')
      setActivePanel(null)
      showToast(`$${amt.toFixed(2)} shifted to Auto-Trade successfully! Your plan is now active.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to shift funds', 'error')
    } finally { setSubmittingShift(false) }
  }

  const depositAddr = addresses.find(a => a.network === depNetwork)

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    )
  }

  const s = summary
  const available = s?.available ?? 0
  const visibleDeposits = showAllDeposits ? s?.recentDeposits : s?.recentDeposits?.slice(0, 3)
  const visibleWith = showAllWith ? s?.recentWithdrawals : s?.recentWithdrawals?.slice(0, 3)

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-900 border border-green-700 text-green-200' : 'bg-red-900 border border-red-700 text-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Balance Hero */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">My Wallet</p>
                <p className="text-slate-600 text-xs">USDT balance across all sources</p>
              </div>
            </div>
            <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Big balance */}
          <div className="mb-6 text-center">
            <p className="text-slate-500 text-sm mb-1">Available Balance</p>
            <p className="text-5xl font-black text-white tracking-tight">
              <span className="text-amber-400">$</span>{available.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-slate-600 text-xs mt-1">USDT</p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setActivePanel(activePanel === 'deposit' ? null : 'deposit')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                activePanel === 'deposit'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-900/30 border border-green-700/40 text-green-400 hover:bg-green-900/50'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Deposit</span>
              <span className="sm:hidden text-xs">Deposit</span>
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'shift' ? null : 'shift')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                activePanel === 'shift'
                  ? 'bg-amber-500 text-black'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Auto-Trade</span>
              <span className="sm:hidden text-xs">Auto-Trade</span>
            </button>
            <button
              onClick={() => setActivePanel(activePanel === 'withdraw' ? null : 'withdraw')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                activePanel === 'withdraw'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-900/30 border border-red-700/40 text-red-400 hover:bg-red-900/50'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Withdraw</span>
              <span className="sm:hidden text-xs">Withdraw</span>
            </button>
          </div>
        </div>

        {/* Deposit panel */}
        {activePanel === 'deposit' && (
          <div className="border-t border-slate-800 px-6 py-6 bg-slate-950/40">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-green-400" />
              Deposit USDT
            </h3>

            {/* Network selector */}
            <div className="flex gap-2 mb-4">
              {NETWORKS.map(n => (
                <button
                  key={n}
                  onClick={() => setDepNetwork(n)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                    depNetwork === n ? NETWORK_COLORS[n] : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Deposit address */}
            {depositAddr ? (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4">
                <p className="text-slate-500 text-xs mb-1">Send USDT ({depNetwork}) to this address:</p>
                <div className="flex items-center gap-2">
                  <code className="text-amber-300 text-xs font-mono flex-1 break-all leading-relaxed">
                    {depositAddr.address}
                  </code>
                  <button
                    onClick={() => copyToClipboard(depositAddr.address, 'dep-addr')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white shrink-0 transition-colors"
                  >
                    {copied === 'dep-addr' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {depositAddr.label && <p className="text-slate-600 text-xs mt-1">{depositAddr.label}</p>}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-4 text-center text-slate-500 text-xs">
                No deposit address configured for {depNetwork} yet. Contact admin.
              </div>
            )}

            <form onSubmit={handleDeposit} className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Amount (USDT)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number" min="1" step="0.01"
                    value={depAmount} onChange={e => setDepAmount(e.target.value)}
                    required placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Transaction Hash (optional)</label>
                <input
                  type="text" value={depTxHash} onChange={e => setDepTxHash(e.target.value)}
                  placeholder="Paste your TX hash for faster confirmation"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm font-mono focus:outline-none focus:border-green-500/50 transition-colors"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setActivePanel(null)} className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingDep} className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold">
                  {submittingDep ? 'Submitting...' : 'Submit Deposit'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Shift to Auto-Trade panel */}
        {activePanel === 'shift' && (
          <div className="border-t border-slate-800 px-6 py-6 bg-slate-950/40">
            <h3 className="text-white font-bold mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Shift Balance to Auto-Trade
            </h3>
            <p className="text-slate-500 text-xs mb-4 mt-1">
              Available: <span className="text-white font-bold">${available.toFixed(2)}</span>
              {' '}&mdash; Min: <span className="text-white font-bold">$100</span>
              {' '}&mdash; Max: <span className="text-white font-bold">$5,000</span>
            </p>

            {/* Info strip */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Gross Return', value: '10%/mo', color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/20' },
                { label: 'Platform Fee', value: '2%/mo',  color: 'text-red-400',   bg: 'bg-red-500/5 border-red-500/20' },
                { label: 'Net Profit',   value: '8%/mo',  color: 'text-green-400', bg: 'bg-green-500/5 border-green-500/20' },
              ].map(item => (
                <div key={item.label} className={`rounded-lg border ${item.bg} px-3 py-2 text-center`}>
                  <p className="text-slate-500 text-xs">{item.label}</p>
                  <p className={`font-bold text-sm ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleShift} className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Amount to shift (USDT)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    min="100"
                    max={Math.min(5000, available)}
                    step="0.01"
                    value={shiftAmount}
                    onChange={e => setShiftAmount(e.target.value)}
                    required
                    placeholder="100 – 5,000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-slate-600 text-xs">Min $100 &mdash; Max $5,000</span>
                  <button
                    type="button"
                    onClick={() => setShiftAmount(String(Math.min(5000, available).toFixed(2)))}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Use max (${Math.min(5000, available).toFixed(2)})
                  </button>
                </div>
                {/* Live profit preview */}
                {shiftAmount && !isNaN(parseFloat(shiftAmount)) && parseFloat(shiftAmount) >= 100 && (
                  <div className="mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Est. monthly profit at 8%</span>
                    <span className="text-amber-400 font-bold text-sm">
                      +${((parseFloat(shiftAmount) * 8) / 100).toFixed(2)} / month
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Funds shift instantly to a new auto-trade plan. Profits accumulate daily back into your wallet.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Only one active plan allowed at a time. Shifted amount is locked as principal.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setActivePanel(null); setShiftAmount('') }}
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingShift || available < 100}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingShift ? 'Shifting...' : 'Shift to Auto-Trade'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Withdraw panel */}
        {activePanel === 'withdraw' && (
          <div className="border-t border-slate-800 px-6 py-6 bg-slate-950/40">
            <h3 className="text-white font-bold mb-1 flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-red-400" />
              Withdraw USDT
            </h3>

            {/* Weekly gate notice */}
            {s?.canWithdrawNow === false && s.nextWithdrawalAvailable ? (
              <div className="mt-3 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 text-sm font-semibold">Weekly withdrawal window not yet open</p>
                  <p className="text-amber-300/70 text-xs mt-0.5 leading-relaxed">
                    Withdrawals are allowed once per week. Your next withdrawal opens on{' '}
                    <span className="text-amber-300 font-semibold">
                      {new Date(s.nextWithdrawalAvailable).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-xs mb-4 mt-1">
                Available: <span className="text-white font-bold">${available.toFixed(2)}</span>
                {' '}&mdash; Min: <span className="text-white font-bold">$100</span>
                {' '}&mdash; <span className="text-green-400 font-semibold">Weekly window open</span>
              </p>
            )}

            {/* Only show form when weekly window is open */}
            {(s?.canWithdrawNow !== false) && (
              <form onSubmit={handleWithdraw} className="space-y-3 mt-3">
                {/* Network */}
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 block">Network</label>
                  <div className="flex gap-2">
                    {NETWORKS.map(n => (
                      <button type="button" key={n}
                        onClick={() => setWithNetwork(n)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                          withNetwork === n ? NETWORK_COLORS[n] : 'border-slate-700 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 block">Amount (USDT)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="number" min="100" step="0.01" max={available}
                      value={withAmount} onChange={e => setWithAmount(e.target.value)}
                      required placeholder="Minimum $100"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-600 text-xs">Minimum withdrawal: $100</span>
                    <button type="button" onClick={() => setWithAmount(available.toFixed(2))} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                      Use max (${available.toFixed(2)})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 block">Your {withNetwork} Wallet Address</label>
                  <input
                    type="text"
                    value={withAddress} onChange={e => setWithAddress(e.target.value)}
                    required placeholder="Your USDT wallet address"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm font-mono focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                </div>

                <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 space-y-1">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Withdrawals are processed within 24 hours. Minimum <span className="text-white font-semibold">$100</span> per request.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Double-check your address — crypto transfers are irreversible.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" onClick={() => setActivePanel(null)} className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submittingWith || available < 100} className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                    {submittingWith ? 'Submitting...' : 'Request Withdrawal'}
                  </Button>
                </div>
              </form>
            )}

            {s?.canWithdrawNow === false && (
              <div className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setActivePanel(null)} className="w-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
                  Close
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Income source breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard label="Deposited" value={`$${(s?.totalDeposited ?? 0).toFixed(2)}`}
          sub={s?.pendingDeposit ? `+$${s.pendingDeposit.toFixed(2)} pending` : 'Confirmed deposits'}
          icon={ArrowDownCircle} color="bg-green-500/10 text-green-400" />
        <StatCard label="Auto-Trade Profit" value={`$${(s?.tradeProfits ?? 0).toFixed(2)}`}
          sub="8% net monthly return"
          icon={TrendingUp} color="bg-amber-500/10 text-amber-400" />
        <StatCard label="Referral Income" value={`$${(s?.referralEarnings ?? 0).toFixed(2)}`}
          sub="L1 $30 · L2 $10 · L3 $5"
          icon={Gift} color="bg-purple-500/10 text-purple-400" />
        <StatCard label="Shifted to Auto-Trade" value={`-$${(s?.autoTradeShifted ?? 0).toFixed(2)}`}
          sub="Principal locked in plan"
          icon={Zap} color="bg-amber-500/10 text-amber-400" />
        <StatCard label="Total Withdrawn" value={`$${(s?.totalWithdrawn ?? 0).toFixed(2)}`}
          sub={s?.pendingWithdrawal ? `$${s.pendingWithdrawal.toFixed(2)} pending` : 'All-time payouts'}
          icon={ArrowUpCircle} color="bg-red-500/10 text-red-400" />
      </div>

      {/* Weekly withdrawal window status */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
        s?.canWithdrawNow !== false
          ? 'bg-green-500/5 border-green-500/20'
          : 'bg-slate-900 border-slate-800'
      }`}>
        <Clock className={`w-4 h-4 shrink-0 ${s?.canWithdrawNow !== false ? 'text-green-400' : 'text-slate-500'}`} />
        <div className="flex-1 min-w-0">
          {s?.canWithdrawNow !== false ? (
            <p className="text-sm text-slate-300">
              <span className="text-green-400 font-semibold">Weekly withdrawal window is open.</span>
              {' '}Minimum withdrawal: <span className="text-white font-bold">$100 USDT</span>.
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Next withdrawal available on{' '}
              <span className="text-white font-semibold">
                {s?.nextWithdrawalAvailable
                  ? new Date(s.nextWithdrawalAvailable).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : '—'}
              </span>
              . Withdrawals are once per week, minimum $100.
            </p>
          )}
        </div>
      </div>

      {/* Activation fee notice */}
      {s?.activationDebit ? (
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-slate-400 text-sm">
            <span className="text-green-400 font-semibold">Account activated</span> — $100 activation fee deducted from balance.
          </p>
        </div>
      ) : null}

      {/* Recent Deposits */}
      {(s?.recentDeposits?.length ?? 0) > 0 && (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-green-400" />
              Deposit History
            </h3>
          </div>
          <div className="divide-y divide-slate-800">
            {visibleDeposits?.map(dep => (
              <div key={dep.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${NETWORK_COLORS[dep.network] ?? 'text-slate-400 border-slate-700'}`}>
                    {dep.network}
                  </span>
                  <div>
                    <p className="text-white text-sm font-semibold">${parseFloat(String(dep.amount)).toFixed(2)}</p>
                    <p className="text-slate-600 text-xs">{new Date(dep.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dep.txHash && (
                    <code className="text-slate-600 text-xs font-mono hidden sm:block">
                      {dep.txHash.slice(0, 12)}...
                    </code>
                  )}
                  {dep.status === 'pending' && <span className="flex items-center gap-1 text-xs text-amber-400"><Clock className="w-3 h-3" />Pending</span>}
                  {dep.status === 'confirmed' && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3 h-3" />Confirmed</span>}
                  {dep.status === 'rejected' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" />Rejected</span>}
                </div>
              </div>
            ))}
          </div>
          {(s?.recentDeposits?.length ?? 0) > 3 && (
            <button
              onClick={() => setShowAllDeposits(v => !v)}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1 border-t border-slate-800 transition-colors"
            >
              {showAllDeposits ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show all {s?.recentDeposits?.length}</>}
            </button>
          )}
        </Card>
      )}

      {/* Recent Withdrawals */}
      {(s?.recentWithdrawals?.length ?? 0) > 0 && (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-red-400" />
              Withdrawal History
            </h3>
          </div>
          <div className="divide-y divide-slate-800">
            {visibleWith?.map(w => (
              <div key={w.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${NETWORK_COLORS[w.network] ?? 'text-slate-400 border-slate-700'}`}>
                    {w.network}
                  </span>
                  <div>
                    <p className="text-white text-sm font-semibold">${parseFloat(String(w.amount)).toFixed(2)}</p>
                    <p className="text-slate-600 text-xs truncate max-w-[120px] font-mono">{w.walletAddress?.slice(0, 16)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {w.status === 'pending' && (
                    <>
                      <span className="flex items-center gap-1 text-xs text-amber-400"><Clock className="w-3 h-3" />Pending</span>
                      <button
                        onClick={() => handleCancelWithdrawal(w.id)}
                        className="p-1 rounded-lg hover:bg-red-900/20 text-red-500 hover:text-red-400 transition-colors"
                        title="Cancel withdrawal"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {w.status === 'approved' && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3 h-3" />Approved</span>}
                  {w.status === 'rejected' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" />Rejected</span>}
                </div>
              </div>
            ))}
          </div>
          {(s?.recentWithdrawals?.length ?? 0) > 3 && (
            <button
              onClick={() => setShowAllWith(v => !v)}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1 border-t border-slate-800 transition-colors"
            >
              {showAllWith ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show all {s?.recentWithdrawals?.length}</>}
            </button>
          )}
        </Card>
      )}
    </div>
  )
}
