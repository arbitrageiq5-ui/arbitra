import axios from 'axios'
import CryptoJS from 'crypto-js'

const EXCHANGES = {
  binance: 'https://api.binance.com',
  kraken: 'https://api.kraken.com',
  coinbase: 'https://api.coinbase.com',
  bybit: 'https://api.bybit.com',
  kucoin: 'https://api.kucoin.com',
  huobi: 'https://api.huobi.pro',
  coingecko: 'https://api.coingecko.com/api/v3',
  bitfinex: 'https://api.bitfinex.com/v1',
  okx: 'https://www.okx.com/api/v5',
  gateio: 'https://api.gateio.ws/api/v4',
  gemini: 'https://api.gemini.com/v1',
  cryptocom: 'https://api.crypto.com/v2',
}

const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  MATIC: 'matic-network',
  DOT: 'polkadot',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  LTC: 'litecoin',
  NEAR: 'near',
  FIL: 'filecoin',
  ICP: 'internet-computer',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  SUI: 'sui',
  AAVE: 'aave',
  CRV: 'curve-dao-token',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  TON: 'the-open-network',
}

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

// Binance Price Fetcher
async function getBinancePrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.binance}/api/v3/ticker/price`, {
      params: { symbol: symbol.toUpperCase() },
      timeout: 5000,
    })
    return {
      symbol,
      exchange: 'binance',
      price: parseFloat(response.data.price),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Kraken Price Fetcher
async function getKrakenPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const krakenSymbol = symbol.toUpperCase()
    const response = await axios.get(`${EXCHANGES.kraken}/0/public/Ticker`, {
      params: { pair: krakenSymbol },
      timeout: 5000,
    })
    const data = Object.values(response.data.result as Record<string, any>)[0]
    return {
      symbol,
      exchange: 'kraken',
      price: parseFloat(data.c[0]),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Coinbase Price Fetcher
async function getCoinbasePrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const pair = `${symbol.toUpperCase()}-USD`
    const response = await axios.get(
      `${EXCHANGES.coinbase}/v2/prices/${pair}/spot`,
      { timeout: 5000 }
    )
    return {
      symbol,
      exchange: 'coinbase',
      price: parseFloat(response.data.data.amount),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Bybit Price Fetcher
async function getBybitPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.bybit}/v5/market/tickers`, {
      params: { category: 'spot', symbol: symbol.toUpperCase() },
      timeout: 5000,
    })
    return {
      symbol,
      exchange: 'bybit',
      price: parseFloat(response.data.result.list[0].lastPrice),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Kucoin Price Fetcher
async function getKucoinPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.kucoin}/api/v1/market/orderbook/level1`, {
      params: { symbol: `${symbol.toUpperCase()}-USDT` },
      timeout: 5000,
    })
    return {
      symbol,
      exchange: 'kucoin',
      price: parseFloat(response.data.data.price),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Huobi Price Fetcher
async function getHuobiPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.huobi}/market/detail`, {
      params: { symbol: `${symbol.toLowerCase()}usdt` },
      timeout: 5000,
    })
    return {
      symbol,
      exchange: 'huobi',
      price: response.data.tick.close,
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// CoinGecko Price Fetcher (free, reliable, no auth needed)
async function getCoinGeckoPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const coinGeckoId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()]
    if (!coinGeckoId) return null

    const response = await axios.get(`${EXCHANGES.coingecko}/simple/price`, {
      params: {
        ids: coinGeckoId,
        vs_currencies: 'usd',
        include_market_cap: false,
        include_24hr_vol: false,
      },
      timeout: 5000,
    })

    const price = response.data[coinGeckoId]?.usd
    if (!price) return null

    return {
      symbol,
      exchange: 'coingecko',
      price,
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Bitfinex Price Fetcher
async function getBitfinexPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.bitfinex}/pubticker/${symbol.toUpperCase()}USD`, {
      timeout: 5000,
    })
    return {
      symbol,
      exchange: 'bitfinex',
      price: parseFloat(response.data.last_price),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// OKX Price Fetcher
async function getOkxPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.okx}/market/ticker`, {
      params: {
        instId: `${symbol.toUpperCase()}-USD`,
      },
      timeout: 5000,
    })
    const data = response.data.data[0]
    return {
      symbol,
      exchange: 'okx',
      price: parseFloat(data.last),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Gate.io Price Fetcher
async function getGateioPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.gateio}/spot/tickers`, {
      params: {
        currency_pair: `${symbol.toUpperCase()}_USDT`,
      },
      timeout: 5000,
    })
    const data = response.data[0]
    return {
      symbol,
      exchange: 'gate.io',
      price: parseFloat(data.last),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Gemini Price Fetcher
async function getGeminiPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.gemini}/pubticker/${symbol.toUpperCase()}USD`, {
      timeout: 5000,
    })
    return {
      symbol,
      exchange: 'gemini',
      price: parseFloat(response.data.last),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Crypto.com Price Fetcher
async function getCryptocomPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const response = await axios.get(`${EXCHANGES.cryptocom}/public/instrument-detail`, {
      params: {
        instrument_name: `${symbol.toUpperCase()}_USD`,
      },
      timeout: 5000,
    })
    const data = response.data.result[0]
    return {
      symbol,
      exchange: 'crypto.com',
      price: parseFloat(data.index_price || data.mark_price),
      timestamp: Date.now(),
    }
  } catch {
    return null
  }
}

