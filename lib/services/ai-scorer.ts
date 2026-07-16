import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface OpportunityScoringRequest {
  symbol: string
  buyExchange: string
  buyPrice: number
  sellExchange: string
  sellPrice: number
  profitPercentage: number
  volume?: number
  volatility?: number
}

export interface OpportunityScore {
  score: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SKIP'
  reasoning: string
  factors: {
    profitability: number
    liquidity: number
    exchangeReliability: number
    executionRisk: number
    marketTiming: number
  }
}

const EXCHANGE_SCORES = {
  binance: 95,
  coinbase: 90,
  kraken: 88,
  bybit: 85,
  kucoin: 80,
  huobi: 75,
}

export async function scoreOpportunityWithAI(
  opportunity: OpportunityScoringRequest
): Promise<OpportunityScore> {
  const buyExchangeScore = EXCHANGE_SCORES[opportunity.buyExchange as keyof typeof EXCHANGE_SCORES] || 70
  const sellExchangeScore = EXCHANGE_SCORES[opportunity.sellExchange as keyof typeof EXCHANGE_SCORES] || 70

  const prompt = `You are an expert crypto trader evaluating arbitrage opportunities. Analyze this opportunity and provide a comprehensive assessment.

**Opportunity Details:**
- Symbol: ${opportunity.symbol}
- Buy Exchange: ${opportunity.buyExchange} (Reliability Score: ${buyExchangeScore}/100)
- Buy Price: $${opportunity.buyPrice.toFixed(2)}
- Sell Exchange: ${opportunity.sellExchange} (Reliability Score: ${sellExchangeScore}/100)
- Sell Price: $${opportunity.sellPrice.toFixed(2)}
- Profit Margin: ${opportunity.profitPercentage.toFixed(2)}%
${opportunity.volume ? `- Trading Volume: ${opportunity.volume.toLocaleString()} units` : ''}
${opportunity.volatility ? `- Market Volatility: ${opportunity.volatility.toFixed(1)}%` : ''}

**Evaluation Criteria:**
1. **Profitability (0-25 points):** After fees (0.1% taker on both sides) and withdrawal costs, is the profit sustainable?
2. **Liquidity (0-20 points):** Can orders be filled at stated prices? Both exchanges?
3. **Exchange Reliability (0-20 points):** How trustworthy/stable are these exchanges?
4. **Execution Risk (0-20 points):** What could go wrong? Network delays, order rejection, price slippage?
5. **Market Timing (0-15 points):** Is this window likely to stay open long enough to execute?

**Expected Fees:**
- Maker/Taker: 0.1% each exchange
- Withdrawal: ~$1-2 for major coins
- Network confirmation: Depends on blockchain

Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "score": <0-100>,
  "riskLevel": "<LOW|MEDIUM|HIGH>",
  "recommendation": "<STRONG_BUY|BUY|HOLD|SKIP>",
  "reasoning": "<2-3 sentence concise assessment>",
  "factors": {
    "profitability": <0-25>,
    "liquidity": <0-20>,
    "exchangeReliability": <0-20>,
    "executionRisk": <0-20>,
    "marketTiming": <0-15>
  }
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    })

    const content = response.choices[0].message.content || '{}'
    const parsed = JSON.parse(content) as OpportunityScore

    return {
      score: Math.max(0, Math.min(100, parsed.score || 0)),
      riskLevel: parsed.riskLevel || 'MEDIUM',
      recommendation: parsed.recommendation || 'HOLD',
      reasoning: parsed.reasoning || 'Unable to evaluate',
      factors: parsed.factors || {
        profitability: 0,
        liquidity: 0,
        exchangeReliability: 0,
        executionRisk: 0,
        marketTiming: 0,
      },
    }
  } catch (error) {
    console.error('[v0] AI scoring error:', error)
    // Fallback scoring based on profit percentage
    const baseScore = Math.min(100, opportunity.profitPercentage * 10)
    return {
      score: baseScore,
      riskLevel: baseScore > 75 ? 'LOW' : baseScore > 50 ? 'MEDIUM' : 'HIGH',
      recommendation: baseScore > 75 ? 'BUY' : baseScore > 50 ? 'HOLD' : 'SKIP',
      reasoning: `Arbitrage opportunity with ${opportunity.profitPercentage.toFixed(2)}% potential profit. Manual review recommended.`,
      factors: {
        profitability: Math.min(25, opportunity.profitPercentage * 5),
        liquidity: 15,
        exchangeReliability: 15,
        executionRisk: 10,
        marketTiming: 10,
      },
    }
  }
}

export async function batchScoreOpportunities(
  opportunities: OpportunityScoringRequest[]
): Promise<Map<number, OpportunityScore>> {
  const results = new Map<number, OpportunityScore>()

  // Score in batches of 3 to avoid rate limits
  for (let i = 0; i < opportunities.length; i += 3) {
    const batch = opportunities.slice(i, i + 3)
    const scores = await Promise.all(batch.map(opp => scoreOpportunityWithAI(opp)))

    batch.forEach((opp, idx) => {
      results.set(i + idx, scores[idx])
    })

    // Add delay between batches
    if (i + 3 < opportunities.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}
