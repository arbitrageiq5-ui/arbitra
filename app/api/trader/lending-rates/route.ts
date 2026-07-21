export const runtime = 'nodejs'
export const revalidate = 0 // never cache — always live

import { NextResponse } from 'next/server'

// ── Coin IDs to track (CoinGecko ids) ────────────────────────────────────────
const COIN_IDS = [
  'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
  'ripple', 'cardano', 'dogecoin', 'polkadot', 'avalanche-2',
  'chainlink', 'litecoin', 'uniswap', 'dai', 'aave',
  'matic-network', 'stellar', 'tron', 'monero', 'cosmos',
]

// Symbol aliases — maps CoinGecko symbol → DeFiLlama symbol match
const SYMBOL_MAP: Record<string, string[]> = {
  BTC:   ['BTC', 'WBTC'],
  ETH:   ['ETH', 'WETH', 'STETH'],
  USDT:  ['USDT'],
  BNB:   ['BNB'],
  SOL:   ['SOL'],
  XRP:   ['XRP'],
  ADA:   ['ADA'],
  DOGE:  ['DOGE'],
  DOT:   ['DOT'],
  AVAX:  ['AVAX'],
  LINK:  ['LINK'],
  LTC:   ['LTC'],
  UNI:   ['UNI'],
  DAI:   ['DAI'],
  AAVE:  ['AAVE'],
  MATIC: ['MATIC'],
  XLM:   ['XLM'],
  TRX:   ['TRX'],
  XMR:   ['XMR'],
  ATOM:  ['ATOM'],
}

export interface LendingPool {
  project:  string
  chain:    string
  symbol:   string
  apy:      number
  apyBase:  number
  apyReward: number
  tvlUsd:   number
  poolMeta: string | null
  pool:     string
}

export interface CoinData {
  id:                          string
  symbol:                      string
  name:                        string
  image:                       string
  current_price:               number
  market_cap:                  number
  market_cap_rank:             number | null
  total_volume:                number
  high_24h:                    number
  low_24h:                     number
  price_change_percentage_24h: number
  price_change_24h:            number
  ath:                         number
  ath_change_percentage:       number
  circulating_supply:          number
  total_supply:                number | null
}

export interface LendingRatesResponse {
  coins:     CoinData[]
  poolsByCoin: Record<string, LendingPool[]>
  updatedAt: string
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchCoinGecko(): Promise<CoinData[]> {
  const ids = COIN_IDS.join(',')
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  return res.json()
}

async function fetchDeFiLlamaPools(): Promise<LendingPool[]> {
  const res = await fetch('https://yields.llama.fi/pools', {
    signal: AbortSignal.timeout(15_000),
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`)
  const json = await res.json()
  const raw: any[] = json.data ?? []

  // Keep only single-asset pools (no IL risk), minimum $5M TVL, has a real APY
  return raw
    .filter(p =>
      p.exposure === 'single' &&
      p.apy != null &&
      p.apy > 0 &&
      p.tvlUsd >= 5_000_000 &&
      !p.outlier
    )
    .map(p => ({
      project:   p.project,
      chain:     p.chain,
      symbol:    p.symbol,
      apy:       Number(p.apy.toFixed(2)),
      apyBase:   Number((p.apyBase ?? 0).toFixed(2)),
      apyReward: Number((p.apyReward ?? 0).toFixed(2)),
      tvlUsd:    p.tvlUsd,
      poolMeta:  p.poolMeta ?? null,
      pool:      p.pool,
    }))
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Fetch both in parallel
    const [coins, allPools] = await Promise.all([
      fetchCoinGecko(),
      fetchDeFiLlamaPools(),
    ])

    // Build a lookup of DeFiLlama pools keyed by the CoinGecko symbol
    const poolsByCoin: Record<string, LendingPool[]> = {}

    for (const coin of coins) {
      const sym = coin.symbol.toUpperCase()
      const aliases = SYMBOL_MAP[sym] ?? [sym]

      // Find matching pools — match on symbol alias, sort by APY desc, take top 8
      const matched = allPools
        .filter(p => aliases.some(a => p.symbol.toUpperCase() === a || p.symbol.toUpperCase().startsWith(a)))
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 8)

      poolsByCoin[sym] = matched
    }

    const payload: LendingRatesResponse = {
      coins,
      poolsByCoin,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Data-Sources': 'CoinGecko, DeFiLlama',
      },
    })
  } catch (err) {
    console.error('[lending-rates] fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch live rates', detail: String(err) },
      { status: 502 }
    )
  }
}
