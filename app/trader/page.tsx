import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { TraderClient } from '@/components/trader-client'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const metadata = {
  title: 'Trader Dashboard - Arbitrage IQ',
  description: 'Manage your funds and trade arbitrage opportunities',
}

export default async function TraderPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) redirect('/sign-in')

  const role = (session.user as unknown as { role?: string }).role ?? 'viewer'
  if (role === 'admin') redirect('/admin')
  if (role === 'protrader') redirect('/protrader')
  if (role === 'viewer') redirect('/opportunities')

  // Fetch fresh isActivated + createdAt directly from DB — the session object
  // does not include custom fields like isActivated so we always query the DB here.
  const [dbUser] = await db
    .select({ isActivated: userTable.isActivated, createdAt: userTable.createdAt })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1)

  return (
    <TraderClient
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
