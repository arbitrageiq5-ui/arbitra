'use server'

import { auth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { UserRole } from '@/lib/roles'
import { logAudit, AuditActions } from '@/lib/audit'

// Get all users (admin only)
export async function getAllUsers() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0] || currentUser[0].role !== 'admin') {
    throw new Error('Only admins can view all users')
  }

  const users = await db.select().from(user).orderBy(user.createdAt)

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  }))
}

// Change user role (admin only)
export async function changeUserRole(userId: string, newRole: UserRole) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  // Check if current user is admin
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0] || currentUser[0].role !== 'admin') {
    throw new Error('Only admins can change user roles')
  }

  // Can't change your own role
  if (userId === session.user.id) {
    throw new Error('You cannot change your own role')
  }

  // Update the role
  await db.update(user).set({ role: newRole }).where(eq(user.id, userId))

  // Log the action
  await logAudit({
    userId: session.user.id,
    action: AuditActions.ADMIN_USER_ROLE_CHANGE,
    resource: 'users',
    resourceId: parseInt(userId.split('_')[1] || '0'),
    details: {
      targetUserId: userId,
      newRole,
    },
  })

  return { success: true }
}

// Get user by ID (admin only or self)
export async function getUserById(userId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  // Can view yourself or if you're admin
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0]) throw new Error('User not found')

  if (userId !== session.user.id && currentUser[0].role !== 'admin') {
    throw new Error('You can only view your own profile')
  }

  const targetUser = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!targetUser[0]) throw new Error('User not found')

  return {
    id: targetUser[0].id,
    name: targetUser[0].name,
    email: targetUser[0].email,
    role: targetUser[0].role,
    createdAt: targetUser[0].createdAt,
  }
}

// Delete user (admin only)
export async function deleteUser(userId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  // Check if current user is admin
  const currentUser = await db
    .select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!currentUser[0] || currentUser[0].role !== 'admin') {
    throw new Error('Only admins can delete users')
  }

  // Can't delete yourself
  if (userId === session.user.id) {
    throw new Error('You cannot delete your own account')
  }

  await db.delete(user).where(eq(user.id, userId))

  // Log the action
  await logAudit({
    userId: session.user.id,
    action: AuditActions.ADMIN_USER_DELETE,
    resource: 'users',
    resourceId: parseInt(userId.split('_')[1] || '0'),
    details: {
      deletedUserId: userId,
    },
  })

  return { success: true }
}

// Create a new admin user (admin only — not available through public sign-up)
export async function createAdminUser(name: string, email: string, password: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!currentUser[0] || currentUser[0].role !== 'admin') {
    throw new Error('Only admins can create admin accounts')
  }

  // Check email not already taken
  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1)
  if (existing[0]) throw new Error('An account with this email already exists')

  // Use Better Auth's sign-up endpoint server-side to get proper password hashing
  const result = await auth.api.signUpEmail({
    body: { name, email, password, role: 'admin' },
  })

  if (!result?.user) throw new Error('Failed to create admin account')

  // Ensure role is set to admin (in case additionalFields didn't apply)
  await db.update(user).set({ role: 'admin' }).where(eq(user.email, email))

  await logAudit({
    userId: session.user.id,
    action: AuditActions.ADMIN_USER_ROLE_CHANGE,
    resource: 'users',
    details: { createdAdminEmail: email },
  })

  return { success: true }
}

// Reset a user's password (admin only) — uses Better Auth's internal hash
export async function resetUserPassword(userId: string, newPassword: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!currentUser[0] || currentUser[0].role !== 'admin') {
    throw new Error('Only admins can reset passwords')
  }

  if (newPassword.length < 8) throw new Error('Password must be at least 8 characters')

  // Use Better Auth's internal scrypt hash — same algorithm used during sign-up
  // @ts-ignore — .mjs path not in TS declarations but exists at runtime
  const cryptoMod = await import('better-auth/dist/crypto/password.mjs')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hashed: string = await (cryptoMod as any).hashPassword(newPassword)

  // Update the password in the account table (Better Auth stores credentials there)
  await pool.query(
    `UPDATE account SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = 'credential'`,
    [hashed, userId]
  )

  await logAudit({
    userId: session.user.id,
    action: AuditActions.ADMIN_USER_ROLE_CHANGE,
    resource: 'users',
    details: { action: 'password_reset', targetUserId: userId },
  })

  return { success: true }
}

// Update user profile
export async function updateUserProfile(name: string, email?: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const updates: Record<string, any> = { name }

  if (email && email !== session.user.email) {
    // Email uniqueness check
    const existing = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    if (existing[0] && existing[0].id !== session.user.id) {
      throw new Error('Email already in use')
    }

    updates.email = email
  }

  await db.update(user).set(updates).where(eq(user.id, session.user.id))

  // Log the action
  await logAudit({
    userId: session.user.id,
    action: AuditActions.USER_PROFILE_UPDATE,
    resource: 'user_profile',
    details: {
      updatedFields: Object.keys(updates),
    },
  })

  return { success: true }
}
