'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getActivationStatus, submitActivationFee } from '@/app/actions/referral'
import {
  Shield, Clock, CheckCircle2, XCircle,
  ChevronRight, AlertTriangle, Wallet, X, RefreshCw, LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { CopyButton as CopyBtn } from '@/lib/trader-utils'

type DepositAddress = {
  id: number
  network: string
  address: string
  label: string | null
  isActive: boolean
}

type ActivationStatus = Awaited<ReturnType<typeof getActivationStatus>>

const NETWORK_META: Record<string, { color: string; bg: string; border: string; badge: string }> = {
  TRC20: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    badge: 'TRON' },
  BEP20: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', badge: 'BNB Chain' },
  ERC20: { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   badge: 'Ethereum' },
}



export function ActivationFeeModal({ serverIsActivated }: { serverIsActivated: boolean }) {
  const router = useRouter()
  const [status, setStatus] = useState<ActivationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    router.push('/sign-in')
  }

  // Form state
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null)
  const [txHash, setTxHash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!txHash.trim()) return
    if (!selectedNetwork) { setSubmitError('Please select a network first.'); return }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitActivationFee(txHash.trim())
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    // If the server already confirmed activated, skip the async fetch entirely
    if (serverIsActivated) return
    load()
  }, [serverIsActivated])

  const load = async () => {
    setLoading(true)
    try {
      const data = await getActivationStatus()
      setStatus(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  // Never show for already-activated traders (server-authoritative check)
  if (serverIsActivated) return null

  // Don't show while loading
  if (loading) return null

  // Don't show if the fresh DB check also confirms activation
  if (status?.isActivated) return null

  // If dismissed after a pending submission, allow dashboard use
  if (dismissed) return null

  const hasPending  = status?.latestFee?.status === 'pending'
  const hasRejected = status?.latestFee?.status === 'rejected'
  const addresses   = status?.depositAddresses ?? []
  const noAddresses = addresses.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

        {/* Top-right controls — sign out is always available; dismiss when pending */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          {(hasPending || submitted) && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              title="Continue to dashboard"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium disabled:opacity-50"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Account Activation Required</h2>
              <p className="text-slate-400 text-xs mt-0.5">One-time fee to unlock your Trader Dashboard</p>
            </div>
          </div>
        </div>

        {/* Fee badge */}
        <div className="mx-6 mb-5 flex items-center gap-4 bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-4">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Activation Fee</p>
            <p className="text-amber-400 font-black text-3xl font-mono leading-tight">$100 <span className="text-base font-semibold text-slate-400">USDT</span></p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-slate-500 text-xs">Multi-Level Referral Plan</p>
            <div className="mt-1 space-y-0.5">
              {[['L1 Direct', '$30'], ['L2', '$10'], ['L3', '$5']].map(([lv, amt]) => (
                <div key={lv} className="flex items-center gap-2 justify-end">
                  <span className="text-slate-500 text-xs">{lv}</span>
                  <span className="text-green-400 text-xs font-bold">{amt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">

          {/* ── PENDING STATE ── */}
          {(hasPending || submitted) && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-semibold text-sm">Payment Under Review</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Your activation fee has been submitted and is awaiting admin confirmation.
                  You can continue using the dashboard — your account will be fully activated once approved.
                </p>
                {status?.latestFee?.txHash && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <code className="text-slate-400 text-xs font-mono bg-slate-800 px-2 py-0.5 rounded truncate max-w-[260px]">
                      {status.latestFee.txHash}
                    </code>
                    <CopyBtn text={status.latestFee.txHash} />
                  </div>
                )}
                <Button
                  onClick={() => setDismissed(true)}
                  className="mt-3 h-8 px-4 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold gap-1.5"
                >
                  Continue to Dashboard <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ── REJECTED STATE ── */}
          {hasRejected && !submitted && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Previous Submission Rejected</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  {status?.latestFee?.note
                    ? `Reason: ${status.latestFee.note}`
                    : 'Your previous submission was not confirmed. Please re-submit with the correct transaction hash.'}
                </p>
              </div>
            </div>
          )}

          {/* ── SUBMISSION FORM (shown when not pending/submitted) ── */}
          {!hasPending && !submitted && (
            <>
              {noAddresses ? (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex items-center gap-3 text-slate-400 text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  Deposit addresses are being configured by the admin. Please check back shortly.
                </div>
              ) : (
                <>
                  {/* Step 1 — Choose network */}
                  <div>
                    <p className="text-slate-300 text-sm font-semibold mb-2.5 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">1</span>
                      Select Network &amp; Copy Address
                    </p>
                    <div className="space-y-2">
                      {addresses.map((addr) => {
                        const meta = NETWORK_META[addr.network] ?? { color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700', badge: addr.network }
                        const isSelected = selectedNetwork === addr.network
                        return (
                          // Not a native <button> — it wraps CopyBtn (also a <button>), and
                          // nested buttons are invalid HTML and trigger a hydration error.
                          <div
                            key={addr.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedNetwork(addr.network)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setSelectedNetwork(addr.network)
                              }
                            }}
                            className={`w-full text-left rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                              isSelected
                                ? `${meta.bg} ${meta.border} ring-1 ring-offset-0 ${meta.border.replace('border-', 'ring-')}`
                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`px-2 py-0.5 rounded-md text-xs font-bold border ${meta.bg} ${meta.color} ${meta.border}`}>
                                {addr.network}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-300 text-xs">{meta.badge}</p>
                                <p className="text-slate-500 text-xs font-mono truncate">{addr.address}</p>
                              </div>
                              <CopyBtn text={addr.address} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Step 2 — TX Hash */}
                  <div>
                    <p className="text-slate-300 text-sm font-semibold mb-2.5 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">2</span>
                      Send Exactly $100 USDT &amp; Paste TX Hash
                    </p>
                    <div className="relative">
                      <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={txHash}
                        onChange={e => { setTxHash(e.target.value); setSubmitError(null) }}
                        placeholder="e.g. 0xabc123... or TRX hash"
                        className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500/50 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 text-sm font-mono focus:outline-none transition-colors"
                      />
                    </div>
                    <p className="text-slate-600 text-xs mt-1.5 ml-0.5">
                      Paste the full transaction hash from your wallet after sending.
                    </p>
                  </div>

                  {/* Error */}
                  {submitError && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-red-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !txHash || typeof txHash !== 'string' || !txHash.trim()}
                    className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Submit Activation Fee
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
          )}

          {/* Info note */}
          {!hasPending && !submitted && (
            <p className="text-slate-600 text-xs text-center leading-relaxed">
              Your account will be activated within 24 hours after admin confirmation.
              Contact support if you have any issues.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
