'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { getRoleLabel, getRoleDescription, UserRole } from '@/lib/roles'
import { validateReferralCode } from '@/app/actions/referral'
import { storeReferredBy } from '@/app/actions/users'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer')
  const [referralCode, setReferralCode] = useState('')
  const [referralValid, setReferralValid] = useState<boolean | null>(null)
  const [referralChecking, setReferralChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'sign-up'

  // Pre-fill referral code from URL param e.g. /sign-up?ref=ABCD1234
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) setReferralCode(ref.toUpperCase())
  }, [searchParams])

  // Validate referral code with debounce
  useEffect(() => {
    if (!referralCode || referralCode.length < 6) {
      setReferralValid(null)
      return
    }
    const timer = setTimeout(async () => {
      setReferralChecking(true)
      const referrerId = await validateReferralCode(referralCode)
      setReferralValid(referrerId !== null)
      setReferralChecking(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [referralCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (isSignUp) {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name,
        role: selectedRole,
      })
      if (error) {
        setError(error.message ?? 'Something went wrong')
        setLoading(false)
        return
      }

      // After sign-up: store referredBy if a valid code was entered
      if (referralCode && referralValid) {
        try {
          await storeReferredBy(referralCode)
        } catch { /* non-fatal */ }
      }
    } else {
      const { error } = await authClient.signIn.email({ email, password })
      if (error) {
        setError(error.message ?? 'Something went wrong')
        setLoading(false)
        return
      }
    }

    setLoading(false)

    const session = await authClient.getSession()
    const role = (session?.data?.user as unknown as { role?: string })?.role ?? 'viewer'
    if (role === 'admin') router.push('/admin')
    else if (role === 'trader') router.push('/trader')
    else router.push('/opportunities')
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSignUp ? 'Create an account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignUp
              ? 'Sign up to get started'
              : 'Sign in to your account to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isSignUp && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="flex flex-col gap-3 pb-2 border-b border-slate-200">
                <Label className="text-base font-semibold">Select your role</Label>
                <div className="space-y-2">
                  {(['viewer', 'trader'] as const).map((role) => (
                    <label
                      key={role}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedRole === role
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={selectedRole === role}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{getRoleLabel(role)}</p>
                        <p className="text-xs text-slate-600">{getRoleDescription(role)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {/* Referral code */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="referralCode">
                  Referral Code{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="referralCode"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC12345"
                    maxLength={12}
                    className={`pr-8 font-mono tracking-widest uppercase ${
                      referralValid === true
                        ? 'border-green-500 focus-visible:ring-green-500'
                        : referralValid === false
                        ? 'border-red-400 focus-visible:ring-red-400'
                        : ''
                    }`}
                  />
                  {referralCode.length >= 6 && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm">
                      {referralChecking ? (
                        <span className="text-muted-foreground animate-pulse">...</span>
                      ) : referralValid === true ? (
                        <span className="text-green-500">&#10003;</span>
                      ) : referralValid === false ? (
                        <span className="text-red-400">&#10007;</span>
                      ) : null}
                    </span>
                  )}
                </div>
                {referralValid === true && (
                  <p className="text-xs text-green-600">Valid referral code applied.</p>
                )}
                {referralValid === false && referralCode.length >= 6 && (
                  <p className="text-xs text-red-500">Referral code not found.</p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? 'Please wait...'
              : isSignUp
                ? 'Create account'
                : 'Sign in'}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <Link
            href={isSignUp ? '/sign-in' : '/sign-up'}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </Link>
        </p>
      </Card>
    </main>
  )
}
