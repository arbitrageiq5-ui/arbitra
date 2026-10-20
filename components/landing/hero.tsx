'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Bot, CheckCircle2, Play, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { ArbitrageIQLogo } from '@/components/logo'

const metrics = [
  { value: '24/7', label: 'Autonomous execution', icon: Bot },
  { value: '12+', label: 'Connected exchanges', icon: TrendingUp },
  { value: '<50ms', label: 'Opportunity scanning', icon: Sparkles },
]

const botCapabilities = ['DCA and grid strategies', 'Cross-exchange arbitrage', 'Risk controls and auto-exit']

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#03070d] pt-24 text-white sm:pt-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_22%,rgba(0,174,255,0.17),transparent_28%),radial-gradient(circle_at_18%_72%,rgba(0,102,255,0.12),transparent_32%)]" />
      <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-20 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-28">
        <div className="max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <ArbitrageIQLogo size="md" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee]" /> Autonomous trading infrastructure
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="text-balance text-5xl font-black leading-[0.98] tracking-[-0.06em] sm:text-7xl">
            Build your edge.
            <span className="block bg-gradient-to-r from-white via-cyan-200 to-blue-500 bg-clip-text text-transparent">Let the bots execute.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
            Algobot turns market signals into disciplined automated execution. Deploy DCA, grid, and arbitrage bots across crypto markets with transparent controls built for serious traders.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-bold text-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.28)] transition hover:bg-cyan-300">
              Launch your first bot <ArrowRight className="size-4" />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"><Play className="size-4" /> See how it works</a>
          </motion.div>
          <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
            {botCapabilities.map((item) => <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-cyan-400" />{item}</span>)}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.18 }} className="relative">
          <div className="absolute -inset-8 rounded-[2.5rem] bg-cyan-500/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#09111d]/90 p-3 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-white/8 bg-[#050b13]">
              <img src="/algobot-logo.png" alt="Algobot AI trading robot" className="h-72 w-full object-cover object-center opacity-90 sm:h-96" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050b13] via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-slate-950/75 p-4 backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" /> Bot fleet online</div><span className="text-xs text-slate-500">LIVE</span></div>
                <div className="grid grid-cols-3 gap-2">{metrics.map(({ value, label, icon: Icon }) => <div key={label} className="rounded-xl bg-white/[0.05] p-2.5"><Icon className="mb-2 size-4 text-cyan-300" /><div className="text-sm font-bold text-white">{value}</div><div className="mt-0.5 text-[10px] leading-3 text-slate-500">{label}</div></div>)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 pb-1 pt-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-cyan-400" /> Rules-first execution</span><span>BTC · ETH · XAU</span></div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
