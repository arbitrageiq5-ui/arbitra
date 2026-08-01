'use server'

import { db, pool } from '@/lib/db'
import { user, activationFees, referralCommissions, referralIncomeCommissions, depositAddresses as depositAddressesTable } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

// Commission amounts by level (activation fee flat amounts)
const LEVEL_COMMISSIONS: Record<number, number> = { 1: 30, 2: 10, 3: 5 }
const ACTIVATION_FEE = 100

// Income commission rates (% of bot/auto-trade profit)
const INCOME_COMMISSION_RATES: Record<number, number> = { 1: 0.50, 2: 0.25, 3: 0.20 }

/**
 * Called whenever a bot or auto-trade cycle generates profit.
 * Walks up 3 referral levels and credits each referrer their % of income.
 *
 * @param earnerUserId  - the trader who generated the income
 * @param incomeAmount  - gross profit amount in USD
 * @param sourceType    - 'bot' | 'auto_trade'
 * @param refId         - optional ID of the source record
 */
export async function creditIncomeCommission(
  earnerUserId: string,
  incomeAmount: number,
  sourceType: 'bot' | 'auto_trade',
  refId?: string,
) {
  if (incomeAmount <= 0) return

  // Walk the referral chain: fetch all 3 levels in one query using a CTE
  const chainRows = await db.execute(sql`
    WITH RECURSIVE chain AS (
      SELECT id, "referredBy", 1 AS level
      FROM "user" WHERE id = ${earnerUserId}
      UNION ALL
      SELECT u.id, u."referredBy", c.level + 1
      FROM "user" u JOIN chain c ON u.id = c."referredBy"
      WHERE c.level < 3
    )
    SELECT u.id, u."isActivated", chain.level
    FROM chain
    JOIN "user" u ON u.id = chain."referredBy"
    WHERE chain."referredBy" IS NOT NULL
    ORDER BY chain.level
  `)
  const rows = (chainRows as { rows?: unknown[] }).rows ?? (chainRows as unknown as unknown[])

  // Insert all commissions in parallel
  await Promise.all(rows.map((row) => {
    const r = row as Record<string, unknown>
    const referrerId = r.id as string
    const isActivated = r.isActivated as boolean
    const level = r.level as number
    if (!isActivated) return Promise.resolve()
    const pct = INCOME_COMMISSION_RATES[level]
    if (!pct) return Promise.resolve()
    const commissionAmount = (incomeAmount * pct) / 100
    return db.execute(
      sql`INSERT INTO referral_income_commissions
            ("userId", "fromUserId", level, source_type, income_amount, commission_pct, amount, ref_id, status)
          VALUES
            (${referrerId}, ${earnerUserId}, ${level}, ${sourceType},
             ${incomeAmount.toFixed(8)}, ${pct.toFixed(4)}, ${commissionAmount.toFixed(8)},
             ${refId ?? null}, 'paid')`
    )
  }))
}

// Generate a unique 8-char alphanumeric referral code
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// Ensure current user has a referral code (called on every dashboard load)
export async function ensureReferralCode() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const [u] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!u) return null
  if (u.referralCode) return u.referralCode

  // Generate unique code
  let code = generateCode()
  let attempts = 0
  while (attempts < 10) {
    const existing = await db.select().from(user).where(eq(user.referralCode, code)).limit(1)
    if (existing.length === 0) break
    code = generateCode()
    attempts++
  }

  await db.update(user).set({ referralCode: code }).where(eq(user.id, session.user.id))
  return code
}

// Get current user's referral code — generates if missing
export async function getMyReferralCode(): Promise<string | null> {
  return ensureReferralCode()
}

