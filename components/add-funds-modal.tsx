'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Copy, CheckCircle2, AlertCircle, Loader2, ChevronRight,
  Wallet, Clock, Upload, ImageIcon, Trash2, Hash, ArrowLeft, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDepositAddresses, submitFundRequest, getMyFundRequests } from '@/app/actions/deposits'
import { copyToClipboard } from '@/lib/utils'

type Network = 'TRC20' | 'BEP20' | 'ERC20'
type Step = 'select' | 'deposit' | 'confirm' | 'history'

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
  screenshotUrl: string | null
  status: string
  createdAt: Date
}

const NETWORK_META: Record<Network, {
  color: string; bg: string; border: string; ring: string
  chain: string; token: string; minDeposit: number; badge: string
}> = {
  TRC20: {
    color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30',
    ring: 'ring-red-500/40', chain: 'TRON Network', token: 'USDT (TRC20)',
    minDeposit: 1, badge: 'bg-red-500/20 text-red-300',
  },
  BEP20: {
    color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30',
    ring: 'ring-yellow-500/40', chain: 'BNB Smart Chain', token: 'USDT (BEP20)',
    minDeposit: 1, badge: 'bg-yellow-500/20 text-yellow-300',
  },
  ERC20: {
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30',
    ring: 'ring-blue-500/40', chain: 'Ethereum Network', token: 'USDT (ERC20)',
    minDeposit: 10, badge: 'bg-blue-500/20 text-blue-300',
  },
}

const STEP_LABELS: Record<Exclude<Step, 'history' | 'confirm'>, string> = {
  select: 'Choose Network',
  deposit: 'Deposit Details',
}

