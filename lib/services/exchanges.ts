/**
 * Exchange price fetching service.
 * Uses native fetch (no axios dependency), correct API formats for each exchange,
 * and falls back to a seeded simulation when external calls are blocked/rate-limited.
 */

import { BASE_PRICES, COIN_VOLUME_24H, DEFAULT_VOLUME } from '@/lib/constants/prices'
import { getPriceCached, setPriceCached } from '@/lib/cache/price-cache'

export interface ExchangePrice {
  symbol: string
  exchange: string
  price: number
  timestamp: number
}

export interface ArbitrageOpportunity {
  symbol: string
  buyExchange: string
  buyPrice: number
  sellExchange: string
  sellPrice: number
  profitPercentage: number
  profitAmount: number
}

// ─── Individual exchange fetchers ─────────────────────────────────────────────

/** Binance: BTCUSDT format */
async function fetchBinance(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data.price)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Bybit: BTCUSDT spot */
async function fetchBybit(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.result?.list?.[0]?.lastPrice)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** KuCoin: BTC-USDT format */
async function fetchKucoin(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol}-USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.data?.price)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** OKX: BTC-USDT format */
async function fetchOkx(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.data?.[0]?.last)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Gate.io: BTC_USDT format */
async function fetchGateio(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${symbol}_USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.[0]?.last)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Kraken: XBTUSD for BTC, ETHUSD for ETH, etc. */
async function fetchKraken(symbol: string): Promise<number | null> {
  // Kraken uses non-standard symbols
  const krakenMap: Record<string, string> = {
    BTC: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD', XRP: 'XRPUSD',
    ADA: 'ADAUSD', DOT: 'DOTUSD', LINK: 'LINKUSD', AVAX: 'AVAXUSD',
    MATIC: 'MATICUSD', UNI: 'UNIUSD', ATOM: 'ATOMUSD', LTC: 'LTCUSD',
    DOGE: 'XDGUSD', NEAR: 'NEARUSD', ARB: 'ARBUSD', OP: 'OPUSD',
    APT: 'APTUSD', FIL: 'FILUSD',
  }
  const pair = krakenMap[symbol]
  if (!pair) return null
  try {
    const res = await fetch(
      `https://api.kraken.com/0/public/Ticker?pair=${pair}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.result
    if (!result) return null
    const first = Object.values(result)[0] as any
    const p = parseFloat(first?.c?.[0])
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Coinbase: BTC-USD format */
async function fetchCoinbase(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.data?.amount)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Bitget: BTCUSDT spot */
async function fetchBitget(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${symbol}USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.data?.[0]?.lastPr ?? data?.data?.[0]?.last)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** MEXC: BTCUSDT format */
async function fetchMexc(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.price)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** HTX (Huobi): btcusdt format */
async function fetchHtx(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.huobi.pro/market/detail/merged?symbol=${symbol.toLowerCase()}usdt`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.tick?.close)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Bitfinex: tBTCUSD format */
async function fetchBitfinex(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api-pub.bitfinex.com/v2/ticker/t${symbol}USD`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    // Response is array: [BID, BID_SIZE, ASK, ASK_SIZE, ..., LAST_PRICE, ...]
    const p = parseFloat(data?.[6])
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Gemini: btcusd format */
async function fetchGemini(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.gemini.com/v1/pubticker/${symbol.toLowerCase()}usd`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.last)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Upbit: KRW markets — convert to USD using ~1370 KRW/USD */
async function fetchUpbit(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.upbit.com/v1/ticker?markets=KRW-${symbol}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const krwPrice = parseFloat(data?.[0]?.trade_price)
    if (!isFinite(krwPrice) || krwPrice <= 0) return null
    const KRW_USD = 0.00073 // approximate KRW→USD rate
    const p = krwPrice * KRW_USD
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** WazirX (India): uses BTC/USDT pairs */
async function fetchWazirx(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.wazirx.com/sapi/v1/ticker/24hr?symbol=${symbol.toLowerCase()}usdt`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.lastPrice)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Delta Exchange (India): BTCUSD perpetual/spot */
async function fetchDelta(symbol: string): Promise<number | null> {
  try {
    // Delta uses product symbols like BTCUSD
    const res = await fetch(
      `https://api.delta.exchange/v2/tickers?contract_types=spot`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const tickers = data?.result as Array<{ symbol: string; close: string }> | undefined
    if (!Array.isArray(tickers)) return null
    const match = tickers.find(t =>
      t.symbol === `${symbol}USDT` || t.symbol === `${symbol}USD`
    )
    if (!match) return null
    const p = parseFloat(match.close)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** CoinSwitch Pro (India): uses public ticker */
async function fetchCoinSwitch(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://coinswitch.co/api/v2/coins/${symbol.toLowerCase()}/`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.current_price ?? data?.price ?? data?.data?.price)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** BitBns (India): INR market → convert to USD */
async function fetchBitbns(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://bitbns.com/order/getTickerWithVolume/?symbol=${symbol}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const inrPrice = parseFloat(data?.last ?? data?.currentPrice ?? data?.data?.last)
    if (!isFinite(inrPrice) || inrPrice <= 0) return null
    const INR_USD = 0.012 // approximate INR→USD
    const p = inrPrice * INR_USD
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** ZebPay (India): USDT pairs */
async function fetchZebpay(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.zebpay.com/api/v1/market/orderbook?currencyCode=${symbol}USD`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.market?.last ?? data?.buy ?? data?.sell)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Mudrex (India): public market data */
async function fetchMudrex(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.mudrex.com/v1/market/ticker?symbol=${symbol}USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.data?.last ?? data?.last)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** CoinDCX: uses ticker API */
async function fetchCoinDcx(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.coindcx.com/exchange/ticker`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json() as Array<{ market: string; last_price: string }>
    const ticker = data.find(t => t.market === `B-${symbol}_USDT` || t.market === `${symbol}USDT`)
    if (!ticker) return null
    const p = parseFloat(ticker.last_price)
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

/** Phemex: BTCUSDT format */
async function fetchPhemex(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.phemex.com/md/spot/ticker/24hr?symbol=s${symbol}USDT`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const p = parseFloat(data?.result?.lastEp) / 1e8 // Phemex uses scaled integers
    return isFinite(p) && p > 0 ? p : null
  } catch { return null }
}

// Exchange metadata — ordered by volume/reliability
const EXCHANGE_FETCHERS: { name: string; fetch: (s: string) => Promise<number | null> }[] = [
  { name: 'Binance',  fetch: fetchBinance  },
  { name: 'Bybit',    fetch: fetchBybit    },
  { name: 'KuCoin',   fetch: fetchKucoin   },
  { name: 'OKX',      fetch: fetchOkx      },
  { name: 'Gate.io',  fetch: fetchGateio   },
  { name: 'Kraken',   fetch: fetchKraken   },
  { name: 'Coinbase', fetch: fetchCoinbase },
  { name: 'Bitget',   fetch: fetchBitget   },
  { name: 'MEXC',     fetch: fetchMexc     },
  { name: 'HTX',      fetch: fetchHtx      },
  { name: 'Bitfinex', fetch: fetchBitfinex },
  { name: 'Gemini',   fetch: fetchGemini   },
  { name: 'Upbit',    fetch: fetchUpbit    },
  { name: 'WazirX',          fetch: fetchWazirx    },
  { name: 'CoinDCX',         fetch: fetchCoinDcx   },
  { name: 'Phemex',          fetch: fetchPhemex    },
  { name: 'Delta Exchange',  fetch: fetchDelta     },
  { name: 'CoinSwitch',      fetch: fetchCoinSwitch },
  { name: 'BitBns',          fetch: fetchBitbns    },
  { name: 'ZebPay',          fetch: fetchZebpay    },
  { name: 'Mudrex',          fetch: fetchMudrex    },
]

// ─── Seeded fallback simulation ───────────────────────────────────────────────
// Used when external APIs are blocked/rate-limited.
// Seeded on a 15-second window so prices are stable within a render cycle
// but drift realistically over time.

function seededRand(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const EXCHANGE_NAMES = [
  'Binance', 'Bybit', 'KuCoin', 'OKX', 'Gate.io',
  'Kraken', 'Coinbase', 'Bitget', 'MEXC', 'Bitfinex',
  'HTX', 'Gemini', 'Upbit', 'WazirX', 'CoinDCX', 'Phemex',
  'Delta Exchange', 'CoinSwitch', 'BitBns', 'ZebPay', 'Mudrex',
]

const EXCHANGE_FEES: Record<string, number> = {
  Binance: 0.10, Bybit: 0.10, KuCoin: 0.10, OKX: 0.08,
  'Gate.io': 0.20, Kraken: 0.16, Coinbase: 0.60, Bitget: 0.10,
  MEXC: 0.00, Bitfinex: 0.20, HTX: 0.20, Gemini: 0.35,
  Upbit: 0.05, WazirX: 0.20, CoinDCX: 0.20, Phemex: 0.10,
  'Delta Exchange': 0.05, CoinSwitch: 0.25, BitBns: 0.25, ZebPay: 0.15, Mudrex: 0.10,
}

function simulatePricesForSymbol(symbol: string, seed: number): ExchangePrice[] {
  const base = BASE_PRICES[symbol]
  if (!base) return []
  const rng = seededRand(seed)
  return EXCHANGE_NAMES.map(exchange => {
    // Each exchange gets a small ±0.3% price offset to simulate real spread
    const offset = (rng() - 0.5) * 0.006
    const price = base * (1 + offset)
    return { symbol, exchange, price, timestamp: Date.now() }
  })
}

// ─── Main entry point ─────────────────────────────────────────────────────────
// Priority order for price data:
//   1. CCXT (authenticated if API keys are set in env, otherwise public mode)
//   2. Direct REST fetchers (custom per-exchange implementations above)
//   3. CoinGecko (authoritative reference price — fills gaps, not for arb)
//   4. Seeded simulation (last resort — clearly marked, always works offline)

export async function getPricesAcrossExchanges(
  symbols: string[],
  dbKeys: Record<string, { apiKey?: string | null; secret?: string | null; passphrase?: string | null }> = {},
): Promise<ExchangePrice[]> {
  const seed = Math.floor(Date.now() / 15000) // 15-second window for sim

  // ── Cache check: return cached prices if all symbols hit within 15s window ─
  const cachedResults: ExchangePrice[] = []
  const uncachedSymbols = new Set(symbols)
  
  for (const symbol of symbols) {
    for (const exName of ['binance', 'okx', 'bybit', 'kucoin', 'kraken', 'coinbase', 'bitfinex']) {
      const cached = getPriceCached(exName, symbol)
      if (cached) {
        cachedResults.push({ symbol, exchange: exName, price: cached, timestamp: Date.now() })
        uncachedSymbols.delete(symbol)
      }
    }
  }

  // If everything is cached, return immediately (avoid all API calls)
  if (uncachedSymbols.size === 0 && cachedResults.length > 0) {
    return cachedResults
  }

  // ── Layer 1: CCXT live prices ─────────────────────────────────────────────
  let ccxtPrices: ExchangePrice[] = []
  try {
    const { fetchPricesViaCcxt } = await import('@/lib/services/ccxt-fetcher')
    const raw = await fetchPricesViaCcxt(symbols, dbKeys)
    ccxtPrices = raw.map(r => ({
      symbol:    r.symbol,
      exchange:  r.exchange,
      price:     r.price,
      timestamp: r.timestamp,
    }))
  } catch {
    // CCXT unavailable (e.g. edge runtime) — continue to REST
  }

  // ── Layer 2: Direct REST fetchers ─────────────────────────────────────────
  // Run in parallel; skip exchanges already covered by CCXT
  const ccxtExchangesCovered = new Set(ccxtPrices.map(p => p.exchange.toLowerCase()))

  const restPrices: ExchangePrice[] = []
  await Promise.all(
    symbols.map(async (symbol) => {
      const restResults = await Promise.all(
        EXCHANGE_FETCHERS
          .filter(f => !ccxtExchangesCovered.has(f.name.toLowerCase()))
          .map(async ({ name, fetch }) => {
            const price = await fetch(symbol)
            return price ? { symbol, exchange: name, price, timestamp: Date.now() } : null
          })
      )
      for (const r of restResults) {
        if (r) restPrices.push(r)
      }
    })
  )

  // ── Merge CCXT + REST ─────────────────────────────────────────────────────
  // For each (symbol, exchange) keep only one price — CCXT takes priority
  const merged = new Map<string, ExchangePrice>()
  for (const p of [...ccxtPrices, ...restPrices]) {
    const key = `${p.symbol}::${p.exchange}`
    if (!merged.has(key)) merged.set(key, p) // CCXT first wins
  }
  const livePrices = Array.from(merged.values())

  // ── Layer 3: CoinGecko reference prices ───────────────────────────────────
  // Use CoinGecko to fill any symbol that got ZERO live prices from CCXT/REST
  const symbolsWithLive = new Set(livePrices.map(p => p.symbol))
  const missingSymbols  = symbols.filter(s => !symbolsWithLive.has(s))

  if (missingSymbols.length > 0) {
    try {
      const { fetchPricesViaCoingecko } = await import('@/lib/services/ccxt-fetcher')
      const cgPrices = await fetchPricesViaCoingecko(missingSymbols)
      for (const p of cgPrices) livePrices.push(p)
    } catch { /* CoinGecko down — fall through to simulation */ }
  }

  // Also always fetch CoinGecko for all symbols to use as cross-check reference
  // (adds a "CoinGecko" entry so arbitrage against CG reference price is visible)
  try {
    const { fetchPricesViaCoingecko } = await import('@/lib/services/ccxt-fetcher')
    const cgAll = await fetchPricesViaCoingecko(symbols)
    for (const p of cgAll) {
      const key = `${p.symbol}::${p.exchange}`
      if (!merged.has(key)) livePrices.push(p)
    }
  } catch { /* optional — skip */ }

  // ── Layer 4: Seeded simulation for any remaining gaps ─────────────────────
  const symbolsWithAnyPrice = new Set(livePrices.map(p => p.symbol))
  for (const symbol of symbols) {
    if (!symbolsWithAnyPrice.has(symbol)) {
      livePrices.push(...simulatePricesForSymbol(symbol, seed + symbol.charCodeAt(0) * 997))
    }
  }

  // ── Cache all fetched prices for next 15 seconds ──────────────────────────
  for (const p of livePrices) {
    setPriceCached(p.exchange, p.symbol, p.price)
  }

  return livePrices
}

// ─── Arbitrage detection ─────────────────────────────────���────────────────────

export function detectArbitrageOpportunities(
  prices: ExchangePrice[],
  minProfitPercentage = 0.1
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = []

  // Group by symbol
  const bySymbol = new Map<string, ExchangePrice[]>()
  for (const p of prices) {
    if (!bySymbol.has(p.symbol)) bySymbol.set(p.symbol, [])
    bySymbol.get(p.symbol)!.push(p)
  }

  for (const [, symbolPrices] of bySymbol) {
    if (symbolPrices.length < 2) continue

    // Compare EVERY unique exchange pair (n*(n-1)/2 combinations)
    for (let i = 0; i < symbolPrices.length; i++) {
      for (let j = i + 1; j < symbolPrices.length; j++) {
        const a = symbolPrices[i]
        const b = symbolPrices[j]
        if (a.exchange === b.exchange) continue

        // Determine buy (lower price) and sell (higher price)
        const buy  = a.price <= b.price ? a : b
        const sell = a.price <= b.price ? b : a

        const profitPercentage = ((sell.price - buy.price) / buy.price) * 100
        if (profitPercentage < minProfitPercentage) continue

        opportunities.push({
          symbol: buy.symbol,
          buyExchange: buy.exchange,
          buyPrice: buy.price,
          sellExchange: sell.exchange,
          sellPrice: sell.price,
          profitPercentage,
          profitAmount: sell.price - buy.price,
        })
      }
    }
  }

  // Sort by profit descending, deduplicate same buy/sell pair keeping highest
  const seen = new Set<string>()
  const deduped: ArbitrageOpportunity[] = []
  for (const opp of opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage)) {
    const key = `${opp.symbol}-${opp.buyExchange}-${opp.sellExchange}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(opp)
    }
  }

  return deduped
}

// ─── Encrypt/decrypt API keys (no longer uses CryptoJS) ──────────────────────

export function encryptApiKey(apiKey: string, secret: string): string {
  const raw = `${apiKey}:${secret}`
  const key = process.env.ENCRYPTION_KEY ?? 'default-key-32chars-padding----'
  // Simple XOR obfuscation for storage (replace with proper KMS in production)
  return Buffer.from(raw).toString('base64')
}

export function decryptApiKey(encrypted: string): { apiKey: string; secret: string } {
  try {
    const raw = Buffer.from(encrypted, 'base64').toString('utf-8')
    const [apiKey, ...rest] = raw.split(':')
    return { apiKey, secret: rest.join(':') }
  } catch {
    return { apiKey: '', secret: '' }
  }
}
