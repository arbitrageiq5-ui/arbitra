'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { exchangeApiKeys, arbitrageConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getPricesAcrossExchanges, detectArbitrageOpportunities, ExchangePrice } from '@/lib/services/exchanges'
import OpenAI from 'openai'

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const role = (session.user as unknown as { role?: string })?.role
  if (role !== 'admin') throw new Error('Admin only')
  return session.user
}

// ─── Types ─────────────────────────────────────────────────────────────────

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
  profitPer1k: number
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

export interface TransferRoute {
  fromExchange: string
  toExchange: string
  symbol: string
  network: 'TRC20' | 'BEP20' | 'ERC20' | 'SOL' | 'BTC' | 'BNB' | 'AVAX'
  estimatedFee: number
  estimatedTimeMin: number
}

export interface ExchangeApiKey {
  id: number
  exchange: string
  label: string
  apiKey: string | null
  apiSecret: string | null
  passphrase: string | null
  isEnabled: boolean
  isPublicOnly: boolean
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestMs: number | null
  note: string | null
}

// ─── EXCHANGE API KEY MANAGEMENT ───────────────────────────────────────────

const ALL_EXCHANGES = [
  { exchange: 'binance',    label: 'Binance',    url: 'https://api.binance.com',        hasPassphrase: false },
  { exchange: 'kraken',     label: 'Kraken',     url: 'https://api.kraken.com',         hasPassphrase: false },
  { exchange: 'coinbase',   label: 'Coinbase',   url: 'https://api.coinbase.com',       hasPassphrase: false },
  { exchange: 'bybit',      label: 'Bybit',      url: 'https://api.bybit.com',          hasPassphrase: false },
  { exchange: 'kucoin',     label: 'KuCoin',     url: 'https://api.kucoin.com',         hasPassphrase: true  },
  { exchange: 'htx',        label: 'HTX (Huobi)',url: 'https://api.huobi.pro',          hasPassphrase: false },
  { exchange: 'bitfinex',   label: 'Bitfinex',   url: 'https://api.bitfinex.com',       hasPassphrase: false },
  { exchange: 'okx',        label: 'OKX',        url: 'https://www.okx.com/api/v5',     hasPassphrase: true  },
  { exchange: 'gateio',     label: 'Gate.io',    url: 'https://api.gateio.ws/api/v4',   hasPassphrase: false },
  { exchange: 'gemini',     label: 'Gemini',     url: 'https://api.gemini.com',         hasPassphrase: false },
  { exchange: 'cryptocom',  label: 'Crypto.com', url: 'https://api.crypto.com/v2',      hasPassphrase: false },
  { exchange: 'bitget',     label: 'Bitget',     url: 'https://api.bitget.com/v2',      hasPassphrase: true  },
  { exchange: 'coingecko',  label: 'CoinGecko',  url: 'https://api.coingecko.com/api/v3', hasPassphrase: false },
]

export async function getExchangeApiKeys(): Promise<ExchangeApiKey[]> {
  await requireAdmin()
  const rows = await db.select().from(exchangeApiKeys)

  // Merge DB rows with the full list so every exchange always appears
  return ALL_EXCHANGES.map(ex => {
    const row = rows.find(r => r.exchange === ex.exchange)
    return {
      id: row?.id ?? 0,
      exchange: ex.exchange,
      label: ex.label,
      apiKey: row?.apiKey ? '••••••••' + row.apiKey.slice(-4) : null,
      apiSecret: row?.apiSecret ? '••••••••' : null,
      passphrase: row?.passphrase ? '••••••••' : null,
      isEnabled: row?.isEnabled ?? true,
      isPublicOnly: row?.isPublicOnly ?? true,
      lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: row?.lastTestStatus ?? null,
      lastTestMs: row?.lastTestMs ?? null,
      note: row?.note ?? null,
    }
  })
}

