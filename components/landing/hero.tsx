'use client'

import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Play, TrendingUp, Zap, Globe, Clock } from 'lucide-react'
import Link from 'next/link'

function AnimatedCounter({ from, to, suffix = '' }: { from: number; to: number; suffix?: string }) {
  const count = useMotionValue(from)
  const [display, setDisplay] = useState(from)

  useEffect(() => {
    const controls = animate(count, to, {
      duration: 2,
      delay: 0.5,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return controls.stop
  }, [count, to])

  return <span>{display.toLocaleString()}{suffix}</span>
}

const stats = [
  { icon: Globe, label: 'Exchanges Supported', value: 12, suffix: '+' },
  { icon: TrendingUp, label: 'Active Opportunities', value: 2847, suffix: '' },
  { icon: Zap, label: 'Markets Monitored', value: 38400, suffix: '+' },
  { icon: Clock, label: 'Response Speed', value: 47, suffix: 'ms' },
]

// Animated floating particle dots for background
function ParticleField() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 4,
    duration: Math.random() * 6 + 4,
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#00D4FF]/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.8, 0.2] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

// Animated grid lines
function GridLines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
      }}
    />
  )
}

// Animated orbs
function Orbs() {
  return (
    <>
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-[#6C63FF]/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-[#00D4FF]/8 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-[#00FF99]/6 blur-[80px] pointer-events-none" />
    </>
  )
}

// Exchange logos as text badges
const exchanges = ['Binance', 'Coinbase', 'Kraken', 'Bybit', 'KuCoin', 'Huobi', 'OKX', 'Gate.io']

function FloatingExchangeBadge({ name, index }: { name: string; index: number }) {
  const angle = (index / exchanges.length) * 2 * Math.PI
  const radius = 200
  const cx = 50 + Math.cos(angle) * 35
  const cy = 50 + Math.sin(angle) * 35

  return (
    <motion.div
      className="absolute"
      style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)' }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3 + index * 0.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
    >
      <div className="px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 bg-[#0E1324]/80 backdrop-blur-sm text-[#98A2B3] shadow-lg whitespace-nowrap">
        {name}
      </div>
    </motion.div>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16">
      <GridLines />
      <Orbs />
      <ParticleField />

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/5 text-[#00D4FF] text-sm font-medium mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-[#00FF99] animate-pulse" />
            AI-Powered Arbitrage Intelligence — Live
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.05] text-balance mb-6"
          >
            Find Real-Time Crypto{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(90deg, #00D4FF, #6C63FF)' }}
            >
              Arbitrage Opportunities
            </span>{' '}
            Across Multiple Exchanges
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-[#98A2B3] leading-relaxed max-w-2xl mx-auto mb-10"
          >
            Monitor prices across global exchanges, compare spreads, estimate transaction costs,
            and identify potential arbitrage opportunities using AI-powered analytics.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link
              href="/sign-up"
              className="group flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-[#050816] bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-all shadow-[0_0_30px_rgba(0,212,255,0.4)] hover:shadow-[0_0_50px_rgba(0,212,255,0.6)]"
            >
              Start Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#markets"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all backdrop-blur-sm"
            >
              View Live Demo
            </a>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 text-sm text-[#98A2B3] hover:text-white transition-colors"
            >
              <span className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center">
                <Play className="w-3 h-3 ml-0.5" />
              </span>
              Watch Platform Tour
            </a>
          </motion.div>

          {/* Live stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1 p-4 rounded-2xl border border-white/[0.06] bg-[#0E1324]/60 backdrop-blur-sm"
              >
                <stat.icon className="w-5 h-5 text-[#00D4FF] mb-1" />
                <span className="text-2xl font-bold text-white">
                  <AnimatedCounter from={0} to={stat.value} suffix={stat.suffix} />
                </span>
                <span className="text-xs text-[#98A2B3] text-center">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Floating exchange badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="relative h-[180px] mt-12 hidden lg:block"
        >
          {exchanges.map((name, i) => (
            <FloatingExchangeBadge key={name} name={name} index={i} />
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-16 h-16 rounded-2xl bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center shadow-[0_0_40px_rgba(0,212,255,0.3)]">
              <Zap className="w-7 h-7 text-[#00D4FF]" />
            </div>
            {/* Connection ring */}
            <motion.div
              className="absolute inset-0 rounded-2xl border border-[#00D4FF]/20"
              animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </div>

      {/* Supported exchanges strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="relative z-10 w-full border-t border-white/[0.06] mt-8 py-4 overflow-hidden"
      >
        <p className="text-center text-xs text-[#98A2B3] mb-3">Supported Exchanges</p>
        <div className="flex items-center justify-center gap-6 flex-wrap px-6">
          {exchanges.map((ex) => (
            <span key={ex} className="text-sm font-medium text-[#98A2B3]/60 hover:text-[#98A2B3] transition-colors">
              {ex}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
