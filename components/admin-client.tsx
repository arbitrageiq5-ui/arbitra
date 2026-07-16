'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAllUsers, changeUserRole, deleteUser } from '@/app/actions/users'
import {
  getAllDepositAddresses, upsertDepositAddress,
  getAllFundRequests, reviewFundRequest,
} from '@/app/actions/deposits'
import { getRoleLabel, UserRole } from '@/lib/roles'
import {
  LogOut, Users, Trash2, ChevronDown, Wallet, Plus,
  CheckCircle2, XCircle, Clock, AlertCircle, Pencil,
  Zap, Shield, BarChart3, RefreshCw,
} from 'lucide-react'

type Tab = 'users' | 'deposit-addresses' | 'fund-requests'
type Network = 'TRC20' | 'BEP20' | 'ERC20'

interface User { id: string; name: string | null; email: string; role: string; createdAt: Date }
interface DepositAddress { id: number; network: string; address: string; label: string | null; isActive: boolean; createdAt: Date }
interface FundRequest {
  id: number; userId: string; network: string; amount: string; txHash: string | null
  status: string; note: string | null; reviewedAt: Date | null; createdAt: Date
  userName: string | null; userEmail: string | null
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

  useEffect(() => { loadUsers() }, [])
  useEffect(() => {
    if (activeTab === 'deposit-addresses') loadAddresses()
    if (activeTab === 'fund-requests') loadFundRequests()
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
            { key: 'users' as Tab,               label: 'Users',             icon: Users,    badge: users.length },
            { key: 'deposit-addresses' as Tab,    label: 'Deposit Addresses', icon: Wallet,   badge: activeAddressNetworks.length },
            { key: 'fund-requests' as Tab,        label: 'Fund Requests',     icon: Clock,    badge: pendingCount },
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
              <button onClick={loadUsers} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
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
                      {['Name', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
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
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">
                          <Button
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={deletingUserId === u.id}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-400 hover:bg-red-900/20 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
                            {new Date(req.createdAt as string | Date).toLocaleString()}
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
      </main>

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
    </div>
  )
}
