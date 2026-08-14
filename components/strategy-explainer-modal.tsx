'use client'

import type { ReactNode } from 'react'
import { X, BookOpen, LogIn, LogOut, ShieldCheck, Compass, FlaskConical, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { STRATEGY_EXPLAINERS } from '@/lib/strategy-explainers'

export function StrategyExplainerModal({
  strategyId,
  name,
  icon,
  stats,
  onClose,
}: {
  strategyId: string
  name: string
  icon?: ReactNode
  stats?: { risk?: string; monthly?: string; winRate?: string }
  onClose: () => void
}) {
  const data = STRATEGY_EXPLAINERS[strategyId]

  if (!data) return null

  const riskColor =
    data && stats?.risk
      ? /low/i.test(stats.risk) && !/high/i.test(stats.risk)
        ? 'text-green-400'
        : /high/i.test(stats.risk)
          ? 'text-red-400'
          : 'text-amber-400'
      : 'text-slate-400'

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <Card
        className="bg-slate-900 border-slate-700 w-full max-w-2xl my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0">
              {icon ?? <BookOpen className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-lg leading-tight truncate">{name}</h2>
              <p className="text-slate-500 text-xs mt-0.5">{data.tagline}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors shrink-0"
            aria-label="Close strategy explainer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Stats row */}
          {stats && (stats.monthly || stats.winRate || stats.risk) && (
            <div className="grid grid-cols-3 gap-2">
              {stats.monthly && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
                  <p className="text-slate-600 text-[10px] uppercase tracking-wide">Return</p>
                  <p className="text-green-400 font-bold text-sm">{stats.monthly}</p>
                </div>
              )}
              {stats.winRate && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
                  <p className="text-slate-600 text-[10px] uppercase tracking-wide">Win Rate</p>
                  <p className="text-cyan-400 font-bold text-sm">{stats.winRate}</p>
                </div>
              )}
              {stats.risk && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-center">
                  <p className="text-slate-600 text-[10px] uppercase tracking-wide">Risk</p>
                  <p className={`font-bold text-sm ${riskColor}`}>{stats.risk}</p>
                </div>
              )}
            </div>
          )}

          {/* How it works */}
          <section>
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-2">
              <FlaskConical className="w-4 h-4 text-purple-400" /> How It Works
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">{data.howItWorks}</p>
          </section>

          {/* Entry / Exit rules */}
          <div className="grid sm:grid-cols-2 gap-4">
            <section>
              <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-2">
                <LogIn className="w-4 h-4 text-green-400" /> Entry Rules
              </h3>
              <ul className="space-y-1.5">
                {data.entryRules.map((rule, i) => (
                  <li key={i} className="text-slate-400 text-xs leading-relaxed flex gap-2">
                    <span className="text-green-400 shrink-0">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-2">
                <LogOut className="w-4 h-4 text-red-400" /> Exit Rules
              </h3>
              <ul className="space-y-1.5">
                {data.exitRules.map((rule, i) => (
                  <li key={i} className="text-slate-400 text-xs leading-relaxed flex gap-2">
                    <span className="text-red-400 shrink-0">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Risk management */}
          <section>
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" /> Risk Management
            </h3>
            <ul className="space-y-1.5">
              {data.riskManagement.map((rule, i) => (
                <li key={i} className="text-slate-400 text-xs leading-relaxed flex gap-2">
                  <span className="text-blue-400 shrink-0">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Best conditions */}
          <section>
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-2">
              <Compass className="w-4 h-4 text-amber-400" /> Best Market Conditions
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.bestConditions.map((cond, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full bg-amber-500/5 border border-amber-500/20 text-amber-300/90"
                >
                  {cond}
                </span>
              ))}
            </div>
          </section>

          {/* Example walkthrough */}
          <section className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-cyan-400" /> Example Walkthrough
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">{data.example}</p>
          </section>

          {/* Pros / Cons */}
          <div className="grid sm:grid-cols-2 gap-4">
            <section>
              <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-green-400" /> Pros
              </h3>
              <ul className="space-y-1.5">
                {data.pros.map((pro, i) => (
                  <li key={i} className="text-slate-400 text-xs leading-relaxed flex gap-2">
                    <span className="text-green-400 shrink-0">+</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-2">
                <ThumbsDown className="w-4 h-4 text-red-400" /> Cons
              </h3>
              <ul className="space-y-1.5">
                {data.cons.map((con, i) => (
                  <li key={i} className="text-slate-400 text-xs leading-relaxed flex gap-2">
                    <span className="text-red-400 shrink-0">−</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </Card>
    </div>
  )
}
