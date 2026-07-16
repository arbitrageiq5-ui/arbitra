'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
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
