import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { canAccess, UserRole } from '@/lib/roles'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

// Get the current user's role
export async function getUserRole(): Promise<UserRole | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return null

    const userData = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    return (userData[0]?.role as UserRole) || 'viewer'
  } catch (error) {
    console.error('Error getting user role:', error)
    return null
  }
}

// Check if current user has permission to access a resource/action
export async function checkAccess(resource: string, action: string): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return false

    const userData = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (!userData[0]) return false

    const userRole = userData[0].role as UserRole
    return canAccess(userRole, resource, action)
  } catch (error) {
    console.error('Error checking access:', error)
    return false
  }
}

// Require a specific permission (throws redirect if denied)
export async function requirePermission(resource: string, action: string) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      redirect('/sign-in')
    }

    const userData = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (!userData[0]) {
      redirect('/sign-in')
    }

    const userRole = userData[0].role as UserRole
    if (!canAccess(userRole, resource, action)) {
      redirect('/unauthorized')
    }
  } catch (error) {
    console.error('Error requiring permission:', error)
    redirect('/sign-in')
  }
}

// Require specific role (throws redirect if role doesn't match)
export async function requireRole(requiredRole: UserRole | UserRole[]) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      redirect('/sign-in')
    }

    const userData = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (!userData[0]) {
      redirect('/sign-in')
    }

    const userRole = userData[0].role as UserRole
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

    if (!roles.includes(userRole)) {
      redirect('/unauthorized')
    }
  } catch (error) {
    console.error('Error requiring role:', error)
    redirect('/sign-in')
  }
}

// Get current user with role information
export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return null

    const userData = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (!userData[0]) return null

    return {
      id: userData[0].id,
      email: userData[0].email,
      name: userData[0].name,
      role: userData[0].role as UserRole,
      image: userData[0].image,
      createdAt: userData[0].createdAt,
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}
