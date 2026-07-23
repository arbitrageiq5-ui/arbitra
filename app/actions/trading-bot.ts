'use server'

import { db } from '@/lib/db'
import { tradingBots, dcaOrders, exchangeAccounts } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import type { DcaConfig } from '@/lib/trading-bot-constants'

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

// ─── Create a new bot ──────────────────────────────────────────────────────────
export async function createTradingBot(input: {
  name: string
  strategy: 'dca'
  marketType: 'spot' | 'futures'
  exchange: string
  exchangeAccountId: number | null
  symbol: string
  baseCurrency: string
  quoteCurrency: string
  config: DcaConfig
}) {
  const currentUser = await requireSession()

  // Validate DCA config
  const { config } = input
  if (config.baseOrderSize < 5) throw new Error('Base order size must be at least $5')
  if (config.safetyOrderSize < 5) throw new Error('Safety order size must be at least $5')
  if (config.maxSafetyOrders < 1 || config.maxSafetyOrders > 10) throw new Error('Max safety orders must be 1–10')
  if (config.priceDeviationPct < 0.5 || config.priceDeviationPct > 20) throw new Error('Price deviation must be 0.5%–20%')
  if (config.takeProfitPct < 0.1 || config.takeProfitPct > 50) throw new Error('Take profit must be 0.1%–50%')
  if (input.marketType === 'futures') {
    const lev = config.leverage ?? 1
    if (lev < 1 || lev > 10) throw new Error('Leverage must be 1–10x')
  }

  // Verify exchange account belongs to user if provided
  if (input.exchangeAccountId) {
    const [acct] = await db
      .select({ id: exchangeAccounts.id })
      .from(exchangeAccounts)
      .where(and(
        eq(exchangeAccounts.id, input.exchangeAccountId),
        eq(exchangeAccounts.userId, currentUser.id),
      ))
      .limit(1)
    if (!acct) throw new Error('Exchange account not found')
  }

  const [bot] = await db.insert(tradingBots).values({
    userId: currentUser.id,
    name: input.name,
    strategy: input.strategy,
    marketType: input.marketType,
    exchange: input.exchange,
    exchangeAccountId: input.exchangeAccountId,
    symbol: input.symbol,
    baseCurrency: input.baseCurrency,
    quoteCurrency: input.quoteCurrency,
    status: 'stopped',
    config: input.config as Record<string, unknown>,
  }).returning()

  return bot
}

// ─── Get all bots for current user ─────────────────────────────────────────────
export async function getMyBots() {
  const currentUser = await requireSession()

  const bots = await db
    .select({
      bot: tradingBots,
      exchangeLabel: exchangeAccounts.label,
      exchangeApiKey: exchangeAccounts.apiKey,
    })
    .from(tradingBots)
    .leftJoin(exchangeAccounts, eq(tradingBots.exchangeAccountId, exchangeAccounts.id))
    .where(eq(tradingBots.userId, currentUser.id))
    .orderBy(desc(tradingBots.createdAt))

  return bots.map(r => ({
    ...r.bot,
    exchangeLabel: r.exchangeLabel,
    hasApiKey: !!r.exchangeApiKey,
  }))
}

// ─── Get orders for a bot ──────────────────────────────────────────────────────
export async function getBotOrders(botId: number) {
  const currentUser = await requireSession()

  // Verify ownership
  const [bot] = await db.select({ userId: tradingBots.userId })
    .from(tradingBots)
    .where(eq(tradingBots.id, botId))
    .limit(1)
  if (!bot || bot.userId !== currentUser.id) throw new Error('Bot not found')

  return db
    .select()
    .from(dcaOrders)
    .where(eq(dcaOrders.botId, botId))
    .orderBy(desc(dcaOrders.createdAt))
    .limit(50)
}

