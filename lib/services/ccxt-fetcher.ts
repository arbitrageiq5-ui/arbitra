/**
 * CCXT-based live price fetcher.
 *
 * Strategy (per exchange):
 *   1. If an API key exists in env vars (BINANCE_API_KEY, etc.) or was passed
 *      in from the DB — use authenticated CCXT fetch (lower rate limits).
 *   2. Otherwise — use CCXT in public mode (no credentials).
 *   3. Timeout every exchange at 6 s to avoid blocking the scan.
 *
 * Indian exchanges (coindcx, coinswitch, mudrex) are NOT in CCXT;
 * they fall back to the direct-REST fetchers in exchanges.ts.
 */

// CCXT id → our internal exchange key
export const CCXT_EXCHANGE_MAP: Record<string, string> = {
  binance:    'Binance',
  bybit:      'Bybit',
  kucoin:     'KuCoin',
  okx:        'OKX',
  kraken:     'Kraken',
  coinbase:   'Coinbase',
  bitget:     'Bitget',
  gate:       'Gate.io',
  mexc:       'MEXC',
  htx:        'HTX',
  bitfinex:   'Bitfinex',
  gemini:     'Gemini',
  upbit:      'Upbit',
  phemex:     'Phemex',
  poloniex:   'Poloniex',
  bingx:      'BingX',
  lbank:      'LBank',
  delta:      'Delta Exchange',
  bitbns:     'BitBns',
  zebpay:     'ZebPay',
  cryptocom:  'Crypto.com',
}

export interface CcxtPrice {
  exchange: string   // our display name
  ccxtId:   string   // ccxt exchange id
  symbol:   string   // e.g. "BTC"
  price:    number
  source:   'ccxt-auth' | 'ccxt-public' | 'coingecko' | 'rest-fallback'
  timestamp: number
}

// Build credential map from environment variables
function getEnvCredentials(ccxtId: string): { apiKey?: string; secret?: string; password?: string } | null {
  const id = ccxtId.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const apiKey = process.env[`${id}_API_KEY`] ?? process.env[`EXCHANGE_${id}_API_KEY`]
  const secret  = process.env[`${id}_SECRET`]  ?? process.env[`EXCHANGE_${id}_SECRET`]
  const password = process.env[`${id}_PASSPHRASE`]
  if (apiKey && secret) return { apiKey, secret, ...(password ? { password } : {}) }
  return null
}

// CCXT symbol format for each exchange: most use BTC/USDT, some differ
function toSymbolPair(symbol: string, ccxtId: string): string {
  // Upbit uses KRW markets
  if (ccxtId === 'upbit') return `${symbol}/KRW`
  // Kraken uses XBT for BTC
  if (ccxtId === 'kraken' && symbol === 'BTC') return 'XBT/USD'
  if (ccxtId === 'kraken') return `${symbol}/USD`
  // Coinbase / Gemini / Bitfinex: USD quote
  if (['coinbase', 'gemini', 'bitfinex'].includes(ccxtId)) return `${symbol}/USD`
  return `${symbol}/USDT`
}

const KRW_USD = 0.00073

/**
 * Fetch prices for `symbols` from all supported CCXT exchanges.
 * `dbKeys` is an optional map of ccxtId → { apiKey, secret, passphrase }
 * loaded from the database by the caller.
 */
