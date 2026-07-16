import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OpportunitiesClient } from '@/components/opportunities-client'

export const metadata = {
  title: 'Opportunities Explorer - Arbitrage IQ',
  description: 'Explore and analyze arbitrage opportunities across exchanges',
}

export default async function OpportunitiesPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <OpportunitiesClient user={{
        name: session.user.name,
        email: session.user.email,
        role: (session.user as unknown as { role?: string }).role ?? 'viewer',
      }} />
    </div>
  )
}
