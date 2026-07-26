'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import {
  Zap, RefreshCw, Settings, Play, Pause, ChevronDown, ChevronUp,
  ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock,
  DollarSign, TrendingUp, Send, Loader2, ChevronRight,
  Target, BarChart3, Wifi, Network, ShieldCheck, Copy, Check,
} from 'lucide-react'
import {
  getSniperBotConfig, saveSniperBotConfig, grabLiveOpportunities,
  getDepositAddress, executeExchangeTransfer,
  SniperBotConfig, ScoredOpportunity,
} from '@/app/actions/admin-arbitrage'

// ─── Exchange helpers ─────────────────────────────────────────────────────────

const EX_ABBR: Record<string, string> = {
  binance:'BN', kraken:'KR', coinbase:'CB', bybit:'BB', kucoin:'KC',
  htx:'HT', bitfinex:'BFX', okx:'OKX', gateio:'GT', gemini:'GM',
  cryptocom:'CDC', bitget:'BG',
}
const EX_COLOR: Record<string, string> = {
  binance:'text-yellow-400', kraken:'text-purple-400', coinbase:'text-blue-400',
  bybit:'text-orange-400', kucoin:'text-green-400', htx:'text-cyan-400',
  bitfinex:'text-emerald-400', okx:'text-slate-300', gateio:'text-red-400',
  gemini:'text-sky-400', cryptocom:'text-indigo-400', bitget:'text-teal-400',
}

