'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getAllAuditLogs } from '@/lib/audit'
import { ArrowLeft, Filter } from 'lucide-react'

interface AuditLog {
  id: number
  userId: string
  action: string
  resource: string
  resourceId: number | null
  details: Record<string, any> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date | null
}

export default function AuditLogsClient() {
  const router = useRouter()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState<string>('')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const data = await getAllAuditLogs(200)
      setLogs(data)
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter((log) =>
    filterAction ? log.action.includes(filterAction) : true
  )

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)))

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          onClick={() => router.push('/admin')}
          variant="ghost"
          className="text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Admin
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
          <p className="text-slate-400 mt-1">System activity and user action history</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800/50 backdrop-blur border-slate-700/50 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-white">Filter by Action</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterAction('')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filterAction === ''
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            All Actions
          </button>
          {uniqueActions.map((action) => (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                filterAction === action
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="bg-slate-800/50 backdrop-blur border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No audit logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/20">
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">User ID</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Action</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Resource</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Details</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, idx) => (
                  <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="px-6 py-4 text-slate-400">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString()
                        : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-mono text-xs break-all">
                      {log.userId.slice(0, 12)}...
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-xs font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{log.resource}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {log.details ? JSON.stringify(log.details).slice(0, 50) : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{log.ipAddress || '—'}</td>
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
