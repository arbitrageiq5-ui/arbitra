'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getMyReferralData, submitActivationFee } from '@/app/actions/referral'
import {
  Copy, Check, Users, DollarSign, Gift, ChevronDown, ChevronUp,
  Clock, CheckCircle2, XCircle, AlertCircle, Share2, ExternalLink,
  Zap, TrendingUp, Lock,
} from 'lucide-react'

type Commission = {
  id: number
  level: number
  amount: string
  status: string
  paidAt: Date | null
  createdAt: Date
  fromUser: { name: string | null; email: string } | null
}

type DirectReferral = {
  id: string
  name: string | null
  email: string
  isActivated: boolean
  createdAt: Date
}

type ReferralData = {
  referralCode: string | null
  isActivated: boolean
  activationFee: { id: number; status: string; txHash: string | null; createdAt: Date } | null
  commissions: Commission[]
  directReferrals: DirectReferral[]
  totalEarned: number
  pendingEarnings: number
  l1Count: number
  l1Activated: number
  l2Count: number
  l3Count: number
}

const LEVEL_COLORS: Record<number, { bg: string; text: string; border: string; label: string }> = {
  1: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Direct' },
  2: { bg: 'bg-blue-500/10',  text: 'text-blue-400',  border: 'border-blue-500/20',  label: 'Level 2' },
  3: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', label: 'Level 3' },
}

