import { NextRequest, NextResponse } from 'next/server'
import { getPricesAcrossExchanges, detectArbitrageOpportunities } from '@/lib/services/exchanges'
import { db } from '@/lib/db'
import { arbitrageOpportunities, priceHistory } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const COMMON_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'LINKUSDT',
  'LTCUSDT',
  'UNIUSDT',
]

export async function GET(request: NextRequest) {
  try {
    // Fetch prices from all exchanges
    const prices = await getPricesAcrossExchanges(COMMON_SYMBOLS)

    // Store price history
    for (const price of prices) {
      await db.insert(priceHistory).values({
        symbol: price.symbol,
        exchange: price.exchange,
        price: price.price.toString(),
        timestamp: new Date(price.timestamp),
      })
    }

    // Detect arbitrage opportunities
    const opportunities = detectArbitrageOpportunities(prices, 0.3)

    // Check for existing opportunities to avoid duplicates
    for (const opp of opportunities) {
      const existing = await db
        .select()
        .from(arbitrageOpportunities)
        .where(
          eq(arbitrageOpportunities.symbol, opp.symbol) &&
            eq(arbitrageOpportunities.buyExchange, opp.buyExchange) &&
            eq(arbitrageOpportunities.sellExchange, opp.sellExchange)
        )
        .limit(1)

      // If opportunity doesn't exist or last one is older than 5 minutes, create new one
      if (existing.length === 0 || Date.now() - new Date(existing[0].createdAt!).getTime() > 5 * 60 * 1000) {
        await db.insert(arbitrageOpportunities).values({
          userId: 'system', // System opportunities visible to all
          symbol: opp.symbol,
          buyExchange: opp.buyExchange,
          sellExchange: opp.sellExchange,
          buyPrice: opp.buyPrice.toString(),
          sellPrice: opp.sellPrice.toString(),
          profitPercentage: opp.profitPercentage.toString(),
          profitAmount: opp.profitAmount.toString(),
          status: 'pending',
        })
      }
    }

    return NextResponse.json({
      success: true,
      pricesCollected: prices.length,
      opportunitiesFound: opportunities.length,
      topOpportunities: opportunities.slice(0, 5),
    })
  } catch (error) {
    console.error('Monitor error:', error)
    return NextResponse.json(
      { error: 'Monitor failed', details: String(error) },
      { status: 500 }
    )
  }
}
