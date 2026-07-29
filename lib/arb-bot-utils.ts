// Pure utility — no 'use server'. Safe to import from both server actions and client components.

export type BotTradeInput = {
  symbol:       string
  network:      string
  buyExchange:  string
  sellExchange: string
  buyPrice:     number
  sellPrice:    number
  amount:       number     // qty of coin
  amountUsd:    number     // capital in USD
  riskLevel:    string
  riskScore:    number
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

export function computeProfitBreakdown(input: BotTradeInput) {
  const grossProfitUsd = (input.sellPrice - input.buyPrice) * input.amount
  const feeBuyUsd      = (input.amountUsd * (EXCHANGE_TAKER_FEE[input.buyExchange]  ?? 0.2)) / 100
  const feeSellUsd     = (input.amountUsd * (EXCHANGE_TAKER_FEE[input.sellExchange] ?? 0.2)) / 100
  const feeNetworkUsd  = NETWORK_WITHDRAW_FEE_USD[input.network] ?? 2.0
  const totalFeesUsd   = feeBuyUsd + feeSellUsd + feeNetworkUsd
  const netProfitUsd   = grossProfitUsd - totalFeesUsd
  const netProfitPct   = input.amountUsd > 0 ? (netProfitUsd / input.amountUsd) * 100 : 0
  const transferMins   = NETWORK_TRANSFER_MINS[input.network] ?? 10
  return { grossProfitUsd, feeBuyUsd, feeSellUsd, feeNetworkUsd, totalFeesUsd, netProfitUsd, netProfitPct, transferMins }
}
