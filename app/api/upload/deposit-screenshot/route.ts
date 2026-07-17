import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
  // Require authenticated session
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate type — only images
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    // Max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 10 MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'png'
    const pathname = `deposits/${session.user.id}/${Date.now()}.${ext}`

    const blob = await put(pathname, file, { access: 'private' })

    return NextResponse.json({ pathname: blob.pathname })
  } catch (error) {
    console.error('[v0] Deposit screenshot upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
