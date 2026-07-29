// Pure utility — no 'use server'. Safe to import from both server actions and client components.

export type BotTradeInput = {
  symbol:            string
  network:           string
  buyExchange:       string
  sellExchange:      string
  buyPrice:          number
  sellPrice:         number
  amount:            number      // qty of coin
  amountUsd:         number      // capital in USD
  riskLevel:         string
  riskScore:         number
  slippagePct?:      number      // max acceptable slippage %
  minNetProfitUsd?:  number      // minimum net profit gate ($)
  destinationAddr?:  string      // wallet address on sell exchange
}

// Network transfer time estimates (minutes)
export const NETWORK_TRANSFER_MINS: Record<string, number> = {
  TRC20:     3,
  BEP20:     3,
  ERC20:     12,
  SOL:       1,
  Polygon:   3,
  Avalanche: 5,
  BTC:       40,
  XRP:       1,
  ADA:       5,
}

// Exchange taker fee estimates (% of trade value)
export const EXCHANGE_TAKER_FEE: Record<string, number> = {
  Binance: 0.10, OKX: 0.08, Bybit: 0.10, KuCoin: 0.10, Kraken: 0.16,
  Coinbase: 0.60, HTX: 0.20, Bitfinex: 0.20, 'Gate.io': 0.20, Gemini: 0.35,
  'Crypto.com': 0.075, Bitget: 0.10, MEXC: 0.00, Phemex: 0.10,
  Poloniex: 0.14, BingX: 0.10, LBank: 0.10, Upbit: 0.05,
  CoinDCX: 0.20, CoinSwitch: 0.30, WazirX: 0.20, BitBns: 0.25,
  ZebPay: 0.20, 'Delta Exchange': 0.05, Mudrex: 0.25,
}

// Network withdrawal fee estimates (USD)
export const NETWORK_WITHDRAW_FEE_USD: Record<string, number> = {
  TRC20: 1.0, BEP20: 0.5, ERC20: 8.0, SOL: 0.1, Polygon: 0.2,
  Avalanche: 0.5, BTC: 5.0, XRP: 0.5, ADA: 0.4,
}

// Minimum confirmations needed per network before considering deposit settled
export const NETWORK_MIN_CONFIRMATIONS: Record<string, number> = {
  TRC20: 19, BEP20: 15, ERC20: 12, SOL: 31, Polygon: 128,
  Avalanche: 35, BTC: 1, XRP: 0, ADA: 10,
}

// Coins supported per network
export const NETWORK_SUPPORTED_COINS: Record<string, string[]> = {
  TRC20:     ['USDT', 'TRX', 'USDC'],
  BEP20:     ['USDT', 'BNB', 'USDC', 'ETH', 'BTC', 'SOL', 'MATIC'],
  ERC20:     ['USDT', 'USDC', 'ETH', 'WBTC', 'DAI', 'LINK', 'UNI'],
  SOL:       ['SOL', 'USDC', 'USDT', 'RAY', 'BONK'],
  Polygon:   ['USDT', 'USDC', 'MATIC', 'ETH', 'WBTC'],
  Avalanche: ['USDT', 'USDC', 'AVAX', 'ETH', 'BTC'],
  BTC:       ['BTC'],
  XRP:       ['XRP'],
  ADA:       ['ADA'],
}

export function computeProfitBreakdown(input: BotTradeInput) {
  const slippage     = (input.slippagePct ?? 0.1) / 100
  // Adjust effective sell price down by slippage
  const effectiveSell = input.sellPrice * (1 - slippage)
  const grossProfitUsd = (effectiveSell - input.buyPrice) * input.amount
  const feeBuyUsd      = (input.amountUsd * (EXCHANGE_TAKER_FEE[input.buyExchange]  ?? 0.2)) / 100
  const feeSellUsd     = (input.amountUsd * (EXCHANGE_TAKER_FEE[input.sellExchange] ?? 0.2)) / 100
  const feeNetworkUsd  = NETWORK_WITHDRAW_FEE_USD[input.network] ?? 2.0
  const totalFeesUsd   = feeBuyUsd + feeSellUsd + feeNetworkUsd
  const netProfitUsd   = grossProfitUsd - totalFeesUsd
  const netProfitPct   = input.amountUsd > 0 ? (netProfitUsd / input.amountUsd) * 100 : 0
  const transferMins   = NETWORK_TRANSFER_MINS[input.network] ?? 10
  const roi            = input.amountUsd > 0 ? (netProfitUsd / input.amountUsd) * 100 : 0
  return {
    grossProfitUsd, feeBuyUsd, feeSellUsd, feeNetworkUsd,
    totalFeesUsd, netProfitUsd, netProfitPct, transferMins, roi,
    effectiveSellPrice: effectiveSell,
    breakEvenSpreadPct: totalFeesUsd / input.amountUsd * 100,
  }
}

