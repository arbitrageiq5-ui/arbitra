'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import {
  getArbitrageOpportunities,
  getNotifications,
  createNotification,
  scoreOpportunityWithAI,
} from '@/app/actions/arbitrage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownLeft, Bell, LogOut, Zap } from 'lucide-react'

export function DashboardClient({ user }: { user: any }) {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scoringId, setScoringId] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [opps, notifs] = await Promise.all([
        getArbitrageOpportunities(20),
        getNotifications(),
      ])
      setOpportunities(opps)
      setNotifications(notifs)
      setUnreadCount(notifs.filter((n: any) => !n.isRead).length)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleScoreOpportunity = async (opportunityId: number) => {
    setScoringId(opportunityId)
    try {
      await scoreOpportunityWithAI(opportunityId)
      await loadData()
    } catch (error) {
      console.error('Scoring failed:', error)
    } finally {
      setScoringId(null)
    }
  }

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Arbitrage IQ</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50">
              <span className="text-sm text-slate-400">Welcome,</span>
              <span className="text-sm font-semibold text-white">{user.name || user.email}</span>
            </div>
            <button className="relative p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="text-slate-400 text-sm mb-2">Active Opportunities</div>
            <div className="text-3xl font-bold text-white">{opportunities.length}</div>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="text-slate-400 text-sm mb-2">Avg Profit Margin</div>
            <div className="text-3xl font-bold text-amber-400">
              {opportunities.length > 0
                ? (
                    opportunities.reduce(
                      (sum: number, opp: any) => sum + parseFloat(opp.profitPercentage),
                      0
                    ) / opportunities.length
                  ).toFixed(2)
                : '0.00'}
              %
            </div>
          </Card>
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="text-slate-400 text-sm mb-2">Notifications</div>
            <div className="text-3xl font-bold text-slate-100">{notifications.length}</div>
          </Card>
        </div>

        {/* Opportunities Table */}
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          <div className="border-b border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white">Arbitrage Opportunities</h2>
            <p className="text-slate-400 text-sm mt-1">Real-time opportunities across exchanges</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="animate-pulse">Loading opportunities...</div>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No opportunities found. Checking exchanges...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Symbol
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Buy Exchange
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Buy Price
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                      Sell Exchange
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Sell Price
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                      Profit
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      Score
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opp: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 text-white font-semibold">{opp.symbol}</td>
                      <td className="px-6 py-4 text-slate-300">{opp.buyExchange}</td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        ${parseFloat(opp.buyPrice).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{opp.sellExchange}</td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        ${parseFloat(opp.sellPrice).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ArrowUpRight className="w-4 h-4 text-green-400" />
                          <span className="font-semibold text-green-400">
                            {parseFloat(opp.profitPercentage).toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {opp.aiScore ? (
                          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold">
                            {parseFloat(opp.aiScore).toFixed(0)}/100
                          </span>
                        ) : (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          size="sm"
                          disabled={scoringId === opp.id}
                          onClick={() => handleScoreOpportunity(opp.id)}
                          className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        >
                          {scoringId === opp.id ? 'Scoring...' : 'Score'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Notifications Section */}
        {notifications.length > 0 && (
          <Card className="bg-slate-800 border-slate-700 mt-8 overflow-hidden">
            <div className="border-b border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white">Recent Notifications</h2>
            </div>
            <div className="divide-y divide-slate-700">
              {notifications.slice(0, 5).map((notif: any) => (
                <div key={notif.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <Bell className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{notif.title}</h3>
                      <p className="text-slate-400 text-sm">{notif.message}</p>
                      <span className="text-xs text-slate-500 mt-2 block">
                        {new Date(notif.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
