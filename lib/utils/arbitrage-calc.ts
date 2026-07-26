// Pure utility — no 'use server', safe to import anywhere (client or server)

export interface NetProfitBreakdown {
  symbol: string
  buyExchange: string
  sellExchange: string
  tradeAmountUsd: number
  buyPrice: number
  sellPrice: number
  // Costs
  tradingFeeBuy: number
  tradingFeeSell: number
  withdrawalFee: number
  networkFee: number
  estimatedSlippage: number
  safetyBuffer: number
  // Results
  grossProfit: number
  totalCosts: number
  netProfit: number
  grossProfitPct: number
  netProfitPct: number
  roi: number
  viable: boolean
  rejectReason: string | null
  estimatedTransferMin: number
}

export type CalcConfig = {
  safetyBufferPct: number
  tradingFeePct: number | null
  withdrawalFeeOverride: number | null
  networkFeeOverride: number | null
  minProfitPct: number
  maxSlippagePct: number
  maxTransferTimeMin: number
}

const EXCHANGE_FEE_PCT: Record<string, number> = {
  binance: 0.1, kraken: 0.16, coinbase: 0.6, bybit: 0.1, kucoin: 0.1,
  htx: 0.2, bitfinex: 0.2, okx: 0.08, gateio: 0.2, gemini: 0.35,
  cryptocom: 0.075, bitget: 0.1, poloniex: 0.14, mexc: 0.0,
}

const WITHDRAWAL_FEES_USD: Record<string, Record<string, number>> = {
  USDT: { binance: 1.0, kucoin: 1.0, bybit: 1.0, okx: 1.0, kraken: 2.0, default: 1.5 },
  BTC:  { binance: 4.0, kucoin: 3.5, bybit: 4.0, okx: 3.5, kraken: 4.0, default: 4.0 },
  ETH:  { binance: 2.0, kucoin: 1.8, bybit: 2.0, okx: 1.8, kraken: 2.5, default: 2.0 },
  SOL:  { binance: 0.01, kucoin: 0.02, bybit: 0.01, okx: 0.01, default: 0.02 },
  default: { default: 2.0 },
}

const NETWORK_FEES_USD: Record<string, number> = {
  TRC20: 1.0, BEP20: 0.5, ERC20: 5.0, SOL: 0.01, BTC: 3.0, AVAX: 0.5,
  XRP: 0.01, default: 2.0,
}

const BEST_NETWORK: Record<string, string> = {
  USDT: 'TRC20', BTC: 'BTC', ETH: 'ERC20', BNB: 'BEP20', SOL: 'SOL',
  XRP: 'XRP', ADA: 'BEP20', AVAX: 'AVAX', default: 'BEP20',
}

const TRANSFER_TIMES: Record<string, number> = {
  TRC20: 2, BEP20: 3, ERC20: 8, SOL: 1, BTC: 30, AVAX: 2, XRP: 1, default: 5,
}

export function calcNetProfit(
  symbol: string,
  buyExchange: string,
  sellExchange: string,
  buyPrice: number,
  sellPrice: number,
  tradeAmountUsd: number,
  config: CalcConfig,
): NetProfitBreakdown {
  const buyEx    = buyExchange.toLowerCase()
  const sellEx   = sellExchange.toLowerCase()
  const symUpper = symbol.toUpperCase()

  const quantity  = tradeAmountUsd / buyPrice
  const sellValue = quantity * sellPrice
  const buyValue  = tradeAmountUsd

  const feeBuyPct  = (config.tradingFeePct ?? EXCHANGE_FEE_PCT[buyEx]  ?? 0.1) / 100
  const feeSellPct = (config.tradingFeePct ?? EXCHANGE_FEE_PCT[sellEx] ?? 0.1) / 100
  const tradingFeeBuy  = buyValue  * feeBuyPct
  const tradingFeeSell = sellValue * feeSellPct

  const wdFeeMap     = WITHDRAWAL_FEES_USD[symUpper] ?? WITHDRAWAL_FEES_USD['default']
  const withdrawalFee = config.withdrawalFeeOverride
    ?? wdFeeMap[buyEx] ?? wdFeeMap['default'] ?? 2.0

  const bestNet    = BEST_NETWORK[symUpper] ?? BEST_NETWORK['default']
  const networkFee = config.networkFeeOverride ?? NETWORK_FEES_USD[bestNet] ?? 2.0

  const slippagePct      = 0.05 / 100
  const estimatedSlippage = (buyValue + sellValue) * slippagePct

  const safetyBuffer = tradeAmountUsd * ((config.safetyBufferPct ?? 0.1) / 100)

  const grossProfit = sellValue - buyValue
  const totalCosts  = tradingFeeBuy + tradingFeeSell + withdrawalFee + networkFee + estimatedSlippage + safetyBuffer
  const netProfit   = grossProfit - totalCosts

  const grossProfitPct = ((sellPrice - buyPrice) / buyPrice) * 100
  const netProfitPct   = (netProfit / tradeAmountUsd) * 100
  const roi            = netProfitPct

  const transferMin = TRANSFER_TIMES[bestNet] ?? TRANSFER_TIMES['default']

  let rejectReason: string | null = null
  const slippagePctActual = (estimatedSlippage / tradeAmountUsd) * 100
  if (netProfitPct < config.minProfitPct)
    rejectReason = `Net profit ${netProfitPct.toFixed(3)}% below threshold ${config.minProfitPct}%`
  else if (slippagePctActual > config.maxSlippagePct)
    rejectReason = `Slippage ${slippagePctActual.toFixed(3)}% exceeds max ${config.maxSlippagePct}%`
  else if (transferMin > config.maxTransferTimeMin)
    rejectReason = `Transfer time ${transferMin}m exceeds max ${config.maxTransferTimeMin}m`

  return {
    symbol, buyExchange, sellExchange, tradeAmountUsd, buyPrice, sellPrice,
    tradingFeeBuy, tradingFeeSell, withdrawalFee, networkFee,
    estimatedSlippage, safetyBuffer,
    grossProfit, totalCosts, netProfit,
    grossProfitPct, netProfitPct, roi,
    viable: !rejectReason, rejectReason,
    estimatedTransferMin: transferMin,
  }
}
