'use server'

import { db } from '@/lib/db'
import { depositAddresses, fundRequests, user } from '@/lib/db/schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { eq, desc } from 'drizzle-orm'

type Network = 'TRC20' | 'BEP20' | 'ERC20'

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Not authenticated')
  return session
}

async function requireAdmin() {
  const session = await getSession()
  const u = session.user as unknown as { role?: string }
  if (u.role !== 'admin') throw new Error('Admin access required')
  return session
}

// ─── Admin: Deposit Address Management ───────────────────────────────────────

export async function getDepositAddresses() {
  await getSession()
  return db
    .select()
    .from(depositAddresses)
    .where(eq(depositAddresses.isActive, true))
    .orderBy(depositAddresses.network)
}

export async function getAllDepositAddresses() {
  await requireAdmin()
  return db
    .select()
    .from(depositAddresses)
    .orderBy(desc(depositAddresses.createdAt))
}

export async function upsertDepositAddress(
  network: Network,
  address: string,
  label?: string
) {
  const session = await requireAdmin()

  // Deactivate existing active address for this network
  await db
    .update(depositAddresses)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(depositAddresses.network, network))

  // Insert new one
  const [row] = await db
    .insert(depositAddresses)
    .values({
      network,
      address: address.trim(),
      label: label?.trim() || null,
      isActive: true,
      createdBy: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  return row
}

export async function deleteDepositAddress(id: number) {
  await requireAdmin()
  await db
    .update(depositAddresses)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(depositAddresses.id, id))
}

// ─── Trader: Fund Request Management ─────────────────────────────────────────

export async function submitFundRequest(
  network: Network,
  amount: number,
  txHash?: string,
  screenshotUrl?: string
) {
  const session = await getSession()
  const u = session.user as unknown as { role?: string }
  if (u.role !== 'trader' && u.role !== 'protrader') throw new Error('Trader access required')

  if (amount <= 0) throw new Error('Amount must be greater than 0')
  if (!txHash?.trim()) throw new Error('Transaction hash is required')

  const [row] = await db
    .insert(fundRequests)
    .values({
      userId: session.user.id,
      network,
      amount: amount.toString(),
      txHash: txHash.trim(),
      screenshotUrl: screenshotUrl?.trim() ?? '',
      status: 'pending',
    })
    .returning()

  return row
}

export async function getMyFundRequests() {
  const session = await getSession()
  return db
    .select()
    .from(fundRequests)
    .where(eq(fundRequests.userId, session.user.id))
    .orderBy(desc(fundRequests.createdAt))
}

// ─── Admin: Review Fund Requests ─────────────────────────────────────────────

export async function getAllFundRequests() {
  await requireAdmin()
  return db
    .select({
      id: fundRequests.id,
      userId: fundRequests.userId,
      network: fundRequests.network,
      amount: fundRequests.amount,
      txHash: fundRequests.txHash,
      screenshotUrl: fundRequests.screenshotUrl,
      status: fundRequests.status,
      note: fundRequests.note,
      reviewedBy: fundRequests.reviewedBy,
      reviewedAt: fundRequests.reviewedAt,
      createdAt: fundRequests.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(fundRequests)
    .leftJoin(user, eq(fundRequests.userId, user.id))
    .orderBy(desc(fundRequests.createdAt))
}

export async function reviewFundRequest(
  id: number,
  status: 'confirmed' | 'rejected',
  note?: string
) {
  const session = await requireAdmin()
  const [row] = await db
    .update(fundRequests)
    .set({
      status,
      note: note?.trim() || null,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(fundRequests.id, id))
    .returning()
  return row
}
