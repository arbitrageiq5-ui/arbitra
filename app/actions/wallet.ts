'use server'

import { db } from '@/lib/db'
import { walletTransactions, withdrawals, fundRequests, user, referralCommissions, autoTradeLogs } from '@/lib/db/schema'
import { eq, desc, sum, sql } from 'drizzle-orm'
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

// Compute a user's live wallet balance from all sources
export async function computeWalletBalance(userId: string): Promise<number> {
  // 1. Confirmed deposits (fund_requests confirmed)
  const depRes = await db
    .select({ total: sum(fundRequests.amount) })
    .from(fundRequests)
    .where(sql`"userId" = ${userId} AND status = 'confirmed'`)
  const deposits = parseFloat(String(depRes[0]?.total ?? '0')) || 0

  // 2. Auto-trade net profits (sum of daily_net from logs)
  const profitRes = await db
    .select({ total: sum(autoTradeLogs.dailyNet) })
    .from(autoTradeLogs)
    .where(eq(autoTradeLogs.userId, userId))
  const profits = parseFloat(String(profitRes[0]?.total ?? '0')) || 0

  // 3. Referral commissions (paid status)
  const commRes = await db
    .select({ total: sum(referralCommissions.amount) })
    .from(referralCommissions)
    .where(sql`"userId" = ${userId} AND status = 'paid'`)
  const commissions = parseFloat(String(commRes[0]?.total ?? '0')) || 0

  // 4. Approved withdrawals (debit)
  const withRes = await db
    .select({ total: sum(withdrawals.amount) })
    .from(withdrawals)
    .where(sql`"userId" = ${userId} AND status = 'approved'`)
  const withdrawn = parseFloat(String(withRes[0]?.total ?? '0')) || 0

  // 5. Pending withdrawals (locked)
  const pendingWithRes = await db
    .select({ total: sum(withdrawals.amount) })
    .from(withdrawals)
    .where(sql`"userId" = ${userId} AND status = 'pending'`)
  const pendingWithdrawn = parseFloat(String(pendingWithRes[0]?.total ?? '0')) || 0

  // 6. Activation fee paid (debit $100)
  const userRow = await db.select({ isActivated: user.isActivated }).from(user).where(eq(user.id, userId)).limit(1)
  const activationDebit = userRow[0]?.isActivated ? 100 : 0

  const available = deposits + profits + commissions - withdrawn - pendingWithdrawn - activationDebit
  return Math.max(0, parseFloat(available.toFixed(2)))
}

// ─── Trader: get full wallet summary ──────────────────────────────────────────

export async function getWalletSummary() {
  const session = await getSession()
  const userId = session.user.id

  // Confirmed deposits
  const depRes = await db
    .select({ total: sum(fundRequests.amount) })
    .from(fundRequests)
    .where(sql`"userId" = ${userId} AND status = 'confirmed'`)
  const totalDeposited = parseFloat(String(depRes[0]?.total ?? '0')) || 0

  // Pending deposits
  const pendDepRes = await db
    .select({ total: sum(fundRequests.amount) })
    .from(fundRequests)
    .where(sql`"userId" = ${userId} AND status = 'pending'`)
  const pendingDeposit = parseFloat(String(pendDepRes[0]?.total ?? '0')) || 0

  // Auto-trade net profits
  const profitRes = await db
    .select({ total: sum(autoTradeLogs.dailyNet) })
    .from(autoTradeLogs)
    .where(eq(autoTradeLogs.userId, userId))
  const tradeProfits = parseFloat(String(profitRes[0]?.total ?? '0')) || 0

  // Referral commissions earned (paid)
  const commRes = await db
    .select({ total: sum(referralCommissions.amount) })
    .from(referralCommissions)
    .where(sql`"userId" = ${userId} AND status = 'paid'`)
  const referralEarnings = parseFloat(String(commRes[0]?.total ?? '0')) || 0

  // Pending referral commissions
  const pendCommRes = await db
    .select({ total: sum(referralCommissions.amount) })
    .from(referralCommissions)
    .where(sql`"userId" = ${userId} AND status = 'pending'`)
  const pendingReferral = parseFloat(String(pendCommRes[0]?.total ?? '0')) || 0

  // Withdrawals
  const withApproved = await db
    .select({ total: sum(withdrawals.amount) })
    .from(withdrawals)
    .where(sql`"userId" = ${userId} AND status = 'approved'`)
  const totalWithdrawn = parseFloat(String(withApproved[0]?.total ?? '0')) || 0

  const withPending = await db
    .select({ total: sum(withdrawals.amount) })
    .from(withdrawals)
    .where(sql`"userId" = ${userId} AND status = 'pending'`)
  const pendingWithdrawal = parseFloat(String(withPending[0]?.total ?? '0')) || 0

  // Activation fee
  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  const activationDebit = u?.isActivated ? 100 : 0

  // Available balance
  const available = Math.max(
    0,
    parseFloat((totalDeposited + tradeProfits + referralEarnings - totalWithdrawn - pendingWithdrawal - activationDebit).toFixed(2))
  )

  // Recent transactions (deposits + withdrawals)
  const recentDeposits = await db
    .select()
    .from(fundRequests)
    .where(eq(fundRequests.userId, userId))
    .orderBy(desc(fundRequests.createdAt))
    .limit(5)

  const recentWithdrawals = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.userId, userId))
    .orderBy(desc(withdrawals.createdAt))
    .limit(5)

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
    isActivated: u?.isActivated ?? false,
    recentDeposits,
    recentWithdrawals,
  }
}

// ─── Trader: request withdrawal ───────────────────────────────────────────────

export async function requestWithdrawal(
  amount: number,
  network: 'TRC20' | 'BEP20' | 'ERC20',
  walletAddress: string,
) {
  const session = await getSession()
  const userId = session.user.id

  if (amount < 10) throw new Error('Minimum withdrawal is $10')
  if (!walletAddress.trim()) throw new Error('Wallet address is required')

  // Check available balance
  const available = await computeWalletBalance(userId)
  if (amount > available) throw new Error(`Insufficient balance. Available: $${available.toFixed(2)}`)

  // Check no duplicate pending withdrawal
  const pending = await db
    .select()
    .from(withdrawals)
    .where(sql`"userId" = ${userId} AND status = 'pending'`)
    .limit(1)
  if (pending.length > 0) throw new Error('You already have a pending withdrawal request. Please wait for it to be processed.')

  const [row] = await db.insert(withdrawals).values({
    userId,
    amount: String(amount),
    network,
    walletAddress: walletAddress.trim(),
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
    txHash: txHash?.trim() || null,
    note: note?.trim() || null,
    updatedAt: new Date(),
  }).where(eq(withdrawals.id, withdrawalId))

  return { success: true }
}
