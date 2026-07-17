'use server'

import { getAllAuditLogs } from '@/lib/audit'

export async function fetchAllAuditLogs(limit = 200) {
  return getAllAuditLogs(limit)
}
