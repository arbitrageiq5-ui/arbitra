# Role-Based Access Control (RBAC) Documentation

## Overview

Arbitrage IQ implements a comprehensive role-based access control system with three distinct user roles: **Viewer**, **Trader**, and **Admin**. Each role has specific permissions that determine what features and actions a user can access.

## The Three Roles

### 1. Viewer (Read-Only Access)

**Description:** Can view opportunities, analytics, and portfolio data but cannot execute any trades or manage accounts.

**Permissions:**
- ✓ View Dashboard
- ✓ View Opportunities (real-time prices and arbitrage opportunities)
- ✓ View Analytics (charts and statistics)
- ✓ View Portfolio (see positions and performance)
- ✗ Execute Trades
- ✗ Manage Exchange Accounts
- ✗ View Audit Logs
- ✗ Manage Users or Change Roles

**Use Cases:**
- Market analysts monitoring opportunities
- Read-only observers
- Educational users learning the platform
- Stakeholders tracking system performance

---

### 2. Trader (Execute Access)

**Description:** Can execute trades, manage exchange accounts, and perform all trading operations.

**Permissions:**
- ✓ View Dashboard
- ✓ View Opportunities
- ✓ View Analytics
- ✓ View Portfolio
- ✓ Execute Trades (score opportunities, create positions)
- ✓ Manage Exchange Accounts (add, update, delete exchange API keys)
- ✗ View Audit Logs
- ✗ Manage Users or Change Roles
- ✗ Access Admin Panel

**Use Cases:**
- Active traders executing arbitrage strategies
- Portfolio managers
- Automated trading operators
- Risk managers monitoring positions

---

### 3. Admin (Full Access)

**Description:** Complete system access including user management, audit trails, and administrative operations.

**Permissions:**
- ✓ All Trader permissions
- ✓ View Audit Logs (complete system activity history)
- ✓ Manage Users (view all users, change roles, delete accounts)
- ✓ Change User Roles (promote/demote users)
- ✓ Access Admin Panel (user management interface)
- ✓ System Configuration

**Use Cases:**
- System administrators
- Platform owners
- Compliance officers
- Security managers

---

## Database Schema Changes

### User Table Extension

```sql
ALTER TABLE "user" ADD COLUMN role TEXT DEFAULT 'viewer' 
  CHECK (role IN ('viewer', 'trader', 'admin'));
```

### Audit Logs Table

Tracks all user actions for security and compliance:

```sql
CREATE TABLE "audit_logs" (
  id SERIAL PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  action TEXT NOT NULL,           -- e.g., 'TRADE_EXECUTE', 'USER_LOGIN'
  resource TEXT NOT NULL,         -- e.g., 'trades', 'users', 'accounts'
  resourceId INTEGER,             -- ID of the affected resource
  details JSONB,                  -- Additional action details
  ipAddress TEXT,                 -- User's IP address
  userAgent TEXT,                 -- User's browser/client info
  createdAt TIMESTAMP DEFAULT now()
);
```

### User Permissions Table

Allows granular permission overrides:

```sql
CREATE TABLE "user_permissions" (
  id SERIAL PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  grantedBy TEXT REFERENCES "user"(id),
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now(),
  UNIQUE(userId, resource, action)
);
```

---

## Implementation Details

### Core Files

#### `/lib/roles.ts`
Contains all role definitions and permission logic:
- `UserRole` type definition
- `RolePermissions` interface
- `rolePermissions` mapping (role → permissions)
- Helper functions: `hasPermission()`, `canAccess()`, `getRoleLabel()`

#### `/lib/role-middleware.ts`
Server-side role checking:
- `getUserRole()` - Get current user's role
- `checkAccess()` - Check specific permission
- `requirePermission()` - Enforce permission or redirect
- `requireRole()` - Enforce specific role or redirect
- `getCurrentUser()` - Get user with role info

#### `/lib/audit.ts`
Audit logging functions:
- `logAudit()` - Log any user action
- `getUserAuditLogs()` - Get logs for specific user
- `getAllAuditLogs()` - Get all logs (admin only)
- `AuditActions` - Predefined action types

### Server Actions

#### `/app/actions/users.ts`
User management operations:
- `getAllUsers()` - List all users (admin only)
- `changeUserRole()` - Change user's role (admin only)
- `getUserById()` - Get user details
- `deleteUser()` - Delete user account (admin only)
- `updateUserProfile()` - Update personal profile

---

## Usage Patterns

### Protecting Routes Based on Role

```typescript
// In app/admin/page.tsx
import { requireRole } from '@/lib/role-middleware'

export default async function AdminPage() {
  // Redirects to /unauthorized if user is not admin
  await requireRole('admin')
  
  return <AdminClient />
}
```

### Checking Permissions in Server Actions

```typescript
// In /app/actions/trades.ts
import { requirePermission } from '@/lib/role-middleware'

export async function executeTrade(opportunityId: number) {
  // Redirects if user doesn't have execute permission
  await requirePermission('trades', 'execute')
  
  // Execute the trade...
}
```

### Client-Side Permission Display

```typescript
// In components/dashboard-client.tsx
import { hasPermission, UserRole } from '@/lib/roles'

export function DashboardClient({ user }: { user: any }) {
  const userRole = user.role as UserRole
  
  return (
    <>
      {hasPermission(userRole, 'canExecuteTrades') ? (
        <Button onClick={handleExecuteTrade}>Execute Trade</Button>
      ) : (
        <span className="text-gray-500">Trade execution disabled</span>
      )}
    </>
  )
}
```

