'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Bot, Send, X, RefreshCw, Sparkles, TrendingUp,
  Users, Wallet, BarChart3, Activity, ChevronRight,
  Shield, Copy, Check, AlertCircle, Zap,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AdminContext {
  userCount?: number
  traderCount?: number
  pendingDeposits?: number
  pendingWithdrawals?: number
  pendingActivations?: number
  activePlans?: number
  confirmedFunds?: number
  opportunities?: Array<{
    symbol: string
    buyExchange: string
    sellExchange: string
    spread: number
    netProfit: number
    risk: string
  }>
}

interface AdminAiPanelProps {
  context: AdminContext
}

// Quick-action prompt cards shown before first message
const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    label: 'Best Opportunities',
    prompt: 'What are the best arbitrage opportunities available right now? Rank them by net profit and explain which to prioritize.',
  },
  {
    icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    label: 'Platform Summary',
    prompt: 'Give me a summary of the current platform status — users, pending items, and what needs my attention most urgently.',
  },
  {
    icon: Activity,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    label: 'India Exchange Arb',
    prompt: 'Explain the Indian exchange arbitrage opportunities. Which coins show the biggest INR premium vs global prices right now?',
  },
  {
    icon: Wallet,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    label: 'Auto-Trade Advice',
    prompt: 'What parameters should I use for auto-trade plans? Give me recommended gross return %, fee %, and principal ranges for different trader risk profiles.',
  },
  {
    icon: BarChart3,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    label: 'Gold & Silver Setup',
    prompt: 'How should I set up Gold and Silver trading for my Pro Traders? Which strategies work best on CoinSwitch and Delta Exchange?',
  },
  {
    icon: Shield,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    label: 'Risk Assessment',
    prompt: 'Which current arbitrage opportunities carry the most risk? What should I watch out for in thin liquidity situations?',
  },
]