function ExBadge({ exchange }: { exchange: string }) {
  const k = exchange.toLowerCase().replace(/[\s.]/g, '')
  return (
    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 ${EX_COLOR[k] ?? 'text-slate-300'}`}>
      {EX_ABBR[k] ?? exchange.slice(0,3).toUpperCase()}
    </span>
  )
}

// Score bar coloring
function scoreColor(s: number) {
  if (s >= 70) return 'bg-green-500'
  if (s >= 45) return 'bg-amber-500'
  return 'bg-red-500'
}
function scoreBg(s: number) {
  if (s >= 70) return 'border-green-500/30 bg-green-500/5'
  if (s >= 45) return 'border-amber-500/30 bg-amber-500/5'
  return 'border-red-500/20 bg-red-500/5'
}
function scoreText(s: number) {
  if (s >= 70) return 'text-green-400'
  if (s >= 45) return 'text-amber-400'
  return 'text-red-400'
}

const ALL_NETWORKS = ['TRC20','BEP20','ERC20','SOL','BTC','AVAX','XRP']
const ALL_COINS    = ['USDT','SOL','BNB','XRP','TRX','ETH','BTC','ADA','AVAX','MATIC']

// ─── Transfer Wizard ──────────────────────────────────────────────────────────

interface WizardProps {
  opp: ScoredOpportunity
  onClose: () => void
  onSuccess: (txId: string) => void
}

function TransferWizard({ opp, onClose, onSuccess }: WizardProps) {
  const [step, setStep]           = useState<1 | 2 | 3>(1)
  const [network, setNetwork]     = useState(opp.suggestedNetwork)
  const [amount, setAmount]       = useState(String(opp.suggestedAmount))
  const [toAddress, setToAddress] = useState('')
  const [memo, setMemo]           = useState('')
  const [fetchingAddr, setFetchingAddr] = useState(false)
  const [addrError, setAddrError]       = useState<string | null>(null)
  const [executing, setExecuting]       = useState(false)
  const [execResult, setExecResult]     = useState<{ success: boolean; txId?: string; message: string } | null>(null)
  const [copied, setCopied]             = useState(false)

  const fetchAddress = useCallback(async () => {
    setFetchingAddr(true)
    setAddrError(null)
    const res = await getDepositAddress(opp.sellExchange, opp.symbol, network)
    setFetchingAddr(false)
    if (res.address) {
      setToAddress(res.address)
      if (res.memo) setMemo(res.memo)
    } else {
      setAddrError(res.error ?? 'Could not fetch deposit address')
    }
  }, [opp.sellExchange, opp.symbol, network])

  // Auto-fetch on step 2
  useEffect(() => { if (step === 2 && !toAddress) fetchAddress() }, [step, toAddress, fetchAddress])

  const handleExecute = async () => {
    setExecuting(true)
    const res = await executeExchangeTransfer({
      fromExchange: opp.buyExchange,
      toExchange:   opp.sellExchange,
      symbol:       opp.symbol,
      network,
      amount:       parseFloat(amount),
      toAddress,
      memo:         memo || undefined,
    })
    setExecuting(false)
    setExecResult(res)
    setStep(3)
    if (res.success && res.txId) onSuccess(res.txId)
  }

  const copyAddr = () => {
    navigator.clipboard.writeText(toAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const feeRows = [
    { label: 'Buy fee',        usd: opp.tradingFeeBuyUsd  },
    { label: 'Sell fee',       usd: opp.tradingFeeSellUsd },
    { label: 'Withdrawal fee', usd: opp.withdrawalFeeUsd  },
    { label: 'Network fee',    usd: opp.networkFeeUsd     },
    { label: 'Slippage est.',  usd: opp.slippageUsd       },
    { label: 'Safety buffer',  usd: opp.safetyBufferUsd   },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <Card className="bg-[#0D1117] border-slate-700 w-full max-w-lg overflow-hidden">

        {/* Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Transfer Wizard — {opp.symbol}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <ExBadge exchange={opp.buyExchange} />
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <ExBadge exchange={opp.sellExchange} />
              <span className="text-[10px] text-slate-500 ml-1">
                Est. net <span className="text-green-400 font-bold">+${opp.netProfitUsd.toFixed(2)}</span>
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none p-1">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 py-3 border-b border-slate-800">
          {(['Review', 'Transfer Details', 'Confirm & Execute'] as const).map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3
            const active = step === n
            const done   = step > n
            return (
              <div key={label} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                  active ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                  done   ? 'text-green-400' : 'text-slate-600'
                }`}>
                  {done ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px]">{n}</span>}
                  {label}
                </div>
                {i < 2 && <ChevronRight className="w-3 h-3 text-slate-700 mx-1" />}
              </div>
            )
          })}
        </div>

        {/* Step 1 — Review cost breakdown */}
        {step === 1 && (
          <div className="px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                <p className="text-[10px] text-slate-500">Gross Spread</p>
                <p className="text-amber-400 font-bold text-base mt-0.5">+{opp.grossSpreadPct.toFixed(3)}%</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-[10px] text-slate-500">Est. Net Profit</p>
                <p className="text-green-400 font-bold text-base mt-0.5">+${opp.netProfitUsd.toFixed(2)} ({opp.netProfitPct.toFixed(3)}%)</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Full Cost Breakdown</p>
              <div className="rounded-lg border border-slate-800 overflow-hidden">
                {feeRows.map((r, i) => (
                  <div key={r.label} className={`flex items-center justify-between px-3 py-2 text-xs ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}`}>
                    <span className="text-slate-400">{r.label}</span>
                    <span className="text-red-400 font-mono">-${r.usd.toFixed(4)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-t border-slate-700">
                  <span className="text-white font-semibold text-xs">Total Costs</span>
                  <span className="text-red-400 font-mono font-bold text-xs">-${opp.totalCostsUsd.toFixed(4)}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Buy on</span><span className="text-white font-semibold">{opp.buyExchange} @ ${opp.buyPrice.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sell on</span><span className="text-white font-semibold">{opp.sellExchange} @ ${opp.sellPrice.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Network</span><span className="text-cyan-400 font-mono">{opp.suggestedNetwork}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Est. transfer</span><span className="text-white">{opp.estimatedTransferMin} min</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Score</span><span className={`font-bold ${scoreText(opp.score)}`}>{opp.score}/100</span></div>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-lg text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={() => setStep(2)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-sm transition-colors">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Transfer Details */}
        {step === 2 && (
          <div className="px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-800 rounded-lg border border-slate-700">
                <p className="text-[10px] text-slate-500 mb-0.5">From (Withdraw)</p>
                <div className="flex items-center gap-1.5"><ExBadge exchange={opp.buyExchange} /><span className="text-white text-xs font-semibold">{opp.buyExchange}</span></div>
              </div>
              <div className="p-2.5 bg-slate-800 rounded-lg border border-slate-700">
                <p className="text-[10px] text-slate-500 mb-0.5">To (Deposit)</p>
                <div className="flex items-center gap-1.5"><ExBadge exchange={opp.sellExchange} /><span className="text-white text-xs font-semibold">{opp.sellExchange}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Coin</label>
                <div className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-bold">{opp.symbol}</div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Network</label>
                <select value={network} onChange={e => { setNetwork(e.target.value); setToAddress(''); setAddrError(null) }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-cyan-500/50">
                  {ALL_NETWORKS.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Amount ({opp.symbol})</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm font-mono focus:outline-none focus:border-cyan-500/50" />
              <p className="text-[10px] text-slate-600 mt-0.5">Approx. ${(parseFloat(amount || '0') * opp.buyPrice).toFixed(2)} USD</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-500">Destination Address ({opp.sellExchange})</label>
                <button onClick={fetchAddress} disabled={fetchingAddr}
                  className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 ${fetchingAddr ? 'animate-spin' : ''}`} />
                  {fetchingAddr ? 'Fetching...' : 'Auto-fetch'}
                </button>
              </div>
              <div className="relative">
                <input value={toAddress} onChange={e => setToAddress(e.target.value)}
                  placeholder="Paste address or use Auto-fetch..."
                  className="w-full px-3 py-2.5 pr-10 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500/50" />
                {toAddress && (
                  <button onClick={copyAddr} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {addrError && <p className="text-red-400 text-[10px] mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{addrError}</p>}
              {fetchingAddr && <p className="text-cyan-400 text-[10px] mt-1">Fetching deposit address from {opp.sellExchange} API...</p>}
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Memo / Tag <span className="text-slate-600">(optional — required for XRP, XLM, etc.)</span></label>
              <input value={memo} onChange={e => setMemo(e.target.value)}
                placeholder="Destination tag or memo..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs focus:outline-none focus:border-cyan-500/50" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-lg text-sm hover:text-white transition-colors">Back</button>
              <button onClick={() => setStep(3)} disabled={!toAddress}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition-colors">
                Review <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Confirm & Execute */}
        {step === 3 && !execResult && (
          <div className="px-5 py-4 space-y-3">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
              <p className="text-amber-300 font-bold text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4" />Final Confirmation</p>
              <p className="text-slate-400 text-xs">This will execute a real withdrawal from <span className="text-white font-semibold">{opp.buyExchange}</span> and send funds to <span className="text-white font-semibold">{opp.sellExchange}</span>. This action cannot be undone.</p>
            </div>
            <div className="rounded-lg border border-slate-800 overflow-hidden text-xs">
              {[
                { k: 'Coin',         v: opp.symbol },
                { k: 'Network',      v: network, mono: true },
                { k: 'Amount',       v: `${amount} ${opp.symbol}` },
                { k: 'From',         v: opp.buyExchange },
                { k: 'To',           v: opp.sellExchange },
                { k: 'Address',      v: `${toAddress.slice(0,14)}...${toAddress.slice(-6)}`, mono: true },
                { k: 'Memo/Tag',     v: memo || '—' },
                { k: 'Est. profit',  v: `+$${opp.netProfitUsd.toFixed(2)}`, green: true },
              ].map((row, i) => (
                <div key={row.k} className={`flex justify-between px-3 py-2 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/60'}`}>
                  <span className="text-slate-500">{row.k}</span>
                  <span className={`font-semibold ${row.green ? 'text-green-400' : 'text-white'} ${row.mono ? 'font-mono' : ''}`}>{row.v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} disabled={executing} className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-lg text-sm hover:text-white transition-colors disabled:opacity-50">Back</button>
              <button onClick={handleExecute} disabled={executing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-colors">
                {executing ? <><Loader2 className="w-4 h-4 animate-spin" />Executing...</> : <><Zap className="w-4 h-4" />Execute Transfer</>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Result */}
        {step === 3 && execResult && (
          <div className="px-5 py-6 text-center space-y-4">
            {execResult.success ? (
              <>
                <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-base">Transfer Submitted</p>
                  <p className="text-slate-400 text-xs mt-1">{execResult.message}</p>
                  {execResult.txId && (
                    <p className="text-cyan-400 font-mono text-[11px] mt-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 inline-block">{execResult.txId}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto">
                  <XCircle className="w-7 h-7 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-base">Transfer Failed</p>
                  <p className="text-red-400 text-xs mt-1">{execResult.message}</p>
                </div>
              </>
            )}
            <button onClick={onClose} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">Close</button>
          </div>
        )}

      </Card>
    </div>
  )
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  config: SniperBotConfig
  onChange: (cfg: Partial<SniperBotConfig>) => void
  onSave: () => void
  saving: boolean
}

function ConfigPanel({ config, onChange, onSave, saving }: ConfigPanelProps) {
  const toggleNetwork = (n: string) =>
    onChange({ preferredNetworks: config.preferredNetworks.includes(n) ? config.preferredNetworks.filter(x => x !== n) : [...config.preferredNetworks, n] })
  const toggleCoin = (c: string) =>
    onChange({ preferredCoins: config.preferredCoins.includes(c) ? config.preferredCoins.filter(x => x !== c) : [...config.preferredCoins, c] })

  return (
    <Card className="bg-slate-900 border-slate-800 p-5 space-y-5">
      <p className="text-white font-bold text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-cyan-400" />Sniper Bot Configuration</p>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Trade Amount (USD)', key: 'tradeAmountUsd', min: 50, step: 50 },
          { label: 'Min Net Profit (%)', key: 'minNetProfitPct', min: 0.05, step: 0.05 },
          { label: 'Min Net Profit (USD)', key: 'minNetProfitUsd', min: 0.5, step: 0.5 },
          { label: 'Max Transfer (min)', key: 'maxTransferMin', min: 1, step: 1 },
          { label: 'Cooldown (sec)', key: 'cooldownSeconds', min: 5, step: 5 },
          { label: 'Max Concurrent Grabs', key: 'maxConcurrentGrabs', min: 1, step: 1 },
        ].map(f => (
          <div key={f.key}>
            <label className="text-[10px] text-slate-500 mb-1 block">{f.label}</label>
            <input type="number" min={f.min} step={f.step}
              value={(config as Record<string,unknown>)[f.key] as number}
              onChange={e => onChange({ [f.key]: parseFloat(e.target.value) } as Partial<SniperBotConfig>)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500/50" />
          </div>
        ))}
      </div>

      {/* Scoring weights */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Scoring Weights (0–10)</p>
        <div className="space-y-2">
          {[
            { label: 'Net Profit Weight', key: 'netProfit' },
            { label: 'Transfer Speed Weight', key: 'transferSpeed' },
            { label: 'Fee Efficiency Weight', key: 'feeEfficiency' },
          ].map(w => (
            <div key={w.key} className="flex items-center gap-3">
              <span className="text-slate-400 text-xs w-40 shrink-0">{w.label}</span>
              <input type="range" min={0} max={10} step={1}
                value={(config.scoringWeights as Record<string,number>)[w.key]}
                onChange={e => onChange({ scoringWeights: { ...config.scoringWeights, [w.key]: parseInt(e.target.value) } })}
                className="flex-1 accent-cyan-500" />
              <span className="text-cyan-400 font-bold text-xs w-4 text-right">{(config.scoringWeights as Record<string,number>)[w.key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Networks */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Preferred Networks</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_NETWORKS.map(n => (
            <button key={n} onClick={() => toggleNetwork(n)}
              className={`px-2.5 py-1 rounded border text-[10px] font-semibold transition-colors ${
                config.preferredNetworks.includes(n)
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}>{n}</button>
          ))}
        </div>
      </div>

      {/* Coins */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Preferred Coins</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_COINS.map(c => (
            <button key={c} onClick={() => toggleCoin(c)}
              className={`px-2.5 py-1 rounded border text-[10px] font-semibold transition-colors ${
                config.preferredCoins.includes(c)
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700">
        <div>
          <p className="text-white text-xs font-semibold">Auto-Execute</p>
          <p className="text-slate-500 text-[10px] mt-0.5">Grab top opportunity automatically without confirmation</p>
        </div>
        <button onClick={() => onChange({ autoExecute: !config.autoExecute })}
          className={`px-3 py-1 rounded border text-[10px] font-bold transition-colors ${
            config.autoExecute ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-slate-700 border-slate-600 text-slate-400'
          }`}>
          {config.autoExecute ? 'ON' : 'OFF'}
        </button>
      </div>

      <button onClick={onSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-colors">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save Configuration'}
      </button>
    </Card>
  )
}

// ─── Opportunity Card ─────────────────────────────────────────────────────────

function OpportunityCard({ opp, onGrab, grabbed }: { opp: ScoredOpportunity; onGrab: () => void; grabbed: boolean }) {
  return (
    <Card className={`border transition-all duration-200 overflow-hidden ${grabbed ? 'opacity-50 border-slate-700' : scoreBg(opp.score)}`}>
      <div className={`h-0.5 w-full ${grabbed ? 'bg-slate-700' : scoreColor(opp.score)}`} />

      <div className="p-4 space-y-3">
        {/* Top row: coin + score + profit */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-base">{opp.symbol}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                opp.score >= 70 ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : opp.score >= 45 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>{opp.score}/100</span>
              {grabbed && <span className="text-[10px] text-slate-500 italic">grabbed</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <ExBadge exchange={opp.buyExchange} />
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <ExBadge exchange={opp.sellExchange} />
              <span className="text-[10px] text-slate-500 ml-1">via</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">{opp.suggestedNetwork}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-green-400 font-black text-base">+${opp.netProfitUsd.toFixed(2)}</p>
            <p className="text-green-400/70 text-[10px] font-semibold">+{opp.netProfitPct.toFixed(3)}%</p>
          </div>
        </div>

        {/* Score breakdown bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] text-slate-600">
            <span>Profit</span><span>Speed</span><span>Fees</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { v: opp.scoreBreakdown.profitScore, label: 'Profit' },
              { v: opp.scoreBreakdown.speedScore,  label: 'Speed'  },
              { v: opp.scoreBreakdown.feeScore,    label: 'Fees'   },
            ].map(s => (
              <div key={s.label} className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${scoreColor(s.v)}`} style={{ width: `${s.v}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Prices + key stats */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="p-1.5 bg-slate-800/60 rounded border border-slate-700">
            <p className="text-slate-600">Buy</p>
            <p className="text-white font-mono font-semibold">${opp.buyPrice.toFixed(4)}</p>
          </div>
          <div className="p-1.5 bg-slate-800/60 rounded border border-slate-700">
            <p className="text-slate-600">Sell</p>
            <p className="text-white font-mono font-semibold">${opp.sellPrice.toFixed(4)}</p>
          </div>
          <div className="p-1.5 bg-slate-800/60 rounded border border-slate-700">
            <p className="text-slate-600">Spread</p>
            <p className="text-amber-400 font-mono font-semibold">+{opp.grossSpreadPct.toFixed(3)}%</p>
          </div>
          <div className="p-1.5 bg-slate-800/60 rounded border border-slate-700">
            <p className="text-slate-600">Total Fees</p>
            <p className="text-red-400 font-mono">-${opp.totalCostsUsd.toFixed(2)}</p>
          </div>
          <div className="p-1.5 bg-slate-800/60 rounded border border-slate-700">
            <p className="text-slate-600">Transfer</p>
            <p className="text-white flex items-center gap-0.5"><Clock className="w-2.5 h-2.5 text-slate-500" />{opp.estimatedTransferMin}m</p>
          </div>
          <div className="p-1.5 bg-slate-800/60 rounded border border-slate-700">
            <p className="text-slate-600">Amount</p>
            <p className="text-white font-mono">${opp.suggestedAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* Blockers or ready */}
        {opp.blockers.length > 0 ? (
          <div className="space-y-1">
            {opp.blockers.map(b => (
              <div key={b} className="flex items-center gap-1.5 text-[10px] text-red-400">
                <XCircle className="w-3 h-3 shrink-0" />{b}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-green-400">
            <CheckCircle2 className="w-3 h-3" />All pre-checks passed — ready to grab
          </div>
        )}

        {/* Grab button */}
        <button
          onClick={onGrab}
          disabled={grabbed || opp.blockers.length > 0}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-xs transition-all ${
            grabbed
              ? 'bg-slate-800 border border-slate-700 text-slate-600 cursor-not-allowed'
              : opp.blockers.length > 0
              ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          {grabbed ? 'Grabbed' : opp.blockers.length > 0 ? 'Blocked' : 'Grab This Opportunity'}
        </button>

        <p className="text-[9px] text-slate-700 text-right">
          {new Date(opp.detectedAt).toLocaleTimeString()}
        </p>
      </div>
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SniperBotTab() {
  const [config, setConfig]           = useState<SniperBotConfig | null>(null)
  const [localConfig, setLocalConfig] = useState<SniperBotConfig | null>(null)
  const [opps, setOpps]               = useState<ScoredOpportunity[]>([])
  const [scanning, setScanning]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [showConfig, setShowConfig]   = useState(false)
  const [activeWizard, setActiveWizard] = useState<ScoredOpportunity | null>(null)
  const [grabbedIds, setGrabbedIds]   = useState<Set<string>>(new Set())
  const [successIds, setSuccessIds]   = useState<Record<string, string>>({})
  const [lastScan, setLastScan]       = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshSec, setRefreshSec]   = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [stats, setStats] = useState({ grabs: 0, profit: 0, winRate: 100 })

  // Load config on mount
  useEffect(() => {
    getSniperBotConfig().then(cfg => { setConfig(cfg); setLocalConfig(cfg) })
  }, [])

  const runScan = useCallback(async () => {
    if (!localConfig) return
    setScanning(true)
    try {
      const results = await grabLiveOpportunities(localConfig)
      setOpps(results)
      setLastScan(new Date().toLocaleTimeString())
    } finally {
      setScanning(false)
    }
  }, [localConfig])

  // Auto-refresh ticker
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh && localConfig) {
      timerRef.current = setInterval(runScan, refreshSec * 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, refreshSec, runScan, localConfig])

  const handleSaveConfig = async () => {
    if (!localConfig) return
    setSaving(true)
    await saveSniperBotConfig(localConfig)
    setConfig(localConfig)
    setSaving(false)
  }

  const handleToggleBot = async () => {
    if (!localConfig) return
    const next = { ...localConfig, enabled: !localConfig.enabled }
    setLocalConfig(next)
    await saveSniperBotConfig({ enabled: next.enabled })
    setConfig(next)
  }

  const handleSuccess = (oppId: string, txId: string) => {
    setGrabbedIds(prev => new Set([...prev, oppId]))
    setSuccessIds(prev => ({ ...prev, [oppId]: txId }))
    setStats(s => ({ ...s, grabs: s.grabs + 1, profit: s.profit + (opps.find(o => o.id === oppId)?.netProfitUsd ?? 0) }))
  }

  const ready  = opps.filter(o => o.readyToGrab).length
  const top    = opps[0]

  if (!localConfig) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        <span className="text-slate-400 text-sm ml-3">Loading Bot 2...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Transfer Wizard overlay */}
      {activeWizard && (
        <TransferWizard
          opp={activeWizard}
          onClose={() => setActiveWizard(null)}
          onSuccess={txId => { handleSuccess(activeWizard.id, txId); setActiveWizard(null) }}
        />
      )}

      {/* ── Status Bar ─────────────────────────────────────────────────────── */}
      <Card className={`border p-4 ${localConfig.enabled ? 'bg-slate-900 border-cyan-500/30' : 'bg-slate-900 border-slate-800'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${localConfig.enabled ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-slate-800 border-slate-700'}`}>
              <Target className={`w-5 h-5 ${localConfig.enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">Bot 2 — Live Sniper</span>
                {localConfig.enabled
                  ? <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />ACTIVE</span>
                  : <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500 font-bold">PAUSED</span>
                }
              </div>
              <p className="text-slate-500 text-[10px] mt-0.5">Alt-coin arbitrage scanner with 1-click transfer execution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleToggleBot}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                localConfig.enabled
                  ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                  : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
              }`}>
              {localConfig.enabled ? <><Pause className="w-3.5 h-3.5" />Pause</> : <><Play className="w-3.5 h-3.5" />Activate</>}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[
            { icon: Zap,       label: 'Grabs Today',  value: stats.grabs.toString(),                    color: 'text-cyan-400'   },
            { icon: DollarSign,label: 'Session Profit',value: `$${stats.profit.toFixed(2)}`,             color: 'text-green-400'  },
            { icon: BarChart3, label: 'Opportunities', value: opps.length.toString(),                    color: 'text-amber-400'  },
            { icon: ShieldCheck,label: 'Ready to Grab',value: ready.toString(),                          color: ready > 0 ? 'text-green-400' : 'text-slate-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
              <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
              <div>
                <p className="text-[9px] text-slate-500">{s.label}</p>
                <p className={`text-sm font-bold leading-none mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Scan Controls ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={runScan} disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold rounded-lg text-xs transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning...' : 'Scan Now'}
        </button>

        <button onClick={() => setAutoRefresh(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            autoRefresh ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}>
          <Wifi className="w-3.5 h-3.5" />
          {autoRefresh ? `Auto: ${refreshSec}s` : 'Auto-Refresh'}
        </button>

        {autoRefresh && (
          <select value={refreshSec} onChange={e => setRefreshSec(parseInt(e.target.value))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs focus:outline-none">
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
            <option value={120}>2min</option>
          </select>
        )}

        {lastScan && <span className="text-[10px] text-slate-500 flex items-center gap-1 ml-2"><Clock className="w-3 h-3" />Last scan: {lastScan}</span>}

        <button onClick={() => setShowConfig(p => !p)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white text-xs rounded-lg transition-colors">
          <Settings className="w-3.5 h-3.5" />
          Config
          {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* ── Config Panel (collapsible) ─────────────────────────────────────── */}
      {showConfig && (
        <ConfigPanel
          config={localConfig}
          onChange={patch => setLocalConfig(p => p ? { ...p, ...patch, scoringWeights: { ...p.scoringWeights, ...(patch.scoringWeights ?? {}) } } : p)}
          onSave={handleSaveConfig}
          saving={saving}
        />
      )}

      {/* ── Top Opportunity Banner ─────────────────────────────────────────── */}
      {top && !grabbedIds.has(top.id) && top.readyToGrab && (
        <Card className="bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border-cyan-500/40 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] text-cyan-400 font-semibold">TOP OPPORTUNITY</p>
                <p className="text-white font-bold text-sm">{top.symbol} — Score {top.score}/100</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ExBadge exchange={top.buyExchange} />
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <ExBadge exchange={top.sellExchange} />
                  <span className="text-green-400 font-bold text-xs ml-1">+${top.netProfitUsd.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setActiveWizard(top)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg text-xs transition-all shadow-lg shadow-cyan-500/20">
              <Zap className="w-3.5 h-3.5" />Grab &amp; Transfer
            </button>
          </div>
        </Card>
      )}

      {/* ── Opportunities Grid ─────────────────────────────────────────────── */}
      {opps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opps.map(opp => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              grabbed={grabbedIds.has(opp.id)}
              onGrab={() => setActiveWizard(opp)}
            />
          ))}
        </div>
      ) : (
        <Card className="bg-slate-900 border-slate-800 p-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-slate-700 flex items-center justify-center">
                <Target className="w-7 h-7 text-slate-600" />
              </div>
              {scanning && (
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/50 animate-ping" />
              )}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{scanning ? 'Scanning exchanges...' : 'No opportunities yet'}</p>
              <p className="text-slate-500 text-xs mt-1">
                {scanning ? 'Querying price feeds across all configured exchanges' : 'Click "Scan Now" to search for live altcoin arbitrage opportunities'}
              </p>
            </div>
            {!scanning && (
              <button onClick={runScan}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />Scan Now
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── Network Legend ─────────────────────────────────────────────────── */}
      {opps.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 p-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Network className="w-3 h-3" />Transfer Network Reference</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { net: 'TRC20',  fee: '$1.00',  time: '2m',  desc: 'TRON — best for USDT' },
              { net: 'BEP20',  fee: '$0.50',  time: '3m',  desc: 'BSC — cheap, fast'    },
              { net: 'SOL',    fee: '$0.01',  time: '1m',  desc: 'Solana — ultra fast'  },
              { net: 'ERC20',  fee: '$5.00',  time: '8m',  desc: 'Ethereum — expensive' },
              { net: 'BTC',    fee: '$3.00',  time: '30m', desc: 'Bitcoin native'        },
              { net: 'AVAX',   fee: '$0.50',  time: '2m',  desc: 'Avalanche — fast'     },
              { net: 'XRP',    fee: '$0.01',  time: '1m',  desc: 'Ripple — requires tag' },
            ].map(n => (
              <div key={n.net} className="p-2.5 bg-slate-800 rounded border border-slate-700">
                <p className="text-cyan-400 font-mono text-xs font-bold">{n.net}</p>
                <p className="text-slate-400 text-[10px] mt-0.5">{n.desc}</p>
                <div className="flex justify-between mt-1.5">
                  <span className="text-red-400 text-[9px]">{n.fee}</span>
                  <span className="text-slate-500 text-[9px] flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{n.time}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  )
}
