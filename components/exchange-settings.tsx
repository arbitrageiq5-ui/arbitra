'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'

const EXCHANGES = ['Binance', 'Kraken', 'Coinbase', 'Bybit', 'KuCoin', 'Huobi']

export function ExchangeSettings() {
  const [exchanges, setExchanges] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    exchange: '',
    apiKey: '',
    apiSecret: '',
    passphrase: '',
  })
  const [loading, setLoading] = useState(false)

  const handleAddExchange = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // TODO: Implement API call to save exchange credentials
      // For now, just add to local state
      setExchanges([...exchanges, { id: Date.now(), ...formData }])
      setFormData({ exchange: '', apiKey: '', apiSecret: '', passphrase: '' })
      setShowForm(false)
    } catch (error) {
      console.error('Failed to add exchange:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveExchange = (id: number) => {
    setExchanges(exchanges.filter((e) => e.id !== id))
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-2">Connected Exchanges</h2>
        <p className="text-slate-400">Manage your exchange API credentials for automated trading</p>
      </div>

      {exchanges.length > 0 && (
        <div className="grid gap-4 mb-8">
          {exchanges.map((exchange) => (
            <Card key={exchange.id} className="bg-slate-800 border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">{exchange.exchange}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    API Key: {exchange.apiKey.substring(0, 10)}...
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveExchange(exchange.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!showForm ? (
        <Button
          onClick={() => setShowForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Exchange Account
        </Button>
      ) : (
        <Card className="bg-slate-800 border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Add Exchange Account</h3>

          <form onSubmit={handleAddExchange} className="space-y-4">
            <div>
              <Label htmlFor="exchange" className="text-white">
                Exchange
              </Label>
              <select
                id="exchange"
                value={formData.exchange}
                onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                required
                className="w-full mt-2 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">Select an exchange...</option>
                {EXCHANGES.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="apiKey" className="text-white">
                API Key
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                required
                placeholder="Enter your API key"
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>

            <div>
              <Label htmlFor="apiSecret" className="text-white">
                API Secret
              </Label>
              <Input
                id="apiSecret"
                type="password"
                value={formData.apiSecret}
                onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                required
                placeholder="Enter your API secret"
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>

            <div>
              <Label htmlFor="passphrase" className="text-white">
                Passphrase (Optional)
              </Label>
              <Input
                id="passphrase"
                type="password"
                value={formData.passphrase}
                onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                placeholder="Enter passphrase if required"
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {loading ? 'Adding...' : 'Add Exchange'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
