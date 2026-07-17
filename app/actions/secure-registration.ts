'use server'

import { db } from '@/lib/db'
import { user, registrationAudits } from '@/lib/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { headers } from 'next/headers'

const CAPTCHA_SCORE_THRESHOLD = 0.5 // reCAPTCHA v3: score >= 0.5 is likely legitimate
const RATE_LIMIT_WINDOW_MS = 3600000 // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5 // Max 5 registration attempts per IP per hour

/**
 * Verify reCAPTCHA v3 token with Google servers
 */
async function verifyCaptcha(token: string, ipAddress: string): Promise<{ score: number; success: boolean; action: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  if (!secretKey) {
    console.warn('[v0] RECAPTCHA_SECRET_KEY not configured')
    return { score: 0.5, success: false, action: 'register' }
  }

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: ipAddress,
      }).toString(),
    })

    const data = (await res.json()) as {
      success: boolean
      challenge_ts?: string
      hostname?: string
      score?: number
      action?: string
      error_codes?: string[]
    }

    return {
      success: data.success && (data.score ?? 0) >= CAPTCHA_SCORE_THRESHOLD,
      score: data.score ?? 0,
      action: data.action ?? 'register',
    }
  } catch (err) {
    console.error('[v0] reCAPTCHA verification failed:', err)
    return { score: 0, success: false, action: 'register' }
  }
}

/**
 * Check rate limiting per IP
 */
async function checkRateLimit(ipAddress: string): Promise<{ allowed: boolean; attemptCount: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)

  const [result] = await db
    .select({ count: db.count() })
    .from(registrationAudits)
    .where(
      and(
        eq(registrationAudits.ipAddress, ipAddress),
        gt(registrationAudits.createdAt, windowStart)
      )
    )

  const attemptCount = result?.count ?? 0
  return {
    allowed: attemptCount < RATE_LIMIT_MAX_ATTEMPTS,
    attemptCount,
  }
}

/**
 * Get client IP address from headers (works with proxies like Vercel)
 */
function getClientIp(): string {
  const headersList = headers()
  return (
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    headersList.get('cf-connecting-ip') ||
    '0.0.0.0'
  )
}

/**
 * Register user with captcha validation and secure audit logging
 */
export async function registerWithCaptcha({
  email,
  password,
  name,
  phone,
  country,
  tradingExperienceLevel,
  captchaToken,
}: {
  email: string
  password: string
  name: string
  phone: string
  country: string
  tradingExperienceLevel: 'beginner' | 'intermediate' | 'advanced'
  captchaToken: string
}): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    const ipAddress = getClientIp()
    const userAgent = headers().get('user-agent') || ''

    // 1. Check rate limiting
    const { allowed, attemptCount } = await checkRateLimit(ipAddress)
    if (!allowed) {
      // Log failed attempt
      await db.insert(registrationAudits).values({
        email,
        ipAddress,
        userAgent,
        registrationStatus: 'rejected',
        rejectionReason: `Rate limited: ${attemptCount} attempts in last hour`,
        country,
        tradingExperienceLevel,
      })
      return { success: false, error: 'Too many registration attempts. Try again later.' }
    }

    // 2. Verify captcha
    const captchaResult = await verifyCaptcha(captchaToken, ipAddress)
    if (!captchaResult.success) {
      // Log failed captcha
      await db.insert(registrationAudits).values({
        email,
        ipAddress,
        userAgent,
        captchaScore: parseFloat(captchaResult.score.toFixed(2)),
        captchaPassed: false,
        registrationStatus: 'rejected',
        rejectionReason: `Captcha score too low: ${captchaResult.score.toFixed(2)}`,
        country,
        tradingExperienceLevel,
      })
      return { success: false, error: 'Captcha verification failed. Please try again.' }
    }

    // 3. Validate email uniqueness
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email.toLowerCase()))
      .limit(1)

    if (existingUser.length > 0) {
      // Log duplicate email attempt
      await db.insert(registrationAudits).values({
        email,
        ipAddress,
        userAgent,
        captchaScore: parseFloat(captchaResult.score.toFixed(2)),
        captchaPassed: true,
        registrationStatus: 'rejected',
        rejectionReason: 'Email already registered',
        country,
        tradingExperienceLevel,
      })
      return { success: false, error: 'Email already registered.' }
    }

    // 4. Create user with additional details
    const newUser = await db
      .insert(user)
      .values({
        email: email.toLowerCase(),
        password,
        name,
        phone,
        country,
        tradingExperienceLevel,
        role: 'trader',
      })
      .returning({ id: user.id })

    if (!newUser[0]) {
      throw new Error('Failed to create user')
    }

    // 5. Log successful registration
    await db.insert(registrationAudits).values({
      userId: newUser[0].id,
      email,
      ipAddress,
      userAgent,
      captchaScore: parseFloat(captchaResult.score.toFixed(2)),
      captchaPassed: true,
      registrationStatus: 'success',
      country,
      tradingExperienceLevel,
    })

    return {
      success: true,
      userId: newUser[0].id,
    }
  } catch (err) {
    console.error('[v0] Registration error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Registration failed. Please try again.',
    }
  }
}

/**
 * Get registration audit logs (admin only)
 */
export async function getRegistrationAudits({
  limit = 50,
  offset = 0,
}: {
  limit?: number
  offset?: number
} = {}) {
  try {
    const audits = await db
      .select()
      .from(registrationAudits)
      .orderBy((t) => [desc(t.createdAt)])
      .limit(limit)
      .offset(offset)

    return { success: true, audits }
  } catch (err) {
    console.error('[v0] Failed to fetch audits:', err)
    return { success: false, audits: [] }
  }
}
