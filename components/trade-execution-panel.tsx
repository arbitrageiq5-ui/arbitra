'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowRightLeft, TrendingUp, TrendingDown, Clock, CheckCircle2,
  XCircle, AlertCircle, RefreshCw, Zap, ArrowRight, Eye,
  ChevronDown, FileText,
} from 'lucide-react'
import {
  getExchangeAccounts,
  placeTradeOrder,
  transferBetweenExchanges,
  getTradeHistory,
} from '@/app/actions/exchanges'

type Account = { id: number; exchange: string; label: string | null; tradeMode: string }
type TradeOrder = {
  id: number
  symbol: string
  side: string
  orderType: string
  amount: string | null
  price: string | null
  filled: string | null
  cost: string | null
  fee: string | null
  exchange: string
  status: string
  tradeMode: string
  externalOrderId: string | null
  note: string | null
  createdAt: Date | null
}

const POPULAR_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'MATIC/USDT', 'LINK/USDT',
  'DOT/USDT', 'UNI/USDT', 'LTC/USDT', 'ARB/USDT', 'OP/USDT',
]

const TRANSFER_NETWORKS = ['TRC20', 'BEP20 (BSC)', 'ERC20', 'SOL', 'MATIC', 'AVAX C-Chain']

const STATUS_STYLE: Record<string, string> = {
  closed:   'text-green-400 bg-green-500/10 border-green-500/20',
  open:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  pending:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  canceled: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  failed:   'text-red-400 bg-red-500/10 border-red-500/20',
}

