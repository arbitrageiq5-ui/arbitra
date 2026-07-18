'use server'
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are an expert crypto trading bot advisor specializing in DCA (Dollar-Cost Averaging) strategy configuration.

Your role is to help traders configure their DCA bots optimally based on:
- Their risk tolerance (low/medium/high)
- Their available capital budget
- Their preferred trading pair (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, MATIC, LINK, LTC, UNI, ATOM, TRX)
- Current market conditions (bull/bear/sideways)
- Their experience level

When recommending DCA bot settings, ALWAYS provide specific values in this exact JSON format at the end of your response, wrapped in a code block labeled "CONFIG":

\`\`\`CONFIG
{
  "name": "BTC DCA Bot",
  "symbol": "BTC/USDT",
  "marketType": "spot",
  "baseOrderSize": 50,
  "safetyOrderSize": 50,
  "maxSafetyOrders": 5,
  "priceDeviationPct": 2.5,
  "safetyOrderVolumePct": 1.5,
  "takeProfitPct": 3.0,
  "interval": "4h",
  "leverage": 1
}
\`\`\`

Rules for configurations:
- baseOrderSize: $5–$500 (first buy order size)
- safetyOrderSize: $5–$500 (additional buy on each dip)
- maxSafetyOrders: 1–10 (how many times to buy the dip)
- priceDeviationPct: 0.5%–10% (% drop before each safety order)
- safetyOrderVolumePct: 1x–3x (scale factor for each safety order)
- takeProfitPct: 0.5%–20% (% above avg cost to sell all)
- interval: "manual" | "1h" | "4h" | "1d"
- leverage: 1–10 (futures only, always recommend 1 for spot)
- marketType: "spot" (default, safer) or "futures" (only if trader explicitly wants it)

Risk profiles:
- LOW RISK: smaller order sizes, more safety orders, smaller deviation (catch gradual drops), lower TP
- MEDIUM RISK: balanced settings, moderate leverage only on futures
- HIGH RISK: larger position sizes, aggressive TP, fewer safety orders

Market conditions:
- BULL: fewer safety orders needed, higher TP %, smaller deviation
- BEAR: more safety orders, smaller sizes per order spread wider, lower TP
- SIDEWAYS: balanced, medium TP, medium deviation

Be concise, friendly, and always explain WHY you chose each parameter value. Then provide the CONFIG block.`

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages } = await req.json()

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    // Graceful fallback — rule-based responses
    const lastMsg = (messages[messages.length - 1]?.content ?? '').toLowerCase()
    let reply = ''

    if (lastMsg.includes('low risk') || lastMsg.includes('conservative') || lastMsg.includes('safe')) {
      reply = `For a **low-risk DCA bot**, I recommend a conservative setup designed to accumulate gradually during dips with minimal capital at risk per trade.

**Why these settings work:**
- Small base + safety orders mean you never over-commit to a single position
- 6 safety orders catch a 15%+ overall drawdown
- 2.5% take profit is achievable even in sideways markets
- 1h interval checks frequently without over-trading

\`\`\`CONFIG
{
  "name": "Conservative DCA Bot",
  "symbol": "BTC/USDT",
  "marketType": "spot",
  "baseOrderSize": 30,
  "safetyOrderSize": 30,
  "maxSafetyOrders": 6,
  "priceDeviationPct": 2.5,
  "safetyOrderVolumePct": 1.2,
  "takeProfitPct": 2.0,
  "interval": "1h",
  "leverage": 1
}
\`\`\``
    } else if (lastMsg.includes('btc') || lastMsg.includes('bitcoin')) {
      reply = `For a **BTC DCA bot**, Bitcoin's lower volatility versus altcoins means you can use tighter deviations.

**Recommended BTC settings:**
- BTC rarely drops >10% intraday, so 2.0% deviation catches most micro-dips
- 5 safety orders covers a ~10% total drawdown ladder
- 3% take profit is a realistic target for BTC in any market

\`\`\`CONFIG
{
  "name": "BTC DCA Bot",
  "symbol": "BTC/USDT",
  "marketType": "spot",
  "baseOrderSize": 50,
  "safetyOrderSize": 50,
  "maxSafetyOrders": 5,
  "priceDeviationPct": 2.0,
  "safetyOrderVolumePct": 1.5,
  "takeProfitPct": 3.0,
  "interval": "4h",
  "leverage": 1
}
\`\`\``
    } else if (lastMsg.includes('eth') || lastMsg.includes('ethereum') || lastMsg.includes('sol') || lastMsg.includes('solana')) {
      const coin = lastMsg.includes('sol') ? 'SOL' : 'ETH'
      reply = `For a **${coin} DCA bot**, these assets have higher volatility than BTC so I recommend wider safety order spacing to handle bigger swings.

\`\`\`CONFIG
{
  "name": "${coin} DCA Bot",
  "symbol": "${coin}/USDT",
  "marketType": "spot",
  "baseOrderSize": 40,
  "safetyOrderSize": 45,
  "maxSafetyOrders": 5,
  "priceDeviationPct": 3.0,
  "safetyOrderVolumePct": 1.5,
  "takeProfitPct": 3.5,
  "interval": "4h",
  "leverage": 1
}
\`\`\``
    } else if (lastMsg.includes('high risk') || lastMsg.includes('aggressive')) {
      reply = `For an **aggressive high-risk DCA bot**, I'll configure larger positions with fewer safety nets but higher potential profits.

⚠️ Warning: High-risk bots can run out of safety orders in strong downtrends. Only use capital you can afford to hold long-term.

\`\`\`CONFIG
{
  "name": "Aggressive DCA Bot",
  "symbol": "SOL/USDT",
  "marketType": "spot",
  "baseOrderSize": 100,
  "safetyOrderSize": 120,
  "maxSafetyOrders": 3,
  "priceDeviationPct": 4.0,
  "safetyOrderVolumePct": 2.0,
  "takeProfitPct": 5.0,
  "interval": "1h",
  "leverage": 1
}
\`\`\``
    } else {
      reply = `I can help you configure the perfect DCA bot for your needs. To give you optimal settings, tell me:

1. **Which coin?** (BTC, ETH, SOL, BNB, XRP, etc.)
2. **Your budget?** (How much USDT total you want to deploy)
3. **Risk level?** (Low / Medium / High)
4. **Market view?** (Bullish, Bearish, or Sideways)

For example: *"Set up a medium-risk BTC bot with $500 total budget for a bull market"*`
    }

    const stream = new ReadableStream({
      start(controller) {
        const words = reply.split('')
        let i = 0
        const interval = setInterval(() => {
          if (i < words.length) {
            controller.enqueue(new TextEncoder().encode(words[i]))
            i++
          } else {
            clearInterval(interval)
            controller.close()
          }
        }, 8)
      }
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  const openai = new OpenAI({ apiKey })

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    stream: true,
    max_tokens: 800,
    temperature: 0.7,
  })

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(new TextEncoder().encode(text))
      }
      controller.close()
    },
  })

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
