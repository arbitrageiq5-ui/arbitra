import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { arbitrageOpportunities } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// This endpoint can be called by Vercel Cron to periodically check for arbitrage opportunities
// Configure in vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/check-arbitrage",
//     "schedule": "*/5 * * * *"
//   }]
// }

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ unauthorized: true }, { status: 401 })
  }

  try {
    // Get opportunities that are older than 10 minutes
    const cutoff = new Date(Date.now() - 10 * 60 * 1000)

    // Update old pending opportunities to expired
    await db
      .update(arbitrageOpportunities)
      .set({ status: 'expired' })
      .where(eq(arbitrageOpportunities.status, 'pending'))

    // Call the monitor endpoint to detect new opportunities
    const monitorResponse = await fetch(
      `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/monitor`,
      { method: 'GET' }
    )

    const result = await monitorResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Arbitrage check completed',
      data: result,
    })
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: String(error) },
      { status: 500 }
    )
  }
}
