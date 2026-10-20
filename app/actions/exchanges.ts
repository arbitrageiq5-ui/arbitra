'use server'

import { db } from '@/lib/db'
import { exchangeAccounts, tradeOrders } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { SUPPORTED_EXCHANGES } from '@/lib/exchange-constants'

// ccxt is loaded dynamically to avoid bundling the entire library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CCXTExchange = any

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user.id
}

async function getOptionalUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

async function getCCXT(): Promise<typeof import('ccxt')> {
  return (await import('ccxt')) as unknown as typeof import('ccxt')
}

function buildCCXTInstance(ccxt: CCXTExchange, exchangeId: string, apiKey: string, apiSecret: string, passphrase?: string | null): CCXTExchange {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExchangeClass = (ccxt as any)[exchangeId]
  if (!ExchangeClass) throw new Error(`Exchange "${exchangeId}" is not supported by ccxt`)
  return new ExchangeClass({
    apiKey,
    secret: apiSecret,
    ...(passphrase ? { password: passphrase } : {}),
    enableRateLimit: true,
  })
}

// ─── Save Exchange API Keys ────────────────────────────────────────────────
export async function saveExchangeAccount(data: {
  exchangeId: string   // ccxt exchange id e.g. 'binance'
  label: string
  apiKey: string
  apiSecret: string
  passphrase?: string
  tradeMode: 'read_only' | 'live'
}) {
  const userId = await getUserId()
  const info = SUPPORTED_EXCHANGES[data.exchangeId]
  if (!info) throw new Error('Unsupported exchange')

  const [row] = await db.insert(exchangeAccounts).values({
    userId,
    exchange: data.exchangeId,
    label: data.label || info.name,
    apiKey: data.apiKey,
    apiSecret: data.apiSecret,
    passphrase: data.passphrase || null,
    tradeMode: data.tradeMode,
    isActive: true,
  }).returning()

  return row
}

// ─── Test / Validate API Connection ────────────────────────────────────────
export async function testExchangeConnection(accountId: number): Promise<{ ok: boolean; message: string; balances?: Record<string, number> }> {
  const userId = await getUserId()

  const [acc] = await db
    .select()
    .from(exchangeAccounts)
    .where(and(eq(exchangeAccounts.id, accountId), eq(exchangeAccounts.userId, userId)))
    .limit(1)

  if (!acc) throw new Error('Exchange account not found')

  try {
    const ccxt = await getCCXT()
    const exchange = buildCCXTInstance(ccxt, acc.exchange, acc.apiKey, acc.apiSecret, acc.passphrase)
    const rawBalances = await exchange.fetchBalance()

    // Filter to non-zero balances
    const balances: Record<string, number> = {}
    const total = rawBalances.total as Record<string, number>
    for (const [coin, amount] of Object.entries(total)) {
      if (amount && (amount as number) > 0) balances[coin] = amount as number
    }

    await db.update(exchangeAccounts)
      .set({ testStatus: 'ok', lastTestedAt: new Date() })
      .where(eq(exchangeAccounts.id, accountId))

    return { ok: true, message: 'Connection successful', balances }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.update(exchangeAccounts)
      .set({ testStatus: msg.slice(0, 255), lastTestedAt: new Date() })
      .where(eq(exchangeAccounts.id, accountId))
    return { ok: false, message: msg }
  }
}

// ─── Get All Connected Accounts ─────────────────────────────────────────────
export async function getExchangeAccounts() {
  // Read-only dashboard surfaces may render before authentication is available.
  // Treat that state as an empty account list; mutations remain protected by getUserId().
  const userId = await getOptionalUserId()
  if (!userId) return []

  return db
    .select()
    .from(exchangeAccounts)
    .where(and(eq(exchangeAccounts.userId, userId), eq(exchangeAccounts.isActive, true)))
    .orderBy(desc(exchangeAccounts.createdAt))
}

// ─── Delete Exchange Account ─────────────────────────────────────────────────
export async function deleteExchangeAccount(accountId: number) {
  const userId = await getUserId()
  await db
    .update(exchangeAccounts)
    .set({ isActive: false })
    .where(and(eq(exchangeAccounts.id, accountId), eq(exchangeAccounts.userId, userId)))
}

// ─── Fetch Live Balances ─────────────────────────────────────────────────────
export async function fetchExchangeBalance(accountId: number): Promise<Record<string, number>> {
  const userId = await getUserId()

  const [acc] = await db
    .select()
    .from(exchangeAccounts)
    .where(and(eq(exchangeAccounts.id, accountId), eq(exchangeAccounts.userId, userId)))
    .limit(1)

  if (!acc) throw new Error('Exchange account not found')

  const ccxt = await getCCXT()
  const exchange = buildCCXTInstance(ccxt, acc.exchange, acc.apiKey, acc.apiSecret, acc.passphrase)
  const raw = await exchange.fetchBalance()
  const total = raw.total as Record<string, number>
  const result: Record<string, number> = {}
  for (const [coin, amount] of Object.entries(total)) {
    if (amount && (amount as number) > 0) result[coin] = amount as number
  }
  return result
}

