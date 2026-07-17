'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Zap, TrendingUp, ShieldCheck, Bell, Loader2, Shield, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { registerWithCaptcha } from '@/app/actions/secure-registration'

const benefits = [
  { icon: Zap, text: 'Free forever plan — no credit card required' },
  { icon: TrendingUp, text: 'Access 2,800+ live arbitrage opportunities' },
  { icon: ShieldCheck, text: 'Read-only API keys — your funds stay safe' },
  { icon: Bell, text: 'Telegram, WhatsApp & email alerts included' },
]

const countries = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany',
  'France', 'Singapore', 'Japan', 'South Korea', 'United Arab Emirates',
  'India', 'Brazil', 'Mexico', 'Other',
]

// --- Math captcha helpers ---
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

export function Registration() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    password: '',
    confirmPassword: '',
    tradingExperienceLevel: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    agree: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Captcha state — generated client-side only to avoid hydration mismatch
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [captchaError, setCaptchaError] = useState(false)

  const refreshChallenge = useCallback(() => {
    setChallenge(generateChallenge())
    setCaptchaAnswer('')
    setCaptchaError(false)
  }, [])

  // Generate initial challenge after mount (client-only)
  useEffect(() => {
    refreshChallenge()
  }, [refreshChallenge])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCaptchaError(false)

    // Client-side password match check
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    // Verify math captcha on the client first
    const userAnswer = parseInt(captchaAnswer.trim(), 10)
    if (!challenge || isNaN(userAnswer) || userAnswer !== challenge.answer) {
      setCaptchaError(true)
      refreshChallenge()
      setError('Incorrect captcha answer. A new challenge has been generated.')
      return
    }

    setLoading(true)

    try {
      // Pre-flight check: captcha + rate limit
      const result = await registerWithCaptcha({
        email: form.email.toLowerCase(),
        captchaToken: 'math-captcha-passed',
      })

      if (!result.success) {
        setError(result.error || 'Registration failed. Please try again.')
        refreshChallenge()
        return
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      refreshChallenge()
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="pricing" className="py-28 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/20 to-transparent" />
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-[#00D4FF]/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: benefits */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/5 text-[#00D4FF] text-xs font-medium mb-6">
              Start for Free Today
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 text-balance">
              Join 3,200+ Traders Already Using ArbitrageIQ
            </h2>
            <p className="text-[#98A2B3] text-lg leading-relaxed mb-10">
              Create your free account in under 60 seconds and start discovering
              arbitrage opportunities across 12+ exchanges instantly.
            </p>

            <div className="flex flex-col gap-4 mb-10">
              {benefits.map((b) => (
                <div key={b.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/20 flex items-center justify-center flex-shrink-0">
                    <b.icon className="w-4 h-4 text-[#00D4FF]" />
                  </div>
                  <span className="text-sm text-[#98A2B3]">{b.text}</span>
                </div>
              ))}
            </div>

            {/* Testimonial mini */}
            <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#0E1324]/60">
              <p className="text-sm text-[#98A2B3] italic mb-3">
                &ldquo;Signed up on a Monday. Found my first 1.2% net opportunity by Tuesday morning. Genuinely surprised.&rdquo;
              </p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#00D4FF]/15 border border-[#00D4FF]/25 flex items-center justify-center text-xs font-bold text-[#00D4FF]">
                  RC
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Ryan Chen</p>
                  <p className="text-xs text-[#98A2B3]">Independent Crypto Trader</p>
                </div>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00D4FF] ml-auto" />
              </div>
            </div>
          </motion.div>

          {/* Right: form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1324]/90 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(0,212,255,0.08)]">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#00FF99]/10 border border-[#00FF99]/30 flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-8 h-8 text-[#00FF99]" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Account Created!</h3>
                  <p className="text-[#98A2B3] text-sm mb-6">
                    Welcome to ArbitrageIQ. Check your email to verify your account and start exploring opportunities.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-sm text-[#00D4FF] hover:underline"
                  >
                    Back to form
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-white mb-2">Create Free Account</h3>
                  <p className="text-sm text-[#98A2B3] mb-6">No credit card required. Cancel anytime.</p>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#98A2B3] mb-1.5">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="John Smith"
                          className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#98A2B3]/50 focus:outline-none focus:border-[#00D4FF]/40 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#98A2B3] mb-1.5">Phone</label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="+1 555 000 0000"
                          className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#98A2B3]/50 focus:outline-none focus:border-[#00D4FF]/40 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-[#98A2B3] mb-1.5">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="john@example.com"
                        className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#98A2B3]/50 focus:outline-none focus:border-[#00D4FF]/40 transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#98A2B3] mb-1.5">Country *</label>
                        <select
                          required
                          value={form.country}
                          onChange={(e) => setForm({ ...form, country: e.target.value })}
                          className="w-full px-4 py-2.5 text-sm rounded-xl bg-[#0E1324] border border-white/[0.08] text-white focus:outline-none focus:border-[#00D4FF]/40 transition-colors appearance-none"
                        >
                          <option value="" disabled>Select country</option>
                          {countries.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#98A2B3] mb-1.5">Trading Experience *</label>
                        <select
                          required
                          value={form.tradingExperienceLevel}
                          onChange={(e) => setForm({ ...form, tradingExperienceLevel: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}
                          className="w-full px-4 py-2.5 text-sm rounded-xl bg-[#0E1324] border border-white/[0.08] text-white focus:outline-none focus:border-[#00D4FF]/40 transition-colors appearance-none"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#98A2B3] mb-1.5">Password *</label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          placeholder="Min. 8 characters"
                          className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-[#98A2B3]/50 focus:outline-none focus:border-[#00D4FF]/40 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#98A2B3] mb-1.5">Confirm Password *</label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={form.confirmPassword}
                          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                          placeholder="Repeat password"
                          className={`w-full px-4 py-2.5 text-sm rounded-xl bg-white/[0.04] border text-white placeholder-[#98A2B3]/50 focus:outline-none transition-colors ${
                            form.confirmPassword && form.confirmPassword !== form.password
                              ? 'border-red-500/50 focus:border-red-500/60'
                              : form.confirmPassword && form.confirmPassword === form.password
                              ? 'border-green-500/40 focus:border-green-500/50'
                              : 'border-white/[0.08] focus:border-[#00D4FF]/40'
                          }`}
                        />
                        {form.confirmPassword && form.confirmPassword !== form.password && (
                          <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                        )}
                      </div>
                    </div>

                    {/* Math Captcha */}
                    {challenge && (
                      <div className="rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/[0.03] p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="w-4 h-4 text-[#00D4FF] shrink-0" />
                          <span className="text-xs font-semibold text-[#00D4FF] uppercase tracking-wide">Security Check</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <p className="text-xs text-[#98A2B3] mb-2">Solve the equation to verify you&apos;re human:</p>
                            <div className="flex items-center gap-3">
                              {/* Math challenge display */}
                              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] select-none">
                                <span className="text-lg font-bold text-white font-mono tracking-widest">
                                  {challenge.question} =
                                </span>
                              </div>
                              {/* Answer input */}
                              <input
                                type="number"
                                required
                                value={captchaAnswer}
                                onChange={(e) => { setCaptchaAnswer(e.target.value); setCaptchaError(false) }}
                                placeholder="?"
                                className={`w-20 px-3 py-2.5 text-lg font-bold text-center rounded-xl border text-white placeholder-[#98A2B3]/50 focus:outline-none transition-colors bg-white/[0.04] ${
                                  captchaError
                                    ? 'border-red-500/60 bg-red-500/5'
                                    : captchaAnswer && !captchaError
                                    ? 'border-[#00D4FF]/40'
                                    : 'border-white/[0.08]'
                                }`}
                              />
                              {/* Refresh button */}
                              <button
                                type="button"
                                onClick={refreshChallenge}
                                className="p-2 rounded-lg text-[#98A2B3] hover:text-white hover:bg-white/[0.08] transition-colors"
                                title="New challenge"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            </div>
                            {captchaError && (
                              <p className="text-xs text-red-400 mt-2">Wrong answer — a new challenge was generated.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          required
                          checked={form.agree}
                          onChange={(e) => setForm({ ...form, agree: e.target.checked })}
                          className="mt-1 accent-[#00D4FF]"
                        />
                        <span className="text-xs text-[#98A2B3]">
                          I agree to the{' '}
                          <Link href="#" className="text-[#00D4FF] hover:underline">Terms of Service</Link>
                          {', '}
                          <Link href="#" className="text-[#00D4FF] hover:underline">Privacy Policy</Link>
                          {', and '}
                          <Link href="#" className="text-[#00D4FF] hover:underline">Risk Disclosure</Link>.
                          I understand this platform provides market intelligence only.
                        </span>
                      </label>
                    </div>

                    {error && (
                      <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5" role="alert">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-xl text-sm font-semibold text-[#050816] bg-[#00D4FF] hover:bg-[#00D4FF]/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_0_30px_rgba(0,212,255,0.35)] hover:shadow-[0_0_50px_rgba(0,212,255,0.55)] flex items-center justify-center gap-2"
                    >
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {loading ? 'Creating account...' : 'Create Free Account'}
                    </button>

                    <p className="text-center text-xs text-[#98A2B3]">
                      Already have an account?{' '}
                      <Link href="/sign-in" className="text-[#00D4FF] hover:underline">Sign In</Link>
                    </p>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
