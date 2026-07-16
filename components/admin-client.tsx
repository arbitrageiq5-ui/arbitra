'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAllUsers, changeUserRole, deleteUser, createAdminUser, resetUserPassword } from '@/app/actions/users'
import {
  getAllDepositAddresses, upsertDepositAddress,
  getAllFundRequests, reviewFundRequest,
} from '@/app/actions/deposits'
import { getRoleLabel, UserRole } from '@/lib/roles'
import { getAllAutoTradePlans, createAutoTradePlan, updateAutoTradePlanStatus } from '@/app/actions/auto-trade'
import { getActivationFeeRequests, approveActivationFee, rejectActivationFee } from '@/app/actions/referral'
import { getAllWithdrawals, reviewWithdrawal, getAllTraderBalances } from '@/app/actions/wallet'
import {
  LogOut, Users, Trash2, ChevronDown, Wallet, Plus,
  CheckCircle2, XCircle, Clock, AlertCircle, Pencil,
  Zap, Shield, BarChart3, RefreshCw, UserPlus, X, Eye, EyeOff, KeyRound,
  TrendingUp, Activity, PauseCircle, StopCircle, DollarSign, Gift, ArrowUpCircle,
} from 'lucide-react'

type Tab = 'users' | 'deposit-addresses' | 'fund-requests' | 'auto-trade' | 'activation-fees' | 'withdrawals' | 'wallets'
type Network = 'TRC20' | 'BEP20' | 'ERC20'

interface User { id: string; name: string | null; email: string; role: string; createdAt: Date }
interface DepositAddress { id: number; network: string; address: string; label: string | null; isActive: boolean; createdAt: Date }
interface FundRequest {
  id: number; userId: string; network: string; amount: string; txHash: string | null
  status: string; note: string | null; reviewedAt: Date | null; createdAt: Date
  userName: string | null; userEmail: string | null
}
interface AutoTradePlan {
  id: number; userId: string; principal: string; grossReturnPct: string; feePct: string
  netReturnPct: string; status: string; startDate: string; endDate: string | null
  note: string | null; createdAt: Date
  user: { id: string; name: string | null; email: string }
}
interface ActivationFeeReq {
  id: number; userId: string; amount: string; txHash: string | null
  status: string; note: string | null; createdAt: Date; reviewedAt: Date | null
  trader: { name: string | null; email: string; referredBy: string | null } | null
}
interface WithdrawalReq {
  id: number; userId: string; amount: string; network: string; walletAddress: string
  status: string; txHash: string | null; note: string | null; createdAt: Date; reviewedAt: Date | null
  trader: { name: string | null; email: string } | null
}
interface TraderBalance {
  id: string; name: string | null; email: string; isActivated: boolean; createdAt: Date
  totalDeposited: number; tradeProfits: number; referralEarnings: number
  totalWithdrawn: number; pendingWithdrawal: number; activationDebit: number; available: number
}

const NETWORK_META: Record<Network, { color: string; bg: string; border: string; chain: string }> = {
  TRC20: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    chain: 'TRON Network' },
  BEP20: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', chain: 'BNB Smart Chain' },
  ERC20: { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   chain: 'Ethereum Network' },
}

const ROLE_BADGE: Record<string, string> = {
  admin:  'bg-red-500/10 text-red-400 border border-red-500/20',
  trader: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  viewer: 'bg-slate-700 text-slate-400 border border-slate-600',
}

