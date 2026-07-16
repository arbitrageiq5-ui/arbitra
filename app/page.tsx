import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/dashboard-client'

export const metadata = {
  title: 'Arbitrage IQ - Crypto Arbitrage Intelligence',
  description: 'Real-time arbitrage opportunities across major crypto exchanges',
}

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <DashboardClient user={session.user} />
    </div>
  )
}
