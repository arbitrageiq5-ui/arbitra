'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/utils'
import {
  X, Cpu, Eye, EyeOff, ChevronRight, ChevronLeft, Shield, Zap,
  CheckCircle2, XCircle, RefreshCw, Copy, Check, AlertCircle, MonitorCog,
} from 'lucide-react'
import { saveMetaTraderAccount, testMetaTraderConnection } from '@/app/actions/metatrader'

type Platform = 'mt4' | 'mt5'

const STEPS = ['Platform & Broker', 'Login Credentials', 'Enable Algo Trading', 'Test & Finish'] as const

export function MetaTraderConnectWizard({
  onClose,
  onConnected,
}: {
  onClose: () => void
  onConnected: () => void
}) {
  const [step, setStep] = useState(0)
  const [platform, setPlatform] = useState<Platform>('mt5')
  const [broker, setBroker] = useState('')
  const [server, setServer] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [tradeMode, setTradeMode] = useState<'read_only' | 'live'>('read_only')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAccountId, setSavedAccountId] = useState<number | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const canGoStep1 = broker.trim().length > 0 && server.trim().length > 0
  const canGoStep2 = /^\d{4,12}$/.test(login.trim()) && password.trim().length >= 4

  async function handleSaveAndContinue() {
    setError('')
    setSaving(true)
    try {
      const row = await saveMetaTraderAccount({ platform, broker, server, login, password, tradeMode })
      setSavedAccountId(row.id)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!savedAccountId) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testMetaTraderConnection(savedAccountId)
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  const bridgeId = savedAccountId ? `MT-${savedAccountId.toString().padStart(6, '0')}` : null

  function copyBridgeId() {
    if (!bridgeId) return
    copyToClipboard(bridgeId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Connect MT4/MT5 Account</h2>
              <p className="text-slate-500 text-xs mt-0.5">Bridge your MetaTrader broker account to the trading bot</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 pt-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border ${
                i < step ? 'bg-blue-500 border-blue-500 text-white' :
                i === step ? 'border-blue-500 text-blue-400' : 'border-slate-700 text-slate-600'
              }`}>
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-[11px] font-medium hidden sm:block ${i <= step ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-blue-500' : 'bg-slate-800'}`} />}
            </div>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">

          {/* Step 0: Platform & Broker */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Platform</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['mt5', 'mt4'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setPlatform(p)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        platform === p ? 'border-blue-500/50 bg-blue-500/10 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      <Cpu className="w-4 h-4 mb-1" />
                      <p className="text-sm font-bold">{p === 'mt5' ? 'MetaTrader 5' : 'MetaTrader 4'}</p>
                      <p className="text-xs opacity-70 mt-0.5">{p === 'mt5' ? 'Recommended — newer, faster execution' : 'Legacy — still widely supported'}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Broker Name</label>
                <input type="text" value={broker} onChange={e => setBroker(e.target.value)}
                  placeholder="e.g. Exness, IC Markets, XM, Pepperstone"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Server Name</label>
                <input type="text" value={server} onChange={e => setServer(e.target.value)}
                  placeholder="e.g. Exness-MT5Real8"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-blue-500/50" />
                <p className="text-slate-600 text-xs mt-1.5">
                  Find this on your terminal&apos;s login screen or in the account statement your broker emailed you.
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Login Credentials */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
                <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-blue-300/80 text-xs leading-relaxed">
                  Use your <strong>Investor (read-only) password</strong> if you only want the bot to monitor your account.
                  Use your <strong>Master (trading) password</strong> to let the bot place real trades.
                </p>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Account Login (Number)</label>
                <input type="text" inputMode="numeric" value={login} onChange={e => setLogin(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="e.g. 51234567"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Investor or Master password"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pr-11 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-blue-500/50"
                    autoComplete="off" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-2 block">Bot Permission</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {([
                    { value: 'read_only', label: 'Monitor Only', desc: 'Bot watches your account. No trades placed.', icon: Eye },
                    { value: 'live', label: 'Live Trading', desc: 'Bot places real trades on this account.', icon: Zap },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setTradeMode(opt.value)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        tradeMode === opt.value ? 'border-blue-500/40 bg-blue-500/5 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      <opt.icon className="w-4 h-4 mb-1" />
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs opacity-70 mt-0.5 leading-tight">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Enable Algo Trading guide */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <MonitorCog className="w-4 h-4 text-blue-400" />
                <p className="text-white font-bold text-sm">
                  Enable Algo Trading in {platform === 'mt5' ? 'MetaTrader 5' : 'MetaTrader 4'}
                </p>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Before the bot can act on your account, you need to allow automated trading in your terminal and attach
                our signal-receiver Expert Advisor (EA) to a chart. Follow these steps exactly:
              </p>
              <ol className="space-y-3">
                {[
                  {
                    title: 'Open Terminal Settings',
                    detail: platform === 'mt5'
                      ? 'In MT5, go to Tools → Options → Expert Advisors tab.'
                      : 'In MT4, go to Tools → Options → Expert Advisors tab.',
                  },
                  {
                    title: 'Allow Algo Trading',
                    detail: 'Check "Allow Algo Trading" (MT5) or "Allow live trading" (MT4), then click OK.',
                  },
                  {
                    title: 'Allow WebRequests',
                    detail: 'Check "Allow WebRequest for listed URL" and add our bridge domain so the EA can send trade signals.',
                  },
                  {
                    title: 'Attach the Signal EA',
                    detail: 'We email the SignalBridge EA file to your account email within a few minutes of connecting. Drag it onto any open chart — the symbol doesn\'t matter.',
                  },
                  {
                    title: 'Enter your Bridge ID',
                    detail: 'When the EA properties popup appears, check "Allow live trading" and paste your unique Bridge ID (shown on the next step) into the License field.',
                  },
                ].map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-blue-400 shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{s.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  Your terminal must stay running and connected to the internet for the EA to relay signals. The bot cannot
                  trade on your account while the terminal is closed.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Test & Finish */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0">
                  <Cpu className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm">{broker} — {server}</p>
                  <p className="text-slate-500 text-xs">{platform.toUpperCase()} • Login {login} • {tradeMode === 'live' ? 'Live Trading' : 'Monitor Only'}</p>
                </div>
              </div>

              {bridgeId && (
                <div>
                  <label className="text-slate-400 text-xs font-medium mb-1.5 block">Your Bridge ID</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-blue-300 font-mono text-sm">{bridgeId}</div>
                    <button type="button" onClick={copyBridgeId} className="p-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-slate-600 text-xs mt-1.5">Paste this into the SignalBridge EA&apos;s License field on your chart (Step 3, above).</p>
                </div>
              )}

              <Button type="button" onClick={handleTest} disabled={testing}
                className="w-full bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 font-semibold gap-2">
                {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {testing ? 'Checking credentials...' : 'Verify Credentials'}
              </Button>

              {testResult && (
                <div className={`rounded-lg px-3 py-2.5 border text-sm flex items-start gap-2 ${
                  testResult.ok ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
                }`}>
                  {testResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <p className="leading-relaxed">{testResult.message}</p>
                </div>
              )}

              <div className="flex items-start gap-2.5 bg-slate-800/40 border border-slate-700/60 rounded-xl px-4 py-3">
                <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-slate-400 text-xs leading-relaxed">
                  Your account will show as <strong>Pending EA Attachment</strong> until the SignalBridge EA connects
                  from your terminal. Once attached, this bridge account becomes available in the MT4/MT5 bot builder.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="border-t border-slate-800 px-6 py-4 flex gap-3">
          {step > 0 && step < 3 && (
            <Button type="button" variant="ghost" onClick={() => setStep(s => s - 1)}
              className="border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          )}
          <div className="flex-1" />
          {step === 0 && (
            <Button type="button" disabled={!canGoStep1} onClick={() => setStep(1)}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold gap-1.5">
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {step === 1 && (
            <Button type="button" disabled={!canGoStep2} onClick={() => setStep(2)}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold gap-1.5">
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {step === 2 && (
            <Button type="button" disabled={saving} onClick={handleSaveAndContinue}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold gap-1.5">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Account & Continue'}
            </Button>
          )}
          {step === 3 && (
            <Button type="button" onClick={() => { onConnected(); onClose() }}
              className="bg-blue-500 hover:bg-blue-400 text-white font-bold gap-1.5">
              <Check className="w-4 h-4" /> Done
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
