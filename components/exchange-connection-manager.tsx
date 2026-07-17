'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/utils'
import {
  Plus, Trash2, Zap, CheckCircle2, XCircle, AlertCircle,
  Eye, EyeOff, RefreshCw, ExternalLink, Shield, ChevronDown,
  Wifi, WifiOff, Copy, Check,
} from 'lucide-react'
import {
  saveExchangeAccount,
  testExchangeConnection,
  getExchangeAccounts,
  deleteExchangeAccount,
} from '@/app/actions/exchanges'
import { getUserLoginIp } from '@/app/actions/user-session'
import { useSession } from '@/lib/auth-client'
import { SUPPORTED_EXCHANGES } from '@/lib/exchange-constants'

type Account = {
  id: number
  exchange: string
  label: string | null
  apiKey: string
  tradeMode: string
  isActive: boolean | null
  testStatus: string | null
  lastTestedAt: Date | null
  createdAt: Date | null
}

const EXCHANGE_LOGOS: Record<string, string> = {
  binance: '#F0B90B', htx: '#347AF0', bybit: '#F7A600', bitget: '#00CDD7',
  kucoin: '#00D48E', okx: '#000', gateio: '#2354E6', mexc: '#2196F3',
  kraken: '#5741D9', coinbase: '#0052FF', poloniex: '#00C353',
  cryptocom: '#103F68', phemex: '#4E58EF', bingx: '#1DB8E5', lbank: '#FF6600',
}

