'use client'

import { useState, useEffect } from 'react'
import { X, Copy, CheckCircle2, AlertCircle, Loader2, ChevronDown, Wallet, ArrowRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDepositAddresses, submitFundRequest, getMyFundRequests } from '@/app/actions/deposits'
import { copyToClipboard } from '@/lib/utils'

type Network = 'TRC20' | 'BEP20' | 'ERC20'

interface DepositAddress {
  id: number
  network: string
  address: string
  label: string | null
}

interface FundRequest {
  id: number
  network: string
  amount: string
  txHash: string | null
  status: string
  createdAt: Date
}

const NETWORK_META: Record<Network, { color: string; bg: string; border: string; chain: string; token: string; minDeposit: number }> = {
  TRC20: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    chain: 'TRON Network',
    token: 'USDT (TRC20)',
    minDeposit: 1,
  },
  BEP20: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    chain: 'BNB Smart Chain',
    token: 'USDT (BEP20)',
    minDeposit: 1,
  },
  ERC20: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    chain: 'Ethereum Network',
    token: 'USDT (ERC20)',
    minDeposit: 10,
  },
}

export function AddFundsModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'select' | 'deposit' | 'confirm' | 'history'>('select')
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [addresses, setAddresses] = useState<DepositAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<FundRequest[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    loadAddresses()
  }, [])

  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true)
      const data = await getDepositAddresses()
      setAddresses(data as DepositAddress[])
    } catch {
      setError('Failed to load deposit addresses')
    } finally {
      setLoadingAddresses(false)
    }
  }

  const loadHistory = async () => {
    try {
      setLoadingHistory(true)
      const data = await getMyFundRequests()
      setHistory(data as FundRequest[])
    } catch {
      // silently fail
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleNetworkSelect = (network: Network) => {
    setSelectedNetwork(network)
    setStep('deposit')
    setError(null)
  }

  const handleCopy = async (address: string) => {
    await copyToClipboard(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async () => {
    if (!selectedNetwork || !amount) return
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount')
      return
    }
    const meta = NETWORK_META[selectedNetwork]
    if (parsed < meta.minDeposit) {
      setError(`Minimum deposit is $${meta.minDeposit} USDT`)
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      await submitFundRequest(selectedNetwork, parsed, txHash || undefined)
      setSubmitted(true)
      setStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedAddress = addresses.find(a => a.network === selectedNetwork)
  const networksWithAddress = new Set(addresses.map(a => a.network))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Add Funds</h2>
              <p className="text-slate-400 text-xs">Deposit USDT to your account</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStep('history'); loadHistory() }}
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700"
            >
              <Clock className="w-3 h-3" />
              History
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Steps indicator */}
        {step !== 'history' && step !== 'confirm' && (
          <div className="flex items-center gap-2 px-6 py-3 bg-slate-800/30 border-b border-slate-700/40">
            {(['select', 'deposit'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === s ? 'bg-amber-500 text-black' : i < (['select','deposit']).indexOf(step) ? 'bg-green-500 text-black' : 'bg-slate-700 text-slate-400'}`}>
                  {i < (['select','deposit']).indexOf(step) ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${step === s ? 'text-white' : 'text-slate-500'}`}>
                  {s === 'select' ? 'Choose Network' : 'Deposit Details'}
                </span>
                {i < 1 && <ArrowRight className="w-3 h-3 text-slate-600" />}
              </div>
            ))}
          </div>
        )}

        <div className="p-6 max-h-[70vh] overflow-y-auto">

          {/* STEP: Select Network */}
          {step === 'select' && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm mb-4">Select the USDT network you want to deposit from:</p>
              {loadingAddresses ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading deposit addresses...
                </div>
              ) : (['TRC20', 'BEP20', 'ERC20'] as Network[]).map((network) => {
                const meta = NETWORK_META[network]
                const available = networksWithAddress.has(network)
                return (
                  <button
                    key={network}
                    onClick={() => available && handleNetworkSelect(network)}
                    disabled={!available}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group
                      ${available
                        ? `${meta.border} ${meta.bg} hover:border-amber-500/50 hover:bg-amber-500/5 cursor-pointer`
                        : 'border-slate-700/30 bg-slate-800/30 opacity-50 cursor-not-allowed'
                      }`}
                  >
                    {/* Network badge */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${meta.bg} ${meta.border} border ${meta.color} flex-shrink-0`}>
                      {network}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">{meta.token}</span>
                        {!available && (
                          <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">Not configured</span>
                        )}
                      </div>
                      <div className="text-slate-400 text-xs mt-0.5">{meta.chain}</div>
                      <div className="text-slate-500 text-xs mt-1">Min deposit: ${meta.minDeposit} USDT</div>
                    </div>
                    {available && (
                      <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-amber-400 -rotate-90 transition-colors flex-shrink-0" />
                    )}
                  </button>
                )
              })}

              {!loadingAddresses && networksWithAddress.size === 0 && (
                <div className="text-center py-6 text-slate-400 text-sm">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                  No deposit addresses configured yet. Please contact admin.
                </div>
              )}
            </div>
          )}

          {/* STEP: Deposit Details */}
          {step === 'deposit' && selectedNetwork && (
            <div className="space-y-5">
              {/* Back */}
              <button
                onClick={() => { setStep('select'); setError(null) }}
                className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
              >
                ← Back to network selection
              </button>

              {/* Network badge */}
              {(() => {
                const meta = NETWORK_META[selectedNetwork]
                return (
                  <div className={`flex items-center gap-3 p-3 rounded-xl ${meta.bg} border ${meta.border}`}>
                    <div className={`font-bold text-sm ${meta.color}`}>{selectedNetwork}</div>
                    <div>
                      <div className="text-white text-sm font-medium">{meta.token}</div>
                      <div className="text-slate-400 text-xs">{meta.chain}</div>
                    </div>
                  </div>
                )
              })()}

              {/* Deposit Address */}
              {selectedAddress ? (
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-2 uppercase tracking-wide">
                    Send USDT to this address
                  </label>
                  <div className="bg-slate-800 border border-slate-600 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <code className="flex-1 text-amber-300 text-sm break-all font-mono leading-relaxed">
                        {selectedAddress.address}
                      </code>
                      <button
                        onClick={() => handleCopy(selectedAddress.address)}
                        className={`flex-shrink-0 p-2 rounded-lg transition-all ${copied ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'}`}
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    {selectedAddress.label && (
                      <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400 text-xs">{selectedAddress.label}</div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    Only send USDT ({selectedNetwork}) to this address. Other assets will be lost.
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-sm text-center py-4">
                  Address not available for this network.
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-2 uppercase tracking-wide">
                  Deposit Amount (USDT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={`Min $${NETWORK_META[selectedNetwork].minDeposit}`}
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors pr-20"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">USDT</span>
                </div>
              </div>

              {/* TX Hash */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-2 uppercase tracking-wide">
                  Transaction Hash <span className="text-slate-500 normal-case">(optional but recommended)</span>
                </label>
                <input
                  type="text"
                  value={txHash}
                  onChange={e => setTxHash(e.target.value)}
                  placeholder="0x... or TRX hash"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-mono text-sm"
                />
                <p className="text-slate-500 text-xs mt-1.5">Providing the TX hash speeds up confirmation.</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={submitting || !amount}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-xl"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</>
                ) : (
                  'Submit Deposit Request'
                )}
              </Button>
            </div>
          )}

          {/* STEP: Confirmation */}
          {step === 'confirm' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Deposit Request Submitted</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Your deposit request for <span className="text-amber-400 font-medium">${parseFloat(amount).toLocaleString()} USDT ({selectedNetwork})</span> has been submitted.
                </p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Network</span>
                  <span className="text-white font-medium">{selectedNetwork}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount</span>
                  <span className="text-white font-medium">${parseFloat(amount).toLocaleString()} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="text-yellow-400 font-medium">Pending Review</span>
                </div>
              </div>
              <p className="text-slate-500 text-xs">Admin will review and confirm your deposit. You will be notified once approved.</p>
              <div className="flex gap-3">
                <Button
                  onClick={() => { setStep('history'); loadHistory() }}
                  variant="ghost"
                  className="flex-1 border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  View History
                </Button>
                <Button onClick={onClose} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* STEP: History */}
          {step === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">My Deposit History</h3>
                <button onClick={() => setStep('select')} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
                  + New Deposit
                </button>
              </div>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No deposit requests yet.
                </div>
              ) : history.map(req => {
                const statusColor = req.status === 'confirmed' ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : req.status === 'rejected' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                  : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                return (
                  <div key={req.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${NETWORK_META[req.network as Network]?.color} ${NETWORK_META[req.network as Network]?.bg}`}>
                          {req.network}
                        </span>
                        <span className="text-white font-semibold">${parseFloat(req.amount).toLocaleString()} USDT</span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${statusColor} capitalize`}>
                        {req.status}
                      </span>
                    </div>
                    {req.txHash && (
                      <div className="text-slate-400 text-xs font-mono truncate">TX: {req.txHash}</div>
                    )}
                    <div className="text-slate-500 text-xs">
                      {new Date(req.createdAt).toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