export function PassiveIncome() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showTxInput, setShowTxInput] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showAllCommissions, setShowAllCommissions] = useState(false)
  const [showAllReferrals, setShowAllReferrals] = useState(false)

  const showMsg = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getMyReferralData()
      setData(d as ReferralData)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const copyCode = () => {
    if (!data?.referralCode) return
    navigator.clipboard.writeText(data.referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = () => {
    if (!data?.referralCode) return
    const url = `${window.location.origin}/sign-up?ref=${data.referralCode}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleSubmitFee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!txHash.trim()) return
    try {
      setSubmitting(true)
      await submitActivationFee(txHash.trim())
      await load()
      setShowTxInput(false)
      setTxHash('')
      showMsg('Activation fee submitted. Admin will review within 24 hours.')
    } catch (err) {
      showMsg(err instanceof Error ? err.message : 'Submission failed', 'error')
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-800/50" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const referralLink = data.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/sign-up?ref=${data.referralCode}`
    : ''

  const visibleCommissions = showAllCommissions ? data.commissions : data.commissions.slice(0, 5)
  const visibleReferrals = showAllReferrals ? data.directReferrals : data.directReferrals.slice(0, 5)

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Activation Status Banner */}
      {!data.isActivated && (
        <Card className="bg-slate-900 border-amber-500/30 overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-base">Account Activation Required</h3>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Pay a one-time <span className="text-amber-400 font-semibold">$100 USDT</span> activation fee to unlock trading features, auto-trade plans, and referral commissions. Send payment to the platform wallet and submit your transaction hash below.
                </p>

                {data.activationFee?.status === 'pending' ? (
                  <div className="mt-3 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
                    <span className="text-yellow-300 text-sm">
                      Activation payment submitted — pending admin review.
                      TX: <code className="font-mono text-xs">{data.activationFee.txHash?.slice(0, 20)}...</code>
                    </span>
                  </div>
                ) : data.activationFee?.status === 'rejected' ? (
                  <div className="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-red-300 text-sm">Previous submission was rejected. Please re-submit with a valid transaction hash.</span>
                  </div>
                ) : null}

                {!data.activationFee || data.activationFee.status === 'rejected' ? (
                  <div className="mt-3">
                    {!showTxInput ? (
                      <Button
                        size="sm"
                        onClick={() => setShowTxInput(true)}
                        className="bg-amber-600 hover:bg-amber-700 text-black font-bold gap-2"
                      >
                        <DollarSign className="w-4 h-4" />
                        Submit Activation Payment
                      </Button>
                    ) : (
                      <form onSubmit={handleSubmitFee} className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={txHash}
                          onChange={e => setTxHash(e.target.value)}
                          required
                          placeholder="Paste your USDT transaction hash"
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono"
                        />
                        <Button type="submit" disabled={submitting} size="sm" className="bg-amber-600 hover:bg-amber-700 text-black font-bold shrink-0">
                          {submitting ? 'Sending...' : 'Submit'}
                        </Button>
                        <Button type="button" onClick={() => { setShowTxInput(false); setTxHash('') }} size="sm" variant="ghost" className="text-slate-500 hover:text-white shrink-0">
                          Cancel
                        </Button>
                      </form>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Activated badge */}
      {data.isActivated && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 w-fit">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-semibold text-sm">Account Activated</span>
        </div>
      )}

      {/* Passive Income Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Earned', value: `$${data.totalEarned.toFixed(2)}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
          { label: 'Pending', value: `$${data.pendingEarnings.toFixed(2)}`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          { label: 'Direct Referrals', value: `${data.l1Count}`, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Total Network', value: `${data.l1Count + data.l2Count + data.l3Count}`, icon: Share2, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <Card key={label} className={`bg-slate-900 ${border} border p-4`}>
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-slate-500 text-xs">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Multi-Level Commission Plan */}
      <Card className="bg-slate-900 border-slate-800 p-5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          Multi-Level Commission Plan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { level: 1, label: 'Direct Referral', commission: '$30', desc: 'When someone you refer pays the $100 activation fee', count: data.l1Count, activated: data.l1Activated },
            { level: 2, label: 'Level 2', commission: '$10', desc: 'When your referral\'s referral activates', count: data.l2Count, activated: null },
            { level: 3, label: 'Level 3', commission: '$5',  desc: 'When level 2\'s referral activates', count: data.l3Count, activated: null },
          ].map(({ level, label, commission, desc, count, activated }) => {
            const c = LEVEL_COLORS[level]
            return (
              <div key={level} className={`${c.bg} border ${c.border} rounded-xl p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${c.text} uppercase tracking-wider`}>{label}</span>
                  <span className={`text-xs font-semibold ${c.text} bg-slate-900/60 rounded-full px-2 py-0.5`}>
                    {count} members
                  </span>
                </div>
                <p className={`text-2xl font-bold ${c.text}`}>{commission}</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{desc}</p>
                {activated !== null && (
                  <p className="text-slate-400 text-xs mt-2">
                    {activated}/{count} activated
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Referral Link */}
      <Card className="bg-slate-900 border-slate-800 p-5">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-400" />
          Your Referral Link
        </h3>
        {data.referralCode ? (
          <div className="space-y-3">
            {/* Code */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Referral Code</p>
                  <p className="text-white font-mono font-bold text-lg tracking-widest">{data.referralCode}</p>
                </div>
                <button onClick={copyCode} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {/* Link */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5">
              <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
              <p className="text-slate-400 text-xs font-mono truncate flex-1">{referralLink}</p>
              <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors shrink-0">
                {copiedLink ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-slate-500 text-xs">
              Share this link or code. You earn commissions when referred users pay the $100 activation fee.
            </p>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Generating your referral code...</p>
        )}
      </Card>

      {/* Commission History */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Commission History
          </h3>
          <span className="text-xs text-slate-500">{data.commissions.length} total</span>
        </div>
        {data.commissions.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Lock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No commissions yet.</p>
            <p className="text-slate-600 text-xs mt-1">Refer traders and earn when they activate.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40">
                    {['From', 'Level', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleCommissions.map((c, i) => {
                    const lc = LEVEL_COLORS[c.level]
                    return (
                      <tr key={c.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-white text-xs font-medium">{c.fromUser?.name || '—'}</p>
                          <p className="text-slate-500 text-xs">{c.fromUser?.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${lc.text} ${lc.bg} border ${lc.border} rounded-full px-2 py-0.5`}>
                            {lc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-green-400 font-bold">${parseFloat(c.amount).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {c.status === 'paid' ? (
                            <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" />Paid</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-400"><Clock className="w-3.5 h-3.5" />Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {data.commissions.length > 5 && (
              <button
                onClick={() => setShowAllCommissions(p => !p)}
                className="w-full py-3 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1 border-t border-slate-800 transition-colors"
              >
                {showAllCommissions ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Show all {data.commissions.length}</>}
              </button>
            )}
          </>
        )}
      </Card>

      {/* Direct Referrals Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Direct Referrals (L1)
          </h3>
          <span className="text-xs text-slate-500">{data.l1Count} total &middot; {data.l1Activated} activated</span>
        </div>
        {data.directReferrals.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No direct referrals yet.</p>
            <p className="text-slate-600 text-xs mt-1">Share your referral link to get started.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40">
                    {['Name', 'Email', 'Status', 'Joined'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleReferrals.map((r, i) => (
                    <tr key={r.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 ${i % 2 !== 0 ? 'bg-slate-900/20' : ''}`}>
                      <td className="px-4 py-3 text-white text-xs font-medium">{r.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{r.email}</td>
                      <td className="px-4 py-3">
                        {r.isActivated ? (
                          <span className="flex items-center gap-1 text-xs text-green-400 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />Activated</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-400"><AlertCircle className="w-3.5 h-3.5" />Not activated</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.directReferrals.length > 5 && (
              <button
                onClick={() => setShowAllReferrals(p => !p)}
                className="w-full py-3 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1 border-t border-slate-800 transition-colors"
              >
                {showAllReferrals ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Show all {data.l1Count}</>}
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
