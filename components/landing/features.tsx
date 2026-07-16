'use client'

import { motion } from 'framer-motion'
import {
  Brain, Radio, Building2, ArrowDownUp, ArrowUpDown, Network,
  BarChart2, Calculator, ShieldAlert, Trophy, LineChart, Briefcase,
  Send, MessageSquare, Mail, Code2, Wifi, Moon,
} from 'lucide-react'

const features = [
  { icon: Brain, title: 'AI Opportunity Scanner', desc: 'GPT-4 powered scoring ranks opportunities by estimated profit, risk, and liquidity in real time.', accent: '#00D4FF' },
  { icon: Radio, title: 'Real-Time Price Monitoring', desc: 'WebSocket feeds from 12+ exchanges with sub-50ms latency for always-accurate data.', accent: '#6C63FF' },
  { icon: Building2, title: 'Multi Exchange Support', desc: 'Connect Binance, Coinbase, Kraken, Bybit, KuCoin, Huobi and more from one dashboard.', accent: '#00FF99' },
  { icon: ArrowDownUp, title: 'Withdrawal Status', desc: 'Live withdrawal availability per coin per exchange so you never miss a window.', accent: '#00D4FF' },
  { icon: ArrowUpDown, title: 'Deposit Status', desc: 'Real-time deposit confirmations and estimated credit times for every network.', accent: '#6C63FF' },
  { icon: Network, title: 'Network Comparison', desc: 'Compare transfer costs and times across ERC-20, BEP-20, TRC-20, Solana and more.', accent: '#00FF99' },
  { icon: BarChart2, title: 'Spread Analytics', desc: 'Historical spread charts with trend lines help you time your entries perfectly.', accent: '#00D4FF' },
  { icon: Calculator, title: 'Fee Estimator', desc: 'Automatically factors taker fees, network gas, and slippage into every calculation.', accent: '#6C63FF' },
  { icon: ShieldAlert, title: 'Risk Score', desc: 'Per-opportunity risk score based on liquidity depth, volatility, and exchange health.', accent: '#00FF99' },
  { icon: Trophy, title: 'Opportunity Ranking', desc: 'Sorted by estimated net spread so the best opportunities always surface first.', accent: '#00D4FF' },
  { icon: LineChart, title: 'Historical Charts', desc: 'Price history across all connected exchanges on a single synchronized chart.', accent: '#6C63FF' },
  { icon: Briefcase, title: 'Portfolio Tracking', desc: 'Track your paper trades and real positions with P&L, ROI, and cost basis.', accent: '#00FF99' },
  { icon: Send, title: 'Telegram Alerts', desc: 'Instant bot alerts the moment a qualifying opportunity appears on your watchlist.', accent: '#00D4FF' },
  { icon: MessageSquare, title: 'WhatsApp Alerts', desc: 'Reach you on WhatsApp Business API when high-score opportunities are detected.', accent: '#6C63FF' },
  { icon: Mail, title: 'Email Notifications', desc: 'Daily digests and real-time alerts straight to your inbox with full opportunity details.', accent: '#00FF99' },
  { icon: Code2, title: 'API Integration', desc: 'Programmatic REST & WebSocket API to pipe ArbitrageIQ data into your own systems.', accent: '#00D4FF' },
  { icon: Wifi, title: 'WebSocket Engine', desc: 'Persistent WebSocket connections ensure zero-latency streaming to your browser.', accent: '#6C63FF' },
  { icon: Moon, title: 'Dark & Light Mode', desc: 'System-aware theme that looks stunning in both dark and light environments.', accent: '#00FF99' },
]

export function Features() {
  return (
    <section id="features" className="py-28 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-medium mb-4">
            18 Powerful Features
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
            Everything You Need to Trade Smarter
          </h2>
          <p className="text-[#98A2B3] text-lg max-w-2xl mx-auto">
            A complete arbitrage intelligence toolkit — from real-time scanning to AI scoring to instant alerts.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: (i % 6) * 0.06 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group p-6 rounded-2xl border border-white/[0.06] bg-[#0E1324]/60 hover:bg-[#0E1324] hover:border-white/[0.1] transition-all cursor-default"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${f.accent}12`, border: `1px solid ${f.accent}25` }}
              >
                <f.icon className="w-5 h-5" style={{ color: f.accent }} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-[#98A2B3] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
