import { requireRole } from '@/lib/role-middleware'
import AdminClient from '@/components/admin-client'

export const metadata = {
  title: 'Admin Panel - Arbitrage IQ',
  description: 'System administration and user management',
}

export default async function AdminPage() {
  await requireRole('admin')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminClient />
    </div>
  )
}
