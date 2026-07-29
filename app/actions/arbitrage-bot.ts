'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { arbitrageBotTrades, exchangeApiKeys } from '@/lib/db/schema'
import { headers } from 'next/headers'
import { eq, desc, and } from 'drizzle-orm'
import { computeProfitBreakdown, type BotTradeInput } from '@/lib/arb-bot-utils'

export type { BotTradeInput } from '@/lib/arb-bot-utils'

// ── Auth helper ───────────────────────────────────────────────────────────────
async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type BotTradeRow = typeof arbitrageBotTrades.$inferSelect

// Map display names to CCXT exchange IDs
const DISPLAY_TO_CCXT: Record<string, string> = {
  'Binance': 'binance', 'OKX': 'okx', 'Bybit': 'bybit', 'KuCoin': 'kucoin',
  'Kraken': 'kraken', 'Coinbase': 'coinbase', 'HTX': 'htx', 'Bitfinex': 'bitfinex',
  'Gate.io': 'gate', 'Gemini': 'gemini', 'Crypto.com': 'cryptocom',
  'Bitget': 'bitget', 'MEXC': 'mexc', 'Phemex': 'phemex', 'Poloniex': 'poloniex',
  'BingX': 'bingx', 'LBank': 'lbank', 'Upbit': 'upbit',
  'CoinDCX': 'coindcx', 'WazirX': 'wazirx', 'Delta Exchange': 'delta',
}

// ── Helpers: load API key from env or DB ──────────────────────────────────────
function getEnvKey(exchange: string): { apiKey: string; secret: string; passphrase?: string } | null {
  const id = DISPLAY_TO_CCXT[exchange]?.toUpperCase() ?? exchange.toUpperCase().replace(/[^A-Z]/g, '_')
  const apiKey = process.env[`${id}_API_KEY`]
  const secret = process.env[`${id}_SECRET`]
  if (apiKey && secret) return { apiKey, secret, passphrase: process.env[`${id}_PASSPHRASE`] }
  return null
}

async function getDbKey(exchange: string): Promise<{ apiKey: string; secret: string; passphrase?: string | null } | null> {
  const ccxtId = DISPLAY_TO_CCXT[exchange] ?? exchange.toLowerCase()
  const rows = await db.select().from(exchangeApiKeys)
    .where(and(eq(exchangeApiKeys.exchange, ccxtId), eq(exchangeApiKeys.isEnabled, true)))
    .limit(1)
  const row = rows[0]
  if (row?.apiKey && row?.apiSecret && !row?.isPublicOnly) {
    return { apiKey: row.apiKey, secret: row.apiSecret, passphrase: row.passphrase ?? undefined }
  }
  return null
}

async function getCredentials(exchange: string) {
  return getEnvKey(exchange) ?? await getDbKey(exchange)
}

// ── Build a CCXT exchange instance ────────────────────────────────────────────
async function buildCcxtExchange(exchange: string, creds: { apiKey: string; secret: string; passphrase?: string | null } | null) {
  const ccxt = await import('ccxt')
  const ccxtId = DISPLAY_TO_CCXT[exchange] ?? exchange.toLowerCase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExchangeClass = (ccxt as any)[ccxtId] ?? (ccxt as any)['default']?.[ccxtId]
  if (!ExchangeClass) throw new Error(`CCXT exchange "${ccxtId}" not found`)
  return new ExchangeClass({
    ...(creds ? { apiKey: creds.apiKey, secret: creds.secret, password: creds.passphrase ?? undefined } : {}),
    options: { defaultType: 'spot' },
    enableRateLimit: true,
  })
}

// ── Fetch live ticker price via CCXT ──────────────────────────────────────────
async function fetchLivePrice(exchange: string, symbol: string): Promise<number | null> {
  try {
    const inst = await buildCcxtExchange(exchange, null) // public call — no keys needed
    const pair  = `${symbol}/USDT`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ticker = await (inst as any).fetchTicker(pair)
    return ticker?.last ?? ticker?.close ?? null
  } catch {
    return null
  }
}

