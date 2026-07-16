import { requireRole } from '@/lib/role-middleware'
import AuditLogsClient from '@/components/audit-logs-client'

export const metadata = {
  title: 'Audit Logs - Admin Panel',
  description: 'System audit trail and user activity logs',
}

export default async function AuditLogsPage() {
  await requireRole('admin')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AuditLogsClient />
    </div>
  )
}
