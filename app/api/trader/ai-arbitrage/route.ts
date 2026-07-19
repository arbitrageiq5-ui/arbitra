import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import OpenAI from 'openai'
import { BASE_PRICES } from '@/lib/constants/prices'

const SYSTEM_PROMPT = `You are ArbitrageIQ Assistant — an expert AI crypto arbitrage advisor embedded inside the ArbitrageIQ Trader Dashboard.

Your role:
- Analyze live cross-exchange price differences and help traders identify profitable opportunities
- Explain arbitrage mechanics, risks, and execution strategies in plain English
- Recommend optimal exchange pairs, transfer networks, and position sizing
- Give actionable, specific advice — never vague or generic

Context you have:
- Platform supports 13 exchanges: Binance, Kraken, Coinbase, Bybit, KuCoin, HTX, Bitfinex, OKX, Gate.io, Gemini, Crypto.com, Bitget, CoinGecko
- Transfer networks: TRC20 (USDT, ~$1 fee, 1-2 min), BEP20 (~$0.50, 2-3 min), ERC20 (~$3-15, 3-8 min), Solana (<$0.001, <1 min), Bitcoin (~$2-8, 30 min), Avalanche (~$0.10, 2 min)
- Typical exchange fees: Binance 0.1%, Coinbase 0.6%, Kraken 0.16%, OKX 0.08%, KuCoin 0.1%, Bybit 0.1%, Gate.io 0.2%, HTX 0.2%, Bitget 0.1%, Gemini 0.35%, Bitfinex 0.1%, Crypto.com 0.075%
- Minimum profitable spread after fees: ~0.3% gross (>0.1% net)

Rules:
- Be concise but thorough — use bullet points and structure when helpful
- Always mention fees and transfer costs when discussing opportunities
- Flag high-risk scenarios (volatile meme coins, thin liquidity, large slippage)
- If asked about a specific coin, provide its current approximate price context
- Format numbers clearly: e.g. "0.45% net profit on $10,000 = $45"
- Never make promises about guaranteed profits — always frame as estimates`

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { messages, opportunities } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      opportunities?: Array<{
        symbol: string
        buyExchange: string
        sellExchange: string
        netProfit: number
        spread: number
        risk: string
        volume24h: number
      }>
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      // Graceful fallback when no API key
      const fallback = buildFallbackResponse(messages[messages.length - 1]?.content ?? '', opportunities)
      return NextResponse.json({ content: fallback })
    }

    const openai = new OpenAI({ apiKey })

    // Build a context message with current live data
    let contextBlock = ''
    if (opportunities && opportunities.length > 0) {
      const top5 = [...opportunities]
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, 5)
      contextBlock = `\n\nCURRENT LIVE OPPORTUNITIES (top 5 by net profit):\n` +
        top5.map(o =>
          `• ${o.symbol}: Buy ${o.buyExchange} → Sell ${o.sellExchange} | Spread ${o.spread.toFixed(2)}% | Net ${o.netProfit.toFixed(2)}% | Risk ${o.risk} | Vol ${formatVol(o.volume24h)}`
        ).join('\n')
    }

    // Add selected coin prices for context
    const priceContext = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']
      .map(s => `${s}=$${BASE_PRICES[s]?.toLocaleString() ?? '?'}`)
      .join(', ')
    contextBlock += `\n\nCURRENT REFERENCE PRICES: ${priceContext}`

    const systemWithContext = SYSTEM_PROMPT + contextBlock

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemWithContext },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 800,
      stream: true,
    })

    // Stream back via ReadableStream
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) {
              controller.enqueue(encoder.encode(delta))
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[ai-arbitrage] error:', err)
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 500 })
  }
}

function formatVol(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${(v / 1e3).toFixed(0)}K`
}

function buildFallbackResponse(question: string, opportunities?: Array<{ symbol: string; buyExchange: string; sellExchange: string; netProfit: number; spread: number; risk: string }>) {
  const q = question.toLowerCase()

  if (q.includes('best') || q.includes('top') || q.includes('recommend')) {
    if (opportunities?.length) {
      const top = [...opportunities].sort((a, b) => b.netProfit - a.netProfit)[0]
      return `Based on current live data, the best opportunity right now is **${top.symbol}**: buy on ${top.buyExchange}, sell on ${top.sellExchange} for a **${top.netProfit.toFixed(2)}% net profit** (${top.spread.toFixed(2)}% gross spread).\n\nFor this trade:\n• Use TRC20 for USDT transfer if moving capital between exchanges (~$1 fee, ~1-2 min)\n• On $5,000 capital, this yields ~$${((top.netProfit / 100) * 5000).toFixed(0)} profit\n• Risk level: ${top.risk}\n\n*Connect an OpenAI API key for real-time AI analysis.*`
    }
    return `To find the best opportunities, look for pairs with:\n• **Gross spread > 0.3%** (to clear fees)\n• **High liquidity** coins (BTC, ETH, SOL, BNB)\n• **Low-fee exchange pairs** (e.g. Binance + OKX, both at 0.1%)\n\nThe Markets tab updates every 15 seconds with live data sorted by net profit.\n\n*Connect an OpenAI API key for personalized AI analysis.*`
  }

  if (q.includes('fee') || q.includes('cost') || q.includes('network')) {
    return `**Transfer Network Comparison:**\n\n• **TRC20** (USDT) — ~$1 fee, 1-2 min — best for most USDT moves\n• **BEP20** — ~$0.50 fee, 2-3 min — good for BNB chain assets\n• **Solana** — <$0.001 fee, <1 min — ideal for SOL/SPL tokens\n• **ERC20** — $3-15 fee, 3-8 min — only when necessary\n• **Bitcoin** — $2-8 fee, 30 min — avoid for arbitrage timing\n\nFor arbitrage, TRC20 USDT is almost always the best capital transfer method.\n\n*Connect an OpenAI API key for personalized AI analysis.*`
  }

  if (q.includes('risk') || q.includes('safe') || q.includes('danger')) {
    return `**Arbitrage Risk Levels:**\n\n**Low Risk:**\n• BTC, ETH, BNB, SOL — deep liquidity, tight spreads, fast settlement\n• Spread windows stay open longer\n\n**Medium Risk:**\n• Mid-cap alts (ADA, LINK, DOT) — liquidity can thin quickly\n• Price may move before transfer completes\n\n**High Risk:**\n• Meme coins (PEPE, SHIB, FLOKI) — extreme volatility, 2-5% swings in minutes\n• Only trade with capital you can afford to lose\n\n**General Rule:** Never commit more than 20% of your portfolio to a single arb trade.\n\n*Connect an OpenAI API key for personalized AI analysis.*`
  }

  return `I'm your ArbitrageIQ AI Assistant. I can help you:\n\n• **Analyze** current live opportunities in your Markets tab\n• **Explain** arbitrage mechanics and execution steps\n• **Compare** exchange fees and transfer networks\n• **Assess** risk for specific coin pairs\n• **Calculate** estimated profits for position sizes\n\nAsk me anything — for example: *"What's the best opportunity right now?"* or *"How do I execute a BTC arb between Binance and Kraken?"*\n\n*Note: Connect an OpenAI API key in your environment variables for full AI-powered responses.*`
}
