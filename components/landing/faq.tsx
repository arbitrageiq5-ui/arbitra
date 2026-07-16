'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  {
    q: 'What is crypto arbitrage?',
    a: 'Crypto arbitrage is the practice of buying a cryptocurrency on one exchange where the price is lower, and selling it on another exchange where the price is higher — profiting from the price difference. This requires accounting for all fees, transfer times, and network costs to determine if an opportunity is genuinely profitable.',
  },
  {
    q: 'How does this platform work?',
    a: 'ArbiX AI connects to exchange APIs via read-only WebSocket feeds to monitor prices in real time. Our AI engine continuously scans for price discrepancies, calculates estimated fees and transfer costs, assigns a risk score, and ranks opportunities by estimated net spread — giving you a prioritized, actionable list.',
  },
  {
    q: 'Which exchanges are supported?',
    a: 'We currently support Binance, Coinbase, Kraken, Bybit, KuCoin, Huobi, OKX, Gate.io, Bitfinex, Gemini, Bittrex, and MEXC. We add new exchanges regularly. You can connect as many or as few as you like.',
  },
  {
    q: 'Does this platform execute trades automatically?',
    a: 'No. ArbiX AI is an intelligence and analytics platform only. We provide you with opportunity data, fee estimates, risk scores, and alerts. You retain full control over whether and how to execute any trade. We never touch your funds.',
  },
  {
    q: 'How are fees calculated?',
    a: 'We factor in taker/maker trading fees on the buy exchange, withdrawal fees, network gas costs (using live gas price oracles), taker fees on the sell exchange, and estimated slippage based on order book depth. The "Est. Net Spread" column shows the opportunity after all these costs.',
  },
  {
    q: 'How accurate is the market data?',
    a: 'We connect directly to exchange WebSocket feeds with no intermediary aggregators, achieving average latency under 50ms. Prices are streamed in real time and timestamps are shown on every row. That said, by the time you execute a trade, market conditions will have changed — always verify before acting.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="py-28 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6C63FF]/20 to-transparent" />

      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-medium mb-4">
            Frequently Asked Questions
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
            Got Questions?
          </h2>
          <p className="text-[#98A2B3] text-lg">
            Everything you need to know about ArbiX AI.
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                open === i
                  ? 'border-[#00D4FF]/20 bg-[#0E1324]'
                  : 'border-white/[0.06] bg-[#0E1324]/40 hover:border-white/[0.1]'
              }`}
            >
              <button
                className="w-full flex items-center justify-between px-6 py-5 text-left"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full border border-white/10 flex items-center justify-center">
                  {open === i
                    ? <Minus className="w-3.5 h-3.5 text-[#00D4FF]" />
                    : <Plus className="w-3.5 h-3.5 text-[#98A2B3]" />
                  }
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="px-6 pb-5 text-sm text-[#98A2B3] leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
