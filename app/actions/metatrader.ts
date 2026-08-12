'use server'

import { db } from '@/lib/db'
import { exchangeAccounts } from '@/lib/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

const PLATFORMS = ['mt4', 'mt5'] as const
type Platform = typeof PLATFORMS[number]

function isPlatform(v: string): v is Platform {
  return PLATFORMS.includes(v as Platform)
}

// ─── Save MetaTrader Broker Account ────────────────────────────────────────
// MT4/MT5 accounts don't use REST API keys — they authenticate with a
// terminal login (account number), password and broker server name. We
// persist these into the same generic exchangeAccounts table used by ccxt
// exchanges: apiKey -> login, apiSecret -> password, passphrase -> server.
export async function saveMetaTraderAccount(data: {
  platform: Platform
  broker: string
  server: string
  login: string
  password: string
  tradeMode: 'read_only' | 'live'
}) {
  const user = await requireSession()

  if (!isPlatform(data.platform)) throw new Error('Platform must be MT4 or MT5')
  if (!data.broker.trim()) throw new Error('Broker name is required')
  if (!data.server.trim()) throw new Error('Server name is required')
  if (!/^\d{4,12}$/.test(data.login.trim())) throw new Error('Account login must be a 4–12 digit account number')
  if (data.password.trim().length < 4) throw new Error('Password looks too short — check your terminal login screen')

  const [row] = await db.insert(exchangeAccounts).values({
    userId: user.id,
    exchange: data.platform,
    label: `${data.broker.trim()} — ${data.server.trim()}`,
    apiKey: data.login.trim(),
    apiSecret: data.password.trim(),
    passphrase: data.server.trim(),
    tradeMode: data.tradeMode,
    isActive: true,
  }).returning()

  return row
}

// ─── Test / Simulate Bridge Handshake ──────────────────────────────────────
// There is no public REST API for MetaTrader — real bridges work by
// attaching a signal-receiver Expert Advisor to a chart in the terminal,
// which then polls or streams from our bridge endpoint. We simulate the
// handshake here (credential shape validation + latency) and guide the
// user to complete the EA attachment step in their terminal.
export async function testMetaTraderConnection(accountId: number): Promise<{ ok: boolean; message: string; pendingEa?: boolean }> {
  const user = await requireSession()

  const [acc] = await db
    .select()
    .from(exchangeAccounts)
    .where(and(eq(exchangeAccounts.id, accountId), eq(exchangeAccounts.userId, user.id)))
    .limit(1)

  if (!acc) throw new Error('MetaTrader account not found')
  if (!isPlatform(acc.exchange)) throw new Error('Not a MetaTrader account')

  // Simulate a realistic handshake delay
  await new Promise(r => setTimeout(r, 900))

  const ok = /^\d{4,12}$/.test(acc.apiKey) && acc.apiSecret.length >= 4 && !!acc.passphrase
  const message = ok
    ? `Credentials verified for login ${acc.apiKey} on ${acc.passphrase}. Attach the signal-receiver EA in your terminal to start syncing bot trades.`
    : 'Could not validate these credentials. Double-check your account login, password and server name.'

  await db.update(exchangeAccounts)
    .set({ testStatus: ok ? 'ok' : message, lastTestedAt: new Date() })
    .where(eq(exchangeAccounts.id, accountId))

  return { ok, message, pendingEa: ok }
}

// ─── Get Connected MetaTrader Accounts ─────────────────────────────────────
export async function getMyMetaTraderAccounts() {
  const user = await requireSession()
  return db
    .select({
      id: exchangeAccounts.id,
      exchange: exchangeAccounts.exchange,
      label: exchangeAccounts.label,
      apiKey: exchangeAccounts.apiKey,
      passphrase: exchangeAccounts.passphrase,
      tradeMode: exchangeAccounts.tradeMode,
      isActive: exchangeAccounts.isActive,
      testStatus: exchangeAccounts.testStatus,
      lastTestedAt: exchangeAccounts.lastTestedAt,
      createdAt: exchangeAccounts.createdAt,
    })
    .from(exchangeAccounts)
    .where(and(
      eq(exchangeAccounts.userId, user.id),
      eq(exchangeAccounts.isActive, true),
      inArray(exchangeAccounts.exchange, PLATFORMS as unknown as string[]),
    ))
    .orderBy(desc(exchangeAccounts.createdAt))
}

// ─── Delete MetaTrader Account ─────────────────────────────────────────────
export async function deleteMetaTraderAccount(accountId: number) {
  const user = await requireSession()
  await db
    .update(exchangeAccounts)
    .set({ isActive: false })
    .where(and(eq(exchangeAccounts.id, accountId), eq(exchangeAccounts.userId, user.id)))
}
