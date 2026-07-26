import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthFormClient } from '@/components/auth-form-client'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const role = (session?.user as unknown as { role?: string })?.role
  if (role === 'admin') redirect('/admin')
  if (role === 'protrader') redirect('/protrader')
  if (role === 'trader') redirect('/trader')
  if (session?.user) redirect('/viewer')
  return <AuthFormClient mode="sign-in" />
}
