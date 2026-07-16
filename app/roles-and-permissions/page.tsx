import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { rolePermissions, getRoleLabel, getRoleDescription, UserRole } from '@/lib/roles'
import { Check, X } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Roles & Permissions - Arbitrage IQ',
  description: 'Learn about roles and access permissions',
}

export default async function RolesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect('/sign-in')
  }

  const roles: UserRole[] = ['viewer', 'trader', 'admin']
  const permissions = [
    { key: 'canViewDashboard', label: 'View Dashboard' },
    { key: 'canViewOpportunities', label: 'View Opportunities' },
    { key: 'canViewAnalytics', label: 'View Analytics' },
    { key: 'canViewPortfolio', label: 'View Portfolio' },
    { key: 'canExecuteTrades', label: 'Execute Trades' },
    { key: 'canManageAccounts', label: 'Manage Exchange Accounts' },
    { key: 'canViewAuditLogs', label: 'View Audit Logs' },
    { key: 'canManageUsers', label: 'Manage Users' },
    { key: 'canChangeRoles', label: 'Change User Roles' },
    { key: 'canAccessAdmin', label: 'Access Admin Panel' },
  ] as const

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <Link href="/">
          <Button variant="outline" className="mb-4">
            ← Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-4xl font-bold text-white mb-2">Roles & Permissions</h1>
        <p className="text-slate-400">
          Learn about the three user roles and their capabilities in Arbitrage IQ
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Role Descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {roles.map((role) => (
            <Card key={role} className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-xl font-bold text-white mb-2">{getRoleLabel(role)}</h3>
              <p className="text-slate-400 text-sm">{getRoleDescription(role)}</p>
            </Card>
          ))}
        </div>

        {/* Permissions Matrix */}
        <Card className="bg-slate-800 border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-2xl font-bold text-white">Permissions Matrix</h2>
            <p className="text-slate-400 text-sm mt-2">
              Check marks indicate permissions granted to each role
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role}
                      className="px-6 py-4 text-center text-sm font-semibold text-slate-300"
                    >
                      {getRoleLabel(role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map(({ key, label }) => (
                  <tr key={key} className="border-b border-slate-700 hover:bg-slate-700/20">
                    <td className="px-6 py-4 text-slate-300 font-medium">{label}</td>
                    {roles.map((role) => {
                      const hasPermission =
                        rolePermissions[role][key as keyof typeof rolePermissions[typeof role]]
                      return (
                        <td key={`${role}-${key}`} className="px-6 py-4 text-center">
                          {hasPermission ? (
                            <Check className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="w-5 h-5 text-slate-500 mx-auto" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Role Details */}
        <div className="mt-8 space-y-6">
          {roles.map((role) => (
            <Card key={role} className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-xl font-bold text-white mb-4">{getRoleLabel(role)} Role</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-200 mb-3">What can {role}s do?</h4>
                  <ul className="space-y-2 text-slate-400 text-sm">
                    {permissions.map(({ key, label }) => {
                      const hasPermission =
                        rolePermissions[role][key as keyof typeof rolePermissions[typeof role]]
                      return hasPermission ? (
                        <li key={key} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          {label}
                        </li>
                      ) : null
                    })}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 mb-3">Limitations</h4>
                  <ul className="space-y-2 text-slate-400 text-sm">
                    {permissions.map(({ key, label }) => {
                      const hasPermission =
                        rolePermissions[role][key as keyof typeof rolePermissions[typeof role]]
                      return !hasPermission ? (
                        <li key={key} className="flex items-center gap-2">
                          <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                          Cannot {label.toLowerCase()}
                        </li>
                      ) : null
                    })}
                  </ul>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Information Box */}
        <Card className="bg-blue-900/20 border-blue-500/30 p-6 mt-8">
          <h3 className="text-lg font-bold text-blue-200 mb-2">Need a role upgrade?</h3>
          <p className="text-blue-200/80 text-sm">
            Contact your administrator to request a role change. Admins can upgrade your account
            to access more features including trade execution and system management tools.
          </p>
        </Card>
      </div>
    </div>
  )
}
