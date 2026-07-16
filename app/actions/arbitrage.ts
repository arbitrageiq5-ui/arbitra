'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { arbitrageOpportunities, notifications, portfolio } from '@/lib/db/schema'
import { headers } from 'next/headers'
import { eq, and, desc } from 'drizzle-orm'
import { OpenAI } from 'openai'

let openai: OpenAI | null = null

function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export async function saveArbitrageOpportunity(data: {
  symbol: string
  buyExchange: string
  sellExchange: string
  buyPrice: number
  sellPrice: number
  profitPercentage: number
  profitAmount: number
}) {
  const userId = await getUserId()

  const result = await db
    .insert(arbitrageOpportunities)
    .values({
      userId,
      symbol: data.symbol,
      buyExchange: data.buyExchange,
      sellExchange: data.sellExchange,
      buyPrice: data.buyPrice.toString(),
      sellPrice: data.sellPrice.toString(),
      profitPercentage: data.profitPercentage.toString(),
      profitAmount: data.profitAmount.toString(),
      status: 'pending',
    })
    .returning()

  return result[0]
}

export async function getArbitrageOpportunities(limit: number = 50) {
  const userId = await getUserId()

  const opps = await db
    .select()
    .from(arbitrageOpportunities)
    .where(and(eq(arbitrageOpportunities.userId, userId), eq(arbitrageOpportunities.status, 'pending')))
    .orderBy(desc(arbitrageOpportunities.profitPercentage))
    .limit(limit)

  return opps
}

export async function scoreOpportunityWithAI(opportunityId: number) {
  const userId = await getUserId()
  const client = getOpenAIClient()

  if (!client) {
    throw new Error('OpenAI API key not configured')
  }

  const opp = await db
    .select()
    .from(arbitrageOpportunities)
    .where(
      and(
        eq(arbitrageOpportunities.id, opportunityId),
        eq(arbitrageOpportunities.userId, userId)
      )
    )
    .limit(1)

  if (!opp.length) throw new Error('Opportunity not found')

  const opportunity = opp[0]

  const prompt = `You are a crypto arbitrage expert. Evaluate this arbitrage opportunity and provide a score from 0-100 and brief reasoning.

Symbol: ${opportunity.symbol}
Buy on ${opportunity.buyExchange}: $${opportunity.buyPrice}
Sell on ${opportunity.sellExchange}: $${opportunity.sellPrice}
Potential Profit: ${opportunity.profitPercentage}%

Consider: exchange reliability, liquidity, withdrawal fees, market volatility, and execution risk.

Respond with JSON: {"score": number, "reasoning": string}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    })

    const content = response.choices[0].message.content
    const parsed = JSON.parse(content || '{}')

    await db
      .update(arbitrageOpportunities)
      .set({
        aiScore: parsed.score?.toString() || '0',
        aiReasoning: parsed.reasoning || 'Could not evaluate',
      })
      .where(eq(arbitrageOpportunities.id, opportunityId))

    return { score: parsed.score, reasoning: parsed.reasoning }
  } catch (error) {
    console.error('AI scoring error:', error)
    throw new Error('Failed to score opportunity with AI')
  }
}

export async function createNotification(data: {
  type: string
  title: string
  message: string
  data?: string
}) {
  const userId = await getUserId()

  const result = await db
    .insert(notifications)
    .values({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
      isRead: false,
    })
    .returning()

  return result[0]
}

export async function getNotifications() {
  const userId = await getUserId()

  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(20)
}

export async function markNotificationAsRead(notificationId: number) {
  const userId = await getUserId()

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
}

export async function updatePortfolio(symbol: string, quantity: number, price: number) {
  const userId = await getUserId()

  const existing = await db
    .select()
    .from(portfolio)
    .where(and(eq(portfolio.userId, userId), eq(portfolio.symbol, symbol)))
    .limit(1)

  if (existing.length > 0) {
    const curr = existing[0]
    const newQty = parseFloat(curr.quantity.toString()) + quantity
    const newCost =
      (parseFloat(curr.averageCost.toString()) * parseFloat(curr.quantity.toString()) +
        price * quantity) /
      newQty

    await db
      .update(portfolio)
      .set({
        quantity: newQty.toString(),
        averageCost: newCost.toString(),
        currentValue: (newQty * price).toString(),
      })
      .where(and(eq(portfolio.userId, userId), eq(portfolio.symbol, symbol)))
  } else {
    await db.insert(portfolio).values({
      userId,
      symbol,
      quantity: quantity.toString(),
      averageCost: price.toString(),
      currentValue: (quantity * price).toString(),
      isLive: false,
    })
  }
}

export async function getPortfolio() {
  const userId = await getUserId()

  return db.select().from(portfolio).where(eq(portfolio.userId, userId))
}
