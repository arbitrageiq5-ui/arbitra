import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AnalyticsClient } from '@/components/analytics-client'

export const metadata = {
  title: 'Analytics - Arbitrage IQ',
  description: 'View market and opportunity analytics',
}

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AnalyticsClient user={session.user} />
    </div>
  )
}
