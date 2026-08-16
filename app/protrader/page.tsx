import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ProtraderClient } from '@/components/protrader-client'

export const metadata = {
  title: 'Pro Trader Dashboard — Arbitrage IQ',
  description: 'Full arbitrage management and trading bot access for Pro Traders',
}

export default async function ProtraderPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) redirect('/sign-in')

  const role = (session.user as unknown as { role?: string }).role ?? 'viewer'
  if (role === 'admin') redirect('/admin')
  if (role === 'trader') redirect('/trader')
  if (role !== 'protrader') redirect('/unauthorized')

  const [dbUser] = await db
    .select({ isActivated: userTable.isActivated, createdAt: userTable.createdAt })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1)

  return (
    <ProtraderClient
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }}
      isActivated={dbUser?.isActivated ?? false}
      createdAt={(dbUser?.createdAt ?? new Date()).toISOString()}
    />
  )
}
