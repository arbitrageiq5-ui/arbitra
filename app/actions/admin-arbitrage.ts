'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { getPricesAcrossExchanges, detectArbitrageOpportunities, ExchangePrice } from '@/lib/services/exchanges'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const role = (session.user as unknown as { role?: string })?.role
  if (role !== 'admin') throw new Error('Admin only')
  return session.user
}

export interface AdminLivePrice {
  symbol: string
  exchange: string
  price: number
  timestamp: number
}

export interface AdminArbitrageOpp {
  id: string
  symbol: string
  buyExchange: string
  buyPrice: number
  sellExchange: string
  sellPrice: number
  profitPct: number
  netProfitPct: number
  detectedAt: string
}

export interface ExchangeStatus {
  name: string
  label: string
  online: boolean
  latencyMs: number
  pricesFetched: number
  lastChecked: string
}

// Fetch live prices across all exchanges and return them for the admin panel
export async function adminFetchLivePrices(symbols: string[]): Promise<{
  prices: AdminLivePrice[]
  opportunities: AdminArbitrageOpp[]
  exchangeStatuses: ExchangeStatus[]
}> {
  await requireAdmin()

  const EXCHANGE_NAMES: Record<string, string> = {
    binance: 'Binance',
    kraken: 'Kraken',
    coinbase: 'Coinbase',
    bybit: 'Bybit',
    kucoin: 'KuCoin',
    huobi: 'HTX (Huobi)',
    bitfinex: 'Bitfinex',
    okx: 'OKX',
    'gate.io': 'Gate.io',
    gemini: 'Gemini',
    'crypto.com': 'Crypto.com',
    bitget: 'Bitget',
    coingecko: 'CoinGecko',
  }

  const start = Date.now()
  let livePrices: ExchangePrice[] = []

  try {
    livePrices = await getPricesAcrossExchanges(symbols)
  } catch {
    livePrices = []
  }

  // Build per-exchange status
  const exchangeMap: Record<string, { count: number; latency: number }> = {}
  livePrices.forEach(p => {
    const key = p.exchange.toLowerCase()
    if (!exchangeMap[key]) exchangeMap[key] = { count: 0, latency: Date.now() - start }
    exchangeMap[key].count++
  })

  const allExchanges = Object.keys(EXCHANGE_NAMES)
  const exchangeStatuses: ExchangeStatus[] = allExchanges.map(key => ({
    name: key,
    label: EXCHANGE_NAMES[key] ?? key,
    online: !!exchangeMap[key],
    latencyMs: exchangeMap[key]?.latency ?? 0,
    pricesFetched: exchangeMap[key]?.count ?? 0,
    lastChecked: new Date().toISOString(),
  }))

  // Detect opportunities
  const rawOpps = detectArbitrageOpportunities(livePrices, 0.3)
  const opportunities: AdminArbitrageOpp[] = rawOpps.map((opp, idx) => ({
    id: `${opp.symbol}-${opp.buyExchange}-${opp.sellExchange}-${Date.now()}-${idx}`,
    symbol: opp.symbol,
    buyExchange: opp.buyExchange.charAt(0).toUpperCase() + opp.buyExchange.slice(1),
    buyPrice: opp.buyPrice,
    sellExchange: opp.sellExchange.charAt(0).toUpperCase() + opp.sellExchange.slice(1),
    sellPrice: opp.sellPrice,
    profitPct: opp.profitPercentage,
    netProfitPct: Math.max(0, opp.profitPercentage - 0.2),
    detectedAt: new Date().toISOString(),
  }))

  return {
    prices: livePrices,
    opportunities,
    exchangeStatuses,
  }
}

// Transfer instruction generator (admin configures which network/address to use)
export interface TransferRoute {
  fromExchange: string
  toExchange: string
  symbol: string
  network: 'TRC20' | 'BEP20' | 'ERC20' | 'SOL' | 'BTC' | 'BNB'
  estimatedFee: number
  estimatedTimeMin: number
}

export async function getTransferRoutes(
  fromExchange: string,
  toExchange: string,
  symbol: string
): Promise<TransferRoute[]> {
  await requireAdmin()

  // Standard network support per asset
  const ASSET_NETWORKS: Record<string, Array<{ network: TransferRoute['network']; fee: number; timeMin: number }>> = {
    USDT: [
      { network: 'TRC20', fee: 1, timeMin: 1 },
      { network: 'BEP20', fee: 0.5, timeMin: 3 },
      { network: 'ERC20', fee: 5, timeMin: 5 },
    ],
    BTC:  [{ network: 'BTC',   fee: 0.0001, timeMin: 30 }],
    ETH:  [{ network: 'ERC20', fee: 0.005,  timeMin: 5  }],
    BNB:  [{ network: 'BEP20', fee: 0.001,  timeMin: 3  }],
    SOL:  [{ network: 'SOL',   fee: 0.001,  timeMin: 1  }],
    XRP:  [{ network: 'TRC20', fee: 0.2,    timeMin: 1  }],
    DOGE: [{ network: 'TRC20', fee: 1,      timeMin: 5  }],
    default: [
      { network: 'BEP20', fee: 0.5, timeMin: 3 },
      { network: 'ERC20', fee: 3,   timeMin: 5 },
    ],
  }

  const routes = ASSET_NETWORKS[symbol] ?? ASSET_NETWORKS['default']
  return routes.map(r => ({
    fromExchange,
    toExchange,
    symbol,
    network: r.network,
    estimatedFee: r.fee,
    estimatedTimeMin: r.timeMin,
  }))
}
