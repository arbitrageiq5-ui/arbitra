'use client'

import { useEffect, useState } from 'react'
import { AuthForm } from '@/components/auth-form'

export function AuthAccess() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up')

  useEffect(() => {
    const syncModeFromHash = () => {
      setMode(window.location.hash === '#auth-sign-in' ? 'sign-in' : 'sign-up')
    }
    syncModeFromHash()
    window.addEventListener('hashchange', syncModeFromHash)
    return () => window.removeEventListener('hashchange', syncModeFromHash)
  }, [])

  const selectMode = (nextMode: 'sign-in' | 'sign-up') => {
    setMode(nextMode)
    window.history.replaceState(null, '', nextMode === 'sign-in' ? '#auth-sign-in' : '#auth-sign-up')
    document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="auth" className="relative overflow-hidden border-t border-white/[0.06] bg-[#050a12] py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(0,212,255,0.12),transparent_28rem),radial-gradient(circle_at_85%_70%,rgba(38,102,255,0.1),transparent_28rem)]" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Access Algobot
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Put your trading plan on autopilot.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
            Create an account to explore live markets, configure your first bot, and connect your exchange when you are ready.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            {['Free account setup', 'Bot-ready workspace', 'Risk controls included', 'Live market intelligence'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3">
                <span className="size-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(0,212,255,0.8)]" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {(['sign-up', 'sign-in'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => selectMode(item)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${mode === item ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/15' : 'text-slate-400 hover:text-white'}`}
              >
                {item === 'sign-up' ? 'Create account' : 'Sign in'}
              </button>
            ))}
          </div>
          <AuthForm mode={mode} embedded />
        </div>
      </div>
    </section>
  )
}
