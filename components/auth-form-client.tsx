'use client'

import AuthForm from '@/components/auth-form'

export function AuthFormClient({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <AuthForm mode={mode} />
}
