'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAllUsers, changeUserRole, deleteUser } from '@/app/actions/users'
import { getAllDepositAddresses, upsertDepositAddress, deleteDepositAddress, getAllFundRequests, reviewFundRequest } from '@/app/actions/deposits'
import { getRoleLabel, UserRole } from '@/lib/roles'
import { LogOut, Users, Trash2, ChevronDown, Wallet, Plus, CheckCircle2, XCircle, Clock, AlertCircle, Pencil } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: Date
}

interface DepositAddress {
  id: number
  network: string
  address: string
  label: string | null
  isActive: boolean
  createdAt: Date
}

interface FundRequest {
  id: number
  userId: string
  network: string
  amount: string
  txHash: string | null
  status: string
  note: string | null
  reviewedAt: Date | null
  createdAt: Date
  userName: string | null
  userEmail: string | null
}

type Tab = 'users' | 'deposit-addresses' | 'fund-requests'
type Network = 'TRC20' | 'BEP20' | 'ERC20'

const NETWORK_META: Record<Network, { color: string; bg: string; border: string }> = {
  TRC20: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  BEP20: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  ERC20: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
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
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewModalId, setReviewModalId] = useState<number | null>(null)
  const [reviewAction, setReviewAction] = useState<'confirmed' | 'rejected' | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    if (activeTab === 'deposit-addresses') loadAddresses()
    if (activeTab === 'fund-requests') loadFundRequests()
  }, [activeTab])

  const showSuccess = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const loadUsers = async () => {
    try {
      setLoadingUsers(true)
      const data = await getAllUsers()
      setUsers(data as User[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true)
      const data = await getAllDepositAddresses()
      setAddresses(data as DepositAddress[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load addresses')
    } finally {
      setLoadingAddresses(false)
    }
  }

  const loadFundRequests = async () => {
    try {
      setLoadingRequests(true)
      const data = await getAllFundRequests()
      setFundRequests(data as FundRequest[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fund requests')
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setUpdatingUserId(userId)
      await changeUserRole(userId, newRole)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return
    try {
      setDeletingUserId(userId)
      await deleteUser(userId)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleSaveAddress = async () => {
    if (!editNetwork || !editAddress.trim()) return
    try {
      setSavingAddress(true)
      setError(null)
      await upsertDepositAddress(editNetwork, editAddress, editLabel)
      await loadAddresses()
      setEditNetwork(null)
      setEditAddress('')
      setEditLabel('')
      showSuccess(`${editNetwork} deposit address saved successfully`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address')
    } finally {
      setSavingAddress(false)
    }
  }

  const handleStartEdit = (network: Network) => {
    const existing = addresses.find(a => a.network === network && a.isActive)
    setEditNetwork(network)
    setEditAddress(existing?.address || '')
    setEditLabel(existing?.label || '')
  }

  const handleReviewRequest = async (id: number, status: 'confirmed' | 'rejected') => {
    try {
      setReviewingId(id)
      await reviewFundRequest(id, status, reviewNote)
      await loadFundRequests()
      setReviewModalId(null)
      setReviewNote('')
      setReviewAction(null)
      showSuccess(`Request ${status} successfully`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review request')
    } finally {
      setReviewingId(null)
    }
  }

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  const pendingCount = fundRequests.filter(r => r.status === 'pending').length
  const activeAddressNetworks = new Set(addresses.filter(a => a.isActive).map(a => a.network))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            Admin Panel
          </h1>
          <p className="text-slate-400 mt-1 text-sm">User management, deposit addresses & fund requests</p>
        </div>
        <Button onClick={handleLogout} variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-700">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Card className="mb-4 p-4 bg-red-900/20 border-red-500/50 text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p>{error}</p>
        </Card>
      )}
      {success && (
        <Card className="mb-4 p-4 bg-green-900/20 border-green-500/50 text-green-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <p>{success}</p>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700">
        {([
          { key: 'users', label: 'Users', icon: Users, count: users.length },
          { key: 'deposit-addresses', label: 'Deposit Addresses', icon: Wallet, count: activeAddressNetworks.size },
          { key: 'fund-requests', label: 'Fund Requests', icon: Clock, count: pendingCount },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setError(null) }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                tab.key === 'fund-requests' && pendingCount > 0
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Users ── */}
      {activeTab === 'users' && (
        <Card className="bg-slate-800/50 backdrop-blur border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              All Users ({users.length})
            </h2>
          </div>
          {loadingUsers ? (
            <div className="p-6 text-center text-slate-400">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/20">
                    {['User', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4 text-sm text-white font-medium">{u.name || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">{u.email}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="relative inline-block">
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u.id, e.target.value as UserRole)}
                            disabled={updatingUserId === u.id}
                            className="appearance-none px-3 py-1 rounded bg-slate-700 text-white text-sm border border-slate-600 hover:border-slate-500 disabled:opacity-50 cursor-pointer"
                          >
                            <option value="viewer">{getRoleLabel('viewer')}</option>
                            <option value="trader">{getRoleLabel('trader')}</option>
                            <option value="admin">{getRoleLabel('admin')}</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm">
                        <Button
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={deletingUserId === u.id}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
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

      {/* ── TAB: Deposit Addresses ── */}
      {activeTab === 'deposit-addresses' && (
        <div className="space-y-6">
          <p className="text-slate-400 text-sm">
            Set the USDT deposit addresses for each network. Traders will see these addresses when they request to add funds.
          </p>

          {/* Network cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['TRC20', 'BEP20', 'ERC20'] as Network[]).map(network => {
              const meta = NETWORK_META[network]
              const existing = addresses.find(a => a.network === network && a.isActive)
              return (
                <Card key={network} className={`bg-slate-800/60 border-slate-700/50 p-5 space-y-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${meta.bg} border ${meta.border} ${meta.color}`}>
                        {network}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-sm">USDT {network}</div>
                        <div className="text-slate-400 text-xs">
                          {network === 'TRC20' ? 'TRON Network' : network === 'BEP20' ? 'BNB Smart Chain' : 'Ethereum Network'}
                        </div>
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${existing ? 'bg-green-400' : 'bg-slate-600'}`} title={existing ? 'Active' : 'Not set'} />
                  </div>

                  {existing ? (
                    <div className="space-y-2">
                      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                        <code className="text-amber-300 text-xs break-all font-mono">{existing.address}</code>
                        {existing.label && <div className="text-slate-400 text-xs mt-1">{existing.label}</div>}
                      </div>
                      <div className="text-slate-500 text-xs">Updated {new Date(existing.createdAt).toLocaleDateString()}</div>
                    </div>
                  ) : (
                    <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-500 text-xs text-center">
                      No address configured
                    </div>
                  )}

                  <Button
                    onClick={() => handleStartEdit(network)}
                    variant="ghost"
                    size="sm"
                    className={`w-full border ${existing ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : `${meta.border} ${meta.color} hover:${meta.bg}`} gap-2`}
                  >
                    {existing ? <><Pencil className="w-3.5 h-3.5" />Update Address</> : <><Plus className="w-3.5 h-3.5" />Set Address</>}
                  </Button>
                </Card>
              )
            })}
          </div>

          {/* Edit form */}
          {editNetwork && (
            <Card className="bg-slate-800/80 border-amber-500/30 p-6 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                {addresses.find(a => a.network === editNetwork && a.isActive) ? 'Update' : 'Set'} USDT {editNetwork} Address
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">
                    Wallet Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    placeholder={
                      editNetwork === 'TRC20' ? 'T... (TRON address)' :
                      editNetwork === 'BEP20' ? '0x... (BNB Smart Chain)' :
                      '0x... (Ethereum)'
                    }
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1.5 uppercase tracking-wide">
                    Label <span className="text-slate-500 normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    placeholder="e.g. Main deposit wallet"
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => { setEditNetwork(null); setEditAddress(''); setEditLabel('') }}
                  variant="ghost"
                  className="flex-1 border border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAddress}
                  disabled={savingAddress || !editAddress.trim()}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                >
                  {savingAddress ? 'Saving...' : 'Save Address'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: Fund Requests ── */}
      {activeTab === 'fund-requests' && (
        <Card className="bg-slate-800/50 backdrop-blur border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Fund Requests ({fundRequests.length})
            </h2>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">{pendingCount} Pending</span>
              <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">{fundRequests.filter(r => r.status === 'confirmed').length} Confirmed</span>
            </div>
          </div>

          {loadingRequests ? (
            <div className="p-6 text-center text-slate-400">Loading requests...</div>
          ) : fundRequests.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No fund requests yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/20">
                    {['Trader', 'Network', 'Amount', 'TX Hash', 'Submitted', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fundRequests.map(req => {
                    const meta = NETWORK_META[req.network as Network]
                    const statusStyle = req.status === 'confirmed'
                      ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : req.status === 'rejected'
                        ? 'text-red-400 bg-red-500/10 border-red-500/20'
                        : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                    return (
                      <tr key={req.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-4">
                          <div className="text-white text-sm font-medium">{req.userName || 'Unknown'}</div>
                          <div className="text-slate-400 text-xs">{req.userEmail}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${meta?.color} ${meta?.bg} border ${meta?.border}`}>
                            {req.network}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-white font-semibold">
                          ${parseFloat(req.amount).toLocaleString()} USDT
                        </td>
                        <td className="px-5 py-4">
                          {req.txHash ? (
                            <code className="text-slate-300 text-xs font-mono">{req.txHash.slice(0, 16)}...</code>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-lg border capitalize ${statusStyle}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {req.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setReviewModalId(req.id); setReviewAction('confirmed') }}
                                className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                                title="Confirm"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setReviewModalId(req.id); setReviewAction('rejected') }}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">{req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString() : '—'}</span>
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

      {/* Review Confirm Modal */}
      {reviewModalId !== null && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setReviewModalId(null); setReviewNote('') }} />
          <Card className="relative w-full max-w-md bg-slate-900 border-slate-700 p-6 space-y-4 z-10">
            <div className="flex items-center gap-3">
              {reviewAction === 'confirmed'
                ? <CheckCircle2 className="w-6 h-6 text-green-400" />
                : <XCircle className="w-6 h-6 text-red-400" />
              }
              <h3 className="text-white font-semibold">
                {reviewAction === 'confirmed' ? 'Confirm Deposit' : 'Reject Deposit'}
              </h3>
            </div>
            <p className="text-slate-400 text-sm">
              {reviewAction === 'confirmed'
                ? "This will mark the deposit as confirmed and credit the trader's account."
                : "This will reject the deposit request."}
            </p>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1.5">
                Note <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="Add a note for the trader..."
                rows={2}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => { setReviewModalId(null); setReviewNote('') }}
                variant="ghost"
                className="flex-1 border border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleReviewRequest(reviewModalId, reviewAction)}
                disabled={reviewingId === reviewModalId}
                className={`flex-1 font-semibold ${reviewAction === 'confirmed' ? 'bg-green-500 hover:bg-green-600 text-black' : 'bg-red-500 hover:bg-red-600 text-white'}`}
              >
                {reviewingId === reviewModalId ? 'Processing...' : reviewAction === 'confirmed' ? 'Confirm' : 'Reject'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
