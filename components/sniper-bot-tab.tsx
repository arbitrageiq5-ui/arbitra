'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Zap, RefreshCw, Play, Pause, CheckCircle2, XCircle, AlertTriangle, Clock,
  DollarSign, TrendingUp, Send, Loader2, ChevronRight, Target, BarChart3,
  ShieldCheck, Copy, Check, X,
} from 'lucide-react'

// ── Types (inlined to avoid server-module imports) ─────────────────────────

interface SniperBotConfig {
  enabled: boolean
  tradeAmountUsd: number
  minNetProfitPct: number
  minNetProfitUsd: number
  maxTransferMin: number
  preferredNetworks: string[]
  preferredCoins: string[]
  excludeExchanges: string[]
  autoExecute: boolean
  cooldownSeconds: number
  maxConcurrentGrabs: number
  scoringWeights: {
    netProfit: number
    transferSpeed: number
    feeEfficiency: number
  }
}

interface ScoredOpportunity {
  id: string
  symbol: string
  buyExchange: string
  sellExchange: string
  buyPrice: number
  sellPrice: number
  grossSpreadPct: number
  netProfitPct: number
  netProfitUsd: number
  totalCostsUsd: number
  tradingFeeBuyUsd: number
  tradingFeeSellUsd: number
  withdrawalFeeUsd: number
  networkFeeUsd: number
  slippageUsd: number
  safetyBufferUsd: number
  suggestedNetwork: string
  suggestedAmount: number
  estimatedTransferMin: number
  score: number
  scoreBreakdown: { profitScore: number; speedScore: number; feeScore: number }
  readyToGrab: boolean
  blockers: string[]
  detectedAt: string
}

// ── Server action lazy loader ──────────────────────────────────────────────
const loadActions = () => import('@/app/actions/admin-arbitrage')