const STATUS_META = {
  pending:   { icon: Clock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Pending' },
  confirmed: { icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',  label: 'Confirmed' },
  rejected:  { icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',      label: 'Rejected' },
}

export default function AdminClient() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('users')

  // Users
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  // Deposit Addresses
  const [addresses, setAddresses] = useState<DepositAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [editNetwork, setEditNetwork] = useState<Network | null>(null)
  const [editAddress, setEditAddress] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)

  // Fund Requests
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [reviewModalId, setReviewModalId] = useState<number | null>(null)
  const [reviewAction, setReviewAction] = useState<'confirmed' | 'rejected' | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewingId, setReviewingId] = useState<number | null>(null)

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Create Admin modal
  const [showCreateAdmin, setShowCreateAdmin] = useState(false)
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false)
  const [creatingAdmin, setCreatingAdmin] = useState(false)

  // Reset Password modal
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetting, setResetting] = useState(false)
  // After a successful reset we store {userId -> plaintext} so admin can see/copy it with show/hide
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, { plain: string; visible: boolean }>>({})

  // Auto Trade Plans
  const [autoTradePlans, setAutoTradePlans] = useState<AutoTradePlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [planTargetUserId, setPlanTargetUserId] = useState('')
  const [planPrincipal, setPlanPrincipal] = useState('')
  const [planStartDate, setPlanStartDate] = useState('')

  // Set date client-side only to avoid SSR hydration mismatch
  useEffect(() => {
    setPlanStartDate(new Date().toISOString().split('T')[0])
  }, [])
  const [planNote, setPlanNote] = useState('')
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [togglingPlanId, setTogglingPlanId] = useState<number | null>(null)

  // Activation Fees
  const [activationFeeReqs, setActivationFeeReqs] = useState<ActivationFeeReq[]>([])
  const [loadingFeeReqs, setLoadingFeeReqs] = useState(false)
  const [reviewingFeeId, setReviewingFeeId] = useState<number | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<number | null>(null)

  // Trader Balances
  const [traderBalances, setTraderBalances] = useState<TraderBalance[]>([])
  const [loadingBalances, setLoadingBalances] = useState(false)

  // Withdrawals
  const [withdrawalReqs, setWithdrawalReqs] = useState<WithdrawalReq[]>([])
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false)
  const [reviewingWithdrawId, setReviewingWithdrawId] = useState<number | null>(null)
  const [withdrawTxHash, setWithdrawTxHash] = useState('')
  const [withdrawNote, setWithdrawNote] = useState('')
  const [showWithdrawRejectModal, setShowWithdrawRejectModal] = useState<number | null>(null)

  useEffect(() => { loadUsers() }, [])
  useEffect(() => {
    if (activeTab === 'deposit-addresses') loadAddresses()
    if (activeTab === 'fund-requests') loadFundRequests()
    if (activeTab === 'auto-trade') loadAutoTradePlans()
    if (activeTab === 'activation-fees') loadActivationFeeReqs()
    if (activeTab === 'withdrawals') loadWithdrawalReqs()
    if (activeTab === 'wallets') loadTraderBalances()
  }, [activeTab])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadUsers = async () => {
    try { setLoadingUsers(true); setUsers((await getAllUsers()) as User[]) }
    catch (e) { showToast(e instanceof Error ? e.message : 'Failed to load users', 'error') }
    finally { setLoadingUsers(false) }
  }

  const loadAddresses = async () => {
    try { setLoadingAddresses(true); setAddresses((await getAllDepositAddresses()) as DepositAddress[]) }
    catch (e) { showToast(e instanceof Error ? e.message : 'Failed to load addresses', 'error') }
    finally { setLoadingAddresses(false) }
  }

  const loadFundRequests = async () => {
    try { setLoadingRequests(true); setFundRequests((await getAllFundRequests()) as FundRequest[]) }
    catch (e) { showToast(e instanceof Error ? e.message : 'Failed to load requests', 'error') }
    finally { setLoadingRequests(false) }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setUpdatingUserId(userId)
      await changeUserRole(userId, newRole)
      await loadUsers()
      showToast('Role updated successfully')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update role', 'error')
    } finally { setUpdatingUserId(null) }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    try {
      setDeletingUserId(userId)
      await deleteUser(userId)
      await loadUsers()
      showToast('User deleted')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to delete user', 'error')
    } finally { setDeletingUserId(null) }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCreatingAdmin(true)
      await createAdminUser(newAdminName, newAdminEmail, newAdminPassword)
      await loadUsers()
      setShowCreateAdmin(false)
      setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword('')
      showToast('Admin account created successfully')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create admin', 'error')
    } finally { setCreatingAdmin(false) }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    try {
      setResetting(true)
      await resetUserPassword(resetTarget.id, resetPassword)
      // Store plaintext so admin can see/copy it with toggle
      setRevealedPasswords(prev => ({
        ...prev,
        [resetTarget.id]: { plain: resetPassword, visible: false },
      }))
      setResetTarget(null)
      setResetPassword('')
      showToast(`Password reset for ${resetTarget.name || resetTarget.email}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset password', 'error')
    } finally { setResetting(false) }
  }

  const toggleReveal = (userId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: { ...prev[userId], visible: !prev[userId].visible },
    }))
  }

  const loadAutoTradePlans = async () => {
    setLoadingPlans(true)
    try {
      const data = await getAllAutoTradePlans()
      setAutoTradePlans(data as AutoTradePlan[])
    } catch { /* ignore */ }
    finally { setLoadingPlans(false) }
  }

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setCreatingPlan(true)
      await createAutoTradePlan(planTargetUserId, parseFloat(planPrincipal), planStartDate, planNote || undefined)
      await loadAutoTradePlans()
      setShowCreatePlan(false)
      setPlanTargetUserId(''); setPlanPrincipal(''); setPlanNote('')
      setPlanStartDate(new Date().toISOString().split('T')[0]) // safe: called in event handler, not render
      showToast('Auto-trade plan created and daily logs generated')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create plan', 'error')
    } finally { setCreatingPlan(false) }
  }

  const handleTogglePlan = async (planId: number, currentStatus: string) => {
    try {
      setTogglingPlanId(planId)
      const next = currentStatus === 'active' ? 'paused' : 'active'
      await updateAutoTradePlanStatus(planId, next as 'active' | 'paused')
      await loadAutoTradePlans()
      showToast(`Plan ${next === 'active' ? 'resumed' : 'paused'}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update plan', 'error')
    } finally { setTogglingPlanId(null) }
  }

  const loadActivationFeeReqs = async () => {
    setLoadingFeeReqs(true)
    try {
      const data = await getActivationFeeRequests()
      setActivationFeeReqs(data as ActivationFeeReq[])
    } catch { /* ignore */ }
    finally { setLoadingFeeReqs(false) }
  }

  const handleApproveFee = async (feeId: number) => {
    try {
      setReviewingFeeId(feeId)
      await approveActivationFee(feeId)
      await loadActivationFeeReqs()
      showToast('Activation fee approved. Account activated and commissions distributed.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    } finally { setReviewingFeeId(null) }
  }

  const handleRejectFee = async (feeId: number) => {
    try {
      setReviewingFeeId(feeId)
      await rejectActivationFee(feeId, rejectNote || undefined)
      await loadActivationFeeReqs()
      setShowRejectModal(null)
      setRejectNote('')
      showToast('Activation fee rejected.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reject', 'error')
    } finally { setReviewingFeeId(null) }
  }

  const loadTraderBalances = async () => {
    setLoadingBalances(true)
    try {
      const data = await getAllTraderBalances()
      setTraderBalances(data as TraderBalance[])
    } catch { /* ignore */ }
    finally { setLoadingBalances(false) }
  }

  const loadWithdrawalReqs = async () => {
    setLoadingWithdrawals(true)
    try {
      const data = await getAllWithdrawals()
      setWithdrawalReqs(data as WithdrawalReq[])
    } catch { /* ignore */ }
    finally { setLoadingWithdrawals(false) }
  }

  const handleApproveWithdrawal = async (id: number) => {
    try {
      setReviewingWithdrawId(id)
      await reviewWithdrawal(id, 'approved', withdrawTxHash || undefined)
      await loadWithdrawalReqs()
      setWithdrawTxHash('')
      showToast('Withdrawal approved and sent.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    } finally { setReviewingWithdrawId(null) }
  }

  const handleRejectWithdrawal = async (id: number) => {
    try {
      setReviewingWithdrawId(id)
      await reviewWithdrawal(id, 'rejected', undefined, withdrawNote || undefined)
      await loadWithdrawalReqs()
      setShowWithdrawRejectModal(null)
      setWithdrawNote('')
      showToast('Withdrawal rejected.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reject', 'error')
    } finally { setReviewingWithdrawId(null) }
  }

  const handleStartEdit = (network: Network) => {
    const existing = addresses.find(a => a.network === network && a.isActive)
    setEditNetwork(network)
    setEditAddress(existing?.address ?? '')
    setEditLabel(existing?.label ?? '')
  }

  const handleSaveAddress = async () => {
    if (!editNetwork || !editAddress.trim()) return
    try {
      setSavingAddress(true)
      await upsertDepositAddress(editNetwork, editAddress, editLabel)
      await loadAddresses()
      setEditNetwork(null); setEditAddress(''); setEditLabel('')
      showToast(`${editNetwork} deposit address saved`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save address', 'error')
    } finally { setSavingAddress(false) }
  }

  const openReview = (id: number, action: 'confirmed' | 'rejected') => {
    setReviewModalId(id); setReviewAction(action); setReviewNote('')
  }

  const handleReview = async () => {
    if (!reviewModalId || !reviewAction) return
    try {
      setReviewingId(reviewModalId)
      await reviewFundRequest(reviewModalId, reviewAction, reviewNote)
      await loadFundRequests()
      setReviewModalId(null); setReviewAction(null); setReviewNote('')
      showToast(`Request ${reviewAction}`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to review request', 'error')
    } finally { setReviewingId(null) }
  }

  const pendingCount = fundRequests.filter(r => r.status === 'pending').length
  const activeAddressNetworks = addresses.filter(a => a.isActive).map(a => a.network)

  // Summary stats
  const traderCount = users.filter(u => u.role === 'trader').length
  const confirmedFunds = fundRequests.filter(r => r.status === 'confirmed').reduce((s, r) => s + parseFloat(r.amount), 0)

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">Arbitrage IQ</span>
              <span className="text-slate-500 text-sm ml-2">Admin Panel</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => { await authClient.signOut(); router.push('/sign-in') }}
            className="text-slate-400 hover:text-white hover:bg-slate-800 gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-green-900/80 border-green-500/30 text-green-300'
            : 'bg-red-900/80 border-red-500/30 text-red-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Summary stats bar */}
      <div className="border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-400' },
            { label: 'Traders', value: traderCount, icon: BarChart3, color: 'text-amber-400' },
            { label: 'Pending Deposits', value: pendingCount, icon: Clock, color: 'text-yellow-400' },
            { label: 'Confirmed Funds', value: `$${confirmedFunds.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: Zap, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800">
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-slate-500 text-xs">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-800 bg-slate-900/60">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 flex gap-1">
          {([
            { key: 'users' as Tab,               label: 'Users',             icon: Users,      badge: users.length },
            { key: 'deposit-addresses' as Tab,    label: 'Deposit Addresses', icon: Wallet,     badge: activeAddressNetworks.length },
            { key: 'fund-requests' as Tab,        label: 'Fund Requests',     icon: Clock,      badge: pendingCount },
            { key: 'auto-trade' as Tab,           label: 'Auto Trade',        icon: TrendingUp, badge: autoTradePlans.filter(p => p.status === 'active').length },
            { key: 'activation-fees' as Tab,      label: 'Activations',       icon: Gift,        badge: activationFeeReqs.filter(f => f.status === 'pending').length },
            { key: 'withdrawals' as Tab,          label: 'Withdrawals',        icon: ArrowUpCircle, badge: withdrawalReqs.filter(w => w.status === 'pending').length },
            { key: 'wallets' as Tab,              label: 'Wallets',             icon: Wallet,        badge: traderBalances.length },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-red-400 text-red-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  tab.key === 'fund-requests' && pendingCount > 0
                    ? 'bg-yellow-500 text-black'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-screen-xl mx-auto px-4 md:px-6 py-6 w-full">

        {/* ── USERS TAB ── */}
        {activeTab === 'users' && (
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                All Users
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowCreateAdmin(true)}
                  className="bg-red-600 hover:bg-red-700 text-white gap-2 h-8 text-xs font-semibold"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create Admin
                </Button>
                <button onClick={loadUsers} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            {loadingUsers ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-400" />
                Loading users...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40">
                      {['Name', 'Email', 'Role', 'Password', 'Joined', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}>
                        <td className="px-5 py-3.5 text-white font-medium">{u.name || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-400">{u.email}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[u.role] ?? ROLE_BADGE.viewer}`}>
                              {getRoleLabel(u.role as UserRole)}
                            </span>
                            <div className="relative">
                              <select
                                value={u.role}
                                onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                                disabled={updatingUserId === u.id}
                                className="appearance-none bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 pr-6 hover:border-slate-500 disabled:opacity-50 cursor-pointer focus:outline-none focus:border-red-500/50"
                              >
                                <option value="viewer">Viewer</option>
                                <option value="trader">Trader</option>
                                <option value="admin">Admin</option>
                              </select>
                              <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                            </div>
                          </div>
                        </td>
                        {/* Password cell */}
                        <td className="px-5 py-3.5">
                          {revealedPasswords[u.id] ? (
                            <div className="flex items-center gap-1.5">
                              <code className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono tracking-wide min-w-[80px]">
                                {revealedPasswords[u.id].visible ? revealedPasswords[u.id].plain : '••••••••'}
                              </code>
                              <button
                                onClick={() => toggleReveal(u.id)}
                                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-colors"
                                title={revealedPasswords[u.id].visible ? 'Hide password' : 'Show password'}
                              >
                                {revealedPasswords[u.id].visible
                                  ? <EyeOff className="w-3.5 h-3.5" />
                                  : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs italic">Not set by admin</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => { setResetTarget(u); setResetPassword(''); setShowResetPassword(false) }}
                              variant="ghost"
                              size="sm"
                              className="text-amber-500 hover:text-amber-400 hover:bg-amber-900/20 h-8 w-8 p-0"
                              title="Reset password"
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeleteUser(u.id)}
                              disabled={deletingUserId === u.id}
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-400 hover:bg-red-900/20 h-8 w-8 p-0"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── DEPOSIT ADDRESSES TAB ── */}
        {activeTab === 'deposit-addresses' && (
          <div className="space-y-6">
            <p className="text-slate-400 text-sm">
              Set the USDT wallet addresses for each network. Traders will see these addresses when they request to add funds.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['TRC20', 'BEP20', 'ERC20'] as Network[]).map(network => {
                const meta = NETWORK_META[network]
                const existing = addresses.find(a => a.network === network && a.isActive)
                const isEditing = editNetwork === network
                return (
                  <Card key={network} className="bg-slate-900 border-slate-800 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs border ${meta.bg} ${meta.border} ${meta.color}`}>
                          {network}
                        </div>
                        <div>
                          <div className="text-white font-semibold text-sm">USDT {network}</div>
                          <div className="text-slate-500 text-xs">{meta.chain}</div>
                        </div>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full ${existing ? 'bg-green-400' : 'bg-slate-700'}`} title={existing ? 'Active' : 'Not configured'} />
                    </div>

                    {existing && !isEditing && (
                      <div className={`p-3 rounded-lg border ${meta.border} ${meta.bg} space-y-1`}>
                        <p className={`font-mono text-xs break-all ${meta.color}`}>{existing.address}</p>
                        {existing.label && <p className="text-slate-500 text-xs">{existing.label}</p>}
                        <p className="text-slate-600 text-xs">Updated {new Date(existing.createdAt).toLocaleDateString()}</p>
                      </div>
                    )}

                    {!existing && !isEditing && (
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 text-slate-600 text-xs text-center">
                        No address configured
                      </div>
                    )}

                    {isEditing && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Wallet Address *</label>
                          <input
                            type="text"
                            value={editAddress}
                            onChange={e => setEditAddress(e.target.value)}
                            placeholder={network === 'TRC20' ? 'T... (TRON)' : '0x... (EVM)'}
                            className={`w-full bg-slate-950 border ${meta.border} rounded-lg px-3 py-2.5 text-white placeholder-slate-600 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors`}
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Label (optional)</label>
                          <input
                            type="text"
                            value={editLabel}
                            onChange={e => setEditLabel(e.target.value)}
                            placeholder="e.g. Main wallet"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => { setEditNetwork(null); setEditAddress(''); setEditLabel('') }}
                            variant="ghost"
                            size="sm"
                            className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveAddress}
                            disabled={savingAddress || !editAddress.trim()}
                            size="sm"
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold"
                          >
                            {savingAddress ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                      <Button
                        onClick={() => handleStartEdit(network)}
                        variant="ghost"
                        size="sm"
                        className={`w-full border text-xs gap-1.5 ${existing ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white' : `${meta.border} ${meta.color}`}`}
                      >
                        {existing ? <><Pencil className="w-3.5 h-3.5" />Update</> : <><Plus className="w-3.5 h-3.5" />Set Address</>}
                      </Button>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* ── FUND REQUESTS TAB ── */}
        {activeTab === 'fund-requests' && (
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                Fund Requests
              </h2>
              <div className="flex gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">{pendingCount} Pending</span>
                <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">{fundRequests.filter(r => r.status === 'confirmed').length} Confirmed</span>
                <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">{fundRequests.filter(r => r.status === 'rejected').length} Rejected</span>
              </div>
            </div>

            {loadingRequests ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-400" />
                Loading requests...
              </div>
            ) : fundRequests.length === 0 ? (
              <div className="p-16 text-center">
                <Clock className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No fund requests yet</p>
                <p className="text-slate-600 text-sm mt-1">Requests will appear here when traders submit deposits.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40">
                      {['Trader', 'Network', 'Amount (USDT)', 'TX Hash', 'Submitted', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fundRequests.map((req, i) => {
                      const status = req.status as keyof typeof STATUS_META
                      const meta = STATUS_META[status] ?? STATUS_META.pending
                      const StatusIcon = meta.icon
                      const networkMeta = NETWORK_META[req.network as Network]
                      return (
                        <tr key={req.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}>
                          <td className="px-5 py-3.5">
                            <div className="text-white font-medium text-sm">{req.userName || 'Unknown'}</div>
                            <div className="text-slate-500 text-xs">{req.userEmail}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${networkMeta?.border ?? ''} ${networkMeta?.color ?? 'text-slate-400'} ${networkMeta?.bg ?? ''}`}>
                              {req.network}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-white font-bold">
                            ${parseFloat(req.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-mono text-xs max-w-32 truncate" title={req.txHash ?? ''}>
                            {req.txHash ? req.txHash.slice(0, 14) + '...' : <span className="text-slate-700">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                                  {new Date(req.createdAt as string | Date).toLocaleString('en-US')}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bg} ${meta.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {req.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => openReview(req.id, 'confirmed')}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white h-7 px-2.5 text-xs gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Confirm
                                </Button>
                                <Button
                                  onClick={() => openReview(req.id, 'rejected')}
                                  size="sm"
                                  variant="ghost"
                                  className="border border-red-500/30 text-red-400 hover:bg-red-900/20 h-7 px-2.5 text-xs gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            {req.status !== 'pending' && req.note && (
                              <p className="text-slate-500 text-xs italic max-w-36 truncate" title={req.note}>{req.note}</p>
                            )}
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

        {/* ── AUTO TRADE TAB ── */}
        {activeTab === 'auto-trade' && (
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  Auto-Trade Plans
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => { setShowCreatePlan(true); setPlanTargetUserId(users.find(u => u.role === 'trader')?.id ?? '') }}
                    className="bg-amber-600 hover:bg-amber-700 text-black font-semibold gap-2 h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Assign Plan
                  </Button>
                  <button onClick={loadAutoTradePlans} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 border-b border-slate-800">
                {[
                  { label: 'Total Plans', value: autoTradePlans.length, color: 'text-white' },
                  { label: 'Active', value: autoTradePlans.filter(p => p.status === 'active').length, color: 'text-green-400' },
                  { label: 'Paused', value: autoTradePlans.filter(p => p.status === 'paused').length, color: 'text-yellow-400' },
                  { label: 'Total Principal', value: '$' + autoTradePlans.reduce((s, p) => s + parseFloat(p.principal), 0).toLocaleString('en-US', { maximumFractionDigits: 0 }), color: 'text-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {loadingPlans ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                  Loading plans...
                </div>
              ) : autoTradePlans.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No auto-trade plans yet. Click <span className="text-amber-400">Assign Plan</span> to create one for a trader.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40">
                        {['Trader', 'Principal', 'Monthly Return', 'Fee', 'Net Profit', 'Started', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {autoTradePlans.map((plan, i) => {
                        const principal = parseFloat(plan.principal)
                        const grossPct = parseFloat(plan.grossReturnPct)
                        const feePct = parseFloat(plan.feePct)
                        const netPct = parseFloat(plan.netReturnPct)
                        const monthlyNet = (principal * netPct) / 100
                        const dailyNet = (principal * netPct / 100) / 30
                        return (
                          <tr key={plan.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}>
                            <td className="px-5 py-3.5">
                              <div>
                                <p className="text-white font-medium">{plan.user.name || '—'}</p>
                                <p className="text-slate-500 text-xs">{plan.user.email}</p>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-white font-semibold">
                              ${principal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-amber-400 font-bold">{grossPct}%</span>
                              <span className="text-slate-500 text-xs ml-1">/mo</span>
                            </td>
                            <td className="px-5 py-3.5 text-red-400">{feePct}%</td>
                            <td className="px-5 py-3.5">
                              <div>
                                <p className="text-green-400 font-bold">{netPct}%/mo</p>
                                <p className="text-slate-500 text-xs">${monthlyNet.toFixed(2)}/mo &middot; ${dailyNet.toFixed(4)}/day</p>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-400 text-xs">
                              {new Date(plan.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </td>
                            <td className="px-5 py-3.5">
                              {plan.status === 'active' && (
                                <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1 w-fit">
                                  <Activity className="w-3 h-3" />Active
                                </span>
                              )}
                              {plan.status === 'paused' && (
                                <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2.5 py-1 w-fit">
                                  <PauseCircle className="w-3 h-3" />Paused
                                </span>
                              )}
                              {plan.status === 'completed' && (
                                <span className="flex items-center gap-1 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" />Completed
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              {plan.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={togglingPlanId === plan.id}
                                  onClick={() => handleTogglePlan(plan.id, plan.status)}
                                  className={`h-7 px-3 text-xs gap-1 border ${
                                    plan.status === 'active'
                                      ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-900/20'
                                      : 'border-green-500/30 text-green-400 hover:bg-green-900/20'
                                  }`}
                                >
                                  {plan.status === 'active'
                                    ? <><PauseCircle className="w-3.5 h-3.5" />Pause</>
                                    : <><Activity className="w-3.5 h-3.5" />Resume</>
                                  }
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── ACTIVATION FEES TAB ── */}
        {activeTab === 'activation-fees' && (
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-400" />
                  Activation Fee Requests
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full">
                    {activationFeeReqs.filter(f => f.status === 'pending').length} pending
                  </span>
                  <button onClick={loadActivationFeeReqs} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-slate-800">
                {[
                  { label: 'Total Requests', value: activationFeeReqs.length, color: 'text-white' },
                  { label: 'Confirmed', value: activationFeeReqs.filter(f => f.status === 'confirmed').length, color: 'text-green-400' },
                  { label: 'Total Collected', value: '$' + (activationFeeReqs.filter(f => f.status === 'confirmed').length * 100).toLocaleString(), color: 'text-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {loadingFeeReqs ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                  Loading...
                </div>
              ) : activationFeeReqs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">No activation fee requests yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40">
                        {['Trader', 'Amount', 'TX Hash', 'Referred By', 'Status', 'Submitted', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activationFeeReqs.map((fee, i) => (
                        <tr key={fee.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}>
                          <td className="px-4 py-3.5">
                            <p className="text-white font-medium text-xs">{fee.trader?.name || '—'}</p>
                            <p className="text-slate-500 text-xs">{fee.trader?.email}</p>
                          </td>
                          <td className="px-4 py-3.5 text-amber-400 font-bold">${parseFloat(fee.amount).toFixed(2)}</td>
                          <td className="px-4 py-3.5">
                            <code className="text-slate-400 text-xs font-mono">
                              {fee.txHash ? `${fee.txHash.slice(0, 16)}...` : '—'}
                            </code>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs">
                            {fee.trader?.referredBy ? (
                              <span className="text-blue-400">Yes</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            {fee.status === 'pending' && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 w-fit">
                                <Clock className="w-3 h-3" />Pending
                              </span>
                            )}
                            {fee.status === 'confirmed' && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" />Confirmed
                              </span>
                            )}
                            {fee.status === 'rejected' && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1 w-fit">
                                <XCircle className="w-3 h-3" />Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs">
                            {new Date(fee.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-3.5">
                            {fee.status === 'pending' && (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  disabled={reviewingFeeId === fee.id}
                                  onClick={() => handleApproveFee(fee.id)}
                                  className="h-7 px-3 text-xs bg-green-700 hover:bg-green-600 text-white gap-1 font-semibold"
                                >
                                  <CheckCircle2 className="w-3 h-3" />Approve
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={reviewingFeeId === fee.id}
                                  onClick={() => setShowRejectModal(fee.id)}
                                  variant="ghost"
                                  className="h-7 px-3 text-xs border border-red-500/30 text-red-400 hover:bg-red-900/20 gap-1"
                                >
                                  <XCircle className="w-3 h-3" />Reject
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── WITHDRAWALS TAB ── */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <ArrowUpCircle className="w-5 h-5 text-red-400" />
                  Withdrawal Requests
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full">
                    {withdrawalReqs.filter(w => w.status === 'pending').length} pending
                  </span>
                  <button onClick={loadWithdrawalReqs} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-slate-800">
                {[
                  { label: 'Total Requests', value: withdrawalReqs.length, color: 'text-white' },
                  { label: 'Approved', value: withdrawalReqs.filter(w => w.status === 'approved').length, color: 'text-green-400' },
                  { label: 'Total Paid Out', value: '$' + withdrawalReqs.filter(w => w.status === 'approved').reduce((s, w) => s + parseFloat(String(w.amount)), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: 'text-red-400' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-slate-500 text-xs">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {loadingWithdrawals ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-400" />
                  Loading...
                </div>
              ) : withdrawalReqs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">No withdrawal requests yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40">
                        {['Trader', 'Amount', 'Network', 'Wallet Address', 'Status', 'Submitted', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawalReqs.map((w, i) => (
                        <tr key={w.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}>
                          <td className="px-4 py-3.5">
                            <p className="text-white font-medium text-xs">{w.trader?.name || '—'}</p>
                            <p className="text-slate-500 text-xs">{w.trader?.email}</p>
                          </td>
                          <td className="px-4 py-3.5 text-red-400 font-bold">${parseFloat(String(w.amount)).toFixed(2)}</td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${
                              w.network === 'TRC20' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                              w.network === 'BEP20' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                              'text-blue-400 bg-blue-500/10 border-blue-500/20'
                            }`}>{w.network}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <code className="text-slate-400 text-xs font-mono">{w.walletAddress.slice(0, 18)}...</code>
                          </td>
                          <td className="px-4 py-3.5">
                            {w.status === 'pending' && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 w-fit">
                                <Clock className="w-3 h-3" />Pending
                              </span>
                            )}
                            {w.status === 'approved' && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" />Approved
                              </span>
                            )}
                            {w.status === 'rejected' && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1 w-fit">
                                <XCircle className="w-3 h-3" />Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs">
                            {new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                          </td>
                          <td className="px-4 py-3.5">
                            {w.status === 'pending' && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="TX hash (optional)"
                                    value={reviewingWithdrawId === w.id ? withdrawTxHash : ''}
                                    onChange={e => setWithdrawTxHash(e.target.value)}
                                    onFocus={() => setReviewingWithdrawId(w.id)}
                                    className="flex-1 min-w-[100px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono focus:outline-none focus:border-green-500/40"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    disabled={reviewingWithdrawId === w.id && !withdrawTxHash && false}
                                    onClick={() => handleApproveWithdrawal(w.id)}
                                    className="h-7 px-3 text-xs bg-green-700 hover:bg-green-600 text-white gap-1 font-semibold"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => setShowWithdrawRejectModal(w.id)}
                                    variant="ghost"
                                    className="h-7 px-3 text-xs border border-red-500/30 text-red-400 hover:bg-red-900/20 gap-1"
                                  >
                                    <XCircle className="w-3 h-3" />Reject
                                  </Button>
                                </div>
                              </div>
                            )}
                            {w.status === 'approved' && w.txHash && (
                              <code className="text-green-400/70 text-xs font-mono">{w.txHash.slice(0, 14)}...</code>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── WALLETS TAB ── */}
        {activeTab === 'wallets' && (
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-400" />
                  Trader Wallet Balances
                </h2>
                <button
                  onClick={loadTraderBalances}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingBalances ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Summary strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 border-b border-slate-800">
                {[
                  {
                    label: 'Total Traders',
                    value: traderBalances.length,
                    color: 'text-white',
                    icon: Users,
                  },
                  {
                    label: 'Total Deposited',
                    value: '$' + traderBalances.reduce((s, t) => s + t.totalDeposited, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    color: 'text-blue-400',
                    icon: ArrowUpCircle,
                  },
                  {
                    label: 'Total Available',
                    value: '$' + traderBalances.reduce((s, t) => s + t.available, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    color: 'text-amber-400',
                    icon: Wallet,
                  },
                  {
                    label: 'Total Withdrawn',
                    value: '$' + traderBalances.reduce((s, t) => s + t.totalWithdrawn, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    color: 'text-red-400',
                    icon: DollarSign,
                  },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 shrink-0">
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">{label}</p>
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {loadingBalances ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-400" />
                  Loading balances...
                </div>
              ) : traderBalances.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No traders registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40">
                        {['Trader', 'Status', 'Deposited', 'Trade Profit', 'Referral', 'Withdrawn', 'Pending', 'Available Balance'].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {traderBalances
                        .sort((a, b) => b.available - a.available)
                        .map((t, i) => (
                          <tr
                            key={t.id}
                            className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}
                          >
                            {/* Trader */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                  <span className="text-amber-400 text-xs font-bold">
                                    {(t.name ?? t.email).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-white font-medium text-sm">{t.name || '—'}</p>
                                  <p className="text-slate-500 text-xs">{t.email}</p>
                                </div>
                              </div>
                            </td>
                            {/* Activation status */}
                            <td className="px-5 py-4">
                              {t.isActivated ? (
                                <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" />Active
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-700/40 border border-slate-600/30 rounded-full px-2.5 py-1 w-fit">
                                  <Clock className="w-3 h-3" />Inactive
                                </span>
                              )}
                            </td>
                            {/* Deposited */}
                            <td className="px-5 py-4">
                              <span className="text-blue-400 font-semibold">
                                ${t.totalDeposited.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            {/* Trade profit */}
                            <td className="px-5 py-4">
                              <span className={t.tradeProfits > 0 ? 'text-green-400 font-semibold' : 'text-slate-500'}>
                                +${t.tradeProfits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            {/* Referral */}
                            <td className="px-5 py-4">
                              <span className={t.referralEarnings > 0 ? 'text-purple-400 font-semibold' : 'text-slate-500'}>
                                +${t.referralEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            {/* Withdrawn */}
                            <td className="px-5 py-4">
                              <span className={t.totalWithdrawn > 0 ? 'text-red-400 font-semibold' : 'text-slate-500'}>
                                -${t.totalWithdrawn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            {/* Pending withdrawal */}
                            <td className="px-5 py-4">
                              {t.pendingWithdrawal > 0 ? (
                                <span className="text-amber-400 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                                  ${t.pendingWithdrawal.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-600 text-xs">—</span>
                              )}
                            </td>
                            {/* Available balance — highlighted */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm font-mono ${
                                  t.available > 0
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                }`}>
                                  ${t.available.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

      </main>

      {/* Reject Withdrawal Modal */}
      {showWithdrawRejectModal !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-slate-700 p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />Reject Withdrawal
              </h3>
              <button onClick={() => { setShowWithdrawRejectModal(null); setWithdrawNote('') }} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium mb-1.5 block">Reason (optional)</label>
              <input
                type="text"
                value={withdrawNote}
                onChange={e => setWithdrawNote(e.target.value)}
                placeholder="e.g. Invalid wallet address"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setShowWithdrawRejectModal(null); setWithdrawNote('') }} variant="ghost" className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
              <Button
                onClick={() => handleRejectWithdrawal(showWithdrawRejectModal)}
                disabled={reviewingWithdrawId === showWithdrawRejectModal}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold"
              >
                {reviewingWithdrawId === showWithdrawRejectModal ? 'Rejecting...' : 'Reject'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Reject Activation Fee Modal */}
      {showRejectModal !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-slate-700 p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />Reject Activation Fee
              </h3>
              <button onClick={() => { setShowRejectModal(null); setRejectNote('') }} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium mb-1.5 block">Reason (optional)</label>
              <input
                type="text"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="e.g. Transaction not found on chain"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setShowRejectModal(null); setRejectNote('') }} variant="ghost" className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
              <Button
                onClick={() => handleRejectFee(showRejectModal)}
                disabled={reviewingFeeId === showRejectModal}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold"
              >
                {reviewingFeeId === showRejectModal ? 'Rejecting...' : 'Reject'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Review Modal */}
      {reviewModalId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-slate-700 p-6 w-full max-w-md space-y-4">
            <h3 className={`text-lg font-bold ${reviewAction === 'confirmed' ? 'text-green-400' : 'text-red-400'}`}>
              {reviewAction === 'confirmed' ? 'Confirm Deposit' : 'Reject Deposit'}
            </h3>
            <p className="text-slate-400 text-sm">
              {reviewAction === 'confirmed'
                ? 'Confirming will mark this deposit as received and credited to the trader.'
                : 'Rejecting will notify the trader that their deposit was not accepted.'}
            </p>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Note for trader <span className="text-slate-600">(optional)</span></label>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                rows={3}
                placeholder="Add a note or reason..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => { setReviewModalId(null); setReviewAction(null); setReviewNote('') }}
                variant="ghost"
                className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReview}
                disabled={reviewingId !== null}
                className={`flex-1 font-bold ${reviewAction === 'confirmed' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              >
                {reviewingId !== null ? 'Processing...' : reviewAction === 'confirmed' ? 'Confirm' : 'Reject'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Auto-Trade Plan Modal */}
      {showCreatePlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-slate-700 p-6 w-full max-w-lg space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Assign Auto-Trade Plan</h3>
                  <p className="text-slate-500 text-xs">Fixed 10% gross / 2% fee / 8% net monthly return</p>
                </div>
              </div>
              <button onClick={() => setShowCreatePlan(false)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Select Trader</label>
                <select
                  value={planTargetUserId}
                  onChange={e => setPlanTargetUserId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                >
                  <option value="">-- select a trader --</option>
                  {users.filter(u => u.role === 'trader').map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Principal (USDT)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    min="10"
                    step="0.01"
                    value={planPrincipal}
                    onChange={e => setPlanPrincipal(e.target.value)}
                    required
                    placeholder="e.g. 1000.00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Start Date</label>
                <input
                  type="date"
                  value={planStartDate}
                  onChange={e => setPlanStartDate(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Note (optional)</label>
                <input
                  type="text"
                  value={planNote}
                  onChange={e => setPlanNote(e.target.value)}
                  placeholder="e.g. Phase 1 investment plan"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              {/* Return preview */}
              {planPrincipal && parseFloat(planPrincipal) > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Monthly Gross', value: `$${((parseFloat(planPrincipal) * 10) / 100).toFixed(2)}`, color: 'text-amber-400' },
                    { label: 'Platform Fee', value: `-$${((parseFloat(planPrincipal) * 2) / 100).toFixed(2)}`, color: 'text-red-400' },
                    { label: 'Trader Net', value: `+$${((parseFloat(planPrincipal) * 8) / 100).toFixed(2)}`, color: 'text-green-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className="text-slate-500 text-xs">{label}</p>
                      <p className={`font-bold text-sm ${color}`}>{value}/mo</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" onClick={() => setShowCreatePlan(false)} variant="ghost" className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
                <Button type="submit" disabled={creatingPlan} className="flex-1 bg-amber-600 hover:bg-amber-700 text-black font-bold">
                  {creatingPlan ? 'Creating...' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-slate-700 p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Reset Password</h3>
                  <p className="text-slate-500 text-xs truncate max-w-[220px]">{resetTarget.name || resetTarget.email}</p>
                </div>
              </div>
              <button
                onClick={() => { setResetTarget(null); setResetPassword('') }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">New Password</label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  The new password will be shown in the Users table with a show/hide toggle until you reload. Share it with the user securely.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  onClick={() => { setResetTarget(null); setResetPassword('') }}
                  variant="ghost"
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetting || resetPassword.length < 8}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-slate-700 p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Create Admin Account</h3>
                  <p className="text-slate-500 text-xs">Only admins can create other admin accounts</p>
                </div>
              </div>
              <button
                onClick={() => { setShowCreateAdmin(false); setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword('') }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={e => setNewAdminName(e.target.value)}
                  required
                  placeholder="e.g. John Smith"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Email Address</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showNewAdminPassword ? 'text' : 'password'}
                    value={newAdminPassword}
                    onChange={e => setNewAdminPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pr-10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewAdminPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNewAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5">
                <Shield className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300/80 text-xs leading-relaxed">
                  This account will have full admin access — user management, deposit addresses, and fund approvals. Share credentials securely.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  onClick={() => { setShowCreateAdmin(false); setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword('') }}
                  variant="ghost"
                  className="flex-1 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creatingAdmin}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {creatingAdmin ? 'Creating...' : 'Create Admin'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
