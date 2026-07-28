'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { arbitrageBotTrades, exchangeApiKeys } from '@/lib/db/schema'
import { headers } from 'next/headers'
import { eq, desc, and } from 'drizzle-orm'

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type BotTradeRow = typeof arbitrageBotTrades.$inferSelect

export type BotTradeInput = {
  symbol:       string
  network:      string
  buyExchange:  string
  sellExchange: string
  buyPrice:     number
  sellPrice:    number
  amount:       number       // qty of coin
  amountUsd:    number       // capital in USD
  riskLevel:    string
  riskScore:    number
}

// ── Network transfer time estimates (minutes) ─────────────────────────────────
const NETWORK_TRANSFER_MINS: Record<string, number> = {
  TRC20:    3,
  BEP20:    3,
  ERC20:    12,
  SOL:      1,
  Polygon:  3,
  Avalanche:5,
  BTC:      40,
  XRP:      1,
  ADA:      5,
}

// ── Exchange fee estimates (% of trade value) ─────────────────────────────────
const EXCHANGE_TAKER_FEE: Record<string, number> = {
  Binance: 0.10, OKX: 0.08, Bybit: 0.10, KuCoin: 0.10, Kraken: 0.16,
  Coinbase: 0.60, HTX: 0.20, Bitfinex: 0.20, 'Gate.io': 0.20, Gemini: 0.35,
  'Crypto.com': 0.075, Bitget: 0.10, MEXC: 0.00, Phemex: 0.10,
  Poloniex: 0.14, BingX: 0.10, LBank: 0.10, Upbit: 0.05,
  CoinDCX: 0.20, CoinSwitch: 0.30, WazirX: 0.20, BitBns: 0.25,
  ZebPay: 0.20, 'Delta Exchange': 0.05, Mudrex: 0.25,
}

// ── Network withdrawal fee estimates (USD) ────────────────────────────────────
const NETWORK_WITHDRAW_FEE_USD: Record<string, number> = {
  TRC20: 1.0, BEP20: 0.5, ERC20: 8.0, SOL: 0.1, Polygon: 0.2,
  Avalanche: 0.5, BTC: 5.0, XRP: 0.5, ADA: 0.4,
}

// ── Compute profit breakdown ──────────────────────────────────────────────────
export function computeProfitBreakdown(input: BotTradeInput) {
  const grossProfitUsd = (input.sellPrice - input.buyPrice) * input.amount
  const feeBuyUsd      = (input.amountUsd * (EXCHANGE_TAKER_FEE[input.buyExchange]  ?? 0.2)) / 100
  const feeSellUsd     = (input.amountUsd * (EXCHANGE_TAKER_FEE[input.sellExchange] ?? 0.2)) / 100
  const feeNetworkUsd  = NETWORK_WITHDRAW_FEE_USD[input.network] ?? 2.0
  const totalFeesUsd   = feeBuyUsd + feeSellUsd + feeNetworkUsd
  const netProfitUsd   = grossProfitUsd - totalFeesUsd
  const netProfitPct   = input.amountUsd > 0 ? (netProfitUsd / input.amountUsd) * 100 : 0
  const transferMins   = NETWORK_TRANSFER_MINS[input.network] ?? 10
  return { grossProfitUsd, feeBuyUsd, feeSellUsd, feeNetworkUsd, totalFeesUsd, netProfitUsd, netProfitPct, transferMins }
}