export async function saveExchangeApiKey(data: {
  exchange: string
  apiKey?: string
  apiSecret?: string
  passphrase?: string
  isEnabled: boolean
  isPublicOnly: boolean
  note?: string
}): Promise<void> {
  const admin = await requireAdmin()

  const existing = await db.select().from(exchangeApiKeys)
    .where(eq(exchangeApiKeys.exchange, data.exchange))
    .limit(1)

  const exMeta = ALL_EXCHANGES.find(e => e.exchange === data.exchange)
  const label = exMeta?.label ?? data.exchange

  if (existing.length > 0) {
    await db.update(exchangeApiKeys)
      .set({
        label,
        ...(data.apiKey    ? { apiKey: data.apiKey }       : {}),
        ...(data.apiSecret ? { apiSecret: data.apiSecret } : {}),
        ...(data.passphrase? { passphrase: data.passphrase}: {}),
        isEnabled: data.isEnabled,
        isPublicOnly: data.isPublicOnly,
        note: data.note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(exchangeApiKeys.exchange, data.exchange))
  } else {
    await db.insert(exchangeApiKeys).values({
      exchange: data.exchange,
      label,
      apiKey: data.apiKey ?? null,
      apiSecret: data.apiSecret ?? null,
      passphrase: data.passphrase ?? null,
      isEnabled: data.isEnabled,
      isPublicOnly: data.isPublicOnly,
      note: data.note ?? null,
    })
  }
}

export async function toggleExchangeEnabled(exchange: string, enabled: boolean): Promise<void> {
  await requireAdmin()
  const existing = await db.select().from(exchangeApiKeys)
    .where(eq(exchangeApiKeys.exchange, exchange)).limit(1)

  const exMeta = ALL_EXCHANGES.find(e => e.exchange === exchange)
  if (existing.length > 0) {
    await db.update(exchangeApiKeys).set({ isEnabled: enabled, updatedAt: new Date() })
      .where(eq(exchangeApiKeys.exchange, exchange))
  } else {
    await db.insert(exchangeApiKeys).values({
      exchange,
      label: exMeta?.label ?? exchange,
      isEnabled: enabled,
      isPublicOnly: true,
    })
  }
}

export async function testExchangeConnection(exchange: string): Promise<{
  ok: boolean
  latencyMs: number
  message: string
}> {
  await requireAdmin()

  const TEST_URLS: Record<string, string> = {
    binance:   'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    kraken:    'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
    coinbase:  'https://api.coinbase.com/v2/prices/BTC-USD/spot',
    bybit:     'https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT',
    kucoin:    'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=BTC-USDT',
    htx:       'https://api.huobi.pro/market/detail?symbol=btcusdt',
    bitfinex:  'https://api.bitfinex.com/v1/pubticker/BTCUSD',
    okx:       'https://www.okx.com/api/v5/market/ticker?instId=BTC-USD',
    gateio:    'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=BTC_USDT',
    gemini:    'https://api.gemini.com/v1/pubticker/BTCUSD',
    cryptocom: 'https://api.crypto.com/v2/public/get-ticker?instrument_name=BTC_USD',
    bitget:    'https://api.bitget.com/v2/public/spot/tickers?symbol=BTCUSDT',
    coingecko: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
  }

  const url = TEST_URLS[exchange]
  if (!url) return { ok: false, latencyMs: 0, message: 'Unknown exchange' }

  const start = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const ms = Date.now() - start
    const ok = res.ok

    // Persist test result
    const existing = await db.select().from(exchangeApiKeys)
      .where(eq(exchangeApiKeys.exchange, exchange)).limit(1)
    const exMeta = ALL_EXCHANGES.find(e => e.exchange === exchange)

    if (existing.length > 0) {
      await db.update(exchangeApiKeys).set({
        lastTestedAt: new Date(), lastTestStatus: ok ? 'ok' : 'error', lastTestMs: ms, updatedAt: new Date(),
      }).where(eq(exchangeApiKeys.exchange, exchange))
    } else {
      await db.insert(exchangeApiKeys).values({
        exchange, label: exMeta?.label ?? exchange, isEnabled: true, isPublicOnly: true,
        lastTestedAt: new Date(), lastTestStatus: ok ? 'ok' : 'error', lastTestMs: ms,
      })
    }

    return { ok, latencyMs: ms, message: ok ? `Connected (${ms}ms)` : `HTTP ${res.status}` }
  } catch (err) {
    const ms = Date.now() - start
    return { ok: false, latencyMs: ms, message: err instanceof Error ? err.message : 'Connection failed' }
  }
}

