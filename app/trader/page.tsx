import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { TraderClient } from '@/components/trader-client'

export const metadata = {
  title: 'Trader Dashboard - Arbitrage IQ',
  description: 'Manage your funds and trade arbitrage opportunities',
}

export default async function TraderPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) redirect('/sign-in')

  const role = (session.user as unknown as { role?: string }).role ?? 'viewer'
  if (role === 'admin') redirect('/admin')
  if (role === 'viewer') redirect('/opportunities')

  return (
    <TraderClient user={{
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }} />
  )
}