export function ExchangeConnectionManager() {
  const { data: session } = useSession()
  const [accounts, setAccounts] = useState<Account[]>([])
  const supportedExchanges: Record<string, { name: string; hasPassphrase: boolean; docsUrl: string }> = SUPPORTED_EXCHANGES
  const [loading, setLoading] = useState(true)
  const [userIp, setUserIp] = useState<string | null>(null)
  const [loginTimestamp, setLoginTimestamp] = useState<Date | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; message: string; balances?: Record<string, number> }>>({})
  const [showBalances, setShowBalances] = useState<Record<number, boolean>>({})

  // Form state
  const [form, setForm] = useState({
    exchangeId: '',
    label: '',
    apiKey: '',
    apiSecret: '',
    passphrase: '',
    tradeMode: 'read_only' as 'read_only' | 'live',
  })
  const [showSecret, setShowSecret] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const accs = await getExchangeAccounts()
      setAccounts(accs as Account[])
    } finally {
      setLoading(false)
    }
  }, [])

  // Load user's login IP when session is available
  useEffect(() => {
    const fetchUserIp = async () => {
      try {
        if (session?.user?.id) {
          const ipData = await getUserLoginIp(session.user.id)
          if (ipData) {
            setUserIp(ipData.ip)
            setLoginTimestamp(ipData.timestamp)
          }
        }
      } catch (err) {
        console.error('Failed to load user IP:', err)
      }
    }
    fetchUserIp()
    loadAccounts()
  }, [session?.user?.id, loadAccounts])

  const selectedExchangeMeta = supportedExchanges[form.exchangeId]

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.exchangeId || !form.apiKey || !form.apiSecret) {
      setFormError('Exchange, API Key, and API Secret are required.')
      return
    }
    if (selectedExchangeMeta?.hasPassphrase && !form.passphrase) {
      setFormError('This exchange requires a passphrase.')
      return
    }
    setSaving(true)
    try {
      await saveExchangeAccount({
        exchangeId: form.exchangeId,
        label: form.label || selectedExchangeMeta?.name || form.exchangeId,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
        passphrase: form.passphrase || undefined,
        tradeMode: form.tradeMode,
      })
      setForm({ exchangeId: '', label: '', apiKey: '', apiSecret: '', passphrase: '', tradeMode: 'read_only' })
      setShowForm(false)
      await loadAccounts()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (id: number) => {
    setTestingId(id)
    try {
      const result = await testExchangeConnection(id)
      setTestResults(prev => ({ ...prev, [id]: result }))
      await loadAccounts()
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteExchangeAccount(id)
      setAccounts(prev => prev.filter(a => a.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const copyKey = (key: string, label: string) => {
    copyToClipboard(key)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  const maskKey = (key: string) => key.slice(0, 6) + '••••••••••••' + key.slice(-4)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-white font-bold text-base sm:text-lg">Exchange API Connections</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5 hidden sm:block">Connect exchange accounts to enable live trading and balance monitoring</p>
        </div>
        <Button
          onClick={() => setShowForm(v => !v)}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5 text-xs sm:text-sm shrink-0 px-3 sm:px-4"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Add Exchange
        </Button>
      </div>

      {/* Add Exchange Form */}
      {showForm && (
        <Card className="bg-slate-900 border-amber-500/30 p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Connect New Exchange
            </h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-300 text-xl leading-none">&times;</button>
          </div>

          {/* Security Info — User IP */}
          {userIp && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 flex items-start gap-3">
              <Shield className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-green-300">
                <p className="font-semibold">Secure Connection Detected</p>
                <p className="text-green-300/80 mt-1">
                  Your login IP: <span className="font-mono font-bold">{userIp}</span>
                  {loginTimestamp && (
                    <> • Last login: {new Date(loginTimestamp).toLocaleString()}</>
                  )}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3 sm:space-y-4">
            {/* Exchange picker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Exchange <span className="text-red-400">*</span></label>
                <div className="relative">
                  <select
                    value={form.exchangeId}
                    onChange={e => setForm(f => ({ ...f, exchangeId: e.target.value, label: '' }))}
                    className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50 pr-10"
                    required
                  >
                    <option value="">Select exchange...</option>
                    {Object.entries(supportedExchanges).map(([id, meta]) => (
                      <option key={id} value={id}>{meta.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
                {selectedExchangeMeta && (
                  <a
                    href={selectedExchangeMeta.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 text-xs mt-1 flex items-center gap-1 hover:text-amber-300"
                  >
                    <ExternalLink className="w-3 h-3" /> Get API keys from {selectedExchangeMeta.name}
                  </a>
                )}
              </div>
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Label (optional)</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder={selectedExchangeMeta?.name ?? 'My Account'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">API Key <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="Paste your API key here"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-amber-500/50"
                required
                autoComplete="off"
              />
            </div>

            {/* API Secret */}
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">API Secret <span className="text-red-400">*</span></label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={form.apiSecret}
                  onChange={e => setForm(f => ({ ...f, apiSecret: e.target.value }))}
                  placeholder="Paste your API secret here"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 pr-11 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-amber-500/50"
                  required
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Passphrase — only for exchanges that need it */}
            {selectedExchangeMeta?.hasPassphrase && (
              <div>
                <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">
                  Passphrase <span className="text-red-400">*</span>
                  <span className="text-slate-500 ml-1 normal-case">(required for {selectedExchangeMeta.name})</span>
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.passphrase}
                    onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))}
                    placeholder="Enter passphrase"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 pr-11 text-white placeholder-slate-600 font-mono text-sm focus:outline-none focus:border-amber-500/50"
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Trade Mode */}
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wider mb-2 block">Trade Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {([
                  { value: 'read_only', label: 'Read Only', desc: 'View balances and prices. No orders placed.', icon: Eye, color: 'border-blue-500/40 bg-blue-500/5 text-blue-400' },
                  { value: 'live', label: 'Live Trading', desc: 'Place real orders. Use with caution.', icon: Zap, color: 'border-amber-500/40 bg-amber-500/5 text-amber-400' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tradeMode: opt.value }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      form.tradeMode === opt.value ? opt.color : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <opt.icon className={`w-4 h-4 mb-1 ${form.tradeMode === opt.value ? '' : 'text-slate-500'}`} />
                    <p className={`text-sm font-semibold ${form.tradeMode === opt.value ? '' : 'text-slate-300'}`}>{opt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-tight">{opt.desc}</p>
                  </button>
                ))}
              </div>
              {form.tradeMode === 'live' && (
                <p className="text-amber-400/80 text-xs mt-2 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  Live mode will place real orders with real funds. Ensure your API key has trading permissions and IP whitelisting is configured.
                </p>
              )}
            </div>

            {formError && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{formError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="border border-slate-700 text-slate-300 hover:bg-slate-800">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-2">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save & Connect'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Connected Accounts List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 p-12 text-center">
          <WifiOff className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-base">No exchanges connected</p>
          <p className="text-slate-600 text-sm mt-1">Add an exchange account to start live trading or monitoring balances.</p>
          <Button onClick={() => setShowForm(true)} className="mt-4 bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2">
            <Plus className="w-4 h-4" /> Connect First Exchange
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => {
            const meta = supportedExchanges[acc.exchange]
            const color = EXCHANGE_LOGOS[acc.exchange] ?? '#888'
            const isLive = acc.tradeMode === 'live'
            const testResult = testResults[acc.id]
            const lastTest = acc.testStatus

            return (
              <Card key={acc.id} className="bg-slate-900 border-slate-800 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  {/* Left: info */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Exchange dot */}
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-black border border-slate-700"
                      style={{ background: `${color}18`, color }}>
                      {(meta?.name ?? acc.exchange).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-white font-bold text-sm">{acc.label ?? meta?.name ?? acc.exchange}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${
                          isLive ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                        }`}>
                          {isLive ? <Zap className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {isLive ? 'Live' : 'Read Only'}
                        </span>
                        {lastTest === 'ok' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400">
                            <Wifi className="w-3 h-3" /> Connected
                          </span>
                        )}
                        {lastTest && lastTest !== 'ok' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400">
                            <WifiOff className="w-3 h-3" /> Error
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-slate-500 text-xs font-mono truncate max-w-[140px] sm:max-w-none">{maskKey(acc.apiKey)}</span>
                        <button onClick={() => copyKey(acc.apiKey, `key-${acc.id}`)} className="text-slate-600 hover:text-slate-400 transition-colors shrink-0">
                          {copied === `key-${acc.id}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      {acc.lastTestedAt && (
                        <p className="text-slate-600 text-xs mt-0.5 hidden sm:block">
                          Last tested: {new Date(acc.lastTestedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTest(acc.id)}
                      disabled={testingId === acc.id}
                      className="border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white gap-1 px-2 sm:px-3 text-xs sm:text-sm"
                    >
                      {testingId === acc.id
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Zap className="w-3.5 h-3.5" />}
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(acc.id)}
                      disabled={deletingId === acc.id}
                      className="border border-red-900/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-2 sm:px-3"
                    >
                      {deletingId === acc.id
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Test result */}
                {testResult && (
                  <div className={`mt-3 rounded-lg px-3 py-2 border text-sm flex items-start gap-2 ${
                    testResult.ok
                      ? 'bg-green-500/10 border-green-500/20 text-green-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-300'
                  }`}>
                    {testResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p>{testResult.message}</p>
                      {testResult.ok && testResult.balances && Object.keys(testResult.balances).length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => setShowBalances(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                            className="text-green-400 text-xs underline underline-offset-2"
                          >
                            {showBalances[acc.id] ? 'Hide' : 'Show'} balances ({Object.keys(testResult.balances).length} coins)
                          </button>
                          {showBalances[acc.id] && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(testResult.balances).slice(0, 20).map(([coin, amt]) => (
                                <span key={coin} className="px-2 py-0.5 bg-green-500/10 rounded text-xs font-mono">
                                  {coin}: {Number(amt).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Previous error from DB */}
                {!testResult && lastTest && lastTest !== 'ok' && (
                  <p className="mt-2 text-xs text-red-400/70 font-mono truncate">{lastTest}</p>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Security note */}
      <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-slate-300 text-sm font-semibold">API Key Security</p>
          <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
            Keys are stored encrypted. Create API keys with IP whitelisting and disable withdrawal permissions unless needed. Never share your secret keys.
          </p>
        </div>
      </div>
    </div>
  )
}
