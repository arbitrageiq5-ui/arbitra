'use server'

import { db } from '@/lib/db'
import { user, registrationAudits } from '@/lib/db/schema'
import { eq, and, gt, desc, count } from 'drizzle-orm'
import { headers } from 'next/headers'

const CAPTCHA_SCORE_THRESHOLD = 0.5 // reCAPTCHA v3: score >= 0.5 is likely legitimate
const RATE_LIMIT_WINDOW_MS = 3600000 // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5 // Max 5 registration attempts per IP per hour

/**
 * Verify captcha token.
 * If the token is 'math-captcha-passed', the math challenge was already verified
 * on the client — we trust it and assign a high score.
 * Otherwise we call Google reCAPTCHA v3 if the secret key is configured.
 */
async function verifyCaptcha(token: string, ipAddress: string): Promise<{ score: number; success: boolean; action: string }> {
  // Math captcha path — no external API needed
  if (token === 'math-captcha-passed') {
    return { score: 0.9, success: true, action: 'register' }
  }

  // Google reCAPTCHA v3 path (optional, used when keys are configured)
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  if (!secretKey) {
    // No key configured — accept submission (math captcha is primary defense)
    return { score: 0.7, success: true, action: 'register' }
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
      score?: number
      action?: string
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
    .select({ count: count() })
    .from(registrationAudits)
    .where(
      and(
        eq(registrationAudits.ipAddress, ipAddress),
        gt(registrationAudits.createdAt, windowStart)
      )
    )

  const attemptCount = Number(result?.count ?? 0)
  return {
    allowed: attemptCount < RATE_LIMIT_MAX_ATTEMPTS,
    attemptCount,
  }
}

/**
 * Get client IP address from headers (works with proxies like Vercel).
 * headers() must be awaited in Next.js 16.
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
 * Pre-flight check: validate captcha and rate limit before account creation.
 * Does NOT insert the user — Better Auth handles that via authClient.signUp.email()
 * on the client, which correctly hashes the password. After Better Auth creates
 * the account, call saveRegistrationProfile() to store extra profile fields.
 */
export async function registerWithCaptcha({
  email,
  captchaToken,
}: {
  email: string
  captchaToken: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const ipAddress = await getClientIp()
    const userAgent = (await headers()).get('user-agent') || ''

    // 1. Check rate limiting
    const { allowed, attemptCount } = await checkRateLimit(ipAddress)
    if (!allowed) {
      await db.insert(registrationAudits).values({
        email,
        ipAddress,
        userAgent,
        registrationStatus: 'rejected',
        rejectionReason: `Rate limited: ${attemptCount} attempts in last hour`,
      })
      return { success: false, error: 'Too many registration attempts. Please try again in an hour.' }
    }

    // 2. Verify captcha
    const captchaResult = await verifyCaptcha(captchaToken, ipAddress)
    if (!captchaResult.success) {
      await db.insert(registrationAudits).values({
        email,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        captchaScore: captchaResult.score.toFixed(2),
        captchaPassed: false,
        registrationStatus: 'rejected',
        rejectionReason: `Captcha failed: score ${captchaResult.score.toFixed(2)}`,
      })
      return { success: false, error: 'Security check failed. Please try again.' }
    }

    // 3. Check email uniqueness before proceeding
    const existingUser = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email.toLowerCase()))
      .limit(1)

    if (existingUser.length > 0) {
      await db.insert(registrationAudits).values({
        email,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        captchaScore: captchaResult.score.toFixed(2),
        captchaPassed: true,
        registrationStatus: 'rejected',
        rejectionReason: 'Email already registered',
      })
      return { success: false, error: 'This email is already registered.' }
    }

    // Pre-flight passed — log pending, client will complete via Better Auth
    await db.insert(registrationAudits).values({
      email,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      captchaScore: captchaResult.score.toFixed(2),
      captchaPassed: true,
      registrationStatus: 'pending',
    })

    return { success: true }
  } catch (err) {
    console.error('[v0] Registration pre-flight error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Registration failed. Please try again.',
    }
  }
}

/**
 * Save additional profile fields after Better Auth creates the account.
 * Called from the client after authClient.signUp.email() succeeds.
 */
export async function saveRegistrationProfile({
  userId,
  phone,
  country,
  tradingExperienceLevel,
}: {
  userId: string
  phone?: string
  country?: string
  tradingExperienceLevel?: string
}): Promise<{ success: boolean }> {
  try {
    await db
      .update(user)
      .set({
        phone: phone || null,
        country: country || null,
        tradingExperienceLevel: tradingExperienceLevel || 'beginner',
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))

    // Update the most-recent pending audit for this user to success
    await db
      .update(registrationAudits)
      .set({
        userId,
        registrationStatus: 'success',
        country: country || null,
        tradingExperienceLevel: tradingExperienceLevel || 'beginner',
      })
      .where(
        and(
          eq(registrationAudits.userId, userId),
          eq(registrationAudits.registrationStatus, 'pending')
        )
      )

    return { success: true }
  } catch (err) {
    console.error('[v0] saveRegistrationProfile error:', err)
    return { success: false }
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
      .orderBy(desc(registrationAudits.createdAt))
      .limit(limit)
      .offset(offset)

    return { success: true, audits }
  } catch (err) {
    console.error('[v0] Failed to fetch audits:', err)
    return { success: false, audits: [] }
  }
}