export type SafetyCheck = {
  id:      string
  label:   string
  status:  'pass' | 'fail' | 'warn' | 'pending'
  detail:  string
}

export function runSafetyChecks(input: BotTradeInput): SafetyCheck[] {
  const p = computeProfitBreakdown(input)
  const supportedCoins = NETWORK_SUPPORTED_COINS[input.network] ?? []

  return [
    {
      id:     'spread',
      label:  'Spread sufficient',
      status: p.netProfitUsd > 0 ? 'pass' : 'fail',
      detail: p.netProfitUsd > 0
        ? `Net profit $${p.netProfitUsd.toFixed(2)} after all fees`
        : `Trade is unprofitable — net loss $${Math.abs(p.netProfitUsd).toFixed(2)}`,
    },
    {
      id:     'min_profit',
      label:  'Min profit gate',
      status: p.netProfitUsd >= (input.minNetProfitUsd ?? 0.5) ? 'pass' : 'fail',
      detail: `Net $${p.netProfitUsd.toFixed(2)} vs threshold $${(input.minNetProfitUsd ?? 0.5).toFixed(2)}`,
    },
    {
      id:     'network_coin',
      label:  'Coin supported on network',
      status: supportedCoins.length === 0 || supportedCoins.includes(input.symbol) ? 'pass' : 'fail',
      detail: supportedCoins.includes(input.symbol) || supportedCoins.length === 0
        ? `${input.symbol} is transferable via ${input.network}`
        : `${input.symbol} is NOT supported on ${input.network}. Try: ${supportedCoins.slice(0, 3).join(', ')}`,
    },
    {
      id:     'slippage',
      label:  'Slippage tolerance set',
      status: (input.slippagePct ?? 0) <= 1.0 ? 'pass' : 'warn',
      detail: `${input.slippagePct ?? 0.1}% slippage — effective sell price $${p.effectiveSellPrice.toFixed(4)}`,
    },
    {
      id:     'capital',
      label:  'Minimum capital ($50)',
      status: input.amountUsd >= 50 ? 'pass' : 'fail',
      detail: input.amountUsd >= 50
        ? `$${input.amountUsd} capital meets minimum`
        : `$${input.amountUsd} is below the $50 minimum for safe execution`,
    },
    {
      id:     'risk',
      label:  'Risk level acceptable',
      status: input.riskLevel === 'Critical' ? 'fail' : input.riskLevel === 'High' ? 'warn' : 'pass',
      detail: `Risk: ${input.riskLevel} (score ${input.riskScore}/100)`,
    },
    {
      id:     'diff_exchange',
      label:  'Different exchanges',
      status: input.buyExchange !== input.sellExchange ? 'pass' : 'fail',
      detail: input.buyExchange !== input.sellExchange
        ? `${input.buyExchange} → ${input.sellExchange}`
        : 'Buy and sell exchange cannot be the same',
    },
    {
      id:     'transfer_risk',
      label:  'Transfer time risk',
      status: NETWORK_TRANSFER_MINS[input.network] <= 10 ? 'pass' : NETWORK_TRANSFER_MINS[input.network] <= 20 ? 'warn' : 'warn',
      detail: `Est. ${NETWORK_TRANSFER_MINS[input.network] ?? 10}m transfer — price may move during transit`,
    },
  ]
}
