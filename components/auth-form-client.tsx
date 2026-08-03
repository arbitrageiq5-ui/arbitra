'use client'

import dynamic from 'next/dynamic'

// Load AuthForm with ssr:false so it is never server-rendered.
// This eliminates hydration mismatches caused by client-only state
// (showPassword, captcha, mounted checks) diverging from SSR output.
const AuthFormDynamic = dynamic(
  () => import('@/components/auth-form').then(mod => ({ default: mod.AuthForm })),
  { ssr: false }
)

export function AuthFormClient({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <AuthFormDynamic mode={mode} />
}
