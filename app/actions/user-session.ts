'use server'

import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * Get client IP address from headers (works with proxies like Vercel, Cloudflare)
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers()
  return (
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') ||
    '0.0.0.0'
  )
}

/**
 * Record user login IP address and timestamp
 * Call this from the auth flow or a post-login server action
 */
export async function recordUserLogin(userId: string) {
  try {
    const ipAddress = await getClientIp()
    const now = new Date()

    await db
      .update(user)
      .set({
        lastLoginIp: ipAddress,
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(user.id, userId))

    return { success: true, ipAddress }
  } catch (err) {
    console.error('[v0] recordUserLogin error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to record login' }
  }
}

/**
 * Get user's last login IP
 */
export async function getUserLoginIp(userId: string) {
  try {
    const [result] = await db
      .select({ lastLoginIp: user.lastLoginIp, lastLoginAt: user.lastLoginAt })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    return result ? { ip: result.lastLoginIp, timestamp: result.lastLoginAt } : null
  } catch (err) {
    console.error('[v0] getUserLoginIp error:', err)
    return null
  }
}