// ─── Start bot (simulate first base order) ────────────────────────────────────
export async function startBot(botId: number) {
  const currentUser = await requireSession()

  const [bot] = await db.select().from(tradingBots)
    .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, currentUser.id)))
    .limit(1)
  if (!bot) throw new Error('Bot not found')
  if (bot.status === 'active') throw new Error('Bot is already running')

  const cfg = bot.config as DcaConfig
  // Simulate fetching current market price (realistic mock based on symbol)
  const mockPrices: Record<string, number> = {
    'BTC/USDT': 67420.0, 'ETH/USDT': 3541.0, 'BNB/USDT': 605.0,
    'SOL/USDT': 172.0,   'XRP/USDT': 0.625,   'ADA/USDT': 0.48,
    'DOGE/USDT': 0.162,  'AVAX/USDT': 38.5,   'DOT/USDT': 7.8,
    'MATIC/USDT': 0.92,  'LINK/USDT': 15.4,   'LTC/USDT': 84.5,
    'UNI/USDT': 10.2,    'ATOM/USDT': 8.9,    'TRX/USDT': 0.128,
  }
  const price = mockPrices[bot.symbol] ?? 1.0
  const qty = cfg.baseOrderSize / price

  // Insert base order
  await db.insert(dcaOrders).values({
    botId,
    userId: currentUser.id,
    orderType: 'buy',
    marketType: bot.marketType,
    symbol: bot.symbol,
    qty: String(qty.toFixed(8)),
    price: String(price),
    total: String(cfg.baseOrderSize.toFixed(2)),
    triggerCondition: 'base_order',
    status: 'filled',
    filledAt: new Date(),
  })

  // Update bot
  await db.update(tradingBots).set({
    status: 'active',
    totalInvested: String(cfg.baseOrderSize.toFixed(2)),
    totalOrders: 1,
    avgBuyPrice: String(price.toFixed(8)),
    currentPrice: String(price.toFixed(8)),
    startedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tradingBots.id, botId))

  return { success: true, price }
}

// ─── Simulate a safety order (price dip triggers DCA buy) ─────────────────────
export async function triggerSafetyOrder(botId: number) {
  const currentUser = await requireSession()

  const [bot] = await db.select().from(tradingBots)
    .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, currentUser.id)))
    .limit(1)
  if (!bot) throw new Error('Bot not found')
  if (bot.status !== 'active') throw new Error('Bot must be active to trigger safety orders')

  const cfg = bot.config as DcaConfig
  const safetyOrdersFilled = await db
    .select({ count: sql<number>`count(*)` })
    .from(dcaOrders)
    .where(and(eq(dcaOrders.botId, botId), eq(dcaOrders.orderType, 'buy')))

  const filledCount = Number(safetyOrdersFilled[0]?.count ?? 0)
  const safetyOrderIndex = filledCount - 1 // 0-indexed safety orders (first was base)

  if (safetyOrderIndex >= cfg.maxSafetyOrders) {
    throw new Error(`Maximum safety orders (${cfg.maxSafetyOrders}) already reached`)
  }

  // Simulate price drop
  const currentPrice = parseFloat(String(bot.currentPrice))
  const dropPct = cfg.priceDeviationPct * (safetyOrderIndex + 1)
  const newPrice = currentPrice * (1 - dropPct / 100)
  const volumeMultiplier = Math.pow(cfg.safetyOrderVolumePct ?? 1, safetyOrderIndex)
  const orderSize = cfg.safetyOrderSize * volumeMultiplier
  const qty = orderSize / newPrice

  await db.insert(dcaOrders).values({
    botId,
    userId: currentUser.id,
    orderType: 'buy',
    marketType: bot.marketType,
    symbol: bot.symbol,
    qty: String(qty.toFixed(8)),
    price: String(newPrice.toFixed(8)),
    total: String(orderSize.toFixed(2)),
    triggerCondition: `safety_order_${safetyOrderIndex + 1}_at_-${dropPct.toFixed(1)}%`,
    status: 'filled',
    filledAt: new Date(),
  })

  // Recalculate average buy price
  const totalInvested = parseFloat(String(bot.totalInvested)) + orderSize
  const totalQty = (parseFloat(String(bot.totalInvested)) / parseFloat(String(bot.avgBuyPrice))) + qty
  const newAvgPrice = totalInvested / totalQty

  await db.update(tradingBots).set({
    totalInvested: String(totalInvested.toFixed(2)),
    totalOrders: (bot.totalOrders + 1),
    avgBuyPrice: String(newAvgPrice.toFixed(8)),
    currentPrice: String(newPrice.toFixed(8)),
    unrealizedPnl: String(((newPrice - newAvgPrice) * totalQty).toFixed(2)),
    updatedAt: new Date(),
  }).where(eq(tradingBots.id, botId))

  return { success: true, newPrice, orderSize, safetyOrderIndex: safetyOrderIndex + 1 }
}

