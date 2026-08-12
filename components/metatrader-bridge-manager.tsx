'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus, Trash2, Zap, CheckCircle2, XCircle, Eye,
  RefreshCw, Wifi, WifiOff, Cpu, Clock,
} from 'lucide-react'
import { getMyMetaTraderAccounts, testMetaTraderConnection, deleteMetaTraderAccount } from '@/app/actions/metatrader'
import { MetaTraderConnectWizard } from '@/components/metatrader-connect-wizard'

type Account = Awaited<ReturnType<typeof getMyMetaTraderAccounts>>[number]

export function MetaTraderBridgeManager() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; message: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const accs = await getMyMetaTraderAccounts()
      setAccounts(accs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleTest = async (id: number) => {
    setTestingId(id)
    try {
      const result = await testMetaTraderConnection(id)
      setTestResults(prev => ({ ...prev, [id]: result }))
      await load()
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteMetaTraderAccount(id)
      setAccounts(prev => prev.filter(a => a.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-white font-bold text-base sm:text-lg flex items-center gap-2">
            <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            MetaTrader 4 & 5 Bridge
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5 hidden sm:block">Connect a broker account to run the MT4/MT5 Forex Bot</p>
        </div>
        <Button
          onClick={() => setShowWizard(true)}
          className="bg-blue-500 hover:bg-blue-400 text-white font-semibold gap-1.5 text-xs sm:text-sm shrink-0 px-3 sm:px-4"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Connect MT4/MT5
        </Button>
      </div>

      {/* Accounts list */}
      {loading ? (
        <div className="space-y-3">
          {[1].map(i => (
            <div key={i} className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 p-12 text-center">
          <WifiOff className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-base">No MetaTrader accounts connected</p>
          <p className="text-slate-600 text-sm mt-1">Connect a broker account to run forex, metals and index strategies with the MT4/MT5 bot.</p>
          <Button onClick={() => setShowWizard(true)} className="mt-4 bg-blue-500 hover:bg-blue-400 text-white font-semibold gap-2">
            <Plus className="w-4 h-4" /> Connect MT4/MT5 Account
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => {
            const isLive = acc.tradeMode === 'live'
            const testResult = testResults[acc.id]
            const lastTest = acc.testStatus

            return (
              <Card key={acc.id} className="bg-slate-900 border-slate-800 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center border border-blue-500/20 bg-blue-500/10">
                      <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-white font-bold text-sm">{acc.label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 uppercase">
                          {acc.exchange}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border ${
                          isLive ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                        }`}>
                          {isLive ? <Zap className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {isLive ? 'Live' : 'Monitor Only'}
                        </span>
                        {lastTest === 'ok' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border border-green-500/30 bg-green-500/10 text-green-400">
                            <Wifi className="w-3 h-3" /> Verified
                          </span>
                        )}
                        {!lastTest && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border border-slate-700 bg-slate-800/60 text-slate-500">
                            <Clock className="w-3 h-3" /> Pending EA Attachment
                          </span>
                        )}
                        {lastTest && lastTest !== 'ok' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400">
                            <WifiOff className="w-3 h-3" /> Error
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs font-mono mt-1">Login {acc.apiKey} • Server {acc.passphrase}</p>
                      {acc.lastTestedAt && (
                        <p className="text-slate-600 text-xs mt-0.5 hidden sm:block">
                          Last checked: {new Date(acc.lastTestedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

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
                      Verify
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

                {testResult && (
                  <div className={`mt-3 rounded-lg px-3 py-2 border text-sm flex items-start gap-2 ${
                    testResult.ok
                      ? 'bg-green-500/10 border-green-500/20 text-green-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-300'
                  }`}>
                    {testResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <p className="leading-relaxed">{testResult.message}</p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Guidance note */}
      <div className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-slate-300 text-sm font-semibold">How MetaTrader Bridging Works</p>
          <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
            MT4/MT5 has no public REST API, so bot signals reach your account through a small Expert Advisor (EA)
            attached to a chart in your terminal. The connect wizard walks you through enabling Algo Trading and
            attaching the EA. Your terminal must stay open and connected for signals to execute.
          </p>
        </div>
      </div>

      {showWizard && (
        <MetaTraderConnectWizard
          onClose={() => setShowWizard(false)}
          onConnected={load}
        />
      )}
    </div>
  )
}
