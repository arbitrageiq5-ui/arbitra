'use client'

// Force rebuild with new chunk hash - fixes ChunkLoadError
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { getRoleLabel, getRoleDescription, UserRole } from '@/lib/roles'
import { RefreshCw, Shield, Eye, EyeOff, ArrowLeft, Bot, Zap } from 'lucide-react'

// Server actions are imported dynamically inside event handlers to avoid bundling them on the client

// ── Math captcha helpers ─────────────────────────────────────────────────────
type CaptchaChallenge = { question: string; answer: number }

function generateChallenge(): CaptchaChallenge {
  const ops = ['+', '-', '*'] as const
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a: number, b: number, answer: number, question: string
  if (op === '+') {
    a = Math.floor(Math.random() * 20) + 1
    b = Math.floor(Math.random() * 20) + 1
    answer = a + b
    question = `${a} + ${b}`
  } else if (op === '-') {
    a = Math.floor(Math.random() * 20) + 10
    b = Math.floor(Math.random() * a) + 1
    answer = a - b
    question = `${a} - ${b}`
  } else {
    a = Math.floor(Math.random() * 9) + 2
    b = Math.floor(Math.random() * 9) + 2
    answer = a * b
    question = `${a} × ${b}`
  }
  return { question, answer }
}

export function AuthForm({ mode, embedded = false }: { mode: 'sign-in' | 'sign-up'; embedded?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('trader')
  const [referralCode, setReferralCode] = useState('')
  const [referralValid, setReferralValid] = useState<boolean | null>(null)
  const [referralChecking, setReferralChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Math captcha — generated client-side only to avoid SSR hydration mismatch
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [captchaError, setCaptchaError] = useState(false)

  const refreshChallenge = useCallback(() => {
    setChallenge(generateChallenge())
    setCaptchaAnswer('')
    setCaptchaError(false)
  }, [])

  const isSignUp = mode === 'sign-up'

  // Generate initial captcha challenge after mount (client-only)
  useEffect(() => {
    if (isSignUp) refreshChallenge()
  }, [isSignUp, refreshChallenge])

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
      const { validateReferralCode } = await import('@/app/actions/referral')
      const referrerId = await validateReferralCode(referralCode)
      setReferralValid(referrerId !== null)
      setReferralChecking(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [referralCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCaptchaError(false)

    // ── Sign-up: verify captcha before anything else ────────────────────────
    if (isSignUp) {
      const userAnswer = parseInt(captchaAnswer.trim(), 10)
      if (!challenge || isNaN(userAnswer) || userAnswer !== challenge.answer) {
        setCaptchaError(true)
        refreshChallenge()
        setError('Incorrect security answer. A new challenge has been generated.')
        return
      }
    }

    setLoading(true)

    if (isSignUp) {
      // Step 1 — Server pre-flight: captcha + rate limit + email uniqueness check
      const { registerWithCaptcha } = await import('@/app/actions/secure-registration')
      const preflightResult = await registerWithCaptcha({
        email: email.toLowerCase(),
        captchaToken: 'math-captcha-passed',
      })
      if (!preflightResult.success) {
        setError(preflightResult.error ?? 'Something went wrong')
        refreshChallenge()
        setLoading(false)
        return
      }

      // Step 2 — Let Better Auth create the account (it hashes the password correctly)
      const { data: signUpData, error: signUpError } = await authClient.signUp.email({
        email: email.toLowerCase(),
        password,
        name,
        role: selectedRole,
      })
      if (signUpError) {
        setError(signUpError.message ?? 'Account creation failed.')
        refreshChallenge()
        setLoading(false)
        return
      }

      // Step 3 — Save extra profile fields via server action
      if (signUpData?.user?.id) {
        try {
          const { saveRegistrationProfile } = await import('@/app/actions/secure-registration')
          await saveRegistrationProfile({ userId: signUpData.user.id })
        } catch { /* non-fatal */ }
      }

      // Step 4 — Store referral association
      if (referralCode && referralValid) {
        try {
          const { storeReferredBy } = await import('@/app/actions/users')
          await storeReferredBy(referralCode)
        } catch { /* non-fatal */ }
      }
    } else {
      const { data: signInData, error } = await authClient.signIn.email({ email, password })
      if (error) {
        setError(error.message ?? 'Something went wrong')
        setLoading(false)
        return
      }

      // Fire-and-forget: record login IP without blocking the redirect
      const userId = signInData?.user?.id
      if (userId) {
        import('@/app/actions/user-session').then(mod => mod.recordUserLogin(userId)).catch(() => {/* non-fatal */})
      }

      // Redirect immediately using the role from the signIn response
      const role = (signInData?.user as unknown as { role?: string })?.role ?? 'viewer'
      const dest = role === 'admin' ? '/admin' : role === 'protrader' ? '/protrader' : role === 'trader' ? '/trader' : '/viewer'
      window.location.href = dest
      return
    }

    setLoading(false)

    // Sign-up flow: get session then redirect
    const session = await authClient.getSession()
    const role = (session?.data?.user as unknown as { role?: string })?.role ?? 'viewer'
    const dest = role === 'admin' ? '/admin' : role === 'protrader' ? '/protrader' : role === 'trader' ? '/trader' : '/viewer'
    window.location.href = dest
  }

  return (
    <main className={embedded ? 'w-full' : 'min-h-svh bg-background flex items-center justify-center px-4'}>
      <Card className={embedded ? 'w-full border-white/[0.08] bg-[#0e1324]/90 p-5 shadow-[0_0_60px_rgba(0,212,255,0.08)] sm:p-7' : 'w-full max-w-sm p-6'}>
        <div className="mb-6">
          {!embedded && (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              Back to Home
            </Link>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSignUp ? 'Start trading with Algobot' : 'Welcome back'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignUp
              ? 'Choose your workspace and automate with confidence.'
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
              <fieldset className="flex flex-col gap-3 border-b border-slate-200 pb-4">
                <legend className="text-sm font-semibold text-slate-900">Choose your AlgoBot workspace</legend>
                <p className="text-xs text-slate-500">Build, automate, and monitor your strategy with the level of control you need.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['trader', 'protrader'] as const).map((role) => {
                    const isPro = role === 'protrader'
                    const Icon = isPro ? Zap : Bot
                    return (
                      <label
                        key={role}
                        className={`relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-all ${
                          selectedRole === role
                            ? isPro
                              ? 'border-cyan-400 bg-cyan-50 shadow-[0_8px_24px_rgba(6,182,212,0.14)]'
                              : 'border-blue-500 bg-blue-50 shadow-[0_8px_24px_rgba(37,99,235,0.12)]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role}
                          checked={selectedRole === role}
                          onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                          className="sr-only"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className={`flex size-9 items-center justify-center rounded-xl ${isPro ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'}`}>
                            <Icon className="size-5" />
                          </span>
                          {isPro && <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700">Advanced</span>}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{isPro ? 'Pro Algo Trader' : 'AlgoBot Trader'}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">{getRoleDescription(role)}</p>
                          <ul className="mt-3 flex flex-col gap-1 text-[11px] text-slate-500">
                            {(isPro
                              ? ['Advanced arbitrage and futures', 'Higher control over risk and execution', 'Detailed bot performance insights']
                              : ['DCA, grid, and arbitrage bots', 'Connect and manage exchanges', 'Simple controls with live analytics']
                            ).map((feature) => (
                              <li key={feature} className="flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-cyan-500" /> {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Math captcha — sign-up only */}
          {isSignUp && challenge && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Security Check</span>
              </div>
              <p className="text-xs text-muted-foreground">Solve the equation to prove you&apos;re human:</p>
              <div className="flex items-center gap-3">
                {/* Challenge display */}
                <div className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-lg bg-background border border-border select-none">
                  <span className="text-base font-bold font-mono tracking-widest text-foreground">
                    {challenge.question} = ?
                  </span>
                </div>
                {/* Answer input */}
                <Input
                  type="number"
                  value={captchaAnswer}
                  onChange={(e) => { setCaptchaAnswer(e.target.value); setCaptchaError(false) }}
                  placeholder="0"
                  className={`w-20 text-center font-bold text-base font-mono ${captchaError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  required={isSignUp}
                />
                {/* Refresh */}
                <button
                  type="button"
                  onClick={refreshChallenge}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="New challenge"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {captchaError && (
                <p className="text-xs text-destructive">Wrong answer — a new challenge has been generated.</p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? 'Please wait...'
              : isSignUp
          ? 'Create AlgoBot account'
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

export default AuthForm
