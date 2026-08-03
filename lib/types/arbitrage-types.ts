// Shared types for arbitrage server actions.
// Lives outside 'use server' files so Turbopack never generates
// broken client-reference stubs for type-only exports.

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
  tradingFeeUsd: number
  withdrawalFeeUsd: number
  networkFeeUsd: number
  slippageUsd: number
  safetyBufferUsd: number
  grossProfitUsd: number
  netProfitUsd: number
  estimatedTransferMin: number
  viable: boolean
  rejectReason: string | null
  riskScore: number
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
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
  connectionStatus: string | null
  // Extended runtime fields added by ALL_EXCHANGES metadata
  region?: string
  color?: string
  lastTestStatus?: string | null
  lastTestMs?: number | null
  hasPassphrase?: boolean
  permissions?: string[]
  note?: string
  docsUrl?: string
  docsLabel?: string
  tradingFee?: number
  requiresIpWhitelist?: boolean
}

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

export interface ExchangeBalance {
  exchange: string
  label: string
  symbol: string
  free: number
  locked: number
  total: number
  usdValue: number
}

export interface TransferRequest {
  fromExchange: string
  toExchange: string
  symbol: string
  network: string
  amount: number
  toAddress: string
  memo?: string
}

export interface TransferResult {
  success: boolean
  txId?: string
  message: string
  logId?: number
}

export interface BotConfig {
  isRunning: boolean
  executionMode: 'monitor' | 'semi-auto' | 'full-auto'
  orderType: 'market' | 'limit'
  preFundedMode: boolean
  minProfitPct: number
  minProfitUsd: number
  tradeAmountUsd: number
  maxOrderSizeUsd: number
  safetyBufferPct: number
  maxSlippagePct: number
  maxTransferTimeMin: number
  maxApiLatencyMs: number
  minLiquidityUsd: number
  minOrderBookDepth: number
  maxDailyLossUsd: number
  maxOpenPositions: number
  maxPositionSizeUsd: number
  minExchangeRiskScore: number
  tradingFeePct: number | null
  withdrawalFeeOverride: number | null
  networkFeeOverride: number | null
  scanIntervalSeconds: number
  watchlistSymbols: string[]
  alertOnOpportunity: boolean
  alertOnExecution: boolean
  alertOnFailure: boolean
  alertOnLowBalance: boolean
  telegramChatId: string | null
  discordWebhook: string | null
}

export interface RiskFilterResult {
  filter: string
  passed: boolean
  value: string
  threshold: string
  description: string
}

export interface BotAnalytics {
  totalOpportunities: number
  executedTrades: number
  successfulTrades: number
  failedTrades: number
  winRate: number
  totalProfitUsd: number
  totalFeesUsd: number
  netProfitUsd: number
  avgRoiPct: number
  bestTradeProfitUsd: number
  dailyProfit: Array<{ date: string; profit: number; trades: number }>
  topPairs: Array<{ symbol: string; buyEx: string; sellEx: string; count: number; totalProfit: number }>
  maxDrawdownPct: number
  sharpeRatio: number
  avgTransferTimeMin: number
}

export interface BotTradeResult {
  success: boolean
  opportunityId: string
  message: string
  netProfit?: number
  txIds?: string[]
}

export interface TransferLog {
  id: number
  fromExchange: string
  toExchange: string
  symbol: string
  network: string
  amount: string
  fee: string | null
  address: string | null
  txId: string | null
  status: string
  errorMessage: string | null
  createdAt: string
}

export interface SniperBotConfig {
  enabled: boolean
  tradeAmountUsd: number
  minNetProfitPct: number
  minNetProfitUsd: number
  maxTransferMin: number
  preferredNetworks: string[]
  preferredCoins: string[]
  excludeExchanges: string[]
  autoExecute: boolean
  cooldownSeconds: number
  maxConcurrentGrabs: number
  scoringWeights: {
    netProfit: number
    transferSpeed: number
    feeEfficiency: number
  }
}

export interface ScoredOpportunity {
  id: string
  symbol: string
  buyExchange: string
  sellExchange: string
  buyPrice: number
  sellPrice: number
  grossSpreadPct: number
  netProfitPct: number
  netProfitUsd: number
  totalCostsUsd: number
  tradingFeeBuyUsd: number
  tradingFeeSellUsd: number
  withdrawalFeeUsd: number
  networkFeeUsd: number
  slippageUsd: number
  safetyBufferUsd: number
  suggestedNetwork: string
  suggestedAmount: number
  estimatedTransferMin: number
  score: number
  scoreBreakdown: {
    profitScore: number
    speedScore: number
    feeScore: number
  }
  readyToGrab: boolean
  blockers: string[]
  detectedAt: string
}
