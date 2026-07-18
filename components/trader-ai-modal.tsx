'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Bot, Send, Sparkles, TrendingUp, Shield, DollarSign,
  Zap, RefreshCw, ChevronRight, AlertTriangle, Wifi, WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Opportunity {
  symbol: string
  buyExchange: string
  sellExchange: string
  netProfit: number
  spread: number
  risk: 'Low' | 'Medium' | 'High'
  volume24h: number
  detectedAt: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  opportunities: Opportunity[]
}

const QUICK_QUESTIONS = [
  { icon: TrendingUp,    label: 'Best opportunity now',     prompt: 'What is the best arbitrage opportunity available right now based on current live data?' },
  { icon: DollarSign,   label: 'Profit on $5,000',         prompt: 'If I deploy $5,000 capital on the top opportunities right now, what profit can I realistically expect?' },
  { icon: Shield,       label: 'Lowest risk plays',        prompt: 'Which current opportunities have the lowest risk? Explain why and how to execute them safely.' },
  { icon: Zap,          label: 'Best transfer network',    prompt: 'Which transfer network should I use to move capital between exchanges quickly and cheaply?' },
  { icon: AlertTriangle, label: 'What to avoid',           prompt: 'Which coins or exchanges should I avoid for arbitrage right now and why?' },
  { icon: RefreshCw,    label: 'Execution steps',          prompt: 'Walk me through the exact steps to execute an arbitrage trade from start to finish on this platform.' },
]

const RISK_COLOR: Record<string, string> = {
  Low: 'text-green-400 bg-green-500/10 border-green-500/20',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  High: 'text-red-400 bg-red-500/10 border-red-500/20',
}

