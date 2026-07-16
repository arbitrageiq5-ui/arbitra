import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ExchangeSettings } from '@/components/exchange-settings'

export const metadata = {
  title: 'Settings - Arbitrage IQ',
  description: 'Manage your exchange connections',
}

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <ExchangeSettings />
      </main>
    </div>
  )
}
