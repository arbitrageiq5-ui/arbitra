'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Bot, Sparkles, X, Send, StopCircle, RefreshCw,
  CheckCircle2, Zap, TrendingUp, Shield, AlertTriangle,
  ChevronRight, Copy, Check,
} from 'lucide-react'
import type { DcaConfig } from '@/lib/trading-bot-constants'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AiConfig extends DcaConfig {
  name?: string
  symbol?: string
  marketType?: 'spot' | 'futures'
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface BotAiAdvisorModalProps {
  open: boolean
  onClose: () => void
  onApplyConfig: (cfg: AiConfig) => void
}

// ─── Parse CONFIG block from AI response ───────────────────────────────────────

function extractConfig(text: string): AiConfig | null {
  const match = text.match(/```CONFIG\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as AiConfig
  } catch {
    return null
  }
}

// ─── Render markdown-lite (bold, bullets, code) ────────────────────────────────

function renderContent(text: string) {
  // Strip CONFIG block from display
  const display = text.replace(/```CONFIG[\s\S]*?```/g, '').trim()
  const lines = display.split('\n')
  return lines.map((line, i) => {
    // Heading (##)
    if (line.startsWith('## ')) {
      return <p key={i} className="text-white font-bold text-sm mt-3 mb-1">{line.slice(3)}</p>
    }
    // Heading (#)
    if (line.startsWith('# ')) {
      return <p key={i} className="text-white font-bold text-base mt-3 mb-1">{line.slice(2)}</p>
    }
    // Bullet
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 mt-1">
          <span className="text-amber-400 mt-0.5 shrink-0">•</span>
          <span className="text-slate-300 text-sm leading-relaxed">{renderInline(line.slice(2))}</span>
        </div>
      )
    }
    // Numbered
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)![1]
      return (
        <div key={i} className="flex gap-2 mt-1">
          <span className="text-amber-400 text-xs mt-0.5 shrink-0 font-bold">{num}.</span>
          <span className="text-slate-300 text-sm leading-relaxed">{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      )
    }
    // Empty line
    if (line.trim() === '') return <div key={i} className="h-2" />
    return <p key={i} className="text-slate-300 text-sm leading-relaxed">{renderInline(line)}</p>
  })
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}

// ─── Config Preview Card ────────────────────────────────────────────────────────

function ConfigPreviewCard({ cfg, onApply }: { cfg: AiConfig; onApply: () => void }) {
  const maxInvested = cfg.baseOrderSize + cfg.safetyOrderSize * cfg.maxSafetyOrders
  const estProfit = maxInvested * (cfg.takeProfitPct / 100)
  const [copied, setCopied] = useState(false)

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(cfg, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-3 bg-slate-950/80 border border-amber-500/30 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/8 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-300 text-xs font-bold uppercase tracking-wider">AI Recommended Config</span>
        </div>
        <button onClick={copyJson} className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-500 hover:text-white">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Config grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
        {cfg.name && (
          <div className="col-span-2">
            <span className="text-slate-500">Bot Name:</span>
            <span className="text-white font-semibold ml-2">{cfg.name}</span>
          </div>
        )}
        {cfg.symbol && (
          <div>
            <span className="text-slate-500">Pair:</span>
            <span className="text-cyan-300 font-mono ml-2">{cfg.symbol}</span>
          </div>
        )}
        {cfg.marketType && (
          <div>
            <span className="text-slate-500">Market:</span>
            <span className={`font-semibold ml-2 ${cfg.marketType === 'futures' ? 'text-orange-400' : 'text-blue-400'}`}>
              {cfg.marketType === 'futures' ? 'Futures' : 'Spot'}
            </span>
          </div>
        )}
        <div><span className="text-slate-500">Base Order:</span><span className="text-white font-mono ml-2">${cfg.baseOrderSize}</span></div>
        <div><span className="text-slate-500">Safety Order:</span><span className="text-white font-mono ml-2">${cfg.safetyOrderSize}</span></div>
        <div><span className="text-slate-500">Max SOs:</span><span className="text-white font-mono ml-2">{cfg.maxSafetyOrders}</span></div>
        <div><span className="text-slate-500">Price Dev:</span><span className="text-amber-400 font-mono ml-2">{cfg.priceDeviationPct}%</span></div>
        <div><span className="text-slate-500">Take Profit:</span><span className="text-green-400 font-mono ml-2">{cfg.takeProfitPct}%</span></div>
        <div><span className="text-slate-500">SO Scale:</span><span className="text-white font-mono ml-2">{cfg.safetyOrderVolumePct}x</span></div>
        <div><span className="text-slate-500">Interval:</span><span className="text-white font-mono ml-2">{cfg.interval}</span></div>
        {cfg.leverage && cfg.leverage > 1 && (
          <div><span className="text-slate-500">Leverage:</span><span className="text-orange-400 font-mono ml-2">{cfg.leverage}x</span></div>
        )}
      </div>

      {/* Est stats */}
      <div className="px-4 py-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-900 rounded-lg px-3 py-2">
          <p className="text-slate-500">Max Investment</p>
          <p className="text-white font-bold text-sm">${maxInvested.toFixed(0)}</p>
        </div>
        <div className="bg-slate-900 rounded-lg px-3 py-2">
          <p className="text-slate-500">Est. Profit / Cycle</p>
          <p className="text-green-400 font-bold text-sm">+${estProfit.toFixed(2)}</p>
        </div>
      </div>

      {/* Apply button */}
      <div className="px-4 py-3 border-t border-slate-800">
        <button
          onClick={onApply}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 transition-colors text-black font-bold text-sm"
        >
          <Zap className="w-4 h-4" />
          Apply This Config to Bot
        </button>
      </div>
    </div>
  )
}

// ─── Quick Prompt Chips ─────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: 'Low risk BTC', icon: Shield,        prompt: 'Set up a low-risk conservative BTC/USDT DCA bot with $300 budget' },
  { label: 'ETH bull run',  icon: TrendingUp,   prompt: 'Configure a medium-risk ETH bot optimized for bull market conditions with $500 budget' },
  { label: 'SOL aggressive',icon: Zap,          prompt: 'Create an aggressive high-profit SOL DCA bot with $400 budget, I can handle higher risk' },
  { label: 'Safe $100',     icon: Shield,        prompt: 'Best DCA bot config for only $100 starting capital, low risk please' },
  { label: 'Bear market',   icon: AlertTriangle, prompt: 'Recommend bot settings for a bear market to average down safely on BTC with $1000' },
  { label: 'Best ROI',      icon: TrendingUp,   prompt: 'What bot settings give the best return on investment while keeping risk medium?' },
]

// ─── Main Modal ─────────────────────────────────────────────────────────────────

export function BotAiAdvisorModal({ open, onClose, onApplyConfig }: BotAiAdvisorModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [pendingConfig, setPendingConfig] = useState<AiConfig | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setStreaming(true)
    setStreamText('')
    setPendingConfig(null)

    abortRef.current = new AbortController()
    let full = ''

    try {
      const res = await fetch('/api/trader/ai-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setStreamText(full)
      }

      const cfg = extractConfig(full)
      if (cfg) setPendingConfig(cfg)
      setMessages(prev => [...prev, { role: 'assistant', content: full }])
      setStreamText('')
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
        setStreamText('')
      }
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming])

  function stopStreaming() {
    abortRef.current?.abort()
    if (streamText) {
      setMessages(prev => [...prev, { role: 'assistant', content: streamText }])
    }
    setStreamText('')
    setStreaming(false)
  }

  function handleApplyConfig(cfg: AiConfig) {
    onApplyConfig(cfg)
    onClose()
  }

  if (!open) return null

  const showWelcome = messages.length === 0 && !streaming

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-slate-950 border border-slate-800 rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl"
        style={{ height: '92vh', maxHeight: '780px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/25 flex items-center justify-center">
              <Bot className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-none">AI Bot Advisor</h2>
              <p className="text-slate-500 text-xs mt-0.5">Get a personalized DCA configuration from AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setStreamText(''); setPendingConfig(null) }}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors border border-slate-800"
                title="New conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {showWelcome ? (
            <div className="space-y-5">
              {/* Welcome */}
              <div className="text-center pt-4 pb-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/25 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-white font-bold text-lg">AI Bot Configuration</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                  Tell me your trading goals and I&apos;ll generate the perfect DCA bot settings. The config can be applied directly to the bot creator.
                </p>
              </div>

              {/* Quick prompts */}
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-3">Quick Start</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map(qp => (
                    <button
                      key={qp.label}
                      onClick={() => sendMessage(qp.prompt)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-800/80 transition-all text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <qp.icon className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <span className="text-slate-300 text-sm group-hover:text-white transition-colors">{qp.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 ml-auto transition-colors" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-slate-600 text-xs">or ask anything</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'user'
                      ? 'bg-slate-700 border border-slate-600'
                      : 'bg-amber-500/15 border border-amber-500/25'
                  }`}>
                    {msg.role === 'user'
                      ? <span className="text-xs text-white font-bold">U</span>
                      : <Bot className="w-3.5 h-3.5 text-amber-400" />
                    }
                  </div>
                  <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.role === 'user' ? (
                      <div className="inline-block bg-slate-800 border border-slate-700 rounded-2xl rounded-tr-sm px-4 py-2.5 text-white text-sm text-left">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="space-y-0.5">{renderContent(msg.content)}</div>
                        {/* Show config preview on last assistant message if it has one */}
                        {i === messages.length - 1 && pendingConfig && (
                          <ConfigPreviewCard
                            cfg={pendingConfig}
                            onApply={() => handleApplyConfig(pendingConfig)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {streaming && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  </div>
                  <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                    {streamText ? (
                      <div className="space-y-0.5">{renderContent(streamText)}</div>
                    ) : (
                      <div className="flex gap-1 items-center py-1">
                        {[0, 1, 2].map(d => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-bounce"
                            style={{ animationDelay: `${d * 0.15}s` }} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Applied config success badge */}
        {pendingConfig && !streaming && messages.length > 0 && (
          <div className="mx-5 mb-1">
            <button
              onClick={() => handleApplyConfig(pendingConfig)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors text-amber-300 text-sm font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              Apply AI Config to Bot Creator
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="px-5 py-4 border-t border-slate-800 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder="Describe your goals, budget, risk level... (Enter to send)"
              rows={2}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none transition-colors leading-relaxed"
            />
            {streaming ? (
              <button
                onClick={stopStreaming}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-black"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-slate-600 text-xs mt-2 text-center">AI suggestions are for guidance only — always review settings before trading.</p>
        </div>
      </div>
    </div>
  )
}
