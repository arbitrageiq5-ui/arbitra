'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPortfolio, updatePortfolio } from '@/app/actions/arbitrage'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'

export function PortfolioClient({ user }: { user: any }) {
  const router = useRouter()
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
    price: '',
  })

  useEffect(() => {
    loadPortfolio()
  }, [])

  const loadPortfolio = async () => {
    try {
      setLoading(true)
      const data = await getPortfolio()
      setPortfolio(data)
    } catch (error) {
      console.error('Failed to load portfolio:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.symbol || !formData.quantity || !formData.price) return

    try {
      await updatePortfolio(
        formData.symbol.toUpperCase(),
        parseFloat(formData.quantity),
        parseFloat(formData.price)
      )
      setFormData({ symbol: '', quantity: '', price: '' })
      setShowAddForm(false)
      await loadPortfolio()
    } catch (error) {
      console.error('Failed to add position:', error)
    }
  }

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  const totalValue = portfolio.reduce(
    (sum: number, pos: any) => sum + parseFloat(pos.currentValue || 0),
    0
  )
  const totalCost = portfolio.reduce(
    (sum: number, pos: any) =>
      sum +
      parseFloat(pos.quantity || 0) * parseFloat(pos.averageCost || 0),
    0
  )
  const totalGain = totalValue - totalCost
  const gainPercentage = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-300 hover:text-white hover:bg-slate-700"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="text-slate-400 text-sm mb-2">Total Value</div>
            <div className="text-3xl font-bold text-white">
              ${totalValue.toFixed(2)}
            </div>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="text-slate-400 text-sm mb-2">Total Cost Basis</div>
            <div className="text-3xl font-bold text-slate-300">
              ${totalCost.toFixed(2)}
            </div>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="text-slate-400 text-sm mb-2">Unrealized Gain/Loss</div>
            <div
              className={`text-3xl font-bold flex items-center gap-2 ${
                totalGain >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {totalGain >= 0 ? (
                <TrendingUp className="w-6 h-6" />
              ) : (
                <TrendingDown className="w-6 h-6" />
              )}
              ${Math.abs(totalGain).toFixed(2)} ({gainPercentage.toFixed(2)}%)
            </div>
          </Card>
        </div>

        {/* Add Position Button */}
        <div className="mb-6">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Position
          </Button>
        </div>

        {/* Add Position Form */}
        {showAddForm && (
          <Card className="bg-slate-800 border-slate-700 p-6 mb-8">
            <form onSubmit={handleAddPosition}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label className="text-slate-300 mb-2 block">Symbol</Label>
                  <Input
                    type="text"
                    placeholder="BTC, ETH, etc."
                    value={formData.symbol}
                    onChange={(e) =>
                      setFormData({ ...formData, symbol: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 mb-2 block">Quantity</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    step="0.00000001"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 mb-2 block">Price (USD)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                >
                  Add Position
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Portfolio Positions */}
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          <div className="border-b border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white">Positions</h2>
            <p className="text-slate-400 text-sm mt-1">
              {portfolio.length} position{portfolio.length !== 1 ? 's' : ''}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="animate-pulse">Loading portfolio...</div>
            </div>
          ) : portfolio.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No positions yet. Add your first position to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Symbol
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Quantity
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Avg Cost
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Current Value
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Gain/Loss
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      %
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((pos: any) => {
                    const qty = parseFloat(pos.quantity)
                    const cost = parseFloat(pos.averageCost)
                    const value = parseFloat(pos.currentValue)
                    const gain = value - qty * cost
                    const gainPct = ((gain) / (qty * cost)) * 100

                    return (
                      <tr key={pos.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-white font-semibold">{pos.symbol}</td>
                        <td className="px-6 py-4 text-right text-slate-300">
                          {qty.toFixed(8)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-300">
                          ${cost.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-300">
                          ${value.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 text-right font-semibold ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${Math.abs(gain).toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 text-center font-semibold ${gainPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {gainPct.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="p-1 hover:bg-slate-700 rounded transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