// Get full referral dashboard data for the current trader
export async function getMyReferralData() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [me] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!me) throw new Error('User not found')

  // Ensure they have a referral code
  if (!me.referralCode) await ensureReferralCode()
  const referralCode = me.referralCode || (await ensureReferralCode())

  // All data fetched in parallel — activationFee, commissions, directReferrals, L2/L3 counts
  const [
    activationFeeRows,
    commissionsRaw,
    directReferrals,
    l2CountRows,
    l3CountRows,
  ] = await Promise.all([
    db.select().from(activationFees)
      .where(eq(activationFees.userId, session.user.id))
      .orderBy(desc(activationFees.createdAt)).limit(1),
    db.select({
      id: referralCommissions.id,
      level: referralCommissions.level,
      amount: referralCommissions.amount,
      status: referralCommissions.status,
      paidAt: referralCommissions.paidAt,
      createdAt: referralCommissions.createdAt,
      fromUserName: user.name,
      fromUserEmail: user.email,
    }).from(referralCommissions)
      .leftJoin(user, eq(referralCommissions.fromUserId, user.id))
      .where(eq(referralCommissions.userId, session.user.id))
      .orderBy(desc(referralCommissions.createdAt)),
    db.select({ id: user.id, name: user.name, email: user.email, isActivated: user.isActivated, createdAt: user.createdAt })
      .from(user).where(eq(user.referredBy, session.user.id)).orderBy(desc(user.createdAt)),
    db.select({ count: sql<number>`count(*)` }).from(user)
      .where(sql`referred_by IN (SELECT id FROM "user" WHERE referred_by = ${session.user.id})`),
    db.select({ count: sql<number>`count(*)` }).from(user)
      .where(sql`referred_by IN (SELECT id FROM "user" WHERE referred_by IN (SELECT id FROM "user" WHERE referred_by = ${session.user.id}))`),
  ])
  const activationFee = activationFeeRows[0]

  // Income commissions (bot + auto-trade %) — raw SQL to avoid quoted column name issues
  let incomeCommissions: {
    id: number
    level: number
    sourceType: string
    incomeAmount: string
    commissionPct: string
    amount: string
    status: string
    createdAt: Date
    fromUser: { name: string | null; email: string | null }
  }[] = []
  try {
    const icRows = await db.execute(
      sql`SELECT ric.id, ric.level, ric.source_type AS "sourceType",
             ric.income_amount AS "incomeAmount", ric.commission_pct AS "commissionPct",
             ric.amount, ric.status, ric."createdAt",
             u.name AS "fromUserName", u.email AS "fromUserEmail"
          FROM referral_income_commissions ric
          LEFT JOIN "user" u ON u.id = ric."fromUserId"
          WHERE ric."userId" = ${session.user.id}
          ORDER BY ric."createdAt" DESC`
    )
    const rows: unknown[] = (icRows as { rows?: unknown[] }).rows ?? ((icRows as unknown) as unknown[])
    incomeCommissions = rows.map((ic) => {
      const r = ic as Record<string, unknown>
      return {
        id: r.id as number,
        level: r.level as number,
        sourceType: r.sourceType as string,
        incomeAmount: r.incomeAmount as string,
        commissionPct: r.commissionPct as string,
        amount: r.amount as string,
        status: r.status as string,
        createdAt: r.createdAt as Date,
        fromUser: { name: r.fromUserName as string | null, email: r.fromUserEmail as string | null },
      }
    })
  } catch {
    // Table may not exist yet or columns differ — return empty array
    incomeCommissions = []
  }

  // Reshape commissionsRaw into commissions with nested fromUser
  const commissions = commissionsRaw.map(c => ({
    id: c.id,
    level: c.level,
    amount: c.amount,
    status: c.status,
    paidAt: c.paidAt,
    createdAt: c.createdAt,
    fromUser: { name: c.fromUserName, email: c.fromUserEmail },
  }))

  // Commission summary (activation flat fees)
  const totalEarned = commissions
    .filter(c => c.status === 'paid')
    .reduce((s, c) => s + parseFloat(c.amount as string), 0)

  const pendingEarnings = commissions
    .filter(c => c.status === 'pending')
    .reduce((s, c) => s + parseFloat(c.amount as string), 0)

  // Income commission totals by level
  const incomeTotalByLevel = { 1: 0, 2: 0, 3: 0 }
  let totalIncomeEarned = 0
  for (const ic of incomeCommissions) {
    const amt = parseFloat(ic.amount as string)
    const lv = ic.level as 1 | 2 | 3
    if (lv in incomeTotalByLevel) incomeTotalByLevel[lv] += amt
    totalIncomeEarned += amt
  }

  const l1Count = directReferrals.length
  const l1Activated = directReferrals.filter(r => r.isActivated).length
  // L2 and L3 counts already fetched in parallel above
  const l2Count = Number(l2CountRows[0]?.count ?? 0)
  const l3Count = Number(l3CountRows[0]?.count ?? 0)

  return {
    referralCode,
    isActivated: me.isActivated,
    activationFee: activationFee ?? null,
    commissions,
    incomeCommissions,
    directReferrals,
    totalEarned,
    pendingEarnings,
    totalIncomeEarned,
    incomeTotalByLevel,
    l1Count,
    l1Activated,
    l2Count: Number(l2Count),
    l3Count: Number(l3Count),
  }
}

// Get current user's activation status + latest fee submission + deposit addresses
export async function getActivationStatus() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [me] = await db.select({
    id: user.id,
    isActivated: user.isActivated,
    activationPaidAt: user.activationPaidAt,
  }).from(user).where(eq(user.id, session.user.id)).limit(1)

  if (!me) throw new Error('User not found')

  // Latest activation fee submission (any status)
  const [latestFee] = await db
    .select()
    .from(activationFees)
    .where(eq(activationFees.userId, session.user.id))
    .orderBy(desc(activationFees.createdAt))
    .limit(1)

  // Admin-configured deposit addresses
  const addresses = await db
    .select()
    .from(depositAddressesTable)
    .where(eq(depositAddressesTable.isActive, true))
    .orderBy(depositAddressesTable.network)

  return {
    isActivated: me.isActivated,
    activationPaidAt: me.activationPaidAt,
    latestFee: latestFee ?? null,
    depositAddresses: addresses,
  }
}

