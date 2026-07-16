'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, Bot, User } from 'lucide-react'

const PROMPTS = [
  'Show BTC opportunities',
  'Show USDT spreads',
  'Compare Binance and Bybit',
  'Rank by estimated net spread',
  'Explain transfer costs',
  "Summarize today's market",
]

const RESPONSES: Record<string, string> = {
  'Show BTC opportunities':
    'Found 8 BTC opportunities. Top pick: Bybit → Coinbase, spread 1.24%, est. net 0.91% after fees. Liquidity: High. Recommended window: now.',
  'Show USDT spreads':
    'USDT spreads are currently tight (0.02–0.08%). Best opportunity: Gate.io → Binance on TRC-20, est. net 0.06%. Low risk, high speed.',
  'Compare Binance and Bybit':
    'Binance has 0.1% taker fee; Bybit 0.075%. Bybit withdrawal fees are ~12% lower on ERC-20. Net advantage: Bybit for most spot pairs today.',
  'Rank by estimated net spread':
    '1. SOL Kraken→Bybit 1.38% net · 2. ETH OKX→Coinbase 1.21% net · 3. BTC Huobi→Binance 0.91% net · 4. AVAX KuCoin→Bybit 0.87% net',
  'Explain transfer costs':
    'Transfer costs include: network gas fee, exchange withdrawal fee, and potential slippage. For ETH on ERC-20 expect ~$4–12 total. BEP-20 is ~$0.30. Always factor these before executing.',
  "Summarize today's market":
    "Today's top sectors: Layer-1s showing 0.8–1.4% spreads. BTC premium on Asian exchanges vs US. 2,847 active opportunities detected. Overall liquidity: Good.",
}

interface Message {
  role: 'user' | 'ai'
  text: string
}

export function AISection() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hello! I\'m ArbiX AI. Ask me about opportunities, spreads, fees, or market conditions.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  function send(prompt: string) {
    if (!prompt.trim()) return
    const userMsg: Message = { role: 'user', text: prompt }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const key = Object.keys(RESPONSES).find((k) =>
      prompt.toLowerCase().includes(k.toLowerCase().split(' ')[1] ?? k)
    )
    const reply = key ? RESPONSES[key] : 'I\'m analyzing the markets right now. Based on current data, there are 2,847 active opportunities across 12 exchanges. Would you like me to narrow that down by coin, exchange, or minimum spread?'

    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'ai', text: reply }])
      setLoading(false)
    }, 900)
  }

  return (
    <section id="ai" className="py-28 relative">
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-[#6C63FF]/8 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 text-[#6C63FF] text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Powered by GPT-4
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
              Meet{' '}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #6C63FF, #00D4FF)' }}>
                ArbiX AI
              </span>
            </h2>
            <p className="text-[#98A2B3] text-lg leading-relaxed mb-8">
              Ask anything about markets, opportunities, fees, or spreads in plain English.
              ArbiX AI understands context, compares exchanges, and surfaces the best insights instantly.
            </p>

            <p className="text-sm font-medium text-white mb-4">Try asking:</p>
            <div className="flex flex-col gap-2">
              {PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-left text-sm px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] text-[#98A2B3] hover:text-white hover:border-[#6C63FF]/40 hover:bg-[#6C63FF]/5 transition-all group flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6C63FF] group-hover:bg-[#00D4FF] transition-colors" />
                  {p}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Right: chat UI */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-2xl border border-white/[0.08] bg-[#0E1324]/90 backdrop-blur-xl overflow-hidden shadow-[0_0_60px_rgba(108,99,255,0.12)]"
          >
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
              <div className="w-8 h-8 rounded-xl bg-[#6C63FF]/20 border border-[#6C63FF]/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#6C63FF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">ArbiX AI</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FF99] animate-pulse" />
                  <span className="text-xs text-[#00FF99]">Online</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="h-72 overflow-y-auto flex flex-col gap-4 p-5">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                        m.role === 'ai'
                          ? 'bg-[#6C63FF]/20 border border-[#6C63FF]/30'
                          : 'bg-[#00D4FF]/20 border border-[#00D4FF]/30'
                      }`}
                    >
                      {m.role === 'ai'
                        ? <Bot className="w-3.5 h-3.5 text-[#6C63FF]" />
                        : <User className="w-3.5 h-3.5 text-[#00D4FF]" />
                      }
                    </div>
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        m.role === 'ai'
                          ? 'bg-white/[0.05] text-[#98A2B3] rounded-tl-sm'
                          : 'bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-white rounded-tr-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3 items-center"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#6C63FF]/20 border border-[#6C63FF]/30 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-[#6C63FF]" />
                    </div>
                    <div className="flex gap-1 px-4 py-3 rounded-2xl bg-white/[0.05]">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[#98A2B3]"
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/[0.06]">
              <form
                onSubmit={(e) => { e.preventDefault(); send(input) }}
                className="flex items-center gap-3"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about opportunities, spreads, fees..."
                  className="flex-1 text-sm px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#98A2B3] focus:outline-none focus:border-[#6C63FF]/40 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-xl bg-[#6C63FF] text-white flex items-center justify-center hover:bg-[#6C63FF]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_16px_rgba(108,99,255,0.4)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
