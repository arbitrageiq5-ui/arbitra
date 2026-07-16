import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OpportunitiesClient } from '@/components/opportunities-client'

export const metadata = {
  title: 'Market Opportunities - Arbitrage IQ',
  description: 'Explore live arbitrage opportunities across all major exchanges',
}

export default async function OpportunitiesPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) redirect('/sign-in')

  const role = (session.user as unknown as { role?: string }).role ?? 'viewer'

  // Traders and admins have their own dashboards
  if (role === 'admin') redirect('/admin')
  if (role === 'trader') redirect('/trader')

  return (
    <OpportunitiesClient user={{
      name: session.user.name,
      email: session.user.email,
      role,
    }} />
  )
}