function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // H2/H3 headers
    if (line.startsWith('### ')) {
      nodes.push(<h3 key={i} className="text-white font-bold text-sm mt-3 mb-1">{inlineFormat(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} className="text-white font-bold text-base mt-3 mb-1.5">{inlineFormat(line.slice(3))}</h2>)
    } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      nodes.push(<p key={i} className="text-white font-bold text-sm mt-2 mb-0.5">{inlineFormat(line.slice(2, -2))}</p>)
    } else if (line.startsWith('• ') || line.startsWith('- ')) {
      nodes.push(
        <div key={i} className="flex items-start gap-2 my-0.5 ml-2">
          <span className="text-slate-500 mt-1 shrink-0 text-xs">•</span>
          <span className="text-slate-300 text-sm leading-relaxed">{inlineFormat(line.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      nodes.push(
        <div key={i} className="flex items-start gap-2 my-0.5 ml-2">
          <span className="text-slate-500 text-xs mt-1 shrink-0 font-mono w-4">{num}.</span>
          <span className="text-slate-300 text-sm leading-relaxed">{inlineFormat(line.replace(/^\d+\. /, ''))}</span>
        </div>
      )
    } else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1.5" />)
    } else if (line.startsWith('---') || line.startsWith('===')) {
      nodes.push(<hr key={i} className="border-slate-700 my-2" />)
    } else {
      nodes.push(<p key={i} className="text-slate-300 text-sm leading-relaxed">{inlineFormat(line)}</p>)
    }

    i++
  }
  return nodes
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="font-mono text-xs bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded">{part.slice(1, -1)}</code>
    return part
  })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-slate-400 transition-colors"
      title="Copy response"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export default function AdminAiPanel({ context }: AdminAiPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim()
    if (!userText || streaming) return

    setError(null)
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/admin/ai-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, context }),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        throw new Error(`API error ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)
        )
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Failed to get AI response. Please try again.')
      setMessages(prev => prev.filter(m => m.id !== assistantId))
    } finally {
      setStreaming(false)
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [messages, streaming, context])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function clearChat() {
    if (streaming) { abortRef.current?.abort(); setStreaming(false) }
    setMessages([])
    setError(null)
  }

  // Stats chips shown at top
  const chips = [
    { label: `${context.userCount ?? 0} users`, color: 'text-blue-400' },
    { label: `${context.traderCount ?? 0} traders`, color: 'text-amber-400' },
    context.pendingDeposits ? { label: `${context.pendingDeposits} pending deposits`, color: 'text-yellow-400' } : null,
    context.pendingWithdrawals ? { label: `${context.pendingWithdrawals} pending withdrawals`, color: 'text-orange-400' } : null,
    context.opportunities?.length ? { label: `${context.opportunities.length} live opportunities`, color: 'text-green-400' } : null,
  ].filter(Boolean) as { label: string; color: string }[]

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-amber-500/20 border border-red-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-red-400" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-slate-950" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">AI Admin Assistant</h2>
            <p className="text-slate-500 text-xs">Platform guidance, arbitrage analysis & strategy</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New chat
          </button>
        )}
      </div>

      {/* Platform context chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 shrink-0">
          <span className="text-slate-600 text-xs self-center">Live context:</span>
          {chips.map((chip, i) => (
            <span key={i} className={`text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 ${chip.color}`}>
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="space-y-5">
            {/* Welcome card */}
            <Card className="bg-slate-900/60 border-slate-800 p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-1">Welcome to your AI Admin Assistant</p>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    I have full context about your platform — users, pending requests, live arbitrage opportunities across 21 exchanges, and trading strategies. Ask me anything.
                  </p>
                </div>
              </div>
            </Card>

            {/* Quick prompts */}
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">Quick actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {QUICK_PROMPTS.map(qp => (
                  <button
                    key={qp.label}
                    onClick={() => sendMessage(qp.prompt)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all hover:border-slate-600 hover:bg-slate-800/60 bg-slate-900/60 border-slate-800 group`}
                  >
                    <div className={`p-1.5 rounded-lg ${qp.bg} border ${qp.border} shrink-0`}>
                      <qp.icon className={`w-4 h-4 ${qp.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-sm font-medium leading-tight group-hover:text-white transition-colors">{qp.label}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-red-400" />
                </div>
              )}
              <div className={`max-w-[82%] ${msg.role === 'user' ? 'max-w-[70%]' : ''}`}>
                {msg.role === 'user' ? (
                  <div className="bg-red-600/20 border border-red-500/20 rounded-2xl rounded-tr-md px-4 py-3">
                    <p className="text-white text-sm leading-relaxed">{msg.content}</p>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-md px-4 py-3.5">
                    {msg.content ? (
                      <div className="space-y-0.5">
                        {renderMarkdown(msg.content)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-slate-500 text-xs">Analyzing...</span>
                      </div>
                    )}
                    {msg.content && !streaming && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
                        <span className="text-slate-600 text-[10px]">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <CopyButton text={msg.content} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {error && (
          <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 shrink-0">
        <form onSubmit={handleSubmit}>
          <div className="flex items-end gap-2 bg-slate-900 border border-slate-700 rounded-2xl p-2 focus-within:border-red-500/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about opportunities, users, plans, strategies..."
              rows={1}
              disabled={streaming}
              className="flex-1 bg-transparent resize-none text-white placeholder-slate-600 text-sm px-2 py-1.5 focus:outline-none leading-relaxed max-h-32 overflow-y-auto"
              style={{ minHeight: '36px' }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {streaming && (
                <button
                  type="button"
                  onClick={() => { abortRef.current?.abort(); setStreaming(false) }}
                  className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Stop generating"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <Button
                type="submit"
                disabled={!input.trim() || streaming}
                size="sm"
                className="rounded-xl bg-red-600 hover:bg-red-500 text-white h-9 w-9 p-0 disabled:opacity-30 transition-all"
              >
                {streaming
                  ? <Zap className="w-4 h-4 animate-pulse" />
                  : <Send className="w-4 h-4" />
                }
              </Button>
            </div>
          </div>
          <p className="text-slate-700 text-[10px] mt-1.5 text-center">
            Enter to send · Shift+Enter for new line · AI responses may not reflect live market changes
          </p>
        </form>
      </div>
    </div>
  )
}