### Logging User Actions

```typescript
import { logAudit, AuditActions } from '@/lib/audit'

export async function executeTrade(opportunityId: number) {
  const session = await getSession()
  
  // ... execute trade ...
  
  // Log the action
  await logAudit({
    userId: session.user.id,
    action: AuditActions.TRADE_EXECUTE,
    resource: 'trades',
    resourceId: opportunityId,
    details: { status: 'completed', profit: 0.5 }
  })
}
```

---

## Admin Panel Features

### User Management (`/admin`)
- View all users with their roles
- Change user roles using dropdown
- Delete user accounts
- See user creation dates

### Audit Logs (`/admin/logs`)
- View complete system activity log
- Filter by action type
- See user IP addresses and user agents
- Track all changes for compliance

---

## Role Selection During Signup

New users select their role during registration:

1. **Default Role**: All new signups default to "Viewer" role
2. **Role Selection UI**: Radio buttons during signup to choose between Viewer and Trader
3. **Admin Promotion**: Only existing admins can promote users to Trader or Admin

The signup form shows:
- Role name and label
- Detailed permission description for each role
- Visual indication of selected role

---

## Audit Logging

### Tracked Actions

The system automatically logs:

**User Actions:**
- USER_LOGIN
- USER_LOGOUT
- USER_SIGNUP
- USER_PROFILE_UPDATE

**Exchange Account Actions:**
- EXCHANGE_ACCOUNT_ADD
- EXCHANGE_ACCOUNT_REMOVE
- EXCHANGE_ACCOUNT_UPDATE

**Trade Actions:**
- TRADE_EXECUTE
- TRADE_CANCEL

**Admin Actions:**
- ADMIN_USER_ROLE_CHANGE
- ADMIN_USER_DELETE
- ADMIN_SYSTEM_CONFIG

**Permission Actions:**
- PERMISSION_GRANT
- PERMISSION_REVOKE

### Audit Log Data

Each log entry contains:
- User ID and action timestamp
- Action type and affected resource
- Resource ID (if applicable)
- Detailed information in JSON format
- IP address and User-Agent for security tracking

---

## Security Considerations

### Permission Validation

1. **Server-Side Only**: All critical permission checks are server-side
2. **No Client-Side Trust**: UI controls are hints only; backend validates all operations
3. **Session-Based**: Roles are tied to authenticated sessions
4. **Immutable Roles**: Users cannot change their own role

### Audit Trail

- Complete action logging for compliance
- IP address and device tracking
- Immutable audit logs (never deleted, only archived)
- 90-day retention by default (configurable)

### Encryption

- API keys encrypted before storage
- Sensitive audit data protected
- HTTPS-only communication

---

## Best Practices

### For Developers

1. **Always use server-side checks** for sensitive operations
2. **Log all administrative actions** for audit purposes
3. **Use `requireRole()` at page entry** to prevent unauthorized access
4. **Display UI based on permissions** but don't rely on it
5. **Never expose permissions client-side as truth**

### For Administrators

1. **Review audit logs regularly** for security monitoring
2. **Promote to higher roles cautiously** - verify identity first
3. **Remove inactive users** to maintain security
4. **Document role changes** and keep change log
5. **Use admin account sparingly** - create service accounts for automation

### For Users

1. **Share credentials securely** when giving account access
2. **Log out when done** especially on shared devices
3. **Review connected exchange accounts** regularly
4. **Keep exchange API keys secure** - never share
5. **Check audit logs** to see who accessed your account

---

## Pages & Routes

### User-Facing Routes

- `/` - Dashboard (all authenticated roles)
- `/opportunities` - Opportunity explorer (all roles)
- `/portfolio` - Portfolio management (all roles)
- `/analytics` - Analytics dashboard (all roles)
- `/settings` - User settings (all roles)
- `/roles-and-permissions` - Role information guide (all roles)
- `/unauthorized` - Access denied page (all roles)

### Admin-Only Routes

- `/admin` - Admin panel / User management
- `/admin/logs` - Audit logs viewer

---

## Configuration

### Default Role Assignment

New users are assigned the "viewer" role by default. Admins can promote users to higher roles.

### Role Hierarchy

```
Viewer (Level 1)
  └─ Trader (Level 2)
      └─ Admin (Level 3)
```

Higher roles inherit all lower role permissions plus additional admin capabilities.

---

## Migration Guide (From Non-RBAC System)

If migrating from a system without roles:

1. Add role column to user table (defaults to 'viewer')
2. Create audit_logs and user_permissions tables
3. Promote specific users to 'trader' or 'admin' as needed
4. Update all admin pages to verify user role
5. Enable audit logging in all critical operations

---

## Troubleshooting

**Issue:** User can't access admin panel
- **Solution:** Verify user role is 'admin' in database

**Issue:** Audit logs not appearing
- **Solution:** Check database connection and ensure auditLogs table exists

**Issue:** Permission checks failing
- **Solution:** Ensure `requirePermission()` is called with correct resource/action pair

**Issue:** Role change not taking effect
- **Solution:** User may need to logout and login for session refresh

---

## Support

For questions about RBAC implementation or permissions configuration, refer to the main README.md or contact support.
