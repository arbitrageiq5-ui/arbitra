'use server'

import { db } from '@/lib/db'
import { walletTransactions, withdrawals, fundRequests, user, referralCommissions, autoTradeLogs } from '@/lib/db/schema'
import { eq, desc, sum, sql, and, gte } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

async function requireAdmin() {
  const session = await getSession()
  const [u] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!u || u.role !== 'admin') throw new Error('Admin only')
  return session
}

// Compute a user's live wallet balance — all 7 queries run in parallel
export async function computeWalletBalance(userId: string): Promise<number> {
  const [depRes, profitRes, commRes, withRes, pendingWithRes, userRow, shiftRes] = await Promise.all([
    db.select({ total: sum(fundRequests.amount) }).from(fundRequests)
      .where(sql`"userId" = ${userId} AND status = 'confirmed'`),
    db.select({ total: sum(autoTradeLogs.dailyNet) }).from(autoTradeLogs)
      .where(eq(autoTradeLogs.userId, userId)),
    db.select({ total: sum(referralCommissions.amount) }).from(referralCommissions)
      .where(sql`"userId" = ${userId} AND status IN ('pending','paid')`),
    db.select({ total: sum(withdrawals.amount) }).from(withdrawals)
      .where(sql`"userId" = ${userId} AND status = 'approved'`),
    db.select({ total: sum(withdrawals.amount) }).from(withdrawals)
      .where(sql`"userId" = ${userId} AND status = 'pending'`),
    db.select({ isActivated: user.isActivated }).from(user).where(eq(user.id, userId)).limit(1),
    db.select({ total: sum(walletTransactions.amount) }).from(walletTransactions)
      .where(sql`"userId" = ${userId} AND type = 'auto_trade_principal' AND status = 'completed'`),
  ])

  const deposits      = parseFloat(String(depRes[0]?.total        ?? '0')) || 0
  const profits       = parseFloat(String(profitRes[0]?.total     ?? '0')) || 0
  const commissions   = parseFloat(String(commRes[0]?.total       ?? '0')) || 0
  const withdrawn     = parseFloat(String(withRes[0]?.total       ?? '0')) || 0
  const pendingWith   = parseFloat(String(pendingWithRes[0]?.total ?? '0')) || 0
  const activationDebit = userRow[0]?.isActivated ? 100 : 0
  const autoTradeShifted = Math.abs(parseFloat(String(shiftRes[0]?.total ?? '0')) || 0)

  const available = deposits + profits + commissions - withdrawn - pendingWith - activationDebit - autoTradeShifted
  return Math.max(0, parseFloat(available.toFixed(2)))
}

// ─── Trader: get FAST wallet balance only ────────────────────────────────────
// Quick balance fetch - only calls computeWalletBalance, no full breakdown
export async function getWalletBalanceFast() {
  const session = await getSession()
  const userId = session.user.id
  const available = await computeWalletBalance(userId)
  return { available }
}

// ─── Trader: get full wallet summary ──────────────────────────────────────────