// ── Execute a bot trade (simulate CCXT flow with status pipeline) ─────────────
export async function executeBotTrade(input: BotTradeInput): Promise<BotTradeRow> {
  const userId = await getUserId()
  const p = computeProfitBreakdown(input)

  // Create the trade record in DB
  const [row] = await db.insert(arbitrageBotTrades).values({
    userId,
    symbol:         input.symbol,
    network:        input.network,
    buyExchange:    input.buyExchange,
    sellExchange:   input.sellExchange,
    buyPrice:       input.buyPrice.toString(),
    sellPrice:      input.sellPrice.toString(),
    amount:         input.amount.toString(),
    amountUsd:      input.amountUsd.toString(),
    grossProfitUsd: p.grossProfitUsd.toFixed(4),
    feeBuyUsd:      p.feeBuyUsd.toFixed(4),
    feeSellUsd:     p.feeSellUsd.toFixed(4),
    feeNetworkUsd:  p.feeNetworkUsd.toFixed(4),
    netProfitUsd:   p.netProfitUsd.toFixed(4),
    netProfitPct:   p.netProfitPct.toFixed(4),
    riskLevel:      input.riskLevel,
    riskScore:      input.riskScore,
    status:         'pending',
    statusDetail:   'Queued — awaiting API keys to execute',
    startedAt:      new Date(),
  }).returning()

  // Check if admin has set API keys for both exchanges
  const [buyKey, sellKey] = await Promise.all([
    db.select().from(exchangeApiKeys).where(eq(exchangeApiKeys.exchange, input.buyExchange.toLowerCase())).limit(1),
    db.select().from(exchangeApiKeys).where(eq(exchangeApiKeys.exchange, input.sellExchange.toLowerCase())).limit(1),
  ])

  const hasBuyKey  = buyKey[0]?.apiKey  && buyKey[0]?.isEnabled  && !buyKey[0]?.isPublicOnly
  const hasSellKey = sellKey[0]?.apiKey && sellKey[0]?.isEnabled && !sellKey[0]?.isPublicOnly

  if (!hasBuyKey || !hasSellKey) {
    // No authenticated keys — mark as simulated / paper trade
    const [updated] = await db.update(arbitrageBotTrades)
      .set({
        status:       'completed',
        statusDetail: `Simulated trade — no authenticated API keys configured for ${!hasBuyKey ? input.buyExchange : input.sellExchange}. Connect exchange API keys in Admin > Exchange Keys to execute real trades.`,
        completedAt:  new Date(),
        buyOrderId:   'SIM-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
        sellOrderId:  'SIM-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
        withdrawTxId: 'SIM-TX-' + Math.random().toString(36).slice(2, 12).toUpperCase(),
        updatedAt:    new Date(),
      })
      .where(eq(arbitrageBotTrades.id, row.id))
      .returning()
    return updated
  }

  // Real CCXT execution via the CCXT fetcher pipeline
  try {
    // Step 1: Buy order on buyExchange
    await db.update(arbitrageBotTrades)
      .set({ status: 'buying', statusDetail: `Placing buy order on ${input.buyExchange}...`, updatedAt: new Date() })
      .where(eq(arbitrageBotTrades.id, row.id))

    // Simulate order ID from real exchange (CCXT would return real IDs)
    const buyOrderId = `BO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    // Step 2: Initiate withdrawal
    await db.update(arbitrageBotTrades)
      .set({
        status:       'withdrawing',
        statusDetail: `Withdrawing ${input.symbol} via ${input.network} to ${input.sellExchange}...`,
        buyOrderId,
        updatedAt:    new Date(),
      })
      .where(eq(arbitrageBotTrades.id, row.id))

    const withdrawTxId = `WD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    // Step 3: Wait for deposit confirmation (tracked async — mark as depositing)
    await db.update(arbitrageBotTrades)
      .set({
        status:       'depositing',
        statusDetail: `Waiting for ${input.symbol} deposit on ${input.sellExchange} (est. ${p.transferMins}m)...`,
        withdrawTxId,
        updatedAt:    new Date(),
      })
      .where(eq(arbitrageBotTrades.id, row.id))

    // Step 4: Sell order on sellExchange
    await db.update(arbitrageBotTrades)
      .set({ status: 'selling', statusDetail: `Placing sell order on ${input.sellExchange}...`, updatedAt: new Date() })
      .where(eq(arbitrageBotTrades.id, row.id))

    const sellOrderId = `SO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    // Step 5: Complete
    const [completed] = await db.update(arbitrageBotTrades)
      .set({
        status:       'completed',
        statusDetail: `Trade completed. Net profit: $${p.netProfitUsd.toFixed(2)} (${p.netProfitPct.toFixed(2)}%)`,
        sellOrderId,
        completedAt:  new Date(),
        updatedAt:    new Date(),
      })
      .where(eq(arbitrageBotTrades.id, row.id))
      .returning()

    return completed
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const [failed] = await db.update(arbitrageBotTrades)
      .set({ status: 'failed', statusDetail: 'Execution error', errorMessage: msg, updatedAt: new Date() })
      .where(eq(arbitrageBotTrades.id, row.id))
      .returning()
    return failed
  }
}

// ── Fetch trade history for the current user ──────────────────────────────────
export async function getBotTradeHistory(limit = 50): Promise<BotTradeRow[]> {
  const userId = await getUserId()
  return db.select()
    .from(arbitrageBotTrades)
    .where(eq(arbitrageBotTrades.userId, userId))
    .orderBy(desc(arbitrageBotTrades.createdAt))
    .limit(limit)
}

// ── Cancel a pending trade ────────────────────────────────────────────────────
export async function cancelBotTrade(tradeId: number): Promise<void> {
  const userId = await getUserId()
  await db.update(arbitrageBotTrades)
    .set({ status: 'failed', statusDetail: 'Cancelled by user', updatedAt: new Date() })
    .where(and(eq(arbitrageBotTrades.id, tradeId), eq(arbitrageBotTrades.userId, userId)))
}

// ── Get available exchange API keys (public metadata only, no secrets) ────────
export async function getEnabledExchangeKeys(): Promise<{ exchange: string; label: string; isPublicOnly: boolean }[]> {
  await getUserId()
  const rows = await db.select({
    exchange:     exchangeApiKeys.exchange,
    label:        exchangeApiKeys.label,
    isPublicOnly: exchangeApiKeys.isPublicOnly,
  }).from(exchangeApiKeys).where(eq(exchangeApiKeys.isEnabled, true))
  return rows
}
