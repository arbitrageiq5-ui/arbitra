'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAllUsers, changeUserRole, deleteUser } from '@/app/actions/users'
import { getRoleLabel } from '@/lib/roles'
import { UserRole } from '@/lib/roles'
import { LogOut, Users, Trash2, ChevronDown } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: Date
}

export default function AdminClient() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await getAllUsers()
      setUsers(data as User[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setUpdatingUserId(userId)
      await changeUserRole(userId, newRole)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) {
      return
    }

    try {
      setDeletingUserId(userId)
      await deleteUser(userId)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleLogout = async () => {
    await authClient.signOut()
    router.push('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white flex items-center gap-2">
            <Users className="w-8 h-8" />
            Admin Panel
          </h1>
          <p className="text-slate-400 mt-2">User management and system administration</p>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="text-slate-300 hover:text-white hover:bg-slate-700"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="mb-6 p-4 bg-red-900/20 border-red-500/50 text-red-200">
          <p>{error}</p>
        </Card>
      )}

      {/* Users List */}
      <Card className="bg-slate-800/50 backdrop-blur border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/50">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            All Users ({users.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-slate-400">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/20">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-white font-medium">{u.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{u.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="relative inline-block">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          disabled={updatingUserId === u.id}
                          className="appearance-none px-3 py-1 rounded bg-slate-700 text-white text-sm border border-slate-600 hover:border-slate-500 disabled:opacity-50 cursor-pointer"
                        >
                          <option value="viewer">{getRoleLabel('viewer')}</option>
                          <option value="trader">{getRoleLabel('trader')}</option>
                          <option value="admin">{getRoleLabel('admin')}</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Button
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={deletingUserId === u.id}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
