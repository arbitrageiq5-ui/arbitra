'use server'

import { db } from '@/lib/db'
import { autoTradePlans, autoTradeLogs, user } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [u] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!u || u.role !== 'admin') throw new Error('Admin only')
  return session
}

async function getAnySession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

// Daily rate: 10% monthly → ~0.3226% per day  (10/31 for avg month)
// More precisely:  (1.10)^(1/30) - 1  ≈ 0.3195%/day  (compound)
// We use simple daily = grossPct / 30  for transparency
function dailyGrossRate(grossPct: number) {
  return grossPct / 30 / 100 // decimal  e.g. 0.003333 for 10%/30
}

// Generate daily log rows from startDate up to today (or endDate if set)
function generateDailyLogs(
  planId: number,
  userId: string,
  principal: number,
  grossPct: number,
  feePct: number,
  netPct: number,
  startDate: string,
  endDate?: string | null,
) {
  const start = new Date(startDate)
  const cap = endDate ? new Date(endDate) : new Date()
  cap.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = cap < today ? cap : today

  const dailyRate = dailyGrossRate(grossPct)
  const feeShare = feePct / grossPct // fraction of gross that is fee
  const rows: typeof autoTradeLogs.$inferInsert[] = []
  let running = 0

  const d = new Date(start)
  while (d <= end) {
    const dateStr = d.toISOString().split('T')[0]
    const gross = parseFloat((principal * dailyRate).toFixed(8))
    const fee = parseFloat((gross * feeShare).toFixed(8))
    const net = parseFloat((gross - fee).toFixed(8))
    running = parseFloat((running + net).toFixed(8))

    rows.push({
      planId,
      userId,
      tradeDate: dateStr,
      dailyGross: String(gross),
      dailyFee: String(fee),
      dailyNet: String(net),
      runningTotal: String(running),
      status: 'completed',
    })

    d.setDate(d.getDate() + 1)
  }

  return rows
}

// ─── Admin actions ─────────────────────────────────────────────────────────────

export async function createAutoTradePlan(
  targetUserId: string,
  principal: number,
  startDate: string,
  note?: string,
) {
  const session = await getAdminSession()

  // Only one active plan per trader
  const existing = await db
    .select()
    .from(autoTradePlans)
    .where(and(eq(autoTradePlans.userId, targetUserId), eq(autoTradePlans.status, 'active')))
    .limit(1)
  if (existing.length) throw new Error('Trader already has an active auto-trade plan')

  const GROSS = 10, FEE = 2, NET = 8

  const [plan] = await db.insert(autoTradePlans).values({
    userId: targetUserId,
    createdBy: session.user.id,
    principal: String(principal),
    grossReturnPct: String(GROSS),
    feePct: String(FEE),
    netReturnPct: String(NET),
    status: 'active',
    startDate,
    note: note ?? null,
  }).returning()

  // Pre-generate daily logs from startDate → today
  const rows = generateDailyLogs(plan.id, targetUserId, principal, GROSS, FEE, NET, startDate)
  if (rows.length) {
    await db.insert(autoTradeLogs).values(rows)
  }

  return plan
}

export async function updateAutoTradePlanStatus(
  planId: number,
  status: 'active' | 'paused' | 'completed',
) {
  await getAdminSession()
  await db.update(autoTradePlans)
    .set({ status, updatedAt: new Date() })
    .where(eq(autoTradePlans.id, planId))
  return { success: true }
}

export async function getAllAutoTradePlans() {
  await getAdminSession()

  const plans = await db.select().from(autoTradePlans).orderBy(desc(autoTradePlans.createdAt))
  const users = await db.select({ id: user.id, name: user.name, email: user.email }).from(user)
  const userMap = Object.fromEntries(users.map(u => [u.id, u]))

  // Sync today's log for active plans
  for (const plan of plans.filter(p => p.status === 'active')) {
    await syncTodayLog(plan)
  }

  return plans.map(p => ({
    ...p,
    user: userMap[p.userId] ?? { id: p.userId, name: null, email: p.userId },
  }))
}

async function syncTodayLog(plan: typeof autoTradePlans.$inferSelect) {
  const today = new Date().toISOString().split('T')[0]
  const existing = await db.select()
    .from(autoTradeLogs)
    .where(and(eq(autoTradeLogs.planId, plan.id), eq(autoTradeLogs.tradeDate, today)))
    .limit(1)
  if (existing.length) return

  // Get last running total
  const [last] = await db.select()
    .from(autoTradeLogs)
    .where(eq(autoTradeLogs.planId, plan.id))
    .orderBy(desc(autoTradeLogs.tradeDate))
    .limit(1)

  const principal = parseFloat(String(plan.principal))
  const grossPct = parseFloat(String(plan.grossReturnPct))
  const feePct = parseFloat(String(plan.feePct))
  const feeShare = feePct / grossPct
  const dailyRate = dailyGrossRate(grossPct)

  const gross = parseFloat((principal * dailyRate).toFixed(8))
  const fee = parseFloat((gross * feeShare).toFixed(8))
  const net = parseFloat((gross - fee).toFixed(8))
  const prevTotal = last ? parseFloat(String(last.runningTotal)) : 0
  const running = parseFloat((prevTotal + net).toFixed(8))

  await db.insert(autoTradeLogs).values({
    planId: plan.id,
    userId: plan.userId,
    tradeDate: today,
    dailyGross: String(gross),
    dailyFee: String(fee),
    dailyNet: String(net),
    runningTotal: String(running),
    status: 'completed',
  })
}

// ─── Trader actions ────────────────────────────────────────────────────────────

export async function getMyAutoTradePlan() {
  const session = await getAnySession()

  const [plan] = await db.select().from(autoTradePlans)
    .where(eq(autoTradePlans.userId, session.user.id))
    .orderBy(desc(autoTradePlans.createdAt))
    .limit(1)

  if (!plan) return null

  // Sync today's log
  if (plan.status === 'active') await syncTodayLog(plan)

  const logs = await db.select().from(autoTradeLogs)
    .where(eq(autoTradeLogs.planId, plan.id))
    .orderBy(desc(autoTradeLogs.tradeDate))

  return { plan, logs }
}
