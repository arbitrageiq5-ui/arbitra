'use client'

import { motion } from 'framer-motion'
import { Zap, Brain, BarChart3, LayoutDashboard, ShieldCheck, Activity, Palette, Database } from 'lucide-react'

const reasons = [
  {
    icon: Zap,
    title: 'Ultra Fast',
    desc: 'Sub-50ms WebSocket feeds ensure you always see the freshest spreads before others.',
    stat: '47ms',
    statLabel: 'avg. latency',
    accent: '#00D4FF',
  },
  {
    icon: Brain,
    title: 'AI Powered',
    desc: 'GPT-4 scoring factors 12+ variables per opportunity including liquidity, volatility, and fees.',
    stat: 'GPT-4',
    statLabel: 'AI engine',
    accent: '#6C63FF',
  },
  {
    icon: BarChart3,
    title: 'Professional Analytics',
    desc: 'Bloomberg-level data density with interactive charts, heat maps, and spread history.',
    stat: '200+',
    statLabel: 'data points',
    accent: '#00FF99',
  },
  {
    icon: LayoutDashboard,
    title: 'Advanced Dashboard',
    desc: 'Customizable widgets, saved filters, watchlists, and a command palette for power users.',
    stat: '12+',
    statLabel: 'exchanges',
    accent: '#00D4FF',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    desc: 'AES-256 key encryption, read-only API permissions, and full audit logging on every action.',
    stat: 'AES-256',
    statLabel: 'encryption',
    accent: '#6C63FF',
  },
  {
    icon: Activity,
    title: 'High Availability',
    desc: '99.9% uptime SLA with auto-failover and multi-region WebSocket relay infrastructure.',
    stat: '99.9%',
    statLabel: 'uptime SLA',
    accent: '#00FF99',
  },
  {
    icon: Palette,
    title: 'Beautiful UI',
    desc: 'Apple-level design polish with fluid animations, glassmorphism, and dark/light modes.',
    stat: 'WCAG AA',
    statLabel: 'accessible',
    accent: '#00D4FF',
  },
  {
    icon: Database,
    title: 'Accurate Market Data',
    desc: 'Direct exchange WebSocket connections — no third-party aggregators inflating latency.',
    stat: '38,400+',
    statLabel: 'markets',
    accent: '#6C63FF',
  },
]

export function WhyChooseUs() {
  return (
    <section className="py-28 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6C63FF]/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/5 text-[#00D4FF] text-xs font-medium mb-4">
            Why Algobot
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
            Built for Serious Traders
          </h2>
          <p className="text-[#98A2B3] text-lg max-w-xl mx-auto">
            Every feature is designed around one goal: giving you the best intelligence, fastest.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reasons.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
              whileHover={{ y: -4 }}
              className="relative p-6 rounded-2xl border border-white/[0.06] bg-[#0E1324]/60 group overflow-hidden"
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${r.accent}08, transparent 70%)` }}
              />
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: `${r.accent}12`, border: `1px solid ${r.accent}25` }}
              >
                <r.icon className="w-5 h-5" style={{ color: r.accent }} />
              </div>
              <div className="mb-3">
                <span className="text-2xl font-bold text-white">{r.stat}</span>
                <span className="text-xs text-[#98A2B3] ml-2">{r.statLabel}</span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{r.title}</h3>
              <p className="text-xs text-[#98A2B3] leading-relaxed">{r.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