// Submit a $100 activation fee payment (trader submits tx hash for admin review)
export async function submitActivationFee(txHash: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [me] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!me) throw new Error('User not found')
  if (me.isActivated) throw new Error('Account already activated')

  // Check no pending/confirmed fee already
  const existing = await db
    .select()
    .from(activationFees)
    .where(and(eq(activationFees.userId, session.user.id), eq(activationFees.status, 'pending')))
    .limit(1)
  if (existing.length > 0) throw new Error('You already have a pending activation fee submission')

  await db.insert(activationFees).values({
    userId: session.user.id,
    amount: ACTIVATION_FEE.toString(),
    txHash: txHash.trim(),
    status: 'pending',
  })

  return { success: true }
}

// ADMIN: Get all pending activation fee requests
export async function getActivationFeeRequests() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [admin] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (admin?.role !== 'admin') throw new Error('Forbidden')

  const fees = await db
    .select({
      id: activationFees.id,
      userId: activationFees.userId,
      amount: activationFees.amount,
      txHash: activationFees.txHash,
      status: activationFees.status,
      note: activationFees.note,
      createdAt: activationFees.createdAt,
      reviewedAt: activationFees.reviewedAt,
      trader: {
        name: user.name,
        email: user.email,
        referredBy: user.referredBy,
      },
    })
    .from(activationFees)
    .leftJoin(user, eq(activationFees.userId, user.id))
    .orderBy(desc(activationFees.createdAt))

  return fees
}

// ADMIN: Approve activation fee — activates account + distributes 3-level commissions
export async function approveActivationFee(feeId: number) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [admin] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (admin?.role !== 'admin') throw new Error('Forbidden')

  const [fee] = await db.select().from(activationFees).where(eq(activationFees.id, feeId)).limit(1)
  if (!fee) throw new Error('Fee not found')
  if (fee.status !== 'pending') throw new Error('Already reviewed')

  // 1. Mark fee confirmed
  await db.update(activationFees).set({
    status: 'confirmed',
    reviewedBy: session.user.id,
    reviewedAt: new Date(),
  }).where(eq(activationFees.id, feeId))

  // 2. Activate the trader account
  await db.update(user).set({
    isActivated: true,
    activationPaidAt: new Date(),
  }).where(eq(user.id, fee.userId))

  // 3. Walk up 3 levels via CTE and credit commissions in parallel
  const chainResult = await db.execute(sql`
    WITH RECURSIVE chain AS (
      SELECT id, "referredBy", 1 AS level
      FROM "user" WHERE id = ${fee.userId}
      UNION ALL
      SELECT u.id, u."referredBy", c.level + 1
      FROM "user" u JOIN chain c ON u.id = c."referredBy"
      WHERE c.level < 3
    )
    SELECT u.id, u."isActivated", chain.level
    FROM chain
    JOIN "user" u ON u.id = chain."referredBy"
    WHERE chain."referredBy" IS NOT NULL
    ORDER BY chain.level
  `)
  const chainRows = (chainResult as { rows?: unknown[] }).rows ?? (chainResult as unknown as unknown[])

  await Promise.all(chainRows.map((row) => {
    const r = row as Record<string, unknown>
    const referrerId = r.id as string
    const isActivated = r.isActivated as boolean
    const level = r.level as number
    const commissionAmount = LEVEL_COMMISSIONS[level]
    if (!commissionAmount) return Promise.resolve()
    return db.insert(referralCommissions).values({
      userId: referrerId,
      fromUserId: fee.userId,
      level,
      amount: commissionAmount.toString(),
      status: isActivated ? 'paid' : 'pending',
      paidAt: isActivated ? new Date() : null,
    })
  }))

  return { success: true }
}

// ADMIN: Reject activation fee
export async function rejectActivationFee(feeId: number, note?: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [admin] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (admin?.role !== 'admin') throw new Error('Forbidden')

  await db.update(activationFees).set({
    status: 'rejected',
    reviewedBy: session.user.id,
    reviewedAt: new Date(),
    note: note ?? null,
  }).where(eq(activationFees.id, feeId))

  return { success: true }
}

// Validate a referral code and return the referrer's userId
export async function validateReferralCode(code: string): Promise<string | null> {
  if (!code?.trim()) return null
  const [referrer] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.referralCode, code.trim().toUpperCase()))
    .limit(1)
  return referrer?.id ?? null
}