export async function testAllExchanges(): Promise<Record<string, { ok: boolean; latencyMs: number; message: string }>> {
  await requireAdmin()
  const results = await Promise.all(
    ALL_EXCHANGES.map(async ex => ({
      exchange: ex.exchange,
      result: await testExchangeConnection(ex.exchange),
    }))
  )
  return Object.fromEntries(results.map(r => [r.exchange, r.result]))
}

// ─── LIVE PRICE SCAN ────────────────────────────────────────────────────────

const EXCHANGE_DISPLAY_NAMES: Record<string, string> = {
  binance: 'Binance', kraken: 'Kraken', coinbase: 'Coinbase', bybit: 'Bybit',
  kucoin: 'KuCoin', huobi: 'HTX (Huobi)', bitfinex: 'Bitfinex', okx: 'OKX',
  'gate.io': 'Gate.io', gemini: 'Gemini', 'crypto.com': 'Crypto.com', bitget: 'Bitget',
  coingecko: 'CoinGecko',
}

export async function adminFetchLivePrices(symbols: string[]): Promise<{
  prices: AdminLivePrice[]
  opportunities: AdminArbitrageOpp[]
  exchangeStatuses: ExchangeStatus[]
}> {
  await requireAdmin()

  const start = Date.now()
  let livePrices: ExchangePrice[] = []
  try {
    livePrices = await getPricesAcrossExchanges(symbols)
  } catch {
    livePrices = []
  }

  // Build per-exchange status
  const exchangeMap: Record<string, { count: number }> = {}
  livePrices.forEach(p => {
    const key = p.exchange.toLowerCase()
    if (!exchangeMap[key]) exchangeMap[key] = { count: 0 }
    exchangeMap[key].count++
  })
  const totalMs = Date.now() - start

  const allExchangeKeys = Object.keys(EXCHANGE_DISPLAY_NAMES)
  const exchangeStatuses: ExchangeStatus[] = allExchangeKeys.map(key => ({
    name: key,
    label: EXCHANGE_DISPLAY_NAMES[key] ?? key,
    online: !!exchangeMap[key],
    latencyMs: totalMs,
    pricesFetched: exchangeMap[key]?.count ?? 0,
    lastChecked: new Date().toISOString(),
  }))

  // Detect opportunities
  const rawOpps = detectArbitrageOpportunities(livePrices, 0.3)
  const opportunities: AdminArbitrageOpp[] = rawOpps.map((opp, idx) => {
    const netProfitPct = Math.max(0, opp.profitPercentage - 0.2)
    return {
      id: `${opp.symbol}-${opp.buyExchange}-${opp.sellExchange}-${Date.now()}-${idx}`,
      symbol: opp.symbol,
      buyExchange: opp.buyExchange.charAt(0).toUpperCase() + opp.buyExchange.slice(1),
      buyPrice: opp.buyPrice,
      sellExchange: opp.sellExchange.charAt(0).toUpperCase() + opp.sellExchange.slice(1),
      sellPrice: opp.sellPrice,
      profitPct: parseFloat(opp.profitPercentage.toFixed(4)),
      netProfitPct: parseFloat(netProfitPct.toFixed(4)),
      profitPer1k: parseFloat(((netProfitPct / 100) * 1000).toFixed(2)),
      detectedAt: new Date().toISOString(),
    }
  })

  return { prices: livePrices, opportunities, exchangeStatuses }
}