// ── Helpers ───────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return 'text-emerald-400'
  if (s >= 40) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-emerald-500'
  if (s >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

// ── Transfer Wizard ────────────────────────────────────────────────────────

interface TransferWizardProps {
  opp: ScoredOpportunity
  tradeAmount: number
  onClose: () => void
  onSuccess: (txId: string) => void
}

function TransferWizard({ opp, tradeAmount, onClose, onSuccess }: TransferWizardProps) {
  const [step, setStep] = useState(1)
  const [network, setNetwork] = useState(opp.suggestedNetwork)
  const [amount, setAmount] = useState(String(tradeAmount))
  const [toAddress, setToAddress] = useState('')
  const [memo, setMemo] = useState('')
  const [fetchingAddr, setFetchingAddr] = useState(false)
  const [addrError, setAddrError] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [execResult, setExecResult] = useState<{ success: boolean; message: string; txId?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchAddress = useCallback(async () => {
    setFetchingAddr(true)
    setAddrError(null)
    try {
      const { getDepositAddress } = await loadActions()
      const res = await getDepositAddress(opp.sellExchange, opp.symbol, network)
      if (res.address) {
        setToAddress(res.address)
        if (res.memo) setMemo(res.memo)
      } else {
        setAddrError(res.error ?? 'Could not fetch deposit address')
      }
    } catch (e) {
      setAddrError(e instanceof Error ? e.message : 'Failed to fetch address')
    } finally {
      setFetchingAddr(false)
    }
  }, [opp.sellExchange, opp.symbol, network])

  useEffect(() => {
    if (step === 2 && !toAddress) fetchAddress()
  }, [step, toAddress, fetchAddress])

  const handleExecute = async () => {
    setExecuting(true)
    try {
      const { executeExchangeTransfer } = await loadActions()
      const res = await executeExchangeTransfer({
        fromExchange: opp.buyExchange,
        toExchange: opp.sellExchange,
        symbol: opp.symbol,
        network,
        amount: parseFloat(amount),
        toAddress,
        memo: memo || undefined,
      })
      setExecResult(res)
      setStep(3)
      if (res.success && res.txId) onSuccess(res.txId)
    } catch (e) {
      setExecResult({ success: false, message: e instanceof Error ? e.message : 'Transfer failed' })
      setStep(3)
    } finally {
      setExecuting(false)
    }
  }

  const copyTx = () => {
    if (execResult?.txId) {
      navigator.clipboard.writeText(execResult.txId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">
              Grab {opp.symbol} — {opp.buyExchange} → {opp.sellExchange}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-800">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors
                ${step === s ? 'bg-cyan-500 text-white' : step > s ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {step > s ? <Check className="w-3 h-3" /> : s}
              </div>
              <span className={`text-xs ${step === s ? 'text-white' : 'text-slate-500'}`}>
                {s === 1 ? 'Review' : s === 2 ? 'Transfer' : 'Result'}
              </span>
              {s < 3 && <ChevronRight className="w-3 h-3 text-slate-600" />}
            </div>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {/* Step 1 — Review */}
          {step === 1 && (
            <>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-800">
                  {[
                    ['Trade amount', `$${tradeAmount.toFixed(2)}`],
                    ['Trading fee (buy)', `$${opp.tradingFeeBuyUsd.toFixed(4)}`],
                    ['Trading fee (sell)', `$${opp.tradingFeeSellUsd.toFixed(4)}`],
                    ['Withdrawal fee', `$${opp.withdrawalFeeUsd.toFixed(4)}`],
                    ['Network fee', `$${opp.networkFeeUsd.toFixed(4)}`],
                    ['Slippage est.', `$${opp.slippageUsd.toFixed(4)}`],
                    ['Safety buffer', `$${opp.safetyBufferUsd.toFixed(4)}`],
                    ['Total costs', `$${opp.totalCostsUsd.toFixed(4)}`],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td className="py-1.5 text-slate-400">{label}</td>
                      <td className="py-1.5 text-right text-slate-200">{val}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2 text-emerald-400">Net profit est.</td>
                    <td className="py-2 text-right text-emerald-400">
                      +${opp.netProfitUsd.toFixed(4)} ({opp.netProfitPct.toFixed(3)}%)
                    </td>
                  </tr>
                </tbody>
              </table>
              {!opp.readyToGrab && opp.blockers.length > 0 && (
                <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 space-y-1">
                  {opp.blockers.map(b => (
                    <div key={b} className="flex items-center gap-2 text-xs text-red-300">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {b}
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
                onClick={() => setStep(2)}
                disabled={!opp.readyToGrab}
              >
                Continue to Transfer Details
              </Button>
            </>
          )}

          {/* Step 2 — Transfer details */}
          {step === 2 && (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Network</label>
                  <div className="flex gap-2">
                    {['TRC20', 'BEP20', 'ERC20', 'SOL', 'NATIVE'].map(n => (
                      <button
                        key={n}
                        onClick={() => { setNetwork(n); setToAddress('') }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors
                          ${network === n ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Amount ({opp.symbol})</label>
                  <input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-400">Destination Address ({opp.sellExchange})</label>
                    <button onClick={fetchAddress} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      {fetchingAddr ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Auto-fetch
                    </button>
                  </div>
                  {addrError && <p className="text-xs text-red-400 mb-1">{addrError}</p>}
                  <input
                    value={toAddress}
                    onChange={e => setToAddress(e.target.value)}
                    placeholder="Paste address or auto-fetch above"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Memo / Tag (optional)</label>
                  <input
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={handleExecute}
                  disabled={executing || !toAddress.trim()}
                >
                  {executing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executing...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Execute Transfer</>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Step 3 — Result */}
          {step === 3 && execResult && (
            <div className="text-center space-y-4 py-2">
              {execResult.success ? (
                <>
                  <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
                  <p className="text-emerald-400 font-semibold text-lg">Transfer Initiated!</p>
                  {execResult.txId && (
                    <div className="bg-slate-800 rounded-lg p-3">
                      <p className="text-xs text-slate-400 mb-1">Transaction ID</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-slate-200 font-mono flex-1 break-all">{execResult.txId}</code>
                        <button onClick={copyTx} className="text-slate-400 hover:text-white shrink-0">
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="w-14 h-14 text-red-400 mx-auto" />
                  <p className="text-red-400 font-semibold text-lg">Transfer Failed</p>
                  <p className="text-slate-400 text-sm">{execResult.message}</p>
                </>
              )}
              <Button className="w-full bg-slate-700 hover:bg-slate-600 text-white" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main SniperBotTab ─────────────────────────────────────────────────────

export function SniperBotTab() {
  const [config, setConfig] = useState<SniperBotConfig | null>(null)
  const [localConfig, setLocalConfig] = useState<SniperBotConfig | null>(null)
  const [opps, setOpps] = useState<ScoredOpportunity[]>([])
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshSec, setRefreshSec] = useState(30)
  const [grabTarget, setGrabTarget] = useState<ScoredOpportunity | null>(null)
  const [grabbedIds, setGrabbedIds] = useState<Set<string>>(new Set())
  const [grabStats, setGrabStats] = useState({ today: 0, profit: 0, wins: 0 })
  const [showConfig, setShowConfig] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load config on mount
  useEffect(() => {
    loadActions()
      .then(mod => mod.getSniperBotConfig())
      .then(cfg => { setConfig(cfg); setLocalConfig(cfg) })
      .catch(() => {})
  }, [])

  const runScan = useCallback(async () => {
    if (!localConfig) return
    setScanning(true)
    try {
      const { grabLiveOpportunities } = await loadActions()
      const results = await grabLiveOpportunities(localConfig)
      setOpps(results)
      setLastScan(new Date().toLocaleTimeString())
    } finally {
      setScanning(false)
    }
  }, [localConfig])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh && localConfig) {
      timerRef.current = setInterval(runScan, refreshSec * 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, refreshSec, runScan, localConfig])

  const handleSave = async () => {
    if (!localConfig) return
    setSaving(true)
    try {
      const { saveSniperBotConfig } = await loadActions()
      await saveSniperBotConfig(localConfig)
      setConfig(localConfig)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async () => {
    if (!localConfig) return
    const next = { ...localConfig, enabled: !localConfig.enabled }
    setLocalConfig(next)
    try {
      const { saveSniperBotConfig } = await loadActions()
      await saveSniperBotConfig({ enabled: next.enabled })
      setConfig(next)
    } catch { /* non-fatal */ }
  }

  const handleGrabSuccess = (txId: string) => {
    if (grabTarget) {
      setGrabbedIds(prev => new Set([...prev, grabTarget.id]))
      setGrabStats(s => ({ ...s, today: s.today + 1, profit: s.profit + (grabTarget?.netProfitUsd ?? 0), wins: s.wins + 1 }))
    }
    setGrabTarget(null)
  }

  const isEnabled = localConfig?.enabled ?? false

  if (!localConfig) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Status Bar ── */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
              ${isEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'}`}>
              <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {isEnabled ? 'Sniper Bot Active' : 'Sniper Bot Paused'}
            </div>
            {lastScan && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last scan: {lastScan}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Stats chips */}
            {[
              { icon: Target, label: 'Today', val: grabStats.today },
              { icon: DollarSign, label: 'Profit', val: `$${grabStats.profit.toFixed(2)}` },
              { icon: BarChart3, label: 'Wins', val: grabStats.wins },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs">
                <Icon className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">{label}:</span>
                <span className="text-white font-medium">{val}</span>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={handleToggle}
            >
              {isEnabled ? <><Pause className="w-3.5 h-3.5 mr-1" /> Pause</> : <><Play className="w-3.5 h-3.5 mr-1" /> Enable</>}
            </Button>
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
              onClick={runScan}
              disabled={scanning}
            >
              {scanning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Scan Now
            </Button>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="accent-cyan-500"
              />
              Auto ({refreshSec}s)
            </label>
          </div>
        </div>
      </div>

      {/* ── Opportunities Queue ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Live Opportunities
            {opps.length > 0 && (
              <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/30">
                {opps.length}
              </span>
            )}
          </h3>
        </div>

        {opps.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
            {scanning ? (
              <div className="space-y-3">
                <div className="relative mx-auto w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-2 border-cyan-400/50 animate-ping" style={{ animationDelay: '0.3s' }} />
                  <Target className="absolute inset-0 m-auto w-5 h-5 text-cyan-400" />
                </div>
                <p className="text-slate-400 text-sm">Scanning markets...</p>
              </div>
            ) : (
              <>
                <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No opportunities detected yet.</p>
                <p className="text-slate-500 text-xs mt-1">Click &quot;Scan Now&quot; to search for arbitrage opportunities.</p>
              </>
            )}
          </div>
        ) : (
          opps.map(opp => (
            <div
              key={opp.id}
              className={`bg-slate-800/60 border rounded-xl p-4 transition-all
                ${grabbedIds.has(opp.id) ? 'border-emerald-800/50 opacity-60' : 'border-slate-700 hover:border-slate-600'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* Left — coin + pair */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">{opp.symbol}</span>
                    <span className="text-xs text-slate-400">
                      BUY <span className="text-blue-400 font-medium">{opp.buyExchange}</span>
                      {' → '}
                      SELL <span className="text-purple-400 font-medium">{opp.sellExchange}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400">Gross: <span className="text-slate-200">+{opp.grossSpreadPct.toFixed(3)}%</span></span>
                    <span className="text-slate-400">Net: <span className="text-emerald-400 font-medium">+{opp.netProfitPct.toFixed(3)}%</span></span>
                    <span className="text-slate-400">Est: <span className="text-emerald-400 font-medium">+${opp.netProfitUsd.toFixed(3)}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium">{opp.suggestedNetwork}</span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> ~{opp.estimatedTransferMin}m
                    </span>
                  </div>
                  {/* Pre-check icons */}
                  <div className="flex items-center gap-2 pt-1">
                    {opp.readyToGrab ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>All checks passed</span>
                      </div>
                    ) : (
                      opp.blockers.map(b => (
                        <div key={b} className="flex items-center gap-1 text-xs text-red-400">
                          <XCircle className="w-3 h-3 shrink-0" />
                          <span>{b}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right — score + action */}
                <div className="flex items-center gap-3">
                  {/* Score */}
                  <div className="text-center">
                    <div className={`text-xl font-bold ${scoreColor(opp.score)}`}>{opp.score}</div>
                    <div className="w-12 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${scoreBg(opp.score)}`}
                        style={{ width: `${opp.score}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">score</div>
                  </div>

                  {grabbedIds.has(opp.id) ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Grabbed
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                      disabled={!opp.readyToGrab}
                      onClick={() => setGrabTarget(opp)}
                    >
                      <Zap className="w-3.5 h-3.5 mr-1" />
                      Grab This
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Config Panel (collapsible) ── */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowConfig(v => !v)}
          className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Sniper Bot Configuration
          </span>
          <ChevronRight className={`w-4 h-4 transition-transform ${showConfig ? 'rotate-90' : ''}`} />
        </button>
        {showConfig && (
          <div className="border-t border-slate-700 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Trade Amount ($)', key: 'tradeAmountUsd', type: 'number' },
                { label: 'Min Net Profit (%)', key: 'minNetProfitPct', type: 'number' },
                { label: 'Min Net Profit ($)', key: 'minNetProfitUsd', type: 'number' },
                { label: 'Max Transfer (min)', key: 'maxTransferMin', type: 'number' },
                { label: 'Cooldown (sec)', key: 'cooldownSeconds', type: 'number' },
                { label: 'Max Concurrent', key: 'maxConcurrentGrabs', type: 'number' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={(localConfig as Record<string, unknown>)[key] as number}
                    onChange={e => setLocalConfig(c => c ? { ...c, [key]: parseFloat(e.target.value) || 0 } : c)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                  />
                </div>
              ))}
            </div>

            {/* Preferred Coins */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Preferred Coins</label>
              <div className="flex flex-wrap gap-2">
                {['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'TRX', 'DOGE'].map(coin => (
                  <button
                    key={coin}
                    onClick={() => setLocalConfig(c => {
                      if (!c) return c
                      const has = c.preferredCoins.includes(coin)
                      return { ...c, preferredCoins: has ? c.preferredCoins.filter(x => x !== coin) : [...c.preferredCoins, coin] }
                    })}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors
                      ${localConfig.preferredCoins.includes(coin) ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                  >{coin}</button>
                ))}
              </div>
            </div>

            {/* Preferred Networks */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Preferred Networks</label>
              <div className="flex flex-wrap gap-2">
                {['TRC20', 'BEP20', 'ERC20', 'SOL', 'NATIVE', 'MATIC'].map(net => (
                  <button
                    key={net}
                    onClick={() => setLocalConfig(c => {
                      if (!c) return c
                      const has = c.preferredNetworks.includes(net)
                      return { ...c, preferredNetworks: has ? c.preferredNetworks.filter(x => x !== net) : [...c.preferredNetworks, net] }
                    })}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors
                      ${localConfig.preferredNetworks.includes(net) ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                  >{net}</button>
                ))}
              </div>
            </div>

            {/* Scoring Weights */}
            <div className="space-y-3">
              <label className="text-xs text-slate-400 block">Scoring Weights</label>
              {[
                { label: 'Net Profit Weight', key: 'netProfit' },
                { label: 'Transfer Speed Weight', key: 'transferSpeed' },
                { label: 'Fee Efficiency Weight', key: 'feeEfficiency' },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={(localConfig.scoringWeights as Record<string, number>)[key]}
                    onChange={e => setLocalConfig(c => c ? {
                      ...c,
                      scoringWeights: { ...c.scoringWeights, [key]: parseInt(e.target.value) },
                    } : c)}
                    className="flex-1 accent-cyan-500"
                  />
                  <span className="text-xs text-white w-4 text-right">
                    {(localConfig.scoringWeights as Record<string, number>)[key]}
                  </span>
                </div>
              ))}
            </div>

            {/* Auto-execute toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.autoExecute}
                onChange={e => setLocalConfig(c => c ? { ...c, autoExecute: e.target.checked } : c)}
                className="accent-cyan-500 w-4 h-4"
              />
              <span className="text-sm text-slate-300">Auto-execute grabs without confirmation</span>
            </label>

            <Button
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Configuration'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Transfer Wizard Modal ── */}
      {grabTarget && (
        <TransferWizard
          opp={grabTarget}
          tradeAmount={localConfig.tradeAmountUsd}
          onClose={() => setGrabTarget(null)}
          onSuccess={handleGrabSuccess}
        />
      )}
    </div>
  )
}
