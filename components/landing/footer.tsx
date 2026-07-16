'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Send, ExternalLink, Globe, MessageCircle } from 'lucide-react'
import { ArbitrageIQLogo } from '@/components/logo'

const links = {
  Product: ['Features', 'Live Markets', 'AI Scanner', 'API', 'Pricing'],
  Company: ['About', 'Blog', 'Careers', 'Press', 'Contact'],
  Legal: ['Privacy', 'Terms', 'Cookies', 'Risk Disclosure', 'Compliance'],
  Developers: ['Documentation', 'API Reference', 'WebSocket Docs', 'Status', 'GitHub'],
}

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] pt-20 pb-10 overflow-hidden">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-[#00D4FF]/3 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-16">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="inline-flex mb-5">
              <ArbitrageIQLogo size="sm" variant="full" />
            </Link>
            <p className="text-sm text-[#98A2B3] leading-relaxed mb-6 max-w-xs">
              AI-powered crypto arbitrage intelligence. Monitor, compare, and discover
              opportunities across 12+ exchanges in real time.
            </p>
            <div className="flex items-center gap-3">
              {[
                { icon: ExternalLink, label: 'X / Twitter' },
                { icon: Globe, label: 'GitHub' },
                { icon: MessageCircle, label: 'LinkedIn' },
                { icon: Send, label: 'Telegram' },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-[#98A2B3] hover:text-white hover:border-white/20 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([title, items]) => (
            <div key={title}>
              <p className="text-xs font-semibold text-white mb-4 uppercase tracking-wider">{title}</p>
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li key={item}>
                    <a
                      href="#"
                      className="text-sm text-[#98A2B3] hover:text-white transition-colors"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.06] pt-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <p className="text-xs text-[#98A2B3]/60">
              &copy; 2025 ArbitrageIQ. All rights reserved.
            </p>
            <p className="text-xs text-[#98A2B3]/40 max-w-lg text-right leading-relaxed">
              Crypto markets involve significant risk. Arbitrage opportunities depend on market conditions, liquidity,
              transfer times, fees, and exchange availability. This platform provides market intelligence and analytics only.
              Users are responsible for their own trading decisions.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