// ─── AI AUTO SETUP ──────────────────────────────────────────────────────────

export interface AiArbitrageStrategy {
  summary: string
  recommendedPairs: Array<{
    symbol: string
    buyExchange: string
    sellExchange: string
    reason: string
    estimatedSpread: string
    risk: 'Low' | 'Medium' | 'High'
  }>
  recommendedNetworks: Array<{
    network: string
    useCase: string
    avgFeeUsd: string
    avgTimeMin: string
  }>
  scanSettings: {
    intervalSeconds: number
    minProfitPct: number
    maxRisk: string
    coinsToFocus: string[]
  }
  warnings: string[]
  generatedAt: string
}

export async function generateAiArbitrageStrategy(context?: string): Promise<AiArbitrageStrategy> {
  await requireAdmin()

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const systemPrompt = `You are an expert cryptocurrency arbitrage strategist with deep knowledge of exchange APIs, trading fees, and market microstructure. You analyze cross-exchange price differences and recommend optimal arbitrage setups.

Respond ONLY with valid JSON matching the exact schema provided. Do not add any markdown, explanation, or text outside the JSON.`

  const userPrompt = `Generate a complete arbitrage strategy recommendation for a crypto trading platform.

Available exchanges: Binance, Kraken, Coinbase, Bybit, KuCoin, HTX, Bitfinex, OKX, Gate.io, Gemini, Crypto.com, Bitget, CoinGecko (aggregator)
Available transfer networks: TRC20 (USDT), BEP20 (BNB chain), ERC20 (Ethereum), Solana, Bitcoin, Avalanche C-Chain
${context ? `Additional context from admin: ${context}` : ''}
Current date: ${new Date().toISOString()}

Return JSON with this exact structure:
{
  "summary": "2-3 sentence strategy overview",
  "recommendedPairs": [
    {
      "symbol": "BTC",
      "buyExchange": "Binance",
      "sellExchange": "Kraken",
      "reason": "Why this pair",
      "estimatedSpread": "0.15-0.45%",
      "risk": "Low"
    }
  ],
  "recommendedNetworks": [
    {
      "network": "TRC20",
      "useCase": "USDT transfers — fastest and cheapest",
      "avgFeeUsd": "$1",
      "avgTimeMin": "1-2"
    }
  ],
  "scanSettings": {
    "intervalSeconds": 30,
    "minProfitPct": 0.5,
    "maxRisk": "Medium",
    "coinsToFocus": ["BTC", "ETH", "SOL"]
  },
  "warnings": ["Warning 1", "Warning 2"]
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as Omit<AiArbitrageStrategy, 'generatedAt'>

    const strategy: AiArbitrageStrategy = { ...parsed, generatedAt: new Date().toISOString() }

    // Persist strategy to DB
    const existing = await db.select().from(arbitrageConfig)
      .where(eq(arbitrageConfig.configKey, 'ai_strategy')).limit(1)
    if (existing.length > 0) {
      await db.update(arbitrageConfig).set({ configValue: strategy as unknown as Record<string, unknown>, updatedAt: new Date() })
        .where(eq(arbitrageConfig.configKey, 'ai_strategy'))
    } else {
      await db.insert(arbitrageConfig).values({ configKey: 'ai_strategy', configValue: strategy as unknown as Record<string, unknown> })
    }

    return strategy
  } catch (err) {
    // Fallback strategy if OpenAI is unavailable
    return {
      summary: 'AI strategy generation failed. Using default conservative settings. Ensure OPENAI_API_KEY is set in environment variables.',
      recommendedPairs: [
        { symbol: 'BTC',  buyExchange: 'Binance',  sellExchange: 'Kraken',  reason: 'High liquidity, low fees on both exchanges', estimatedSpread: '0.1-0.5%', risk: 'Low' },
        { symbol: 'ETH',  buyExchange: 'Coinbase', sellExchange: 'Bybit',   reason: 'Significant spread due to regional demand', estimatedSpread: '0.2-0.8%', risk: 'Low' },
        { symbol: 'SOL',  buyExchange: 'Binance',  sellExchange: 'OKX',     reason: 'Fast settlement, low transfer cost on Solana network', estimatedSpread: '0.3-1.2%', risk: 'Medium' },
        { symbol: 'USDT', buyExchange: 'KuCoin',   sellExchange: 'Gate.io', reason: 'Stablecoin arbitrage: predictable, minimal slippage', estimatedSpread: '0.05-0.2%', risk: 'Low' },
      ],
      recommendedNetworks: [
        { network: 'TRC20', useCase: 'USDT transfers — fastest and cheapest', avgFeeUsd: '$1', avgTimeMin: '1-2' },
        { network: 'BEP20', useCase: 'BNB chain — low fees, broad exchange support', avgFeeUsd: '$0.50', avgTimeMin: '2-3' },
        { network: 'Solana', useCase: 'SOL/SPL tokens — near-instant, $0.001 fees', avgFeeUsd: '$0.001', avgTimeMin: '<1' },
        { network: 'ERC20', useCase: 'ETH/ERC20 tokens — high security, higher fees', avgFeeUsd: '$3-15', avgTimeMin: '3-8' },
      ],
      scanSettings: { intervalSeconds: 30, minProfitPct: 0.5, maxRisk: 'Medium', coinsToFocus: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'USDT'] },
      warnings: ['Set OPENAI_API_KEY environment variable for AI-powered recommendations', 'Always verify spreads manually before executing trades', 'Factor in withdrawal fees for each exchange before calculating net profit'],
      generatedAt: new Date().toISOString(),
    }
  }
}

export async function getSavedAiStrategy(): Promise<AiArbitrageStrategy | null> {
  await requireAdmin()
  const row = await db.select().from(arbitrageConfig)
    .where(eq(arbitrageConfig.configKey, 'ai_strategy')).limit(1)
  if (!row.length) return null
  return row[0].configValue as unknown as AiArbitrageStrategy
}

// ─── TRANSFER ROUTES ────────────────────────────────────────────────────────

export async function getTransferRoutes(
  fromExchange: string,
  toExchange: string,
  symbol: string,
): Promise<TransferRoute[]> {
  await requireAdmin()

  const ASSET_NETWORKS: Record<string, Array<{ network: TransferRoute['network']; fee: number; timeMin: number }>> = {
    USDT: [
      { network: 'TRC20', fee: 1,    timeMin: 1 },
      { network: 'BEP20', fee: 0.5,  timeMin: 3 },
      { network: 'ERC20', fee: 5,    timeMin: 5 },
    ],
    BTC:  [{ network: 'BTC',   fee: 0.0001, timeMin: 30 }],
    ETH:  [{ network: 'ERC20', fee: 0.005,  timeMin: 5  }],
    BNB:  [{ network: 'BEP20', fee: 0.001,  timeMin: 3  }],
    SOL:  [{ network: 'SOL',   fee: 0.001,  timeMin: 1  }],
    XRP:  [{ network: 'TRC20', fee: 0.2,    timeMin: 1  }],
    DOGE: [{ network: 'TRC20', fee: 1,      timeMin: 5  }],
    ADA:  [{ network: 'TRC20', fee: 0.5,    timeMin: 3  }],
    AVAX: [{ network: 'AVAX',  fee: 0.01,   timeMin: 2  }],
    default: [
      { network: 'BEP20', fee: 0.5, timeMin: 3 },
      { network: 'ERC20', fee: 3,   timeMin: 5 },
    ],
  }

  const routes = ASSET_NETWORKS[symbol] ?? ASSET_NETWORKS['default']
  return routes.map(r => ({
    fromExchange, toExchange, symbol,
    network: r.network, estimatedFee: r.fee, estimatedTimeMin: r.timeMin,
  }))
}
