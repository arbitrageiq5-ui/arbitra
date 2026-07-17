import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL
          ? process.env.V0_RUNTIME_URL
          : 'http://localhost:3000'),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'viewer',
        input: true, // allows the client to send role during signUp
      },
    },
  },
  trustedOrigins: [
    // localhost for dev
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    // v0 sandbox runtime URL
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    // Dynamic Vercel deployment URLs (Better Auth does NOT support wildcards — exact only)
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    // Primary origin from env (set per-environment via Vercel CLI)
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
    // Known static aliases — all production & preview domains for this project
    'https://arbitrageiq.exchange',
    'https://www.arbitrageiq.exchange',
    'https://arbitra-rho.vercel.app',
    'https://v0-arbitrageiq.vercel.app',
    'https://arbitra-arbitrageiq5-2752s-projects.vercel.app',
    'https://arbitra-arbitrageiq5-2752-arbitrageiq5-2752s-projects.vercel.app',
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'none' as const,
      secure: true,
      httpOnly: true,
    },
  },
})