function formatVol(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${(v / 1e3).toFixed(0)}K`
}

function MarkdownText({ text }: { text: string }) {
  // Parse **bold**, *italic*, bullet points, and line breaks
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*  ')
        const content = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
        return (
          <p
            key={i}
            className={`text-sm leading-relaxed ${isBullet ? 'pl-3 border-l border-slate-700' : ''}`}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )
      })}
    </div>
  )
}

export function TraderAiArbitrageModal({ open, onClose, opportunities }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(true)
  const [showQuickStart, setShowQuickStart] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (messages.length === 0) setShowQuickStart(true)
    }
  }, [open, messages.length])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !streaming) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, streaming])

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || streaming) return

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: userText.trim() }
    const assistantId = `a-${Date.now()}`

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setShowQuickStart(false)

    // Optimistic assistant bubble
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true }])

    abortRef.current = new AbortController()

    try {
      const historyForApi = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/trader/ai-arbitrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: historyForApi,
          opportunities: opportunities.slice(0, 20).map(o => ({
            symbol: o.symbol,
            buyExchange: o.buyExchange,
            sellExchange: o.sellExchange,
            netProfit: o.netProfit,
            spread: o.spread,
            risk: o.risk,
            volume24h: o.volume24h,
          })),
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const contentType = res.headers.get('content-type') ?? ''

      if (contentType.includes('text/plain')) {
        // Streaming response
        setConnected(true)
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: fullText, streaming: true } : m
          ))
        }

        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: fullText, streaming: false } : m
        ))
      } else {
        // JSON fallback response
        const data = await res.json()
        const text = data.content ?? data.error ?? 'No response from AI.'
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: text, streaming: false } : m
        ))
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: m.content || '_(stopped)_', streaming: false } : m
        ))
      } else {
        setConnected(false)
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Could not reach AI service. Please check your connection and try again.', streaming: false }
            : m
        ))
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [messages, opportunities, streaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
  }

  const clearChat = () => {
    setMessages([])
    setShowQuickStart(true)
  }

  if (!open) return null

  const top3 = [...opportunities].sort((a, b) => b.netProfit - a.netProfit).slice(0, 3)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !streaming && onClose()}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-3xl h-[95vh] sm:h-[85vh] flex flex-col bg-slate-950 border border-slate-700/60 sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-amber-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-slate-900" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-sm sm:text-base">ArbitrageIQ AI Advisor</h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">AI</span>
            </div>
            <p className="text-slate-500 text-xs truncate">
              {connected
                ? `Live data — ${opportunities.length} opportunities loaded`
                : 'Offline mode — limited responses'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {connected
              ? <Wifi className="w-3.5 h-3.5 text-green-400" />
              : <WifiOff className="w-3.5 h-3.5 text-red-400" />
            }
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                disabled={streaming}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="Clear chat"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => !streaming && onClose()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Quick start state */}
          {showQuickStart && messages.length === 0 && (
            <div className="p-4 sm:p-5 space-y-5">
              {/* Welcome */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
                  <p className="text-white text-sm leading-relaxed font-medium">
                    Hello! I&apos;m your ArbitrageIQ AI Advisor.
                  </p>
                  <p className="text-slate-400 text-sm leading-relaxed mt-1">
                    I have access to your <span className="text-amber-400 font-medium">{opportunities.length} live opportunities</span> and can help you find the best arbitrage plays, understand risks, and plan execution strategies.
                  </p>
                </div>
              </div>

              {/* Top 3 live opportunities */}
              {top3.length > 0 && (
                <div className="space-y-2">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-1">Top Opportunities Right Now</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {top3.map((opp, i) => (
                      <button
                        key={opp.symbol + i}
                        onClick={() => sendMessage(`Analyze the ${opp.symbol} arbitrage opportunity: buy on ${opp.buyExchange}, sell on ${opp.sellExchange}. What's the best execution strategy?`)}
                        className="text-left p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-bold text-sm">{opp.symbol}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${RISK_COLOR[opp.risk]}`}>
                            {opp.risk}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mb-1.5">{opp.buyExchange} → {opp.sellExchange}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-green-400 font-bold text-sm">+{opp.netProfit.toFixed(2)}%</span>
                          <span className="text-amber-400 text-xs font-medium">
                            +${((opp.netProfit / 100) * 1000).toFixed(2)}/1k
                          </span>
                        </div>
                        <p className="text-slate-600 text-xs mt-1">Vol: {formatVol(opp.volume24h)}</p>
                        <div className="flex items-center gap-1 mt-2 text-slate-600 group-hover:text-amber-400 transition-colors">
                          <span className="text-xs">Analyze</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick questions */}
              <div className="space-y-2">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-1">Quick Questions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_QUESTIONS.map(q => (
                    <button
                      key={q.label}
                      onClick={() => sendMessage(q.prompt)}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-800/60 transition-all text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-amber-500/30 transition-colors">
                        <q.icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                      </div>
                      <span className="text-slate-300 text-sm group-hover:text-white transition-colors">{q.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 ml-auto transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="px-4 sm:px-5 py-4 space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'user'
                      ? 'bg-amber-500/15 border border-amber-500/25'
                      : 'bg-slate-800 border border-slate-700'
                  }`}>
                    {msg.role === 'user'
                      ? <span className="text-amber-400 text-xs font-bold">You</span>
                      : <Bot className="w-3.5 h-3.5 text-slate-400" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-amber-500/10 border border-amber-500/20 rounded-tr-sm text-white'
                      : 'bg-slate-900 border border-slate-800 rounded-tl-sm text-slate-200'
                  }`}>
                    {msg.role === 'assistant' && msg.content ? (
                      <MarkdownText text={msg.content} />
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                    {msg.streaming && msg.content === '' && (
                      <div className="flex gap-1 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                    )}
                    {msg.streaming && msg.content !== '' && (
                      <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="border-t border-slate-800 bg-slate-900/80 px-4 sm:px-5 py-3 shrink-0">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about opportunities, risks, execution steps..."
                rows={1}
                disabled={streaming}
                className="w-full resize-none bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-amber-500/50 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors disabled:opacity-60 leading-relaxed max-h-32 overflow-y-auto"
                style={{ minHeight: '46px' }}
              />
              {input.trim() && !streaming && (
                <button
                  onClick={() => sendMessage(input)}
                  className="absolute right-2 bottom-2 w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-black" />
                </button>
              )}
            </div>
            {streaming && (
              <Button
                variant="outline"
                size="sm"
                onClick={stopStreaming}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 shrink-0 h-[46px] px-4"
              >
                Stop
              </Button>
            )}
          </div>
          <p className="text-slate-600 text-[10px] mt-2 text-center">
            AI responses are for informational purposes only. Always verify opportunities before trading.
          </p>
        </div>
      </div>
    </div>
  )
}
