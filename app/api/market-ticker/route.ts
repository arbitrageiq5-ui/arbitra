import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Symbols shown in the trader dashboard header ticker (Binance spot pairs, USDT-quoted)
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOGEUSDT', 'DOTUSDT', 'LINKUSDT']

export type TickerEntry = {
  symbol: string
  price: number
  changePercent: number
}

// In-memory fallback cache so a transient Binance failure doesn't blank the ticker
let lastGood: TickerEntry[] | null = null

// api.binance.com blocks requests from some regions/IPs (HTTP 451). api.binance.us
// is Binance's own US-entity API with an identical response shape, used as a fallback.
const ENDPOINTS = ['https://api.binance.com', 'https://api.binance.us']

async function fetchFromBinance(baseUrl: string, symbolsParam: string) {
  const res = await fetch(`${baseUrl}/api/v3/ticker/24hr?symbols=${symbolsParam}`, {
    signal: AbortSignal.timeout(6000),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`${baseUrl} responded ${res.status}`)
  return res.json() as Promise<Array<{ symbol: string; lastPrice: string; priceChangePercent: string }>>
}

export async function GET() {
  const symbolsParam = encodeURIComponent(JSON.stringify(SYMBOLS))
  let lastError: unknown = null

  for (const baseUrl of ENDPOINTS) {
    try {
      const data = await fetchFromBinance(baseUrl, symbolsParam)

      const entries: TickerEntry[] = data
        .map(d => ({
          symbol: d.symbol.replace('USDT', ''),
          price: parseFloat(d.lastPrice),
          changePercent: parseFloat(d.priceChangePercent),
        }))
        .filter(d => isFinite(d.price) && isFinite(d.changePercent))

      if (entries.length === 0) throw new Error('Empty ticker response')

      // Preserve the requested symbol order
      const order = SYMBOLS.map(s => s.replace('USDT', ''))
      entries.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol))

      lastGood = entries
      return NextResponse.json({ ok: true, data: entries, source: 'binance', updatedAt: Date.now() })
    } catch (err) {
      lastError = err
      // Try the next endpoint
    }
  }

  // All endpoints failed — fall back to last known-good snapshot rather than breaking the header UI
  if (lastGood) {
    return NextResponse.json({ ok: true, data: lastGood, source: 'cache', updatedAt: Date.now() })
  }
  return NextResponse.json(
    { ok: false, data: [], source: 'error', message: lastError instanceof Error ? lastError.message : 'Failed to fetch market data' },
    { status: 502 }
  )
}