export function AddFundsModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('select')
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [addresses, setAddresses] = useState<DepositAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [screenshotPathname, setScreenshotPathname] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<FundRequest[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAddresses() }, [])

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
    } catch { /* silent */ } finally {
      setLoadingHistory(false)
    }
  }

  const handleCopy = async (address: string) => {
    await copyToClipboard(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Screenshot handling ────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are accepted for the screenshot.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Screenshot must be under 10 MB.')
      return
    }
    setScreenshotFile(file)
    setScreenshotPathname(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = e => setScreenshotPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const removeScreenshot = () => {
    setScreenshotFile(null)
    setScreenshotPreview(null)
    setScreenshotPathname(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadScreenshot = async (): Promise<string | null> => {
    if (!screenshotFile) return null
    setUploadingScreenshot(true)
    try {
      const formData = new FormData()
      formData.append('file', screenshotFile)
      const res = await fetch('/api/upload/deposit-screenshot', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }
      const { pathname } = await res.json()
      setScreenshotPathname(pathname)
      return pathname
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screenshot upload failed')
      return null
    } finally {
      setUploadingScreenshot(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedNetwork) return
    setError(null)

    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) { setError('Please enter a valid amount'); return }
    const meta = NETWORK_META[selectedNetwork]
    if (parsed < meta.minDeposit) { setError(`Minimum deposit is $${meta.minDeposit} USDT`); return }
    if (!txHash.trim()) { setError('Transaction Hash ID is required'); return }
    if (!screenshotFile) { setError('Payment screenshot is required'); return }

    try {
      setSubmitting(true)

      // Upload screenshot first if one was selected
      let pathname = screenshotPathname
      if (screenshotFile && !pathname) {
        pathname = await uploadScreenshot()
        if (!pathname && screenshotFile) {
          // upload failed — error already set
          setSubmitting(false)
          return
        }
      }

      await submitFundRequest(selectedNetwork, parsed, txHash.trim(), pathname ?? undefined)
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
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#0E1324] border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50 bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Add Funds</h2>
              <p className="text-slate-400 text-xs">Deposit USDT to your trading account</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {step !== 'history' && (
              <button
                onClick={() => { setStep('history'); loadHistory() }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-700/60 transition-all"
              >
                <Clock className="w-3.5 h-3.5" />
                History
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors ml-1">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* ── Step indicator ─────────────────────────────────────────────── */}
        {step !== 'history' && step !== 'confirm' && (
          <div className="flex items-center gap-0 px-5 py-2.5 bg-slate-800/20 border-b border-slate-700/30 shrink-0">
            {(['select', 'deposit'] as const).map((s, i) => {
              const isDone = i < (['select', 'deposit'] as const).indexOf(step)
              const isActive = step === s
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                    ${isActive ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                      : isDone ? 'bg-green-500 text-black'
                      : 'bg-slate-700 text-slate-500'}`}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                    {STEP_LABELS[s]}
                  </span>
                  {i < 1 && <ChevronRight className="w-3 h-3 text-slate-600 mx-1" />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* STEP 1: Network Selection */}
          {step === 'select' && (
            <>
              <p className="text-slate-400 text-sm">Choose the USDT network you will send from:</p>
              {loadingAddresses ? (
                <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading networks...
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(['TRC20', 'BEP20', 'ERC20'] as Network[]).map(network => {
                    const meta = NETWORK_META[network]
                    const available = networksWithAddress.has(network)
                    return (
                      <button
                        key={network}
                        onClick={() => available && (setSelectedNetwork(network), setStep('deposit'), setError(null))}
                        disabled={!available}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group relative overflow-hidden
                          ${available
                            ? `${meta.border} ${meta.bg} hover:ring-2 ${meta.ring} hover:shadow-lg cursor-pointer`
                            : 'border-slate-700/30 bg-slate-800/20 opacity-40 cursor-not-allowed'}`}
                      >
                        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center font-extrabold text-sm shrink-0 ${meta.badge} ${meta.border}`}>
                          {network}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold text-sm">{meta.token}</span>
                            {!available && (
                              <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">Unavailable</span>
                            )}
                          </div>
                          <div className="text-slate-400 text-xs mt-0.5">{meta.chain}</div>
                          <div className="text-slate-500 text-xs mt-1">
                            Min. deposit: <span className="text-slate-300">${meta.minDeposit} USDT</span>
                          </div>
                        </div>
                        {available && (
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 shrink-0 transition-colors" />
                        )}
                      </button>
                    )
                  })}
                  {networksWithAddress.size === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                      No deposit networks configured. Contact admin.
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* STEP 2: Deposit Details */}
          {step === 'deposit' && selectedNetwork && (() => {
            const meta = NETWORK_META[selectedNetwork]
            return (
              <div className="space-y-4">
                {/* Back */}
                <button
                  onClick={() => { setStep('select'); setError(null) }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to network selection
                </button>

                {/* Selected network pill */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${meta.border} ${meta.bg}`}>
                  <span className={`font-extrabold text-sm ${meta.badge} px-2.5 py-1 rounded-lg`}>{selectedNetwork}</span>
                  <div>
                    <div className="text-white text-sm font-semibold">{meta.token}</div>
                    <div className="text-slate-400 text-xs">{meta.chain}</div>
                  </div>
                </div>

                {/* Deposit Address */}
                {selectedAddress ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Send USDT to this address
                    </label>
                    <div className="bg-slate-800/80 border border-slate-600/60 rounded-xl p-4 flex items-start gap-3">
                      <code className="flex-1 text-amber-300 text-sm break-all font-mono leading-relaxed">
                        {selectedAddress.address}
                      </code>
                      <button
                        onClick={() => handleCopy(selectedAddress.address)}
                        className={`shrink-0 p-2 rounded-lg transition-all ${copied ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        title="Copy address"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Only send USDT ({selectedNetwork}) — sending other assets will result in permanent loss.
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm text-center py-3">Address not available for this network.</div>
                )}

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Amount You Sent <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder={`Min $${NETWORK_META[selectedNetwork].minDeposit}`}
                      className="w-full bg-slate-800/80 border border-slate-600/60 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all pr-16 text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">USDT</span>
                  </div>
                </div>

                {/* TX Hash */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3 h-3" />
                    Transaction Hash <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={e => setTxHash(e.target.value)}
                    placeholder="e.g. 0xabc123... or TRX txid"
                    className="w-full bg-slate-800/80 border border-slate-600/60 rounded-xl px-4 py-3 text-amber-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono text-xs"
                  />
                  <p className="text-slate-500 text-xs">Copy the TX/TXID from your wallet or exchange after sending.</p>
                </div>

                {/* Screenshot Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" />
                    Payment Screenshot <span className="text-red-400">*</span>
                  </label>

                  {screenshotPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-600/60 bg-slate-800/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshotPreview}
                        alt="Payment screenshot preview"
                        className="w-full max-h-52 object-contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between p-3">
                        <div className="flex items-center gap-1.5 text-xs text-green-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {screenshotFile?.name}
                        </div>
                        <button
                          onClick={removeScreenshot}
                          className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
                          title="Remove screenshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleFileDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
                        ${isDragging
                          ? 'border-amber-500/60 bg-amber-500/5 scale-[1.01]'
                          : 'border-slate-600/50 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/60'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-700/60 flex items-center justify-center">
                        <Upload className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-slate-300 text-sm font-medium">
                          {isDragging ? 'Drop to upload' : 'Drag & drop or click to upload'}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">PNG, JPG, WEBP — max 10 MB</p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {/* Security note */}
                <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                  Your screenshot is stored securely and only visible to admins for verification.
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || uploadingScreenshot || !amount || !txHash.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {uploadingScreenshot ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading screenshot...</>
                  ) : submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</>
                  ) : (
                    'Submit Deposit Request'
                  )}
                </Button>
              </div>
            )
          })()}

          {/* STEP: Confirmation */}
          {step === 'confirm' && selectedNetwork && (
            <div className="flex flex-col items-center text-center py-4 gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Deposit Request Submitted</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                  Your request for{' '}
                  <span className="text-amber-400 font-semibold">${parseFloat(amount).toLocaleString()} USDT ({selectedNetwork})</span>{' '}
                  is pending admin review.
                </p>
              </div>

              <div className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 text-left space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Network</span>
                  <span className={`font-bold text-xs px-2 py-0.5 rounded ${NETWORK_META[selectedNetwork].badge}`}>{selectedNetwork}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Amount</span>
                  <span className="text-white font-semibold">${parseFloat(amount).toLocaleString()} USDT</span>
                </div>
                {txHash && (
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-slate-400 shrink-0">TX Hash</span>
                    <span className="text-amber-300 font-mono text-xs text-right break-all">{txHash}</span>
                  </div>
                )}
                {screenshotFile && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Screenshot</span>
                    <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Uploaded</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-700/40">
                  <span className="text-slate-400">Status</span>
                  <span className="text-yellow-400 font-medium text-xs bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-lg">Pending Review</span>
                </div>
              </div>

              <p className="text-slate-500 text-xs">Admin will verify and approve your deposit. You will be notified once confirmed.</p>

              <div className="flex gap-3 w-full">
                <Button
                  onClick={() => { setStep('history'); loadHistory() }}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  View History
                </Button>
                <Button
                  onClick={onClose}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* STEP: History */}
          {step === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Deposit History</h3>
                <button
                  onClick={() => { setStep('select'); setError(null) }}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                >
                  + New Deposit
                </button>
              </div>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  No deposit requests yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {history.map(req => {
                    const statusStyle = req.status === 'confirmed'
                      ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : req.status === 'rejected'
                      ? 'text-red-400 bg-red-500/10 border-red-500/20'
                      : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                    const netMeta = NETWORK_META[req.network as Network]
                    return (
                      <div key={req.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${netMeta?.badge ?? 'bg-slate-700 text-slate-300'}`}>
                              {req.network}
                            </span>
                            <span className="text-white font-semibold text-sm">
                              ${parseFloat(req.amount).toLocaleString()} USDT
                            </span>
                          </div>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border capitalize ${statusStyle}`}>
                            {req.status}
                          </span>
                        </div>
                        {req.txHash && (
                          <div className="flex items-start gap-1.5 text-xs text-slate-500">
                            <Hash className="w-3 h-3 text-slate-600 mt-0.5 shrink-0" />
                            <span className="font-mono break-all text-slate-400">{req.txHash}</span>
                          </div>
                        )}
                        {req.screenshotUrl && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <ImageIcon className="w-3 h-3 text-slate-600" />
                            <a
                              href={`/api/file?pathname=${encodeURIComponent(req.screenshotUrl)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-400 hover:text-amber-300 underline-offset-2 underline transition-colors"
                            >
                              View screenshot
                            </a>
                          </div>
                        )}
                        <div className="text-slate-600 text-xs">
                          {new Date(req.createdAt).toLocaleString('en-US')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
