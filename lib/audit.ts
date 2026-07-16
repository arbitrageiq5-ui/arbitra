import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { headers } from 'next/headers'

export interface AuditLogEntry {
  userId: string
  action: string
  resource: string
  resourceId?: number
  details?: Record<string, any>
}

// Log an action to the audit trail
export async function logAudit(entry: AuditLogEntry) {
  try {
    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    await db.insert(auditLogs).values({
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details ? JSON.stringify(entry.details) : null,
      ipAddress,
      userAgent,
    })
  } catch (error) {
    console.error('Failed to log audit entry:', error)
    // Don't throw - audit logging should not break the main operation
  }
}

// Get audit logs for a user
export async function getUserAuditLogs(userId: string, limit = 50) {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .where((al) => al.userId === userId)
      .orderBy((al) => al.createdAt)
      .limit(limit)

    return logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }))
  } catch (error) {
    console.error('Failed to retrieve audit logs:', error)
    return []
  }
}

// Get all audit logs (admin only)
export async function getAllAuditLogs(limit = 100, offset = 0) {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy((al) => al.createdAt)
      .limit(limit)
      .offset(offset)

    return logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }))
  } catch (error) {
    console.error('Failed to retrieve audit logs:', error)
    return []
  }
}

// Get audit logs for a specific resource
export async function getResourceAuditLogs(resource: string, resourceId?: number) {
  try {
    let query = db.select().from(auditLogs).where((al) => al.resource === resource)

    if (resourceId) {
      query = query.where((al) => al.resourceId === resourceId)
    }

    const logs = await query.orderBy((al) => al.createdAt)

    return logs.map((log) => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    }))
  } catch (error) {
    console.error('Failed to retrieve resource audit logs:', error)
    return []
  }
}

// Common audit actions
export const AuditActions = {
  // User actions
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_SIGNUP: 'USER_SIGNUP',
  USER_PROFILE_UPDATE: 'USER_PROFILE_UPDATE',

  // Exchange account actions
  EXCHANGE_ACCOUNT_ADD: 'EXCHANGE_ACCOUNT_ADD',
  EXCHANGE_ACCOUNT_REMOVE: 'EXCHANGE_ACCOUNT_REMOVE',
  EXCHANGE_ACCOUNT_UPDATE: 'EXCHANGE_ACCOUNT_UPDATE',

  // Trade actions
  TRADE_EXECUTE: 'TRADE_EXECUTE',
  TRADE_CANCEL: 'TRADE_CANCEL',

  // Portfolio actions
  PORTFOLIO_UPDATE: 'PORTFOLIO_UPDATE',
  PORTFOLIO_VIEW: 'PORTFOLIO_VIEW',

  // Admin actions
  ADMIN_USER_ROLE_CHANGE: 'ADMIN_USER_ROLE_CHANGE',
  ADMIN_USER_DELETE: 'ADMIN_USER_DELETE',
  ADMIN_SYSTEM_CONFIG: 'ADMIN_SYSTEM_CONFIG',

  // Permission actions
  PERMISSION_GRANT: 'PERMISSION_GRANT',
  PERMISSION_REVOKE: 'PERMISSION_REVOKE',
}
