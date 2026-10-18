'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { getArbitrageOpportunities, getNotifications, scoreOpportunityWithAI } from '@/app/actions/arbitrage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AddFundsModal } from '@/components/add-funds-modal'
import { getRoleLabel, hasPermission, UserRole } from '@/lib/roles'
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, Bell, Bot, CheckCircle2, ChevronRight,
  CircleDollarSign, LogOut, Menu, Network, Plus, Search, Settings, Shield, Sparkles,
  TrendingUp, Wallet, X, Zap,
} from 'lucide-react'

const operations = [
  { label: 'Algo Bot Manager', description: 'Strategies, risk controls, execution logs', href: '/trader', icon: Bot },
  { label: 'Arbitrage Scanner', description: 'Spreads, fees, liquidity, net profit', href: '/opportunities', icon: Network },
  { label: 'Performance Analytics', description: 'Portfolio, drawdown, trade history', href: '/analytics', icon: BarChart3 },
]

export function DashboardClient({ user }: { user: any }) {
  const userRole = user.role as UserRole
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scoringId, setScoringId] = useState<number | null>(null)
  const [showAddFunds, setShowAddFunds] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [opps, notifs] = await Promise.all([getArbitrageOpportunities(20), getNotifications()])
      setOpportunities(opps)
      setNotifications(notifs)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

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

  const averageProfit = useMemo(() => {
    if (!opportunities.length) return '0.00'
    return (opportunities.reduce((sum, opportunity) => sum + parseFloat(opportunity.profitPercentage), 0) / opportunities.length).toFixed(2)
  }, [opportunities])

  const unreadCount = notifications.filter((notification) => !notification.isRead).length

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => router.push('/')} className="flex min-w-0 items-center gap-3 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sky-400 shadow-sm">
              <Activity className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-black tracking-tight">MY ALGO</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:block">Algorithmic trading & arbitrage</span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {[
              ['Dashboard', '/', Activity], ['Explore', '/opportunities', Search], ['Portfolio', '/portfolio', Wallet],
              ['Analytics', '/analytics', BarChart3], ['Settings', '/settings', Settings],
            ].map(([label, href, Icon]: any) => (
              <button key={href} type="button" onClick={() => router.push(href)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
                <Icon className="size-4" />{label}
              </button>
            ))}
            {userRole === 'admin' && <button type="button" onClick={() => router.push('/admin')} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"><Shield className="size-4" />Admin</button>}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:flex">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">System online</span>
            </div>
            <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white lg:hidden" aria-label="Toggle navigation">
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <button type="button" onClick={() => router.push('/settings')} className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white" aria-label="Notifications">
              <Bell className="size-4 text-slate-600" />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{unreadCount}</span>}
            </button>
            <button type="button" onClick={handleLogout} className="hidden size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-950 sm:inline-flex" aria-label="Sign out"><LogOut className="size-4" /></button>
          </div>
        </div>
        {mobileMenuOpen && <nav className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation"><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Dashboard','/'],['Explore','/opportunities'],['Portfolio','/portfolio'],['Analytics','/analytics'],['Settings','/settings']].map(([label, href]) => <button key={href} type="button" onClick={() => { setMobileMenuOpen(false); router.push(href) }} className="rounded-xl bg-slate-50 px-3 py-3 text-left text-sm font-semibold text-slate-700">{label}</button>)}</div></nav>}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Participant dashboard</p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">Good to see you, {user.name?.split(' ')[0] || 'Trader'}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">Monitor your trading operations, discover verified opportunities, and keep your portfolio moving with confidence.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-2 text-xs font-bold text-white">{getRoleLabel(userRole)}</span>
            {userRole === 'trader' && <Button onClick={() => setShowAddFunds(true)} className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"><Plus data-icon="inline-start" /> Add funds</Button>}
          </div>
        </section>

        <section className="mb-8 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-black sm:text-2xl">MY ALGO overview</h2><p className="mt-1 text-sm text-slate-500">Your live trading command center</p></div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-4" /> Connected and monitoring</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Portfolio balance', '—', 'Connected account data', CircleDollarSign, 'text-sky-600'],
              ["Today's P&L", `${averageProfit}%`, 'Realized trading results', TrendingUp, 'text-emerald-600'],
              ['Active bots', '—', 'Live bot status', Bot, 'text-violet-600'],
              ['Arbitrage scanner', loading ? '…' : String(opportunities.length), 'Verified opportunities', Network, 'text-amber-600'],
            ].map(([label, value, caption, Icon, color]: any) => <div key={label} className="rounded-2xl bg-slate-50 p-4 sm:p-5"><div className="mb-5 flex items-center justify-between"><span className="text-sm font-medium text-slate-500">{label}</span><Icon className={`size-5 ${color}`} /></div><p className="text-2xl font-black tracking-tight sm:text-3xl">{value}</p><p className="mt-2 text-sm text-slate-500">{caption}</p></div>)}
          </div>
        </section>

        <section className="mb-8 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-xl font-black sm:text-2xl">Trading operations</h2><p className="mt-1 text-sm text-slate-500">Everything you need to operate your strategy</p></div><Settings className="size-5 text-slate-400" /></div>
          <div className="divide-y divide-slate-100">
            {operations.map(({ label, description, href, icon: Icon }) => <button key={href} type="button" onClick={() => router.push(href)} className="group flex w-full items-center gap-4 py-5 text-left transition hover:px-2"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-slate-950 group-hover:text-sky-400"><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-base font-bold sm:text-lg">{label}</span><span className="mt-1 block text-sm text-slate-500">{description}</span></span><ChevronRight className="size-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-950" /></button>)}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="text-xl font-black sm:text-2xl">Arbitrage scanner</h2><p className="mt-1 text-sm text-slate-500">Real-time opportunities across connected exchanges</p></div><button type="button" onClick={() => router.push('/opportunities')} className="flex items-center gap-1 text-sm font-bold text-slate-700 hover:text-slate-950">View all <ArrowRight className="size-4" /></button></div>
          {loading ? <div className="p-10 text-center text-sm text-slate-500">Loading verified opportunities...</div> : opportunities.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No opportunities found. Checking exchanges...</div> : <div className="overflow-x-auto"><table className="min-w-[760px] w-full"><thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400"><th className="px-4 py-4 sm:px-6">Symbol</th><th className="px-4 py-4 sm:px-6">Route</th><th className="px-4 py-4 text-right sm:px-6">Profit</th><th className="px-4 py-4 text-center sm:px-6">AI score</th><th className="px-4 py-4 text-right sm:px-6">Action</th></tr></thead><tbody>{opportunities.slice(0, 6).map((opportunity: any, index: number) => <tr key={opportunity.id ?? index} className="border-b border-slate-50 text-sm last:border-0 hover:bg-slate-50"><td className="px-4 py-4 font-bold sm:px-6">{opportunity.symbol}</td><td className="px-4 py-4 text-slate-500 sm:px-6">{opportunity.buyExchange} <ArrowRight className="mx-1 inline size-3" /> {opportunity.sellExchange}</td><td className="px-4 py-4 text-right font-bold text-emerald-600 sm:px-6">{parseFloat(opportunity.profitPercentage).toFixed(2)}%</td><td className="px-4 py-4 text-center sm:px-6">{opportunity.aiScore ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{parseFloat(opportunity.aiScore).toFixed(0)}/100</span> : <span className="text-slate-400">—</span>}</td><td className="px-4 py-4 text-right sm:px-6">{hasPermission(userRole, 'canExecuteTrades') ? <Button size="sm" disabled={scoringId === opportunity.id} onClick={() => handleScoreOpportunity(opportunity.id)} className="rounded-lg bg-slate-950 text-white hover:bg-slate-800">{scoringId === opportunity.id ? 'Scoring...' : 'Score'}</Button> : <span className="text-xs text-slate-400">View only</span>}</td></tr>)}</tbody></table></div>}
        </section>

        {notifications.length > 0 && <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6"><div className="mb-4 flex items-center gap-2"><Bell className="size-5 text-slate-500" /><h2 className="text-xl font-black">Recent notifications</h2></div><div className="grid gap-3 sm:grid-cols-2">{notifications.slice(0, 4).map((notification: any) => <div key={notification.id} className="rounded-2xl bg-slate-50 p-4"><p className="font-bold">{notification.title}</p><p className="mt-1 text-sm text-slate-500">{notification.message}</p><p className="mt-3 text-xs text-slate-400">{new Date(notification.createdAt).toLocaleString()}</p></div>)}</div></section>}
      </main>

      {showAddFunds && <AddFundsModal onClose={() => setShowAddFunds(false)} />}
    </div>
  )
}
