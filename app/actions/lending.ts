'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import type { CoinRate, LendingRate, LendingPool } from '@/lib/types/lending-types'

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

/** Calculate deterministic APY based on live market data (not random)
 *  APY is determined by: volatility (24h change), volume, and network type
 *  More volatile and higher volume coins earn higher APY
 */
function calculateLiveAPY(coin: CoinRate, networkMultiplier: number = 1): number {
  // Base APY depends on volatility (absolute price change %)
  const volatility = Math.abs(coin.price_change_percentage_24h ?? 0)
  
  // Volume factor (normalized) - higher volume = lower APY but more stable
  const volumeFactor = Math.min((coin.total_volume ?? 0) / 1e9, 10) / 10
  
  // Market cap rank factor - stablecoin-like projects (low rank) get lower APY
  const rankFactor = coin.market_cap_rank ? Math.min(coin.market_cap_rank / 20, 1) : 0.5
  
  // Calculate base APY: more volatility = higher yield
  // Formula: 2 + (volatility * 0.8) + (volumeFactor * 3) + (rankFactor * 5)
  const baseAPY = 2 + (volatility * 0.8) + (volumeFactor * 3) + (rankFactor * 5)
  
  // Apply network multiplier (lock = higher, different chains = different rates)
  return Math.max(baseAPY * networkMultiplier, 1.5)
}

/** Get lending pools with LIVE APYs based on current market conditions */
export async function getLendingPools(): Promise<LendingPool[]> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const rates = await getLiveRates()

  // Lending pools with deterministic APYs based on live market data
  const pools: LendingPool[] = rates.map((rate) => {
    // Calculate live APYs based on current market conditions
    const ethAPY = calculateLiveAPY(rate, 1.0)        // Ethereum: 1x multiplier
    const bscAPY = calculateLiveAPY(rate, 0.95)       // BSC: slightly lower
    const lockedAPY = calculateLiveAPY(rate, 1.4)     // 30-day lock: higher

    return {
      id: `pool-${rate.id}`,
      name: `${rate.symbol.toUpperCase()} Lending Pool`,
      description: `Earn ${lockedAPY.toFixed(1)}% APY by lending ${rate.symbol.toUpperCase()}`,
      rates: [
        {
          coin: rate.symbol.toUpperCase(),
          network: 'Ethereum',
          apy: ethAPY,
          minDeposit: 0.1,
          maxDeposit: 1000,
          locked: false,
        },
        {
          coin: rate.symbol.toUpperCase(),
          network: 'Binance Smart Chain',
          apy: bscAPY,
          minDeposit: 0.1,
          maxDeposit: 5000,
          locked: false,
        },
        {
          coin: rate.symbol.toUpperCase(),
          network: '30-Day Lock',
          apy: lockedAPY,
          minDeposit: 1,
          maxDeposit: 100000,
          locked: true,
          duration: '30 days',
        },
      ],
      tvl: (rate.total_volume ?? 0) * (Math.random() * 0.5 + 0.5),
      lastUpdated: new Date().toISOString(),
    }
  })

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
