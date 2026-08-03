'use client'

/**
 * Shared UI helpers used across all Trader Dashboard components.
 * Single source of truth — import from here instead of defining locally.
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

// ── Number formatters ─────────────────────────────────────────────────────────

export function formatPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1)    return `$${p.toFixed(3)}`
  if (p >= 0.01) return `$${p.toFixed(4)}`
  if (p >= 0.0001) return `$${p.toFixed(6)}`
  return `$${p.toFixed(8)}`
}

export function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

export function formatUsd(n: number, decimals = 2): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

// ── Shared UI components ──────────────────────────────────────────────────────

/** Single copy-to-clipboard button, works with both navigator.clipboard and the copyToClipboard util */
export function CopyButton({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    try { await copyToClipboard(text) } catch { await navigator.clipboard.writeText(text) }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const cls = size === 'sm'
    ? 'p-1 rounded text-slate-500 hover:text-slate-300 transition-colors'
    : 'p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white'
  return (
    <button onClick={handle} className={cls} title="Copy">
      {copied
        ? <Check className={size === 'sm' ? 'w-3 h-3 text-green-400' : 'w-3.5 h-3.5 text-green-400'} />
        : <Copy className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
    </button>
  )
}

/** Status badge for trade/bot/deposit statuses */
const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  // Deposit / fund request statuses
  pending:     { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20',  label: 'Pending'     },
  confirmed:   { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   label: 'Confirmed'   },
  rejected:    { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: 'Rejected'    },
  // Bot statuses
  active:      { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   label: 'Active'      },
  paused:      { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   label: 'Paused'      },
  stopped:     { color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',   label: 'Stopped'     },
  completed:   { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   label: 'Completed'   },
  failed:      { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: 'Failed'      },
  in_progress: { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     label: 'In Progress' },
  cancelled:   { color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20',   label: 'Cancelled'   },
  // Arb-bot pipeline statuses
  queued:      { color: 'text-slate-400',  bg: 'bg-slate-700/40 border-slate-600/40',   label: 'Queued'      },
  buying:      { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/25',     label: 'Buying'      },
  withdrawing: { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/25',   label: 'Withdrawing' },
  depositing:  { color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/25', label: 'Depositing'  },
  selling:     { color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/25',     label: 'Selling'     },
}

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-semibold ${m.color} ${m.bg}`}>
      {m.label}
    </span>
  )
}

/** Risk chip with colour dot */
const RISK_COLORS: Record<string, { color: string; dot: string }> = {
  Low:      { color: 'text-green-400',  dot: 'bg-green-400'  },
  Medium:   { color: 'text-amber-400',  dot: 'bg-amber-400'  },
  High:     { color: 'text-orange-400', dot: 'bg-orange-400' },
  Critical: { color: 'text-red-400',    dot: 'bg-red-400'    },
}

export function RiskChip({ level, score }: { level: string; score?: number }) {
  const m = RISK_COLORS[level] ?? RISK_COLORS.Medium
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${m.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {level}
      {score !== undefined && <span className="opacity-50 font-normal">({score})</span>}
    </span>
  )
}
