import axios from 'axios'
import CryptoJS from 'crypto-js'

const EXCHANGES = {
  binance: 'https://api.binance.com',
  kraken: 'https://api.kraken.com',
  coinbase: 'https://api.coinbase.com',
  bybit: 'https://api.bybit.com',
  kucoin: 'https://api.kucoin.com',
  huobi: 'https://api.huobi.pro',
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

// Get prices from all exchanges
export async function getPricesAcrossExchanges(
  symbols: string[]
): Promise<ExchangePrice[]> {
  const prices: ExchangePrice[] = []

  for (const symbol of symbols) {
    const [binance, kraken, coinbase, bybit, kucoin, huobi] = await Promise.all([
      getBinancePrice(symbol),
      getKrakenPrice(symbol),
      getCoinbasePrice(symbol),
      getBybitPrice(symbol),
      getKucoinPrice(symbol),
      getHuobiPrice(symbol),
    ])

    if (binance) prices.push(binance)
    if (kraken) prices.push(kraken)
    if (coinbase) prices.push(coinbase)
    if (bybit) prices.push(bybit)
    if (kucoin) prices.push(kucoin)
    if (huobi) prices.push(huobi)
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
