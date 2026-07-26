export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are ArbitrageIQ Admin Assistant — a senior-level AI advisor embedded exclusively in the ArbitrageIQ Admin Dashboard.

You help platform administrators with three core domains:

1. PLATFORM MANAGEMENT
   - User role management (viewer, trader, protrader, admin)
   - Deposit address configuration (TRC20, BEP20, ERC20 networks)
   - Fund request review and approval workflows
   - Withdrawal request processing
   - Activation fee approvals for new traders
   - Auto-trade plan creation and monitoring

2. ARBITRAGE OPPORTUNITY ANALYSIS
   - Analyze live cross-exchange price spreads across 21 exchanges
   - Identify the most profitable opportunities by net profit, volume, and risk
   - Explain execution steps, transfer networks, and fee structures
   - Recommend optimal position sizes given platform capital
   - Flag high-risk or thin-liquidity situations
   - Assess spread sustainability and opportunity window duration

3. STRATEGY & OPERATIONS GUIDANCE
   - Advise on auto-trade plan parameters (principal, gross return %, fee %)
   - Suggest optimal DCA bot configurations for traders
   - Guide on Gold/Silver tokenized asset trading (XAU, XAG, XAUT, PAXG)
   - Recommend which exchanges to prioritize for specific coins
   - Help interpret platform-wide trading metrics

PLATFORM CONTEXT:
- 21 exchanges supported (Global: Binance, Bybit, KuCoin, OKX, Gate.io, Kraken, Coinbase, Bitget, MEXC, HTX, Bitfinex, Gemini, Upbit, Phemex | India: CoinDCX, CoinSwitch, WazirX, Delta Exchange, BitBns, ZebPay, Mudrex)
- Transfer networks: TRC20 (USDT, ~$1 fee, 1-2 min), BEP20 (~$0.50, 2-3 min), ERC20 (~$3-15, 3-8 min), Solana (<$0.001, <1 min)
- Exchange fee ranges: 0.00% (MEXC) to 0.60% (Coinbase); most major exchanges 0.08-0.20%
- Minimum profitable gross spread: 0.3% (clears dual exchange fees + transfer cost)
- Platform roles: viewer (read-only), trader (full access), protrader (all features + bots + arbitrage), admin (platform management)
- Auto-trade plans: admin creates fixed-return plans for traders (principal + gross return % + platform fee %)
- India exchanges: Prices in INR are auto-converted to USD at ~84 INR/USD for CoinDCX, WazirX, BitBns, ZebPay; Delta Exchange and CoinSwitch use USDT pairs
- Gold/Silver trading: Available on CoinSwitch and Delta Exchange (XAU/USDT, XAG/USDT, XAUT/USDT, PAXG/USDT)

