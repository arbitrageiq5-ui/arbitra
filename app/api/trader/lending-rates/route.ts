export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

// ─── Coinpaprika coin IDs ──────────────────────────────────────────────────
const COINS = [
  { id: 'btc-bitcoin',          sym: 'BTC'   },
  { id: 'eth-ethereum',         sym: 'ETH'   },
  { id: 'usdt-tether',          sym: 'USDT'  },
  { id: 'bnb-binance-coin',     sym: 'BNB'   },
  { id: 'usdc-usd-coin',        sym: 'USDC'  },
  { id: 'xrp-xrp',              sym: 'XRP'   },
  { id: 'sol-solana',           sym: 'SOL'   },
  { id: 'doge-dogecoin',        sym: 'DOGE'  },
  { id: 'ada-cardano',          sym: 'ADA'   },
  { id: 'trx-tron',             sym: 'TRX'   },
  { id: 'avax-avalanche',       sym: 'AVAX'  },
  { id: 'dot-polkadot',         sym: 'DOT'   },
  { id: 'link-chainlink',       sym: 'LINK'  },
  { id: 'atom-cosmos',          sym: 'ATOM'  },
  { id: 'ltc-litecoin',         sym: 'LTC'   },
  { id: 'uni-uniswap',          sym: 'UNI'   },
  { id: 'dai-dai',              sym: 'DAI'   },
  { id: 'aave-new',             sym: 'AAVE'  },
  { id: 'matic-polygon',        sym: 'MATIC' },
  { id: 'xlm-stellar',          sym: 'XLM'   },
]

// DeFiLlama symbols that map to each coin
const DEFI_ALIASES: Record<string, string[]> = {
  BTC:   ['BTC','WBTC','BTCB','CBBTC'],
  ETH:   ['ETH','WETH','STETH','WSTETH','WEETH','CBETH','RETH'],
  USDT:  ['USDT','USDT0'],
  USDC:  ['USDC','USDC.E'],
  BNB:   ['BNB','WBNB'],
  SOL:   ['SOL','WSOL','JITOSOL','MSOL'],
  ADA:   ['ADA'],
  XRP:   ['XRP'],
  DOGE:  ['DOGE'],
  TRX:   ['TRX'],
  AVAX:  ['AVAX','WAVAX'],
  DOT:   ['DOT'],
  LINK:  ['LINK'],
  ATOM:  ['ATOM'],
  LTC:   ['LTC'],
  UNI:   ['UNI'],
  DAI:   ['DAI'],
  AAVE:  ['AAVE'],
  MATIC: ['MATIC','WMATIC','POL'],
  XLM:   ['XLM'],
}

export interface CoinData {
  id:           string
  symbol:       string
  name:         string
  price:        number
  change24h:    number
  volume24h:    number
  marketCap:    number
  high24h:      number
  low24h:       number
  ath:          number
}

export interface LendingPool {
  project:   string
  chain:     string
  symbol:    string
  apy:       number
  apyBase:   number
  apyReward: number
  tvlUsd:    number
  poolMeta:  string | null
}

export interface LendingRatesResponse {
  coins:       CoinData[]
  poolsByCoin: Record<string, LendingPool[]>
  updatedAt:   string
  sources:     string[]
}

// ─── Fetch Coinpaprika (no auth, no rate-limit on free tier for these) ──────
async function fetchCoinpaprika(): Promise<CoinData[]> {
  // Use the global tickers endpoint — single call, all coins, truly live
  const res = await fetch(
    'https://api.coinpaprika.com/v1/tickers?limit=100',
    { signal: AbortSignal.timeout(10_000), headers: { 'Accept': 'application/json' } }
  )
  if (!res.ok) throw new Error(`Coinpaprika ${res.status}`)
  const raw: any[] = await res.json()

  const wantedIds = new Set(COINS.map(c => c.id))
  const bySym: Record<string, any> = {}
  for (const t of raw) {
    if (wantedIds.has(t.id)) bySym[t.id] = t
  }

  return COINS.map(({ id, sym }) => {
    const t   = bySym[id]
    const usd = t?.quotes?.USD ?? {}
    return {
      id,
      symbol:    sym,
      name:      t?.name ?? sym,
      price:     usd.price       ?? 0,
      change24h: usd.percent_change_24h ?? 0,
      volume24h: usd.volume_24h  ?? 0,
      marketCap: usd.market_cap  ?? 0,
      high24h:   usd.high_24h    ?? usd.price ?? 0,
      low24h:    usd.low_24h     ?? usd.price ?? 0,
      ath:       usd.ath_price   ?? 0,
    }
  }).filter(c => c.price > 0)
}

// ─── Fetch DeFiLlama Yields (real on-chain APYs) ──────────────────────────
async function fetchDeFiLlamaPools(): Promise<LendingPool[]> {
  const res = await fetch(
    'https://yields.llama.fi/pools',
    { signal: AbortSignal.timeout(20_000), headers: { 'Accept': 'application/json' } }
  )
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`)
  const json = await res.json()
  const raw: any[] = json.data ?? []

  return raw
    .filter(p =>
      p.exposure === 'single' &&
      typeof p.apy === 'number' &&
      p.apy > 0 &&
      p.apy < 300 &&          // exclude obvious outliers
      (p.tvlUsd ?? 0) >= 2_000_000 &&
      !p.outlier
    )
    .map(p => ({
      project:   p.project   as string,
      chain:     p.chain     as string,
      symbol:    (p.symbol   as string).toUpperCase(),
      apy:       +p.apy.toFixed(2),
      apyBase:   +(p.apyBase   ?? 0).toFixed(2),
      apyReward: +(p.apyReward ?? 0).toFixed(2),
      tvlUsd:    p.tvlUsd    as number,
      poolMeta:  p.poolMeta  as string | null,
    }))
}

// ─── Route ────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const [coins, allPools] = await Promise.all([
      fetchCoinpaprika(),
      fetchDeFiLlamaPools(),
    ])

    // Index pools by their symbol
    const poolIndex: Record<string, LendingPool[]> = {}
    for (const pool of allPools) {
      if (!poolIndex[pool.symbol]) poolIndex[pool.symbol] = []
      poolIndex[pool.symbol].push(pool)
    }

    // For each coin, collect matching pools via aliases
    const poolsByCoin: Record<string, LendingPool[]> = {}
    for (const coin of coins) {
      const aliases = DEFI_ALIASES[coin.symbol] ?? [coin.symbol]
      const matched: LendingPool[] = []
      for (const alias of aliases) {
        const ps = poolIndex[alias] ?? []
        matched.push(...ps)
      }
      // Dedupe by project+chain, sort by APY desc, take top 10
      const seen = new Set<string>()
      const deduped: LendingPool[] = []
      for (const p of matched.sort((a, b) => b.apy - a.apy)) {
        const key = `${p.project}-${p.chain}`
        if (!seen.has(key)) { seen.add(key); deduped.push(p) }
        if (deduped.length >= 10) break
      }
      poolsByCoin[coin.symbol] = deduped
    }

    return NextResponse.json(
      {
        coins,
        poolsByCoin,
        updatedAt: new Date().toISOString(),
        sources:   ['Coinpaprika', 'DeFiLlama'],
      } satisfies LendingRatesResponse,
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Data-Sources': 'Coinpaprika, DeFiLlama',
        },
      }
    )
  } catch (err) {
    console.error('[lending-rates] error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch live rates', detail: String(err) },
      { status: 502 }
    )
  }
}
