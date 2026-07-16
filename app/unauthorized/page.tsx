import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Access Denied',
  description: 'You do not have permission to access this resource',
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-lg p-8 text-center">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />

          <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>

          <p className="text-slate-300 mb-6">
            You don&apos;t have permission to access this resource. Your current role does not allow this action.
          </p>

          <div className="bg-slate-700/30 border border-slate-600/30 rounded p-4 mb-6 text-left">
            <p className="text-sm text-slate-400 mb-2">
              <strong>Need more permissions?</strong>
            </p>
            <p className="text-sm text-slate-400">
              Contact your administrator to upgrade your account role or request specific permissions.
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full">
                Back to Dashboard
              </Button>
            </Link>
            <Link href="/settings" className="flex-1">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                View Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
