'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowDownCircle, ArrowUpCircle, Loader, Check, AlertTriangle } from 'lucide-react'
import { submitFundRequestQuick } from '@/app/actions/deposits'
import { requestWithdrawalQuick, checkWithdrawalAvailable } from '@/app/actions/wallet'

type Network = 'TRC20' | 'BEP20' | 'ERC20'

const NETWORKS: { value: Network; label: string; color: string }[] = [
  { value: 'TRC20', label: 'Tron (USDT)', color: 'bg-red-500' },
  { value: 'BEP20', label: 'Binance (USDT)', color: 'bg-yellow-500' },
  { value: 'ERC20', label: 'Ethereum (USDT)', color: 'bg-blue-500' },
]

export function WalletQuickActions({ walletBalance }: { walletBalance: number }) {
  const [activeMode, setActiveMode] = useState<'deposit' | 'withdraw' | null>(null)
  const [network, setNetwork] = useState<Network>('TRC20')
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [withdrawalStatus, setWithdrawalStatus] = useState<{ available: boolean; daysLeft?: number }>()

  const handleDeposit = useCallback(async () => {
    if (!amount || !txHash) {
      setError('Amount and transaction hash required')
      return
    }
    setLoading(true)
    setError('')
    try {
      await submitFundRequestQuick(network, parseFloat(amount), txHash.trim())
      setSuccess(true)
      setAmount('')
      setTxHash('')
      setTimeout(() => {
        setSuccess(false)
        setActiveMode(null)
      }, 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deposit failed')
    } finally {
      setLoading(false)
    }
  }, [network, amount, txHash])

  const handleCheckWithdrawal = useCallback(async () => {
    try {
      const status = await checkWithdrawalAvailable()
      setWithdrawalStatus(status)
    } catch {
      setError('Failed to check withdrawal status')
    }
  }, [])

  const handleWithdraw = useCallback(async () => {
    if (!amount || !walletAddress) {
      setError('Amount and wallet address required')
      return
    }
    setLoading(true)
    setError('')
    try {
      await requestWithdrawalQuick(parseFloat(amount), network, walletAddress.trim())
      setSuccess(true)
      setAmount('')
      setWalletAddress('')
      setTimeout(() => {
        setSuccess(false)
        setActiveMode(null)
      }, 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed')
    } finally {
      setLoading(false)
    }
  }, [network, amount, walletAddress])

  if (!activeMode) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => {
            setActiveMode('deposit')
            setError('')
            setSuccess(false)
          }}
          variant="outline"
          className="h-16 flex flex-col items-center justify-center gap-1"
        >
          <ArrowDownCircle className="w-5 h-5 text-green-500" />
          <span className="text-xs font-semibold">Add Funds</span>
        </Button>
        <Button
          onClick={() => {
            setActiveMode('withdraw')
            setError('')
            setSuccess(false)
            handleCheckWithdrawal()
          }}
          variant="outline"
          className="h-16 flex flex-col items-center justify-center gap-1"
        >
          <ArrowUpCircle className="w-5 h-5 text-blue-500" />
          <span className="text-xs font-semibold">Withdraw</span>
        </Button>
      </div>
    )
  }

  const isDeposit = activeMode === 'deposit'

  return (
    <Card className="p-4 bg-slate-900 border-slate-700">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {isDeposit ? 'Add Funds' : 'Withdraw'}
          </h3>
          <button
            onClick={() => setActiveMode(null)}
            className="text-slate-400 hover:text-slate-200 text-lg"
          >
            ×
          </button>
        </div>

        {/* Network selector */}
        <div className="grid grid-cols-3 gap-2">
          {NETWORKS.map((n) => (
            <button
              key={n.value}
              onClick={() => setNetwork(n.value)}
              className={`py-2 px-3 rounded text-xs font-semibold transition ${
                network === n.value
                  ? `${n.color} text-white`
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {n.label.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Withdrawal check */}
        {!isDeposit && withdrawalStatus === undefined && (
          <div className="text-xs text-slate-400">Checking availability...</div>
        )}

        {!isDeposit && withdrawalStatus && !withdrawalStatus.available && (
          <div className="bg-amber-900/20 border border-amber-700 rounded p-2 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-xs text-amber-200">
              Next withdrawal in {withdrawalStatus.daysLeft} day{withdrawalStatus.daysLeft !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Amount (USDT)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
          />
        </div>

        {/* Deposit-specific fields */}
        {isDeposit && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Transaction Hash</label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="Paste tx hash"
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs focus:outline-none focus:border-slate-500 font-mono"
            />
          </div>
        )}

        {/* Withdraw-specific fields */}
        {!isDeposit && (
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Wallet Address</label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder={`${network} address`}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs focus:outline-none focus:border-slate-500 font-mono"
            />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded p-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="bg-green-900/20 border border-green-700 rounded p-2 flex gap-2">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-xs text-green-200">
              {isDeposit ? 'Deposit submitted!' : 'Withdrawal submitted!'}
            </span>
          </div>
        )}

        {/* Balance info for withdrawal */}
        {!isDeposit && (
          <div className="text-xs text-slate-400 bg-slate-800 rounded p-2">
            Available: <span className="text-white font-semibold">${walletBalance.toFixed(2)}</span>
          </div>
        )}

        {/* Action button */}
        <Button
          onClick={isDeposit ? handleDeposit : handleWithdraw}
          disabled={loading || !amount || (isDeposit ? !txHash : !walletAddress) || (!isDeposit && withdrawalStatus && !withdrawalStatus.available)}
          className="w-full"
        >
          {loading && <Loader className="w-4 h-4 animate-spin mr-2" />}
          {success ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Done
            </>
          ) : isDeposit ? (
            'Submit Deposit'
          ) : (
            'Request Withdrawal'
          )}
        </Button>

        {/* Cancel button */}
        <Button
          onClick={() => setActiveMode(null)}
          variant="ghost"
          className="w-full text-slate-400"
        >
          Cancel
        </Button>
      </div>
    </Card>
  )
}
