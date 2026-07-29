// Exchange capabilities and status cache
// Caches: fee structures, supported networks, deposit/withdraw status
// TTL: 1 hour (rarely changes during trading sessions)

type ExchangeCapabilities = {
  fees: Record<string, number>
  networks: string[]
  supportsCoinwithdraw: Record<string, boolean>
  hasPublicApi: boolean
  timestamp: number
}

const exchangeCache = new Map<string, ExchangeCapabilities>()
const EXCHANGE_CACHE_TTL = 3600000 // 1 hour

export function getExchangeCapsCached(exchange: string): ExchangeCapabilities | null {
  const key = exchange.toLowerCase()
  const cached = exchangeCache.get(key)

  if (!cached) return null
  if (Date.now() - cached.timestamp > EXCHANGE_CACHE_TTL) {
    exchangeCache.delete(key)
    return null
  }

  return cached
}

export function setExchangeCapsCached(exchange: string, caps: Omit<ExchangeCapabilities, 'timestamp'>) {
  const key = exchange.toLowerCase()
  exchangeCache.set(key, {
    ...caps,
    timestamp: Date.now(),
  })
}

export function clearExchangeCache() {
  exchangeCache.clear()
}

// Preloaded defaults for common exchanges (fallback if cache miss)
export const DEFAULT_EXCHANGE_CAPS: Record<string, Omit<ExchangeCapabilities, 'timestamp'>> = {
  binance: {
    fees: { taker: 0.10, maker: 0.10 },
    networks: ['TRC20', 'BEP20', 'ERC20', 'SOL', 'Polygon'],
    supportsCoinwithdraw: { USDT: true, BTC: true, ETH: true },
    hasPublicApi: true,
  },
  okx: {
    fees: { taker: 0.08, maker: 0.08 },
    networks: ['TRC20', 'BEP20', 'ERC20', 'SOL'],
    supportsCoinwithdraw: { USDT: true, BTC: true },
    hasPublicApi: true,
  },
  bybit: {
    fees: { taker: 0.10, maker: 0.10 },
    networks: ['TRC20', 'BEP20', 'ERC20', 'SOL'],
    supportsCoinwithdraw: { USDT: true, BTC: true },
    hasPublicApi: true,
  },
  kucoin: {
    fees: { taker: 0.10, maker: 0.10 },
    networks: ['TRC20', 'BEP20', 'ERC20'],
    supportsCoinwithdraw: { USDT: true, BTC: true },
    hasPublicApi: true,
  },
}
