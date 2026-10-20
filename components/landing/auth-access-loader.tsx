'use client'

import dynamic from 'next/dynamic'

const AuthAccess = dynamic(() => import('@/components/landing/auth-access').then((module) => ({ default: module.AuthAccess })), {
  ssr: false,
  loading: () => <div className="h-[700px] w-full animate-pulse bg-white/[0.02]" />,
})

export function AuthAccessLoader() {
  return <AuthAccess />
}