// Get prices from all exchanges (LIVE rates from 11 sources)
export async function getPricesAcrossExchanges(
  symbols: string[]
): Promise<ExchangePrice[]> {
  const prices: ExchangePrice[] = []

  for (const symbol of symbols) {
    // Fetch from all 11 sources in parallel for maximum coverage
    const [
      coingecko,
      binance,
      kraken,
      coinbase,
      bybit,
      kucoin,
      huobi,
      bitfinex,
      okx,
      gateio,
      gemini,
      cryptocom,
    ] = await Promise.all([
      getCoinGeckoPrice(symbol),
      getBinancePrice(symbol),
      getKrakenPrice(symbol),
      getCoinbasePrice(symbol),
      getBybitPrice(symbol),
      getKucoinPrice(symbol),
      getHuobiPrice(symbol),
      getBitfinexPrice(symbol),
      getOkxPrice(symbol),
      getGateioPrice(symbol),
      getGeminiPrice(symbol),
      getCryptocomPrice(symbol),
    ])

    if (coingecko) prices.push(coingecko)
    if (binance) prices.push(binance)
    if (kraken) prices.push(kraken)
    if (coinbase) prices.push(coinbase)
    if (bybit) prices.push(bybit)
    if (kucoin) prices.push(kucoin)
    if (huobi) prices.push(huobi)
    if (bitfinex) prices.push(bitfinex)
    if (okx) prices.push(okx)
    if (gateio) prices.push(gateio)
    if (gemini) prices.push(gemini)
    if (cryptocom) prices.push(cryptocom)
  }

  return prices
}

// Detect arbitrage opportunities
export function detectArbitrageOpportunities(
  prices: ExchangePrice[],
  minProfitPercentage: number = 0.5
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = []
  const pricesBySymbol = new Map<string, Map<string, number>>()

  // Group prices by symbol and exchange
  for (const price of prices) {
    if (!pricesBySymbol.has(price.symbol)) {
      pricesBySymbol.set(price.symbol, new Map())
    }
    pricesBySymbol.get(price.symbol)!.set(price.exchange, price.price)
  }

  // Find arbitrage opportunities
  for (const [symbol, exchangePrices] of pricesBySymbol) {
    const exchanges = Array.from(exchangePrices.entries())

    for (let i = 0; i < exchanges.length; i++) {
      for (let j = i + 1; j < exchanges.length; j++) {
        const [exchange1, price1] = exchanges[i]
        const [exchange2, price2] = exchanges[j]

        // Check both directions
        if (price1 < price2) {
          const profitPercentage = ((price2 - price1) / price1) * 100
          if (profitPercentage >= minProfitPercentage) {
            opportunities.push({
              symbol,
              buyExchange: exchange1,
              buyPrice: price1,
              sellExchange: exchange2,
              sellPrice: price2,
              profitPercentage,
              profitAmount: price2 - price1,
            })
          }
        } else {
          const profitPercentage = ((price1 - price2) / price2) * 100
          if (profitPercentage >= minProfitPercentage) {
            opportunities.push({
              symbol,
              buyExchange: exchange2,
              buyPrice: price2,
              sellExchange: exchange1,
              sellPrice: price1,
              profitPercentage,
              profitAmount: price1 - price2,
            })
          }
        }
      }
    }
  }

  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage)
}

// Encrypt sensitive data
export function encryptApiKey(apiKey: string, secret: string): string {
  return CryptoJS.AES.encrypt(apiKey + ':' + secret, process.env.ENCRYPTION_KEY || 'default-key').toString()
}

// Decrypt sensitive data
export function decryptApiKey(encrypted: string): { apiKey: string; secret: string } {
  const decrypted = CryptoJS.AES.decrypt(encrypted, process.env.ENCRYPTION_KEY || 'default-key').toString(CryptoJS.enc.Utf8)
  const [apiKey, secret] = decrypted.split(':')
  return { apiKey, secret }
}