export function TradeExecutionPanel() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [history, setHistory] = useState<TradeOrder[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [activeTab, setActiveTab] = useState<'order' | 'transfer' | 'history'>('order')

  // Order form
  const [orderForm, setOrderForm] = useState({
    accountId: '',
    symbol: 'BTC/USDT',
    customSymbol: '',
    side: 'buy' as 'buy' | 'sell',
    orderType: 'market' as 'market' | 'limit',
    amount: '',
    price: '',
  })
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderResult, setOrderResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Transfer form
  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    coin: 'USDT',
    network: 'TRC20',
    amount: '',
  })
  const [transferring, setTransferring] = useState(false)
  const [transferResult, setTransferResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoadingAccounts(true)
    setLoadingHistory(true)
    const [accs, hist] = await Promise.all([
      getExchangeAccounts(),
      getTradeHistory(50),
    ])
    setAccounts(accs as Account[])
    setHistory(hist as TradeOrder[])
    setLoadingAccounts(false)
    setLoadingHistory(false)
  }, [])

  useEffect(() => { load() }, [load])

  const selectedAccount = accounts.find(a => a.id === Number(orderForm.accountId))
  const isLive = selectedAccount?.tradeMode === 'live'
  const finalSymbol = orderForm.symbol === '__custom__' ? orderForm.customSymbol : orderForm.symbol

  const handlePlaceOrder = async () => {
    if (!orderForm.accountId || !finalSymbol || !orderForm.amount) return
    setPlacingOrder(true)
    setOrderResult(null)
    try {
      const result = await placeTradeOrder({
        accountId: Number(orderForm.accountId),
        symbol: finalSymbol.toUpperCase(),
        side: orderForm.side,
        orderType: orderForm.orderType,
        amount: parseFloat(orderForm.amount),
        price: orderForm.orderType === 'limit' ? parseFloat(orderForm.price) : undefined,
      })
      setOrderResult(result)
      if (result.ok) {
        setOrderForm(f => ({ ...f, amount: '', price: '' }))
        setHistory(prev => [{
          id: Date.now(),
          symbol: finalSymbol.toUpperCase(),
          side: orderForm.side,
          orderType: orderForm.orderType,
          amount: orderForm.amount,
          price: orderForm.price || null,
          filled: orderForm.amount,
          cost: null,
          fee: null,
          exchange: selectedAccount?.exchange ?? '',
          status: 'closed',
          tradeMode: isLive ? 'live' : 'paper',
          externalOrderId: result.orderId ?? null,
          note: isLive ? null : 'Paper trade',
          createdAt: new Date(),
        }, ...prev])
      }
    } finally {
      setPlacingOrder(false)
    }
  }

  const handleTransfer = async () => {
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount || !transferForm.coin) return
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      setTransferResult({ ok: false, message: 'Source and destination must be different exchanges.' })
      return
    }
    setTransferring(true)
    setTransferResult(null)
    try {
      const result = await transferBetweenExchanges({
        fromAccountId: Number(transferForm.fromAccountId),
        toAccountId: Number(transferForm.toAccountId),
        coin: transferForm.coin.toUpperCase(),
        network: transferForm.network.split(' ')[0], // strip description
        amount: parseFloat(transferForm.amount),
      })
      setTransferResult(result)
    } finally {
      setTransferring(false)
    }
  }

  const liveAccounts = accounts.filter(a => a.tradeMode === 'live')
  const pendingCount = history.filter(h => h.status === 'pending' || h.status === 'open').length
  const closedCount = history.filter(h => h.status === 'closed').length
  const failedCount = history.filter(h => h.status === 'failed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-white font-bold text-lg">Trade & Transfer</h2>
        <p className="text-slate-400 text-sm mt-0.5">Place orders and transfer coins between connected exchanges</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Connected', value: accounts.length, sub: `${liveAccounts.length} live`, icon: Zap, color: 'text-amber-400' },
          { label: 'Orders Filled', value: closedCount, sub: `${pendingCount} open`, icon: CheckCircle2, color: 'text-green-400' },
          { label: 'Failed', value: failedCount, sub: 'check logs', icon: XCircle, color: 'text-red-400' },
        ].map(s => (
          <Card key={s.label} className="bg-slate-900 border-slate-800 p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-800">
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <p className="text-white font-bold text-xl leading-none">{s.value}</p>
              <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
              <p className="text-slate-600 text-xs">{s.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-slate-800">
        {([
          { id: 'order',    label: 'Place Order',  icon: TrendingUp },
          { id: 'transfer', label: 'Transfer',      icon: ArrowRightLeft },
          { id: 'history',  label: 'Order History', icon: FileText },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-amber-400 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.id === 'history' && history.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-slate-800 text-slate-400">{history.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── PLACE ORDER ── */}
      {activeTab === 'order' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900 border-slate-800 p-6 space-y-5">
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-slate-500"><RefreshCw className="w-4 h-4 animate-spin" /> Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">No exchange accounts connected.</p>
                <p className="text-slate-600 text-sm mt-1">Go to the Exchanges tab to add an API connection.</p>
              </div>
            ) : (
              <>
                {/* Account selector */}
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Exchange Account</label>
                  <div className="relative">
                    <select
                      value={orderForm.accountId}
                      onChange={e => setOrderForm(f => ({ ...f, accountId: e.target.value }))}
                      className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50 pr-10"
                    >
                      <option value="">Select account...</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.label ?? a.exchange} — {a.tradeMode === 'live' ? 'LIVE' : 'Read Only'}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                  {selectedAccount && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${isLive ? 'text-amber-400' : 'text-blue-400'}`}>
                      {isLive ? <Zap className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {isLive ? 'Live trading — real funds will be used' : 'Read-only account — order will be simulated (paper)'}
                    </p>
                  )}
                </div>

                {/* Symbol */}
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Trading Pair</label>
                  <div className="relative">
                    <select
                      value={orderForm.symbol}
                      onChange={e => setOrderForm(f => ({ ...f, symbol: e.target.value }))}
                      className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50 pr-10"
                    >
                      {POPULAR_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                      <option value="__custom__">Custom pair...</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                  {orderForm.symbol === '__custom__' && (
                    <input
                      type="text"
                      value={orderForm.customSymbol}
                      onChange={e => setOrderForm(f => ({ ...f, customSymbol: e.target.value }))}
                      placeholder="e.g. PEPE/USDT"
                      className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 font-mono uppercase focus:outline-none focus:border-amber-500/50"
                    />
                  )}
                </div>

                {/* Side */}
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Side</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderForm(f => ({ ...f, side: 'buy' }))}
                      className={`py-2.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        orderForm.side === 'buy'
                          ? 'border-green-500 bg-green-500/15 text-green-400'
                          : 'border-slate-700 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" /> Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderForm(f => ({ ...f, side: 'sell' }))}
                      className={`py-2.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        orderForm.side === 'sell'
                          ? 'border-red-500 bg-red-500/15 text-red-400'
                          : 'border-slate-700 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      <TrendingDown className="w-4 h-4" /> Sell
                    </button>
                  </div>
                </div>

                {/* Order type */}
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Order Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['market', 'limit'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderForm(f => ({ ...f, orderType: type }))}
                        className={`py-2 rounded-xl border-2 font-semibold text-sm capitalize transition-all ${
                          orderForm.orderType === type
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                            : 'border-slate-700 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount + price */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={orderForm.amount}
                      onChange={e => setOrderForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  {orderForm.orderType === 'limit' && (
                    <div>
                      <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Limit Price (USDT)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={orderForm.price}
                        onChange={e => setOrderForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="0.00"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  )}
                </div>

                {/* Result */}
                {orderResult && (
                  <div className={`rounded-lg px-3 py-2.5 border text-sm flex items-start gap-2 ${
                    orderResult.ok ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
                  }`}>
                    {orderResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    {orderResult.message}
                  </div>
                )}

                {/* Submit */}
                <Button
                  onClick={handlePlaceOrder}
                  disabled={placingOrder || !orderForm.accountId || !finalSymbol || !orderForm.amount}
                  className={`w-full h-11 font-bold text-base gap-2 ${
                    orderForm.side === 'buy'
                      ? 'bg-green-500 hover:bg-green-600 text-black'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  {placingOrder
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
                    : <><TrendingUp className="w-4 h-4" /> {isLive ? 'Place Live' : 'Paper'} {orderForm.side.toUpperCase()} Order</>
                  }
                </Button>

                {!isLive && orderForm.accountId && (
                  <p className="text-slate-600 text-xs text-center">
                    This account is in read-only mode. Orders will be simulated. Switch to live mode in Exchange Settings to trade real funds.
                  </p>
                )}
              </>
            )}
          </Card>

          {/* Quick tips */}
          <div className="space-y-3">
            <h3 className="text-slate-300 font-semibold text-sm uppercase tracking-wider">How It Works</h3>
            {[
              { title: 'Paper Trading', desc: 'Read-only accounts simulate orders without placing them on the exchange. Great for testing strategies.', icon: Eye, color: 'text-blue-400' },
              { title: 'Live Trading', desc: 'Live accounts connect via your API key and place real orders on the exchange in real time.', icon: Zap, color: 'text-amber-400' },
              { title: 'Market Order', desc: 'Executes immediately at the current best market price. Fastest but may have slippage.', icon: TrendingUp, color: 'text-green-400' },
              { title: 'Limit Order', desc: 'Executes only when the market reaches your specified price. More control, may not fill immediately.', icon: Clock, color: 'text-purple-400' },
            ].map(tip => (
              <Card key={tip.title} className="bg-slate-900 border-slate-800 p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800 flex-shrink-0">
                  <tip.icon className={`w-4 h-4 ${tip.color}`} />
                </div>
                <div>
                  <p className="text-slate-300 font-semibold text-sm">{tip.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{tip.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── TRANSFER ── */}
      {activeTab === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900 border-slate-800 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRightLeft className="w-5 h-5 text-amber-400" />
              <h3 className="text-white font-bold">Transfer Between Exchanges</h3>
            </div>
            <p className="text-slate-500 text-sm -mt-2">
              Withdraw from one exchange and deposit to another. Both accounts must be in live mode.
            </p>

            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-slate-500"><RefreshCw className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : liveAccounts.length < 2 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-amber-400 mb-2" />
                <p className="text-amber-300 text-sm font-semibold">At least 2 live exchange accounts required</p>
                <p className="text-amber-400/70 text-xs mt-1">You have {liveAccounts.length} live account(s). Go to Exchanges to add more or switch to live mode.</p>
              </div>
            ) : (
              <>
                {/* From / To */}
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">From</label>
                    <div className="relative">
                      <select
                        value={transferForm.fromAccountId}
                        onChange={e => setTransferForm(f => ({ ...f, fromAccountId: e.target.value }))}
                        className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50 pr-10"
                      >
                        <option value="">Select...</option>
                        {liveAccounts.map(a => <option key={a.id} value={a.id}>{a.label ?? a.exchange}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex justify-center pb-2">
                    <ArrowRight className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="-mt-2 md:mt-0 col-span-2 md:col-span-1">
                    <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">To</label>
                    <div className="relative">
                      <select
                        value={transferForm.toAccountId}
                        onChange={e => setTransferForm(f => ({ ...f, toAccountId: e.target.value }))}
                        className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50 pr-10"
                      >
                        <option value="">Select...</option>
                        {liveAccounts.filter(a => a.id !== Number(transferForm.fromAccountId)).map(a => (
                          <option key={a.id} value={a.id}>{a.label ?? a.exchange}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Coin + Network */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Coin</label>
                    <input
                      type="text"
                      value={transferForm.coin}
                      onChange={e => setTransferForm(f => ({ ...f, coin: e.target.value }))}
                      placeholder="USDT"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white uppercase font-mono focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Network</label>
                    <div className="relative">
                      <select
                        value={transferForm.network}
                        onChange={e => setTransferForm(f => ({ ...f, network: e.target.value }))}
                        className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500/50 pr-10"
                      >
                        {TRANSFER_NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-slate-400 text-xs uppercase tracking-wider mb-1.5 block">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={transferForm.amount}
                    onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                  <p className="text-slate-600 text-xs mt-1">The destination deposit address will be automatically fetched from the target exchange.</p>
                </div>

                {/* Result */}
                {transferResult && (
                  <div className={`rounded-lg px-3 py-2.5 border text-sm flex items-start gap-2 ${
                    transferResult.ok ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
                  }`}>
                    {transferResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    {transferResult.message}
                  </div>
                )}

                <Button
                  onClick={handleTransfer}
                  disabled={transferring || !transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount}
                  className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-black font-bold gap-2"
                >
                  {transferring
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
                    : <><ArrowRightLeft className="w-4 h-4" /> Execute Transfer</>
                  }
                </Button>
              </>
            )}
          </Card>

          <div className="space-y-3">
            <h3 className="text-slate-300 font-semibold text-sm uppercase tracking-wider">Transfer Notes</h3>
            {[
              { title: 'Automatic Deposit Address', desc: 'The destination exchange deposit address is fetched automatically via the API. No manual copying needed.' },
              { title: 'Network Fees', desc: 'Withdrawal fees are charged by the source exchange. Always verify the fee before large transfers.' },
              { title: 'Confirmation Time', desc: 'Transfers typically take 10–60 minutes depending on network congestion and block confirmations.' },
              { title: 'Minimum Amounts', desc: 'Each exchange has minimum withdrawal limits. Amounts below the minimum will be rejected by the exchange.' },
            ].map(note => (
              <Card key={note.title} className="bg-slate-900 border-slate-800 p-4">
                <p className="text-slate-300 font-semibold text-sm">{note.title}</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{note.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── ORDER HISTORY ── */}
      {activeTab === 'history' && (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-white font-bold">Order History</h3>
            <button onClick={load} className="text-slate-500 hover:text-slate-300 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {loadingHistory ? (
            <div className="p-10 text-center text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">No orders placed yet.</p>
              <p className="text-slate-600 text-sm mt-1">Place your first order from the Order tab above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['Time', 'Exchange', 'Pair', 'Side', 'Type', 'Amount', 'Status', 'Mode'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-slate-500 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map(order => {
                    const statusStyle = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending
                    return (
                      <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {order.createdAt ? new Date(order.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-300 capitalize">{order.exchange}</td>
                        <td className="px-4 py-3 text-white font-mono font-semibold">{order.symbol}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${order.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                            {order.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 capitalize">{order.orderType}</td>
                        <td className="px-4 py-3 text-slate-300 font-mono">
                          {parseFloat(order.amount ?? '0').toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusStyle}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                            order.tradeMode === 'live'
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                              : 'text-slate-400 bg-slate-500/10 border-slate-700'
                          }`}>
                            {order.tradeMode === 'live' ? 'Live' : 'Paper'}
                          </span>
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
    </div>
  )
}
