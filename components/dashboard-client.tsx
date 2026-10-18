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
import { ArrowUpRight, ArrowDownLeft, Bell, LogOut, Zap, BarChart3, Settings, Wallet, Search, Shield, PlusCircle, Menu, X } from 'lucide-react'
import { getRoleLabel, hasPermission, UserRole } from '@/lib/roles'
import { AddFundsModal } from '@/components/add-funds-modal'

export function DashboardClient({ user }: { user: any }) {
  const userRole = user.role as UserRole
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scoringId, setScoringId] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showAddFunds, setShowAddFunds] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      <header className="border-b border-slate-700/80 bg-slate-950/85 backdrop-blur-xl sticky top-0 z-40 shadow-lg shadow-black/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 ring-1 ring-amber-400/25">
              <Zap className="size-5 sm:size-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base sm:text-xl font-bold tracking-tight text-white">Arbitrage IQ</h1>
              <p className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-slate-500">Market intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => router.push('/')}
                className="px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <Zap className="w-4 h-4" />
                <span className="text-sm">Dashboard</span>
              </button>
              <button
                onClick={() => router.push('/opportunities')}
                className="px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <Search className="w-4 h-4" />
                <span className="text-sm">Explore</span>
              </button>
              <button
                onClick={() => router.push('/portfolio')}
                className="px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <Wallet className="w-4 h-4" />
                <span className="text-sm">Portfolio</span>
              </button>
              <button
                onClick={() => router.push('/analytics')}
                className="px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Analytics</span>
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">Settings</span>
              </button>
              {userRole === 'admin' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-yellow-300 hover:text-yellow-200"
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">Admin</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(value => !value)}
              className="lg:hidden inline-flex size-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 ring-1 ring-slate-700/80">
              <span className="text-sm text-slate-400">Welcome,</span>
              <span className="text-sm font-semibold text-white">{user.name || user.email}</span>
              <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                {getRoleLabel(userRole)}
              </span>
            </div>
            <button className="relative p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-slate-300" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {userRole === 'trader' && (
              <Button
                size="sm"
                onClick={() => setShowAddFunds(true)}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Add Funds
              </Button>
            )}
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
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-slate-800 bg-slate-950 px-3 py-3 sm:px-6" aria-label="Mobile navigation">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ['/','Dashboard', Zap], ['/opportunities','Explore', Search], ['/portfolio','Portfolio', Wallet], ['/analytics','Analytics', BarChart3], ['/settings','Settings', Settings],
              ].map(([href, label, Icon]: any) => (
                <button key={href} type="button" onClick={() => { setMobileMenuOpen(false); router.push(href) }} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5 text-left text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-white">
                  <Icon className="size-4 text-amber-400" /> {label}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8 w-full min-w-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.06),transparent_34rem)]">
        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="bg-slate-900/75 border-slate-800 p-4 sm:p-5 shadow-xl shadow-black/10">
            <div className="text-slate-400 text-sm mb-2">Active Opportunities</div>
            <div className="text-3xl font-bold text-white">{opportunities.length}</div>
          </Card>
          <Card className="bg-slate-900/75 border-slate-800 p-4 sm:p-5 shadow-xl shadow-black/10">
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
          <Card className="bg-slate-900/75 border-slate-800 p-4 sm:p-5 shadow-xl shadow-black/10">
            <div className="text-slate-400 text-sm mb-2">Notifications</div>
            <div className="text-3xl font-bold text-slate-100">{notifications.length}</div>
          </Card>
        </div>

        {/* Opportunities Table */}
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          <div className="flex flex-col gap-1 border-b border-slate-800 p-4 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Arbitrage Opportunities</h2>
            <p className="text-slate-400 text-sm mt-1">Real-time opportunities across exchanges</p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/20">Live feed</span>
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
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="min-w-[760px] w-full">
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
                        {hasPermission(userRole, 'canExecuteTrades') ? (
                          <Button
                            size="sm"
                            disabled={scoringId === opp.id}
                            onClick={() => handleScoreOpportunity(opp.id)}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                          >
                            {scoringId === opp.id ? 'Scoring...' : 'Score'}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">View only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Add Funds Modal */}
        {showAddFunds && <AddFundsModal onClose={() => setShowAddFunds(false)} />}

        {/* Notifications Section */}
        {notifications.length > 0 && (
          <Card className="bg-slate-800 border-slate-700 mt-8 overflow-hidden">
            <div className="border-b border-slate-800 p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-white">Recent Notifications</h2>
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