// ─── Simulate take-profit ──────────────────────────────────────────────────────
export async function simulateTakeProfit(botId: number) {
  const currentUser = await requireSession()

  const [bot] = await db.select().from(tradingBots)
    .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, currentUser.id)))
    .limit(1)
  if (!bot) throw new Error('Bot not found')
  if (bot.status !== 'active') throw new Error('Bot must be active')

  const cfg = bot.config as DcaConfig
  const avgPrice = parseFloat(String(bot.avgBuyPrice))
  const totalInvested = parseFloat(String(bot.totalInvested))
  const takeProfitPrice = avgPrice * (1 + cfg.takeProfitPct / 100)
  const totalQty = totalInvested / avgPrice
  const saleTotal = totalQty * takeProfitPrice
  const profit = saleTotal - totalInvested

  await db.insert(dcaOrders).values({
    botId,
    userId: currentUser.id,
    orderType: 'take_profit',
    marketType: bot.marketType,
    symbol: bot.symbol,
    qty: String(totalQty.toFixed(8)),
    price: String(takeProfitPrice.toFixed(8)),
    total: String(saleTotal.toFixed(2)),
    triggerCondition: `take_profit_at_+${cfg.takeProfitPct}%`,
    status: 'filled',
    filledAt: new Date(),
  })

  await db.update(tradingBots).set({
    status: 'stopped',
    totalOrders: bot.totalOrders + 1,
    currentPrice: String(takeProfitPrice.toFixed(8)),
    realizedPnl: String((parseFloat(String(bot.realizedPnl)) + profit).toFixed(2)),
    unrealizedPnl: '0',
    totalInvested: '0',
    avgBuyPrice: '0',
    stoppedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tradingBots.id, botId))

  // Credit income commissions to referral chain (non-blocking)
  if (profit > 0) {
    const { creditIncomeCommission } = await import('@/app/actions/referral')
    creditIncomeCommission(currentUser.id, profit, 'bot', String(botId)).catch(() => {})
  }

  return { success: true, profit, takeProfitPrice }
}

// ─── Stop / pause bot ──────────────────────────────────────────────────────────
export async function stopBot(botId: number, action: 'pause' | 'stop') {
  const currentUser = await requireSession()

  const [bot] = await db.select({ id: tradingBots.id, userId: tradingBots.userId })
    .from(tradingBots)
    .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, currentUser.id)))
    .limit(1)
  if (!bot) throw new Error('Bot not found')

  await db.update(tradingBots).set({
    status: action === 'pause' ? 'paused' : 'stopped',
    stoppedAt: action === 'stop' ? new Date() : undefined,
    updatedAt: new Date(),
  }).where(eq(tradingBots.id, botId))

  return { success: true }
}

// ─── Delete bot ────────────────────────────────────────────────────────────────
export async function deleteBot(botId: number) {
  const currentUser = await requireSession()

  const [bot] = await db.select({ id: tradingBots.id, userId: tradingBots.userId, status: tradingBots.status })
    .from(tradingBots)
    .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, currentUser.id)))
    .limit(1)
  if (!bot) throw new Error('Bot not found')
  if (bot.status === 'active') throw new Error('Stop the bot before deleting')

  await db.delete(tradingBots).where(eq(tradingBots.id, botId))
  return { success: true }
}

// ─── Update bot config (only when stopped/paused) ─────────────────────────────
export async function updateBotConfig(botId: number, config: Partial<DcaConfig>) {
  const currentUser = await requireSession()

  const [bot] = await db.select().from(tradingBots)
    .where(and(eq(tradingBots.id, botId), eq(tradingBots.userId, currentUser.id)))
    .limit(1)
  if (!bot) throw new Error('Bot not found')
  if (bot.status === 'active') throw new Error('Pause or stop the bot before editing config')

  const merged = { ...(bot.config as DcaConfig), ...config }
  await db.update(tradingBots).set({
    config: merged as Record<string, unknown>,
    updatedAt: new Date(),
  }).where(eq(tradingBots.id, botId))

  return { success: true }
}

// ─── Get exchange accounts for current user ────────────────────────────────────
export async function getMyExchangeAccountsForBot() {
  const currentUser = await requireSession()
  return db
    .select({
      id: exchangeAccounts.id,
      exchange: exchangeAccounts.exchange,
      label: exchangeAccounts.label,
      tradeMode: exchangeAccounts.tradeMode,
      testStatus: exchangeAccounts.testStatus,
    })
    .from(exchangeAccounts)
    .where(and(
      eq(exchangeAccounts.userId, currentUser.id),
      eq(exchangeAccounts.isActive, true),
    ))
    .orderBy(exchangeAccounts.createdAt)
}