RESPONSE STYLE:
- Be direct, precise, and actionable — this is an admin tool, not a consumer product
- Use structured markdown (headers, bullet points, tables) when comparing data
- Always cite specific numbers: percentages, fees, times, dollar amounts
- When analyzing opportunities, rank by net profit after ALL costs (exchange fees on both sides + transfer fee)
- For operational questions, give step-by-step instructions
- Flag risks and regulatory considerations where relevant
- Never give generic advice — always be specific to the ArbitrageIQ platform context`

interface Message {
  role: 'user' | 'assistant'
  content: string
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin-only route
    const body = await req.json()
    const { messages, context } = body as { messages: Message[]; context?: AdminContext }

    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      const fallback = buildFallbackResponse(messages[messages.length - 1]?.content ?? '', context)
      // Simulate streaming for fallback
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          const chars = fallback.split('')
          let i = 0
          const tick = setInterval(() => {
            if (i < chars.length) {
              controller.enqueue(encoder.encode(chars[i++]))
            } else {
              clearInterval(tick)
              controller.close()
            }
          }, 6)
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
      })
    }

    const openai = new OpenAI({ apiKey })

    // Build rich context block for this request
    let contextBlock = ''
    if (context) {
      contextBlock += '\n\nCURRENT PLATFORM SNAPSHOT:'
      if (context.userCount !== undefined)       contextBlock += `\n• Total users: ${context.userCount}`
      if (context.traderCount !== undefined)     contextBlock += `\n• Active traders: ${context.traderCount}`
      if (context.pendingDeposits !== undefined) contextBlock += `\n• Pending deposit requests: ${context.pendingDeposits}`
      if (context.pendingWithdrawals !== undefined) contextBlock += `\n• Pending withdrawal requests: ${context.pendingWithdrawals}`
      if (context.pendingActivations !== undefined) contextBlock += `\n• Pending activation fees: ${context.pendingActivations}`
      if (context.activePlans !== undefined)     contextBlock += `\n• Active auto-trade plans: ${context.activePlans}`
      if (context.confirmedFunds !== undefined)  contextBlock += `\n• Total confirmed deposits: $${context.confirmedFunds.toLocaleString()}`

      if (context.opportunities?.length) {
        const top = [...context.opportunities]
          .sort((a, b) => b.netProfit - a.netProfit)
          .slice(0, 8)
        contextBlock += `\n\nTOP LIVE ARBITRAGE OPPORTUNITIES:\n` +
          top.map((o, i) =>
            `${i + 1}. ${o.symbol}: Buy ${o.buyExchange} → Sell ${o.sellExchange} | Gross ${o.spread.toFixed(2)}% | Net ${o.netProfit.toFixed(2)}% | Risk: ${o.risk}`
          ).join('\n')
      }
    }

    const systemWithContext = SYSTEM_PROMPT + contextBlock

    const openaiStream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemWithContext },
        ...messages,
      ],
      temperature: 0.35,
      max_tokens: 1000,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of openaiStream) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) controller.enqueue(encoder.encode(delta))
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
    console.error('[admin-ai-support] error:', err)
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 500 })
  }
}

function buildFallbackResponse(question: string, context?: AdminContext): string {
  const q = question.toLowerCase()

  if (q.includes('opportunity') || q.includes('arbitrage') || q.includes('spread') || q.includes('best')) {
    if (context?.opportunities?.length) {
      const sorted = [...context.opportunities].sort((a, b) => b.netProfit - a.netProfit)
      const top3 = sorted.slice(0, 3)
      return `**Top Arbitrage Opportunities Right Now:**\n\n` +
        top3.map((o, i) =>
          `**${i + 1}. ${o.symbol}**\n• Route: Buy ${o.buyExchange} → Sell ${o.sellExchange}\n• Gross spread: ${o.spread.toFixed(2)}% | Net profit: ${o.netProfit.toFixed(2)}%\n• Risk: ${o.risk}\n• Est. profit on $10,000: $${((o.netProfit / 100) * 10000).toFixed(0)}`
        ).join('\n\n') +
        `\n\n**Execution Tip:** Use TRC20 for USDT transfers between exchanges (~$1 fee, 1-2 min). For Indian exchanges (CoinDCX, WazirX), factor in the INR/USD spread (~0.1-0.3% additional cost).\n\n*Connect an OpenAI API key for advanced AI analysis.*`
    }
    return `**Finding Arbitrage Opportunities:**\n\nRun a Full Market Scan in the Arbitrage tab to get live data from all 21 exchanges. Then ask me to analyze the results.\n\n**What to look for:**\n• Gross spread > 0.3% (after dual exchange fees)\n• High-liquidity pairs (BTC, ETH, SOL, BNB) — windows last longer\n• Indian exchange pairs (CoinDCX, WazirX) often show 0.5-1.5% INR premium vs global exchanges\n• Avoid spreads on meme coins with <$1M 24h volume\n\n*Connect an OpenAI API key for full AI-powered analysis.*`
  }

  if (q.includes('user') || q.includes('trader') || q.includes('role')) {
    const snapshot = context ? `\n\nYour platform currently has **${context.userCount ?? '?'} total users** and **${context.traderCount ?? '?'} active traders**.` : ''
    return `**User Management Guide:**${snapshot}\n\n**Role Hierarchy:**\n• **Viewer** — read-only, cannot trade or access bots\n• **Trader** — full access to portfolio, deposits, basic bots\n• **Pro Trader** — all trader features + advanced bots + arbitrage scanner\n• **Admin** — platform management, user creation, fund approval\n\n**Promote a trader:**\nGo to the Users tab → find the user → change role from the dropdown.\n\n**Create accounts:**\nUse "Create Pro Trader" for premium users or "Create Admin" for team members. Always share passwords through a secure channel.\n\n*Connect an OpenAI API key for personalized platform advice.*`
  }

  if (q.includes('deposit') || q.includes('fund') || q.includes('withdrawal') || q.includes('wallet')) {
    const pending = context ? `\n\n**Pending items:** ${context.pendingDeposits ?? 0} deposits, ${context.pendingWithdrawals ?? 0} withdrawals.` : ''
    return `**Fund Operations Overview:**${pending}\n\n**Deposit Review:**\n• Go to Fund Requests tab\n• Verify the tx hash on the correct blockchain explorer\n• TRC20: tronscan.org | BEP20: bscscan.com | ERC20: etherscan.io\n• Confirm only after on-chain verification\n\n**Withdrawal Processing:**\n• Review the wallet address carefully before approving\n• Add the tx hash after broadcasting so the trader can track it\n• Typical processing: TRC20 same day, ERC20 may take 30-60 min\n\n**Deposit Addresses:**\nKeep at least one active address per network (TRC20, BEP20, ERC20).\n\n*Connect an OpenAI API key for personalized guidance.*`
  }

  if (q.includes('plan') || q.includes('auto-trade') || q.includes('return') || q.includes('profit')) {
    const plans = context?.activePlans !== undefined ? `\n\nYou currently have **${context.activePlans} active auto-trade plans**.` : ''
    return `**Auto-Trade Plan Guide:**${plans}\n\n**Creating a plan:**\n• Principal: how much the trader is deploying\n• Gross Return %: total return including your platform fee\n• Platform Fee %: deducted from gross return (default: 10-20%)\n• Net Return = Gross Return - Platform Fee\n\n**Recommended parameters:**\n• Conservative plan: 5-8% gross, 10% fee → 4.5-7.2% net\n• Standard plan: 10-15% gross, 15% fee → 8.5-12.75% net\n• Aggressive plan: 20-30% gross, 20% fee → 16-24% net\n\n**Always set realistic expectations** — link plan duration to your actual arbitrage trading cycle.\n\n*Connect an OpenAI API key for tailored plan advice.*`
  }

  if (q.includes('india') || q.includes('coindcx') || q.includes('wazirx') || q.includes('coinswitch') || q.includes('delta')) {
    return `**Indian Exchange Arbitrage Guide:**\n\n**Key Opportunity: INR Premium**\nIndian exchanges typically price BTC and ETH at a 0.5-2% premium over global USD prices due to capital control restrictions. This creates structural arbitrage opportunities.\n\n**Best pairs to watch:**\n• CoinDCX / WazirX vs Binance: BTC, ETH, SOL\n• Delta Exchange vs OKX: BTC/USDT perpetuals\n• CoinSwitch vs Coinbase: XAU/USDT (Gold)\n\n**Execution note:** Cross-border INR arbitrage requires careful compliance review. USDT-only pairs on CoinSwitch and Delta Exchange are cleaner for international traders.\n\n**India-specific exchanges on platform:**\nCoinDCX, CoinSwitch, WazirX, Delta Exchange, BitBns, ZebPay, Mudrex (7 total).\n\n*Connect an OpenAI API key for live analysis.*`
  }

  return `**ArbitrageIQ Admin AI — Ready to Help**\n\nI can assist you with:\n\n**Arbitrage Analysis**\n• Analyze the current live scan results and rank opportunities\n• Calculate net profit after all fees for specific exchange pairs\n• Identify Indian exchange (INR premium) opportunities\n\n**Platform Operations**\n• Guide through deposit/withdrawal review workflows\n• Advise on auto-trade plan parameters\n• Help with user role management\n\n**Strategy Guidance**\n• Recommend DCA bot configurations for your traders\n• Gold & Silver trading setup (CoinSwitch, Delta Exchange)\n• Optimal exchange pairs for different coin categories\n\nTry asking: *"What are the best opportunities right now?"* or *"How should I configure an auto-trade plan for a $5,000 principal?"*\n\n*Note: Add OPENAI_API_KEY to environment variables for full GPT-4o responses.*`
}
