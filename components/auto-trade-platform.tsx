'use client'

import { useEffect, useState, useCallback } from 'react'
import { getMyAutoTradePlan } from '@/app/actions/auto-trade'
import { Card } from '@/components/ui/card'
import {
  TrendingUp, Zap, DollarSign, Calendar, RefreshCw,
  ChevronDown, ChevronUp, Shield, Activity, BarChart3,
  Clock, CheckCircle2, PauseCircle, Info,
} from 'lucide-react'

type Log = {
  id: number
  tradeDate: string
  dailyGross: string
  dailyFee: string
  dailyNet: string
  runningTotal: string
  status: string
}

type Plan = {
  id: number
  principal: string
  grossReturnPct: string
  feePct: string
  netReturnPct: string
  status: string
  startDate: string
  endDate: string | null
  note: string | null
  createdAt: Date
}

// ── Sparkline mini chart ──────────────────────────────────────────────────────
function Sparkline({ values, color = '#f59e0b' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const w = 200, h = 40
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts.split(' ').at(-1)!.split(',')[0]} cy={pts.split(' ').at(-1)!.split(',')[1]} r="3" fill={color} />
    </svg>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, accent }:
  { label: string; value: string; sub?: string; icon: React.ElementType; color: string; accent: string }) {
  return (
    <Card className="bg-slate-900 border-slate-800 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${accent}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold ${color} mt-0.5`}>{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

// ── Return rate breakdown visual ──────────────────────────────────────────────
function ReturnBreakdown({ gross, fee, net }: { gross: number; fee: number; net: number }) {
  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-3 bg-slate-800">
        <div className="bg-green-500 transition-all" style={{ width: `${(net / gross) * 100}%` }} title={`Net ${net}%`} />
        <div className="bg-red-500/70 transition-all" style={{ width: `${(fee / gross) * 100}%` }} title={`Fee ${fee}%`} />
      </div>
      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
          <span className="text-slate-400">Gross</span>
          <span className="text-amber-400 font-bold">{gross}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/70 inline-block" />
          <span className="text-slate-400">Platform Fee</span>
          <span className="text-red-400 font-bold">{fee}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
          <span className="text-slate-400">Your Net</span>
          <span className="text-green-400 font-bold">{net}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Monthly projection table ──────────────────────────────────────────────────
function MonthlyProjection({ principal, netPct }: { principal: number; netPct: number }) {
  const rows = [1, 2, 3, 6, 12]
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="py-2.5 px-4 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">Period</th>
            <th className="py-2.5 px-4 text-right text-xs text-slate-500 font-medium uppercase tracking-wider">Total Return</th>
            <th className="py-2.5 px-4 text-right text-xs text-slate-500 font-medium uppercase tracking-wider">Net Profit</th>
            <th className="py-2.5 px-4 text-right text-xs text-slate-500 font-medium uppercase tracking-wider">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(months => {
            const totalReturnPct = months * netPct
            const netProfit = (principal * totalReturnPct) / 100
            const balance = principal + netProfit
            return (
              <tr key={months} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 text-white font-medium">{months} month{months > 1 ? 's' : ''}</td>
                <td className="py-3 px-4 text-right text-amber-400 font-bold">{totalReturnPct.toFixed(1)}%</td>
                <td className="py-3 px-4 text-right text-green-400 font-bold">+${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="py-3 px-4 text-right text-white">${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function AutoTradePlatform() {
  const [data, setData] = useState<{ plan: Plan; logs: Log[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [activeSection, setActiveSection] = useState<'overview' | 'daily' | 'projection'>('overview')
  // Stable "today" value set client-side only to avoid SSR/client hydration mismatch
  const [todayStr, setTodayStr] = useState<string>('')
  const [todayDate, setTodayDate] = useState<Date | null>(null)

  useEffect(() => {
    const now = new Date()
    setTodayStr(now.toISOString().split('T')[0])
    setTodayDate(now)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getMyAutoTradePlan()
      setData(result as { plan: Plan; logs: Log[] } | null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── No plan state ──────────────────────────────────────────────────────────
  if (!loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
          <Zap className="w-10 h-10 text-slate-600" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-white text-xl font-bold">No Auto-Trade Plan Active</h2>
          <p className="text-slate-400 text-sm max-w-sm">
            Your account does not have an active auto-trade plan yet. Contact your administrator to get started.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm">Auto-trade plans are set up by admin with guaranteed monthly returns.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
        Loading your auto-trade plan...
      </div>
    )
  }

  const { plan, logs } = data!
  const principal = parseFloat(plan.principal)
  const grossPct = parseFloat(plan.grossReturnPct)
  const feePct = parseFloat(plan.feePct)
  const netPct = parseFloat(plan.netReturnPct)

  // Daily amounts
  const dailyGross = principal * (grossPct / 30 / 100)
  const dailyFee = dailyGross * (feePct / grossPct)
  const dailyNet = dailyGross - dailyFee

  // Totals from logs
  const totalNetProfit = logs.reduce((s, l) => s + parseFloat(l.dailyNet), 0)
  const totalFees = logs.reduce((s, l) => s + parseFloat(l.dailyFee), 0)
  const currentBalance = principal + totalNetProfit
  const daysElapsed = logs.length

  // Monthly progress (% of 8% net target) — uses client-only todayDate to avoid hydration mismatch
  const today = todayDate ?? new Date(0)
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const daysThisMonth = todayDate ? Math.floor((today.getTime() - startOfMonth.getTime()) / 86400000) + 1 : 0
  const thisMonthLogs = logs.filter(l => {
    if (!todayDate) return false
    const d = new Date(l.tradeDate)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  })
  const thisMonthNet = thisMonthLogs.reduce((s, l) => s + parseFloat(l.dailyNet), 0)
  const monthTarget = (principal * netPct) / 100
  const monthProgress = Math.min((thisMonthNet / monthTarget) * 100, 100)

  // Sparkline: last 14 days running totals
  const sparkValues = [...logs].slice(0, 14).reverse().map(l => parseFloat(l.runningTotal))

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }

  const displayLogs = showAllLogs ? logs : logs.slice(0, 7)

  return (
    <div className="space-y-6">

      {/* Header card */}
      <Card className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border-amber-500/20 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-bold text-xl">Auto-Trade Platform</h2>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border capitalize ${statusColors[plan.status] ?? statusColors.active}`}>
                  {plan.status === 'active' ? <span className="flex items-center gap-1"><Activity className="w-3 h-3" />Active</span> : plan.status}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-0.5">
                Managed by administrator &mdash; {grossPct}% gross / {feePct}% fee / <span className="text-green-400 font-semibold">{netPct}% net</span> per month
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-slate-500 text-xs">Started</p>
            <p className="text-white font-medium text-sm">{new Date(plan.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            <p className="text-slate-500 text-xs mt-1">{daysElapsed} day{daysElapsed !== 1 ? 's' : ''} active</p>
          </div>
        </div>

        {/* Monthly progress */}
        <div className="mt-5 space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Monthly profit progress ({daysThisMonth}/{monthDays} days)</span>
            <span className="text-green-400 font-semibold">
              ${thisMonthNet.toFixed(2)} / ${monthTarget.toFixed(2)} target
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-green-500 transition-all duration-700"
              style={{ width: `${monthProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">0%</span>
            <span className="text-amber-400 font-bold">{monthProgress.toFixed(1)}% complete</span>
            <span className="text-slate-500">{netPct}% target</span>
          </div>
        </div>

        {/* Sparkline */}
        {sparkValues.length > 1 && (
          <div className="mt-4">
            <p className="text-slate-500 text-xs mb-1">Cumulative profit trend (last {Math.min(14, logs.length)} days)</p>
            <Sparkline values={sparkValues} color="#f59e0b" />
          </div>
        )}
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Principal"
          value={`$${principal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub="Initial investment"
          icon={DollarSign}
          color="text-blue-400"
          accent="bg-blue-500/10"
        />
        <StatCard
          label="Total Net Profit"
          value={`+$${totalNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`After ${daysElapsed} days`}
          icon={TrendingUp}
          color="text-green-400"
          accent="bg-green-500/10"
        />
        <StatCard
          label="Current Balance"
          value={`$${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`+${((totalNetProfit / principal) * 100).toFixed(3)}% overall`}
          icon={BarChart3}
          color="text-amber-400"
          accent="bg-amber-500/10"
        />
        <StatCard
          label="Daily Net Profit"
          value={`+$${dailyNet.toFixed(2)}`}
          sub={`$${dailyGross.toFixed(2)} gross / $${dailyFee.toFixed(2)} fee`}
          icon={Calendar}
          color="text-cyan-400"
          accent="bg-cyan-500/10"
        />
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {([
          { key: 'overview', label: 'Return Breakdown', icon: Shield },
          { key: 'daily', label: 'Daily Trade Log', icon: Clock },
          { key: 'projection', label: 'Profit Projection', icon: TrendingUp },
        ] as const).map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeSection === s.key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>

      {/* Return breakdown section */}
      {activeSection === 'overview' && (
        <Card className="bg-slate-900 border-slate-800 p-6 space-y-6">
          <div>
            <h3 className="text-white font-bold text-base mb-1">Monthly Return Structure</h3>
            <p className="text-slate-400 text-sm">Your plan delivers a fixed 10% gross monthly return. 2% covers platform operating costs; you receive the remaining 8% as net profit.</p>
          </div>
          <ReturnBreakdown gross={grossPct} fee={feePct} net={netPct} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Gross Return', pct: `${grossPct}%/mo`, amount: `+$${((principal * grossPct) / 100).toFixed(2)}`, color: 'border-amber-500/30 bg-amber-500/5', textColor: 'text-amber-400' },
              { label: 'Platform Fee', pct: `${feePct}%/mo`, amount: `-$${((principal * feePct) / 100).toFixed(2)}`, color: 'border-red-500/30 bg-red-500/5', textColor: 'text-red-400' },
              { label: 'Your Net Profit', pct: `${netPct}%/mo`, amount: `+$${((principal * netPct) / 100).toFixed(2)}`, color: 'border-green-500/30 bg-green-500/5', textColor: 'text-green-400' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl border ${item.color} p-4 text-center`}>
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{item.label}</p>
                <p className={`text-2xl font-bold ${item.textColor}`}>{item.pct}</p>
                <p className={`text-sm ${item.textColor} mt-0.5`}>{item.amount}/month</p>
              </div>
            ))}
          </div>

          {plan.note && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300">
              <span className="text-slate-500 font-medium">Admin note: </span>{plan.note}
            </div>
          )}
        </Card>
      )}

      {/* Daily trade log section */}
      {activeSection === 'daily' && (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Daily Trade Log
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-xs">{logs.length} trading days</span>
              <button onClick={load} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">No trade logs yet. Logs appear daily once your plan starts.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40">
                      {['Date', 'Daily Gross', 'Platform Fee', 'Your Net', 'Running Total', 'Status'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayLogs.map((log, i) => {
                      const gross = parseFloat(log.dailyGross)
                      const fee = parseFloat(log.dailyFee)
                      const net = parseFloat(log.dailyNet)
                      const running = parseFloat(log.runningTotal)
                      const isToday = !!todayStr && log.tradeDate === todayStr
                      return (
                        <tr key={log.id} className={`border-b border-slate-800/60 transition-colors ${
                          isToday ? 'bg-amber-500/5 border-amber-500/20' : i % 2 !== 0 ? 'bg-slate-900/20' : ''
                        } hover:bg-slate-800/30`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">
                                {new Date(log.tradeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                              </span>
                              {isToday && <span className="px-1.5 py-0.5 bg-amber-500 text-black text-xs font-bold rounded">TODAY</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-amber-400 font-medium">+${gross.toFixed(4)}</td>
                          <td className="px-5 py-3.5 text-red-400">-${fee.toFixed(4)}</td>
                          <td className="px-5 py-3.5 text-green-400 font-bold">+${net.toFixed(4)}</td>
                          <td className="px-5 py-3.5 text-white font-semibold">${running.toFixed(4)}</td>
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Completed
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {logs.length > 7 && (
                <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500 text-xs">
                    Showing {displayLogs.length} of {logs.length} days
                  </span>
                  <button
                    onClick={() => setShowAllLogs(p => !p)}
                    className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
                  >
                    {showAllLogs ? <><ChevronUp className="w-4 h-4" />Show less</> : <><ChevronDown className="w-4 h-4" />Show all {logs.length} days</>}
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Projection section */}
      {activeSection === 'projection' && (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h3 className="text-white font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Profit Projection
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">Based on {netPct}% net monthly return on ${principal.toLocaleString('en-US', { minimumFractionDigits: 2 })} principal</p>
          </div>
          <MonthlyProjection principal={principal} netPct={netPct} />
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/20">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
              <p className="text-slate-500 text-xs leading-relaxed">
                Projections are based on fixed 8% net monthly returns. Returns are credited daily (daily net = {((netPct / 30) * 100).toFixed(4)}% of principal = ${dailyNet.toFixed(4)}/day). Fees are deducted before crediting your balance.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Paused notice */}
      {plan.status === 'paused' && (
        <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-4">
          <PauseCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-yellow-300 text-sm">Your auto-trade plan is currently paused by the administrator. Daily profits are not accruing. Contact support to resume.</p>
        </div>
      )}
    </div>
  )
}