// ─── Place Order ─────────────────────────────────────────────────────────────
export async function placeTradeOrder(data: {
  accountId: number
  symbol: string      // e.g. 'BTC/USDT'
  side: 'buy' | 'sell'
  orderType: 'market' | 'limit'
  amount: number
  price?: number      // required for limit orders
}): Promise<{ ok: boolean; orderId?: string; message: string }> {
  const userId = await getUserId()

  const [acc] = await db
    .select()
    .from(exchangeAccounts)
    .where(and(eq(exchangeAccounts.id, data.accountId), eq(exchangeAccounts.userId, userId)))
    .limit(1)

  if (!acc) throw new Error('Exchange account not found')

  const isPaper = acc.tradeMode !== 'live'

  // Always log to trade_orders
  const orderRow = await db.insert(tradeOrders).values({
    userId,
    exchangeAccountId: acc.id,
    symbol: data.symbol,
    side: data.side,
    orderType: data.orderType,
    amount: String(data.amount),
    price: data.price ? String(data.price) : null,
    exchange: acc.exchange,
    tradeMode: isPaper ? 'paper' : 'live',
    status: 'pending',
  }).returning()

  if (isPaper) {
    // Paper trade — simulate fill immediately
    const fillPrice = data.price ?? 0
    await db.update(tradeOrders).set({
      status: 'closed',
      filled: String(data.amount),
      cost: String(data.amount * fillPrice),
      fee: String(data.amount * fillPrice * 0.001),
      note: 'Paper trade — simulated fill',
    }).where(eq(tradeOrders.id, orderRow[0].id))

    return { ok: true, orderId: `PAPER-${orderRow[0].id}`, message: 'Paper trade executed (simulated)' }
  }

  // Live trade via ccxt
  try {
    const ccxt = await getCCXT()
    const exchange = buildCCXTInstance(ccxt, acc.exchange, acc.apiKey, acc.apiSecret, acc.passphrase)

    const order = data.orderType === 'limit'
      ? await exchange.createLimitOrder(data.symbol, data.side, data.amount, data.price)
      : await exchange.createMarketOrder(data.symbol, data.side, data.amount)

    await db.update(tradeOrders).set({
      externalOrderId: String(order.id),
      status: order.status ?? 'open',
      filled: String(order.filled ?? 0),
      cost: String(order.cost ?? 0),
      fee: String(order.fee?.cost ?? 0),
    }).where(eq(tradeOrders.id, orderRow[0].id))

    return { ok: true, orderId: String(order.id), message: `Live order placed: ${order.id}` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.update(tradeOrders).set({ status: 'failed', note: msg }).where(eq(tradeOrders.id, orderRow[0].id))
    return { ok: false, message: msg }
  }
}

// ─── Transfer Between Exchanges ──────────────────────────────────────────────
// Real transfers require withdraw from exchange A + deposit to exchange B.
// We record the intent and execute the withdrawal via ccxt.
export async function transferBetweenExchanges(data: {
  fromAccountId: number
  toAccountId: number
  coin: string        // e.g. 'USDT'
  network: string     // e.g. 'TRC20'
  amount: number
  toAddress?: string  // if not provided, fetches deposit address from destination exchange
}): Promise<{ ok: boolean; txId?: string; message: string }> {
  const userId = await getUserId()

  const accounts = await db
    .select()
    .from(exchangeAccounts)
    .where(eq(exchangeAccounts.userId, userId))

  const fromAcc = accounts.find(a => a.id === data.fromAccountId)
  const toAcc = accounts.find(a => a.id === data.toAccountId)

  if (!fromAcc || !toAcc) throw new Error('One or both exchange accounts not found')
  if (fromAcc.tradeMode !== 'live' || toAcc.tradeMode !== 'live') {
    return { ok: false, message: 'Both accounts must be in live mode to transfer' }
  }

  try {
    const ccxt = await getCCXT()

    // Step 1: Get deposit address from destination exchange
    let toAddress = data.toAddress
    if (!toAddress) {
      const toExchange = buildCCXTInstance(ccxt, toAcc.exchange, toAcc.apiKey, toAcc.apiSecret, toAcc.passphrase)
      const depAddr = await toExchange.fetchDepositAddress(data.coin, { network: data.network })
      toAddress = depAddr.address
    }

    if (!toAddress) throw new Error('Could not determine destination deposit address')

    // Step 2: Withdraw from source exchange
    const fromExchange = buildCCXTInstance(ccxt, fromAcc.exchange, fromAcc.apiKey, fromAcc.apiSecret, fromAcc.passphrase)
    const withdrawal = await fromExchange.withdraw(data.coin, data.amount, toAddress, undefined, { network: data.network })

    return {
      ok: true,
      txId: withdrawal.id ? String(withdrawal.id) : undefined,
      message: `Withdrawal initiated. TX: ${withdrawal.id ?? 'pending'}`,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: msg }
  }
}

// ─── Get Trade History ────────────────────────────────────────────────────────
export async function getTradeHistory(limit = 50) {
  const userId = await getUserId()
  return db
    .select()
    .from(tradeOrders)
    .where(eq(tradeOrders.userId, userId))
    .orderBy(desc(tradeOrders.createdAt))
    .limit(limit)
}