export async function fetchPricesViaCcxt(
  symbols: string[],
  dbKeys: Record<string, { apiKey?: string | null; secret?: string | null; passphrase?: string | null }> = {},
): Promise<CcxtPrice[]> {
  // Dynamic import — CCXT is large; only load in server context
  const ccxt = await import('ccxt').then(m => m.default ?? m)

  const results: CcxtPrice[] = []

  await Promise.all(
    Object.entries(CCXT_EXCHANGE_MAP).map(async ([ccxtId, displayName]) => {
      // Skip exchanges not in CCXT
      if (!(ccxtId in ccxt)) return

      const envCreds = getEnvCredentials(ccxtId)
      const dbCred  = dbKeys[ccxtId]
      const creds   = envCreds ?? (
        dbCred?.apiKey && dbCred?.secret
          ? { apiKey: dbCred.apiKey, secret: dbCred.secret, ...(dbCred.passphrase ? { password: dbCred.passphrase } : {}) }
          : null
      )

      let exchange: any
      try {
        exchange = new (ccxt as any)[ccxtId]({
          ...( creds ?? {} ),
          enableRateLimit: true,
          timeout: 6000,
          options: { defaultType: 'spot' },
        })
      } catch {
        return
      }

      // Fetch all requested symbols in parallel for this exchange
      await Promise.all(symbols.map(async (symbol) => {
        const pair = toSymbolPair(symbol, ccxtId)
        try {
          const ticker = await exchange.fetchTicker(pair)
          let price = ticker?.last ?? ticker?.close ?? ticker?.bid
          if (price == null) return

          // Convert KRW to USD for Upbit
          if (ccxtId === 'upbit') price = price * KRW_USD

          const p = parseFloat(String(price))
          if (!isFinite(p) || p <= 0) return

          results.push({
            exchange: displayName,
            ccxtId,
            symbol,
            price: p,
            source: creds ? 'ccxt-auth' : 'ccxt-public',
            timestamp: Date.now(),
          })
        } catch {
          // Exchange doesn't support this pair or is rate-limited — skip
        }
      }))

      // Close exchange connection to free resources
      try { if (exchange.close) await exchange.close() } catch { /* ignore */ }
    })
  )

  return results
}

/**
 * Fetch prices from CoinGecko as a reference / fallback layer.
 * Uses COINGECKO_API_KEY env var for Pro tier if available.
 * Returns prices for all available symbols.
 */
const COINGECKO_ID_MAP: Record<string, string> = {
  BTC:   'bitcoin',
  ETH:   'ethereum',
  BNB:   'binancecoin',
  SOL:   'solana',
  XRP:   'ripple',
  ADA:   'cardano',
  AVAX:  'avalanche-2',
  DOGE:  'dogecoin',
  MATIC: 'matic-network',
  DOT:   'polkadot',
  LINK:  'chainlink',
  UNI:   'uniswap',
  LTC:   'litecoin',
  ATOM:  'cosmos',
  TRX:   'tron',
  NEAR:  'near',
  FIL:   'filecoin',
  ARB:   'arbitrum',
  OP:    'optimism',
  APT:   'aptos',
  USDT:  'tether',
  USDC:  'usd-coin',
  XLM:   'stellar',
  ALGO:  'algorand',
  VET:   'vechain',
  HBAR:  'hedera-hashgraph',
  ICP:   'internet-computer',
  SAND:  'the-sandbox',
  MANA:  'decentraland',
  AAVE:  'aave',
  CRV:   'curve-dao-token',
  MKR:   'maker',
  COMP:  'compound-governance-token',
  INJ:   'injective-protocol',
  SUI:   'sui',
  SEI:   'sei-network',
}

export async function fetchPricesViaCoingecko(
  symbols: string[],
): Promise<CcxtPrice[]> {
  const apiKey = process.env.COINGECKO_API_KEY ?? process.env.CG_API_KEY
  const isPro  = !!apiKey
  const base   = isPro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3'

  const cgIds = symbols
    .map(s => COINGECKO_ID_MAP[s.toUpperCase()])
    .filter(Boolean)

  if (cgIds.length === 0) return []

  const url = `${base}/simple/price?ids=${cgIds.join(',')}&vs_currencies=usd`
  const headers: Record<string, string> = isPro ? { 'x-cg-pro-api-key': apiKey! } : {}

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 0 }, // always fresh in Next.js
    })
    if (!res.ok) return []
    const data = await res.json() as Record<string, { usd: number }>

    const results: CcxtPrice[] = []
    for (const sym of symbols) {
      const cgId = COINGECKO_ID_MAP[sym.toUpperCase()]
      if (!cgId) continue
      const price = data[cgId]?.usd
      if (price == null || !isFinite(price) || price <= 0) continue
      // Use CoinGecko as a single "reference" price for every exchange
      // that we couldn't reach with CCXT/REST
      results.push({
        exchange: 'CoinGecko',
        ccxtId:   'coingecko',
        symbol:   sym,
        price,
        source:   'coingecko',
        timestamp: Date.now(),
      })
    }
    return results
  } catch {
    return []
  }
}
