import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ViewerDashboard } from '@/components/viewer-dashboard'

export const metadata = {
  title: 'Viewer Dashboard - ArbitrageIQ',
  description: 'Explore live arbitrage market data as a free viewer account',
}

export default async function ViewerPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) redirect('/sign-in')

  const role = (session.user as unknown as { role?: string }).role ?? 'viewer'
  if (role === 'admin') redirect('/admin')
  if (role === 'trader') redirect('/trader')

  const [dbUser] = await db
    .select({
      name: userTable.name,
      email: userTable.email,
      country: userTable.country,
      tradingExperienceLevel: userTable.tradingExperienceLevel,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1)

  return (
    <ViewerDashboard
      user={{
        id: session.user.id,
        name: dbUser?.name ?? session.user.name,
        email: dbUser?.email ?? session.user.email,
        country: dbUser?.country ?? null,
        tradingExperienceLevel: dbUser?.tradingExperienceLevel ?? 'beginner',
        createdAt: dbUser?.createdAt?.toISOString() ?? new Date().toISOString(),
      }}
    />
  )
}
