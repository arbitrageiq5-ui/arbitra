// Role-based access control utilities

export type UserRole = 'viewer' | 'trader' | 'admin'

export interface RolePermissions {
  canViewDashboard: boolean
  canViewOpportunities: boolean
  canViewAnalytics: boolean
  canViewPortfolio: boolean
  canExecuteTrades: boolean
  canManageAccounts: boolean
  canViewAuditLogs: boolean
  canManageUsers: boolean
  canChangeRoles: boolean
  canAccessAdmin: boolean
}

// Define permissions for each role
export const rolePermissions: Record<UserRole, RolePermissions> = {
  viewer: {
    canViewDashboard: true,
    canViewOpportunities: true,
    canViewAnalytics: true,
    canViewPortfolio: true,
    canExecuteTrades: false,
    canManageAccounts: false,
    canViewAuditLogs: false,
    canManageUsers: false,
    canChangeRoles: false,
    canAccessAdmin: false,
  },
  trader: {
    canViewDashboard: true,
    canViewOpportunities: true,
    canViewAnalytics: true,
    canViewPortfolio: true,
    canExecuteTrades: true,
    canManageAccounts: true,
    canViewAuditLogs: false,
    canManageUsers: false,
    canChangeRoles: false,
    canAccessAdmin: false,
  },
  admin: {
    canViewDashboard: true,
    canViewOpportunities: true,
    canViewAnalytics: true,
    canViewPortfolio: true,
    canExecuteTrades: true,
    canManageAccounts: true,
    canViewAuditLogs: true,
    canManageUsers: true,
    canChangeRoles: true,
    canAccessAdmin: true,
  },
}

// Get permissions for a role
export function getPermissions(role: UserRole): RolePermissions {
  return rolePermissions[role]
}

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return getPermissions(role)[permission]
}

// Check if role can perform an action on a resource
export function canAccess(role: UserRole, resource: string, action: string): boolean {
  const permissions = getPermissions(role)

  // Map resource:action pairs to specific permissions
  const accessMap: Record<string, keyof RolePermissions> = {
    'dashboard:view': 'canViewDashboard',
    'opportunities:view': 'canViewOpportunities',
    'opportunities:execute': 'canExecuteTrades',
    'analytics:view': 'canViewAnalytics',
    'portfolio:view': 'canViewPortfolio',
    'portfolio:edit': 'canExecuteTrades',
    'accounts:view': 'canViewPortfolio',
    'accounts:manage': 'canManageAccounts',
    'audit:view': 'canViewAuditLogs',
    'users:manage': 'canManageUsers',
    'admin:access': 'canAccessAdmin',
  }

  const permissionKey = `${resource}:${action}`
  const permission = accessMap[permissionKey]

  if (!permission) {
    return false
  }

  return permissions[permission]
}

// Role hierarchy (higher roles have more permissions)
export const roleHierarchy: Record<UserRole, number> = {
  viewer: 1,
  trader: 2,
  admin: 3,
}

// Check if one role is higher than another
export function roleIsHigherThan(role1: UserRole, role2: UserRole): boolean {
  return roleHierarchy[role1] > roleHierarchy[role2]
}

// Get role label for display
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    viewer: 'Viewer',
    trader: 'Trader',
    admin: 'Administrator',
  }
  return labels[role]
}

// Get role description
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    viewer: 'Can view opportunities, analytics, and portfolio. Read-only access.',
    trader: 'Can execute trades, manage exchange accounts, and view all analytics.',
    admin: 'Full system access including user management, audit logs, and configuration.',
  }
  return descriptions[role]
}
