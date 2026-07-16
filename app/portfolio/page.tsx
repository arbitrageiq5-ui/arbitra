import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { PortfolioClient } from '@/components/portfolio-client'

export const metadata = {
  title: 'Portfolio - Arbitrage IQ',
  description: 'Track your cryptocurrency portfolio and positions',
}

export default async function PortfolioPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <PortfolioClient user={session.user} />
    </div>
  )
}
