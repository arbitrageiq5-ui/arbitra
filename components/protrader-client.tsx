'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import AdminArbitragePanel from '@/components/admin-arbitrage-panel'
import { TraderClient } from '@/components/trader-client'
import { Shield, Bot, LogOut, Zap, ChevronRight } from 'lucide-react'

type Mode = 'arbitrage' | 'trading'

interface ProtraderClientProps {
  user: { id: string; name?: string | null; email?: string }
  isActivated: boolean
  createdAt: string
}

export function ProtraderClient({ user, isActivated, createdAt }: ProtraderClientProps) {
  const [mode, setMode] = useState<Mode>('arbitrage')
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push('/sign-in')
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 font-sans">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-400" />
            </div>
            <div className="hidden sm:block">
              <span className="text-white font-bold text-base tracking-tight">AlgoBot</span>
              <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Pro Trader
              </span>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
            <button
              onClick={() => setMode('arbitrage')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'arbitrage'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Arbitrage Panel</span>
              <span className="sm:hidden">Arbitrage</span>
            </button>
            <button
              onClick={() => setMode('trading')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === 'trading'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">Trading Bots</span>
              <span className="sm:hidden">Bots</span>
            </button>
          </div>

          {/* Right: user info + sign out */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-white text-sm font-medium leading-tight">{user.name ?? 'Pro Trader'}</span>
              <span className="text-slate-500 text-xs leading-tight">{user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white hover:bg-slate-800 gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Mode indicator bar */}
        <div className={`h-0.5 transition-all duration-300 ${mode === 'arbitrage' ? 'bg-violet-500/60' : 'bg-cyan-500/60'}`} />
      </header>

      {/* ── Mode breadcrumb ─────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border-b border-slate-800/60 px-4 md:px-6 py-2">
        <div className="max-w-screen-xl mx-auto flex items-center gap-1.5 text-xs text-slate-500">
          <span className="text-violet-400 font-semibold">Pro Trader</span>
          <ChevronRight className="w-3 h-3" />
          <span className={mode === 'arbitrage' ? 'text-violet-300' : 'text-cyan-300'}>
            {mode === 'arbitrage' ? 'Arbitrage Panel — Full Admin Access' : 'Trading Bots — Full Trader Access'}
          </span>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {mode === 'arbitrage' ? (
          /* Full admin arbitrage panel — identical to what /admin sees */
          <div className="max-w-screen-xl mx-auto px-0 md:px-0 py-0">
            <AdminArbitragePanel />
          </div>
        ) : (
          /* Full trader dashboard — identical to /trader */
          <TraderClient user={user} isActivated={isActivated} createdAt={createdAt} />
        )}
      </div>
    </div>
  )
}
