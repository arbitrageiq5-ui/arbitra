'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export interface CoinRate {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number | null
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_percentage_24h: number
  price_change_24h: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  circulating_supply: number
  total_supply: number
  ath: number
  atl: number
  ath_change_percentage: number
  ath_date: string
  atl_date: string
  roi: { times: number; currency: string; percentage: number } | null
  last_updated: string
}

export interface LendingRate {
  coin: string
  network: string
  apy: number
  minDeposit: number
  maxDeposit: number
  locked: boolean
  duration?: string
}

export interface LendingPool {
  id: string
  name: string
  description: string
  rates: LendingRate[]
  tvl: number
  lastUpdated: string
}

/** Fetch live coin rates from CoinGecko for lending display */
export async function getLiveRates(coinIds: string[] = ['bitcoin', 'ethereum', 'binancecoin', 'solana', 'ripple', 'cardano', 'dogecoin', 'polygon', 'avalanche-2', 'polkadot']) {
  try {
    const ids = coinIds.join(',')
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=250&sparkline=false&price_change_percentage=24h`,
      {
        headers: { 'Accept-Encoding': 'gzip' },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`)
    const rates = await res.json() as CoinRate[]
    return rates
  } catch (err) {
    console.error('[v0] CoinGecko fetch error:', err instanceof Error ? err.message : err)
    return []
  }
}

/** Get lending pools with simulated APYs based on current market conditions */
export async function getLendingPools(): Promise<LendingPool[]> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const rates = await getLiveRates()

  // Simulated lending pools with APYs that vary by coin and network
  const pools: LendingPool[] = rates.map((rate, idx) => ({
    id: `pool-${rate.id}`,
    name: `${rate.symbol.toUpperCase()} Lending Pool`,
    description: `Earn up to ${(8 + Math.random() * 12).toFixed(1)}% APY by lending ${rate.symbol.toUpperCase()}`,
    rates: [
      {
        coin: rate.symbol.toUpperCase(),
        network: 'Ethereum',
        apy: 6 + Math.random() * 12,
        minDeposit: 0.1,
        maxDeposit: 1000,
        locked: false,
      },
      {
        coin: rate.symbol.toUpperCase(),
        network: 'Binance Smart Chain',
        apy: 5.5 + Math.random() * 10,
        minDeposit: 0.1,
        maxDeposit: 5000,
        locked: false,
      },
      {
        coin: rate.symbol.toUpperCase(),
        network: '30-Day Lock',
        apy: 12 + Math.random() * 8,
        minDeposit: 1,
        maxDeposit: 100000,
        locked: true,
        duration: '30 days',
      },
    ],
    tvl: Math.random() * 50000000,
    lastUpdated: new Date().toISOString(),
  }))

  return pools
}

/** Get portfolio lending summary */
export async function getMyLendingPositions() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  // In a real app, this would query from a database
  // For now, return empty array (user has no lending positions yet)
  return []
}