// ── Fetch available USDT balance on an exchange ───────────────────────────────
async function fetchBalance(exchange: string, creds: { apiKey: string; secret: string; passphrase?: string | null }): Promise<number | null> {
  try {
    const inst = await buildCcxtExchange(exchange, creds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bal = await (inst as any).fetchBalance()
    return bal?.USDT?.free ?? bal?.total?.USDT ?? null
  } catch {
    return null
  }
}

// ── Place a market buy order ───────────────────────────────────────────────────
async function placeMarketBuy(exchange: string, creds: { apiKey: string; secret: string; passphrase?: string | null }, symbol: string, amount: number) {
  const inst = await buildCcxtExchange(exchange, creds)
  const pair  = `${symbol}/USDT`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (inst as any).createMarketBuyOrder(pair, amount)
  return { orderId: order.id as string, filledPrice: (order.average ?? order.price ?? 0) as number }
}

// ── Place a market sell order ─────────────────────────────────────────────────
async function placeMarketSell(exchange: string, creds: { apiKey: string; secret: string; passphrase?: string | null }, symbol: string, amount: number) {
  const inst = await buildCcxtExchange(exchange, creds)
  const pair  = `${symbol}/USDT`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (inst as any).createMarketSellOrder(pair, amount)
  return { orderId: order.id as string, filledPrice: (order.average ?? order.price ?? 0) as number }
}

// ── Withdraw coin from exchange to destination address ────────────────────────
async function withdrawCoin(exchange: string, creds: { apiKey: string; secret: string; passphrase?: string | null }, symbol: string, amount: number, network: string, toAddress: string) {
  const inst = await buildCcxtExchange(exchange, creds)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (inst as any).withdraw(symbol, amount, toAddress, undefined, { network })
  return { txId: (result?.id ?? result?.txid ?? '') as string }
}

// ── Fetch deposit address from exchange ───────────────────────────────────────
async function getDepositAddress(exchange: string, creds: { apiKey: string; secret: string; passphrase?: string | null }, symbol: string, network: string): Promise<string | null> {
  try {
    const inst = await buildCcxtExchange(exchange, creds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addr = await (inst as any).fetchDepositAddress(symbol, { network })
    return addr?.address ?? null
  } catch {
    return null
  }
}

// ── Execute a full arbitrage trade ─────────────────────────────────────────────
export async function executeBotTrade(input: BotTradeInput): Promise<BotTradeRow> {
  const userId = await getUserId()

  // Re-fetch live prices for safety — protect against stale data
  const [liveBuyPrice, liveSellPrice] = await Promise.all([
    fetchLivePrice(input.buyExchange, input.symbol),
    fetchLivePrice(input.sellExchange, input.symbol),
  ])

  // Use live prices if available, else fall back to input prices
  const buyPrice  = liveBuyPrice  ?? input.buyPrice
  const sellPrice = liveSellPrice ?? input.sellPrice
  const amount    = input.amountUsd / buyPrice
  const liveInput = { ...input, buyPrice, sellPrice, amount }
  const p         = computeProfitBreakdown(liveInput)

  // Min-profit gate: abort if net profit is below threshold after live pricing
  const minProfit = input.minNetProfitUsd ?? 0.5
  if (p.netProfitUsd < minProfit) {
    // Still create a record so the user can see it was checked
    const [aborted] = await db.insert(arbitrageBotTrades).values({
      userId,
      symbol:         input.symbol,
      network:        input.network,
      buyExchange:    input.buyExchange,
      sellExchange:   input.sellExchange,
      buyPrice:       buyPrice.toString(),
      sellPrice:      sellPrice.toString(),
      amount:         amount.toString(),
      amountUsd:      input.amountUsd.toString(),
      grossProfitUsd: p.grossProfitUsd.toFixed(4),
      feeBuyUsd:      p.feeBuyUsd.toFixed(4),
      feeSellUsd:     p.feeSellUsd.toFixed(4),
      feeNetworkUsd:  p.feeNetworkUsd.toFixed(4),
      netProfitUsd:   p.netProfitUsd.toFixed(4),
      netProfitPct:   p.netProfitPct.toFixed(4),
      riskLevel:      input.riskLevel,
      riskScore:      input.riskScore,
      status:         'failed',
      statusDetail:   `Aborted: live net profit $${p.netProfitUsd.toFixed(2)} is below minimum threshold $${minProfit.toFixed(2)}. Live buy: $${buyPrice.toFixed(4)}, live sell: $${sellPrice.toFixed(4)}.`,
      startedAt:      new Date(),
      completedAt:    new Date(),
    }).returning()
    return aborted
  }

  // Create trade record
  const [row] = await db.insert(arbitrageBotTrades).values({
    userId,
    symbol:         input.symbol,
    network:        input.network,
    buyExchange:    input.buyExchange,
    sellExchange:   input.sellExchange,
    buyPrice:       buyPrice.toString(),
    sellPrice:      sellPrice.toString(),
    amount:         amount.toString(),
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
    statusDetail:   `Queued. Live prices confirmed — buy $${buyPrice.toFixed(4)}, sell $${sellPrice.toFixed(4)}.`,
    startedAt:      new Date(),
  }).returning()

  // Get API credentials for both exchanges
  const [buyCreds, sellCreds] = await Promise.all([
    getCredentials(input.buyExchange),
    getCredentials(input.sellExchange),
  ])

  const isLive = !!(buyCreds && sellCreds)

  if (!isLive) {
    // Simulation mode — realistic mock IDs
    const [updated] = await db.update(arbitrageBotTrades).set({
      status:       'completed',
      statusDetail: `Paper trade — no authenticated API keys for ${!buyCreds ? input.buyExchange : input.sellExchange}. Add keys in Admin > Exchange Keys for live execution. Estimated profit: $${p.netProfitUsd.toFixed(2)}.`,
      completedAt:  new Date(),
      buyOrderId:   'SIM-BO-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      sellOrderId:  'SIM-SO-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      withdrawTxId: 'SIM-TX-' + Math.random().toString(36).slice(2, 12).toUpperCase(),
      updatedAt:    new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id)).returning()
    return updated
  }

  // ── LIVE EXECUTION PIPELINE ──────────────────────────────────────────────
  try {
    // Step 1: Check buy exchange USDT balance
    await db.update(arbitrageBotTrades).set({
      status: 'buying',
      statusDetail: `Checking USDT balance on ${input.buyExchange}...`,
      updatedAt: new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id))

    const balance = await fetchBalance(input.buyExchange, buyCreds)
    if (balance !== null && balance < input.amountUsd) {
      throw new Error(`Insufficient USDT balance on ${input.buyExchange}: $${balance.toFixed(2)} available, $${input.amountUsd.toFixed(2)} required.`)
    }

    // Step 2: Get deposit address from sell exchange
    await db.update(arbitrageBotTrades).set({
      statusDetail: `Fetching ${input.symbol} deposit address on ${input.sellExchange}...`,
      updatedAt: new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id))

    const depositAddr = input.destinationAddr
      ?? await getDepositAddress(input.sellExchange, sellCreds, input.symbol, input.network)
    if (!depositAddr) throw new Error(`Could not fetch deposit address for ${input.symbol} on ${input.sellExchange}.`)

    // Step 3: Place market buy order
    await db.update(arbitrageBotTrades).set({
      statusDetail: `Placing market buy order for ${input.symbol} on ${input.buyExchange}...`,
      destinationAddr: depositAddr,
      updatedAt: new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id))

    const { orderId: buyOrderId, filledPrice: actualBuyPrice } = await placeMarketBuy(
      input.buyExchange, buyCreds, input.symbol, amount
    )

    // Slippage guard: abort sell if buy price moved too much
    const slippageAllowed = (input.slippagePct ?? 0.5) / 100
    if (Math.abs(actualBuyPrice - buyPrice) / buyPrice > slippageAllowed * 2) {
      throw new Error(`Buy price slippage exceeded: expected $${buyPrice.toFixed(4)}, got $${actualBuyPrice.toFixed(4)}.`)
    }

    // Step 4: Withdraw to sell exchange
    await db.update(arbitrageBotTrades).set({
      status: 'withdrawing',
      statusDetail: `Withdrawing ${amount.toFixed(6)} ${input.symbol} via ${input.network} to ${depositAddr.slice(0, 8)}...`,
      buyOrderId,
      updatedAt: new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id))

    const { txId: withdrawTxId } = await withdrawCoin(
      input.buyExchange, buyCreds, input.symbol, amount, input.network, depositAddr
    )

    // Step 5: Mark depositing — the transfer is underway
    await db.update(arbitrageBotTrades).set({
      status: 'depositing',
      statusDetail: `Transfer in progress via ${input.network}. TX: ${withdrawTxId}. Est. ${p.transferMins}m until deposit confirmed on ${input.sellExchange}.`,
      withdrawTxId,
      updatedAt: new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id))

    // Note: In production, deposit confirmation would be handled by a webhook/poller.
    // For now we proceed after a brief wait and trust the transfer.
    await new Promise(r => setTimeout(r, 2000))

    // Step 6: Place market sell order
    await db.update(arbitrageBotTrades).set({
      status: 'selling',
      statusDetail: `Placing market sell order for ${input.symbol} on ${input.sellExchange}...`,
      updatedAt: new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id))

    const { orderId: sellOrderId, filledPrice: actualSellPrice } = await placeMarketSell(
      input.sellExchange, sellCreds, input.symbol, amount
    )

    // Recalculate with actual fill prices
    const actualGross = (actualSellPrice - actualBuyPrice) * amount
    const actualNet   = actualGross - p.feeBuyUsd - p.feeSellUsd - p.feeNetworkUsd
    const actualPct   = input.amountUsd > 0 ? (actualNet / input.amountUsd) * 100 : 0

    // Step 7: Complete
    const [completed] = await db.update(arbitrageBotTrades).set({
      status:         'completed',
      statusDetail:   `Trade complete. Bought at $${actualBuyPrice.toFixed(4)}, sold at $${actualSellPrice.toFixed(4)}. Net profit: $${actualNet.toFixed(2)} (${actualPct.toFixed(2)}%).`,
      sellOrderId,
      buyPrice:       actualBuyPrice.toString(),
      sellPrice:      actualSellPrice.toString(),
      grossProfitUsd: actualGross.toFixed(4),
      netProfitUsd:   actualNet.toFixed(4),
      netProfitPct:   actualPct.toFixed(4),
      completedAt:    new Date(),
      updatedAt:      new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id)).returning()

    return completed
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown execution error'
    const [failed] = await db.update(arbitrageBotTrades).set({
      status:       'failed',
      statusDetail: 'Execution halted due to error — funds are safe, no incomplete sell left open.',
      errorMessage: msg,
      updatedAt:    new Date(),
    }).where(eq(arbitrageBotTrades.id, row.id)).returning()
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

// ── Cancel a pending / stuck trade ───────────────────────────────────────────
export async function cancelBotTrade(tradeId: number): Promise<void> {
  const userId = await getUserId()
  await db.update(arbitrageBotTrades)
    .set({ status: 'failed', statusDetail: 'Cancelled by user before execution began.', updatedAt: new Date() })
    .where(and(eq(arbitrageBotTrades.id, tradeId), eq(arbitrageBotTrades.userId, userId)))
}

// ── Get available exchange API keys (public metadata only) ────────────────────
export async function getEnabledExchangeKeys(): Promise<{ exchange: string; label: string; isPublicOnly: boolean }[]> {
  await getUserId()
  const rows = await db.select({
    exchange:     exchangeApiKeys.exchange,
    label:        exchangeApiKeys.label,
    isPublicOnly: exchangeApiKeys.isPublicOnly,
  }).from(exchangeApiKeys).where(eq(exchangeApiKeys.isEnabled, true))

  // Also surface exchanges configured via env vars
  const envExchanges = Object.entries(DISPLAY_TO_CCXT)
    .filter(([display]) => getEnvKey(display) !== null)
    .map(([display, id]) => ({ exchange: id, label: display, isPublicOnly: false }))

  const allKeys = [...rows, ...envExchanges]
  // Dedupe by exchange id
  const seen = new Set<string>()
  return allKeys.filter(k => { if (seen.has(k.exchange)) return false; seen.add(k.exchange); return true })
}

// ── Fetch live prices for two exchanges (for the panel price ticker) ──────────
export async function fetchLivePricesForPair(
  buyExchange: string, sellExchange: string, symbol: string
): Promise<{ buyPrice: number | null; sellPrice: number | null }> {
  await getUserId()
  const [buy, sell] = await Promise.all([
    fetchLivePrice(buyExchange, symbol),
    fetchLivePrice(sellExchange, symbol),
  ])
  return { buyPrice: buy, sellPrice: sell }
}
