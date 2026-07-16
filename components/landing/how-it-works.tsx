'use client'

import { motion } from 'framer-motion'
import { UserPlus, KeyRound, ScanSearch, ClipboardList, DollarSign, ArrowRightLeft, Bell } from 'lucide-react'

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Register',
    desc: 'Create your free account in under 60 seconds. No credit card required.',
    accent: '#00D4FF',
  },
  {
    icon: KeyRound,
    step: '02',
    title: 'Connect APIs',
    desc: 'Link your exchange API keys (read-only) to enable live price streaming.',
    accent: '#6C63FF',
  },
  {
    icon: ScanSearch,
    step: '03',
    title: 'Monitor Markets',
    desc: 'ArbiX AI continuously scans prices across all connected exchanges in real time.',
    accent: '#00FF99',
  },
  {
    icon: ClipboardList,
    step: '04',
    title: 'Review Opportunities',
    desc: 'AI-ranked list of opportunities sorted by estimated net spread and risk score.',
    accent: '#00D4FF',
  },
  {
    icon: DollarSign,
    step: '05',
    title: 'Evaluate Costs',
    desc: 'Inspect full fee breakdowns: taker fees, withdrawal costs, network gas, and timing.',
    accent: '#6C63FF',
  },
  {
    icon: ArrowRightLeft,
    step: '06',
    title: 'Execute Yourself',
    desc: 'ArbiX provides intelligence — you retain full control and execute on your own terms.',
    accent: '#00FF99',
  },
  {
    icon: Bell,
    step: '07',
    title: 'Receive Alerts',
    desc: 'Get notified via Telegram, WhatsApp, or email the instant a top opportunity appears.',
    accent: '#00D4FF',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#6C63FF]/5 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00FF99]/20 bg-[#00FF99]/5 text-[#00FF99] text-xs font-medium mb-4">
            Simple 7-Step Process
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
            How ArbiX AI Works
          </h2>
          <p className="text-[#98A2B3] text-lg max-w-xl mx-auto">
            From registration to receiving your first alert in minutes.
          </p>
        </motion.div>

        {/* Desktop: horizontal flow */}
        <div className="hidden lg:flex items-start gap-0">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex-1 relative"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="absolute top-5 left-[calc(50%+24px)] right-0 h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}
              <div className="flex flex-col items-center text-center px-2">
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 relative z-10"
                  style={{ backgroundColor: `${s.accent}15`, border: `1px solid ${s.accent}30`, boxShadow: `0 0 20px ${s.accent}15` }}
                >
                  <s.icon className="w-5 h-5" style={{ color: s.accent }} />
                </div>
                <span className="text-xs font-bold mb-1" style={{ color: s.accent }}>{s.step}</span>
                <h3 className="text-sm font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-xs text-[#98A2B3] leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile: vertical list */}
        <div className="lg:hidden flex flex-col gap-0">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex gap-5 relative"
            >
              {/* Vertical line */}
              {i < steps.length - 1 && (
                <div className="absolute left-[23px] top-12 bottom-0 w-px bg-white/[0.06]" />
              )}
              <div
                className="w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center mt-0.5"
                style={{ backgroundColor: `${s.accent}15`, border: `1px solid ${s.accent}30` }}
              >
                <s.icon className="w-5 h-5" style={{ color: s.accent }} />
              </div>
              <div className="pb-8">
                <span className="text-xs font-bold" style={{ color: s.accent }}>{s.step}</span>
                <h3 className="text-sm font-semibold text-white mt-0.5 mb-1">{s.title}</h3>
                <p className="text-sm text-[#98A2B3] leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
