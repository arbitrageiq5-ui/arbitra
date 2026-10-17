'use client'

import { motion } from 'framer-motion'
import { Star, CheckCircle2 } from 'lucide-react'

const testimonials = [
  {
    name: 'Marcus Chen',
    role: 'Quantitative Trader',
    company: 'Independent',
    avatar: 'MC',
    stars: 5,
    text: 'ArbitrageIQ found a 1.3% net spread on SOL within 2 minutes of me signing up. The AI scoring is genuinely impressive — it flagged a liquidity risk I would have missed manually.',
    accent: '#00D4FF',
  },
  {
    name: 'Priya Nair',
    role: 'Portfolio Manager',
    company: 'DeFi Capital',
    avatar: 'PN',
    stars: 5,
    text: "The fee estimator alone is worth the subscription. Finally a tool that shows me the REAL net spread after withdrawal fees and gas — not the fake headline number other tools show.",
    accent: '#6C63FF',
  },
  {
    name: 'Alex Roth',
    role: 'Crypto Analyst',
    company: 'BlockView Research',
    avatar: 'AR',
    stars: 5,
    text: "The Bloomberg Terminal of crypto arbitrage. I use it every morning for my market brief. The historical charts and cross-exchange comparison are the best I've seen in any tool.",
    accent: '#00FF99',
  },
  {
    name: 'Sofia Marchetti',
    role: 'Algorithmic Trader',
    company: 'Vertex Fund',
    avatar: 'SM',
    stars: 5,
    text: "The API integration let me plug ArbitrageIQ data straight into my execution system. Sub-50ms latency is real — I measured it. The role-based access control is perfect for our team.",
    accent: '#00D4FF',
  },
  {
    name: 'James Okafor',
    role: 'Independent Trader',
    company: 'Self-employed',
    avatar: 'JO',
    stars: 5,
    text: "Telegram alerts are a game changer. I set a 0.8% minimum net spread filter and now I only get notified for opportunities worth acting on. Zero noise.",
    accent: '#6C63FF',
  },
  {
    name: 'Yuki Tanaka',
    role: 'Derivatives Strategist',
    company: 'Apex Trading',
    avatar: 'YT',
    stars: 5,
    text: 'Switched from a competitor and never looked back. The UI is light years ahead — dark mode, glass cards, smooth animations. Feels like using a premium product. Because it is.',
    accent: '#00FF99',
  },
]

export function Testimonials() {
  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00FF99]/15 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00FF99]/20 bg-[#00FF99]/5 text-[#00FF99] text-xs font-medium mb-4">
            Trusted by 3,200+ traders
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 text-balance">
            Traders Love ArbitrageIQ
          </h2>
          <p className="text-[#98A2B3] text-lg max-w-xl mx-auto">
            From quant funds to independent traders — real results from real users.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              className="relative p-6 rounded-2xl border border-white/[0.06] bg-[#0E1324]/70 backdrop-blur-sm group overflow-hidden"
            >
              {/* Glow top edge */}
              <div
                className="absolute top-0 left-0 right-0 h-px opacity-60"
                style={{ background: `linear-gradient(90deg, transparent, ${t.accent}60, transparent)` }}
              />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, si) => (
                  <Star key={si} className="w-3.5 h-3.5 fill-[#00FF99] text-[#00FF99]" />
                ))}
              </div>

              <p className="text-sm text-[#98A2B3] leading-relaxed mb-6 italic">
                &ldquo;{t.text}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${t.accent}15`, border: `1px solid ${t.accent}30`, color: t.accent }}
                >
                  {t.avatar}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00D4FF] flex-shrink-0" />
                  </div>
                  <p className="text-xs text-[#98A2B3] truncate">
                    {t.role} · {t.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