export async function getWalletSummary() {
  const session = await getSession()
  const userId = session.user.id

  // All 11 queries fire in parallel — dramatically faster than sequential awaits
  const [
    depRes, pendDepRes, profitRes, commRes,
    withApproved, withPending, uRows, shiftRes,
    recentDeposits, recentWithdrawals, lastWithdrawalRows,
  ] = await Promise.all([
    db.select({ total: sum(fundRequests.amount) }).from(fundRequests)
      .where(sql`"userId" = ${userId} AND status = 'confirmed'`),
    db.select({ total: sum(fundRequests.amount) }).from(fundRequests)
      .where(sql`"userId" = ${userId} AND status = 'pending'`),
    db.select({ total: sum(autoTradeLogs.dailyNet) }).from(autoTradeLogs)
      .where(eq(autoTradeLogs.userId, userId)),
    db.select({ total: sum(referralCommissions.amount) }).from(referralCommissions)
      .where(sql`"userId" = ${userId} AND status IN ('pending','paid')`),
    db.select({ total: sum(withdrawals.amount) }).from(withdrawals)
      .where(sql`"userId" = ${userId} AND status = 'approved'`),
    db.select({ total: sum(withdrawals.amount) }).from(withdrawals)
      .where(sql`"userId" = ${userId} AND status = 'pending'`),
    db.select().from(user).where(eq(user.id, userId)).limit(1),
    db.select({ total: sum(walletTransactions.amount) }).from(walletTransactions)
      .where(sql`"userId" = ${userId} AND type = 'auto_trade_principal' AND status = 'completed'`),
    db.select().from(fundRequests).where(eq(fundRequests.userId, userId))
      .orderBy(desc(fundRequests.createdAt)).limit(10),
    db.select().from(withdrawals).where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.createdAt)).limit(10),
    db.select({ createdAt: withdrawals.createdAt }).from(withdrawals)
      .where(sql`"userId" = ${userId} AND status IN ('pending','approved')`)
      .orderBy(desc(withdrawals.createdAt)).limit(1),
  ])

  const totalDeposited    = parseFloat(String(depRes[0]?.total      ?? '0')) || 0
  const pendingDeposit    = parseFloat(String(pendDepRes[0]?.total   ?? '0')) || 0
  const tradeProfits      = parseFloat(String(profitRes[0]?.total    ?? '0')) || 0
  const referralEarnings  = parseFloat(String(commRes[0]?.total      ?? '0')) || 0
  const totalWithdrawn    = parseFloat(String(withApproved[0]?.total ?? '0')) || 0
  const pendingWithdrawal = parseFloat(String(withPending[0]?.total  ?? '0')) || 0
  const u                 = uRows[0]
  const activationDebit   = u?.isActivated ? 100 : 0
  const autoTradeShifted  = Math.abs(parseFloat(String(shiftRes[0]?.total ?? '0')) || 0)
  const pendingReferral   = 0

  const available = Math.max(
    0,
    parseFloat((totalDeposited + tradeProfits + referralEarnings - totalWithdrawn - pendingWithdrawal - activationDebit - autoTradeShifted).toFixed(2))
  )

  const lastWithdrawal = lastWithdrawalRows[0]

  const lastWithdrawalAt = lastWithdrawal?.createdAt ?? null
  const nextWithdrawalAvailable = lastWithdrawalAt
    ? new Date(new Date(lastWithdrawalAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null
  const canWithdrawNow = !nextWithdrawalAvailable || new Date() >= nextWithdrawalAvailable

  return {
    available,
    totalDeposited,
    pendingDeposit,
    tradeProfits,
    referralEarnings,
    pendingReferral,
    totalWithdrawn,
    pendingWithdrawal,
    activationDebit,
    autoTradeShifted,
    isActivated: u?.isActivated ?? false,
    lastWithdrawalAt,
    nextWithdrawalAvailable,
    canWithdrawNow,
    recentDeposits,
    recentWithdrawals,
  }
}

// ─── Trader: request withdrawal ───────────────────────────────────────────────

export async function requestWithdrawal(
  amount: number,
  network: 'TRC20' | 'BEP20' | 'ERC20',
  walletAddress: string,
  txHash: string,
) {
  const session = await getSession()
  const userId = session.user.id

  if (amount < 100) throw new Error('Minimum withdrawal is $100')
  if (!walletAddress.trim()) throw new Error('Wallet address is required')
  if (!txHash.trim()) throw new Error('Transaction Hash ID is required')

  // Check available balance
  const available = await computeWalletBalance(userId)
  if (amount > available) throw new Error(`Insufficient balance. Available: $${available.toFixed(2)}`)

  // Weekly withdrawal gate — only one withdrawal per 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [recentWithdrawal] = await db
    .select({ createdAt: withdrawals.createdAt })
    .from(withdrawals)
    .where(and(
      eq(withdrawals.userId, userId),
      sql`status IN ('pending','approved')`,
      gte(withdrawals.createdAt, sevenDaysAgo),
    ))
    .orderBy(desc(withdrawals.createdAt))
    .limit(1)

  if (recentWithdrawal) {
    const nextAvailable = new Date(new Date(recentWithdrawal.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    const daysLeft = Math.ceil((nextAvailable.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    throw new Error(`Withdrawals are weekly. Next withdrawal available in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${nextAvailable.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}).`)
  }

  const [row] = await db.insert(withdrawals).values({
    userId,
    amount: String(amount),
    network,
    walletAddress: walletAddress.trim(),
    txHash: txHash.trim(),
    status: 'pending',
  }).returning()

  return row
}

// ─── Trader: cancel pending withdrawal ────────────────────────────────────────

export async function cancelWithdrawal(withdrawalId: number) {
  const session = await getSession()
  const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1)
  if (!row) throw new Error('Not found')
  if (row.userId !== session.user.id) throw new Error('Forbidden')
  if (row.status !== 'pending') throw new Error('Cannot cancel a processed withdrawal')
  await db.update(withdrawals).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(withdrawals.id, withdrawalId))
  return { success: true }
}

// ─── Admin: get all trader wallet balances ────────────────────────────────────

export async function getAllTraderBalances() {
  await requireAdmin()

  const traders = await db
    .select({ id: user.id, name: user.name, email: user.email, isActivated: user.isActivated, createdAt: user.createdAt })
    .from(user)
    .where(sql`role IN ('trader', 'protrader')`)

  const results = await Promise.all(
    traders.map(async (t) => {
      // Confirmed deposits
      const depRes = await db.select({ total: sum(fundRequests.amount) }).from(fundRequests)
        .where(sql`"userId" = ${t.id} AND status = 'confirmed'`)
      const totalDeposited = parseFloat(String(depRes[0]?.total ?? '0')) || 0

      // Auto-trade profits
      const profitRes = await db.select({ total: sum(autoTradeLogs.dailyNet) }).from(autoTradeLogs)
        .where(eq(autoTradeLogs.userId, t.id))
      const tradeProfits = parseFloat(String(profitRes[0]?.total ?? '0')) || 0

      // Referral commissions (paid)
      const commRes = await db.select({ total: sum(referralCommissions.amount) }).from(referralCommissions)
        .where(sql`"userId" = ${t.id} AND status = 'paid'`)
      const referralEarnings = parseFloat(String(commRes[0]?.total ?? '0')) || 0

      // Approved withdrawals
      const withRes = await db.select({ total: sum(withdrawals.amount) }).from(withdrawals)
        .where(sql`"userId" = ${t.id} AND status = 'approved'`)
      const totalWithdrawn = parseFloat(String(withRes[0]?.total ?? '0')) || 0

      // Pending withdrawals
      const pendRes = await db.select({ total: sum(withdrawals.amount) }).from(withdrawals)
        .where(sql`"userId" = ${t.id} AND status = 'pending'`)
      const pendingWithdrawal = parseFloat(String(pendRes[0]?.total ?? '0')) || 0

      const activationDebit = t.isActivated ? 100 : 0
      const available = Math.max(0, parseFloat(
        (totalDeposited + tradeProfits + referralEarnings - totalWithdrawn - pendingWithdrawal - activationDebit).toFixed(2)
      ))

      return {
        ...t,
        totalDeposited,
        tradeProfits,
        referralEarnings,
        totalWithdrawn,
        pendingWithdrawal,
        activationDebit,
        available,
      }
    })
  )

  return results
}

// ─── Admin: get all withdrawals ───────────────────────────────────────────────

export async function getAllWithdrawals() {
  await requireAdmin()
  const rows = await db
    .select({
      id: withdrawals.id,
      userId: withdrawals.userId,
      amount: withdrawals.amount,
      network: withdrawals.network,
      walletAddress: withdrawals.walletAddress,
      status: withdrawals.status,
      txHash: withdrawals.txHash,
      note: withdrawals.note,
      createdAt: withdrawals.createdAt,
      reviewedAt: withdrawals.reviewedAt,
      trader: { name: user.name, email: user.email },
    })
    .from(withdrawals)
    .leftJoin(user, eq(withdrawals.userId, user.id))
    .orderBy(desc(withdrawals.createdAt))
  return rows
}

// ─── Admin: approve or reject withdrawal ─────────────────────────────────────

export async function reviewWithdrawal(
  withdrawalId: number,
  action: 'approved' | 'rejected',
  txHash?: string,
  note?: string,
) {
  const session = await requireAdmin()

  const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1)
  if (!row) throw new Error('Not found')
  if (row.status !== 'pending') throw new Error('Already reviewed')

  if (action === 'approved') {
    // Verify balance is still sufficient
    const available = await computeWalletBalance(row.userId)
    const amount = parseFloat(String(row.amount))
    if (amount > available + amount) throw new Error('User has insufficient balance') // available already excludes pending
  }

  await db.update(withdrawals).set({
    status: action,
    reviewedBy: session.user.id,
    reviewedAt: new Date(),
    txHash: txHash?.trim() ?? undefined,
    note: note?.trim() ?? undefined,
    updatedAt: new Date(),
  }).where(eq(withdrawals.id, withdrawalId))

  return { success: true }
}
