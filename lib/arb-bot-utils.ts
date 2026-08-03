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

// Average block times per network (seconds)
export const NETWORK_BLOCK_TIME_SECS: Record<string, number> = {
  TRC20: 3, BEP20: 3, ERC20: 12, SOL: 0.4, Polygon: 2,
  Avalanche: 2, BTC: 600, XRP: 4, ADA: 20,
}

// Known contract addresses per symbol per network (checksummed / canonical)
// Used to validate the token is the same on both exchanges before trading
export const TOKEN_CONTRACTS: Record<string, Partial<Record<string, string>>> = {
  USDT: {
    TRC20:     'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    ERC20:     '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    BEP20:     '0x55d398326f99059fF775485246999027B3197955',
    Polygon:   '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    Avalanche: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
  USDC: {
    ERC20:     '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    BEP20:     '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    Polygon:   '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    Avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    SOL:       'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  ETH: {
    ERC20:     'native',
    BEP20:     '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    Polygon:   '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    Avalanche: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
  },
  BNB: {
    BEP20:  'native',
    ERC20:  '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
  },
  BTC: {
    BTC:    'native',
    ERC20:  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',  // WBTC
    BEP20:  '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    Avalanche: '0x152b9d0FdC40C096757F570A51E494bd4b943E50',
  },
  SOL:  { SOL: 'native', BEP20: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF' },
  TRX:  { TRC20: 'native' },
  MATIC:{ Polygon: 'native', ERC20: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', BEP20: '0xCC42724C6683B7E57334c4E856f4c9965ED682bD' },
  AVAX: { Avalanche: 'native', BEP20: '0x1CE0c2827e2eF14D5C4f29a091d735A204794041' },
  XRP:  { XRP: 'native' },
  LINK: { ERC20: '0x514910771AF9Ca656af840dff83E8264EcF986CA', BEP20: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD' },
  UNI:  { ERC20: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
  AAVE: { ERC20: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
  SHIB: { ERC20: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', BEP20: '0x2859e4544C4bB03966803b044A93563Bd2D0DD4D' },
  PEPE: { ERC20: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' },
  BONK: { SOL: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  WIF:  { SOL: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
}

// ── Volume Validation ──────────────────────────────────────────────────────────
// Returns true if capital is a safe % of available exchange volume
export function validateVolume(capitalUsd: number, volume24hUsd: number): {
  safe: boolean
  pct: number
  warning: string | null
} {
  if (volume24hUsd <= 0) return { safe: true, pct: 0, warning: null }
  const pct = (capitalUsd / volume24hUsd) * 100
  if (pct > 5)  return { safe: false, pct, warning: `Capital is ${pct.toFixed(1)}% of 24h volume — high slippage risk (>5%)` }
  if (pct > 1)  return { safe: true,  pct, warning: `Capital is ${pct.toFixed(1)}% of 24h volume — moderate impact, proceed with caution` }
  return { safe: true, pct, warning: null }
}

// ── Contract Address Checker ───────────────────────────────────────────────────
export type ContractCheckResult = {
  symbol:        string
  network:       string
  address:       string | null
  isNative:      boolean
  isVerified:    boolean
  warning:       string | null
}

export function checkContractAddress(symbol: string, network: string): ContractCheckResult {
  const networkContracts = TOKEN_CONTRACTS[symbol]
  if (!networkContracts) {
    return { symbol, network, address: null, isNative: false, isVerified: false, warning: `No contract registry for ${symbol} — verify manually on the exchange` }
  }
  const addr = networkContracts[network]
  if (!addr) {
    return { symbol, network, address: null, isNative: false, isVerified: false, warning: `${symbol} has no known contract on ${network} — verify this coin is supported` }
  }
  if (addr === 'native') {
    return { symbol, network, address: null, isNative: true, isVerified: true, warning: null }
  }
  return { symbol, network, address: addr, isNative: false, isVerified: true, warning: null }
}

// ── Transfer Timing Calculator ─────────────────────────────────────────────────
export type TransferTiming = {
  network:            string
  estimatedMins:      number
  blockTimeSecs:      number
  minConfirmations:   number
  totalBlocksNeeded:  number
  progressPct:        (elapsedSecs: number) => number
  etaText:            (elapsedSecs: number) => string
  isSettled:          (elapsedSecs: number) => boolean
}

export function getTransferTiming(network: string): TransferTiming {
  const estimatedMins    = NETWORK_TRANSFER_MINS[network]      ?? 10
  const blockTimeSecs    = NETWORK_BLOCK_TIME_SECS[network]    ?? 15
  const minConfirmations = NETWORK_MIN_CONFIRMATIONS[network]  ?? 12
  const totalBlocksNeeded = minConfirmations
  const totalEstSecs     = estimatedMins * 60

  return {
    network,
    estimatedMins,
    blockTimeSecs,
    minConfirmations,
    totalBlocksNeeded,
    progressPct: (elapsedSecs: number) => Math.min(100, (elapsedSecs / totalEstSecs) * 100),
    etaText: (elapsedSecs: number) => {
      const remaining = Math.max(0, totalEstSecs - elapsedSecs)
      if (remaining === 0) return 'Settled'
      if (remaining < 60) return `~${remaining}s remaining`
      return `~${Math.ceil(remaining / 60)}m remaining`
    },
    isSettled: (elapsedSecs: number) => elapsedSecs >= totalEstSecs,
  }
}

// ── Spread Expiry ──────────────────────────────────────────────────────────────
// Arbitrage windows close in minutes. Warn when the detected opportunity is stale.
export function getSpreadFreshness(detectedAtIso: string): {
  ageSeconds:  number
  isFresh:     boolean
  isStale:     boolean
  isExpired:   boolean
  label:       string
  color:       string
} {
  const ageSeconds = Math.floor((Date.now() - new Date(detectedAtIso).getTime()) / 1000)
  if (ageSeconds < 60)   return { ageSeconds, isFresh: true,  isStale: false, isExpired: false, label: `${ageSeconds}s ago`,          color: 'text-green-400' }
  if (ageSeconds < 300)  return { ageSeconds, isFresh: false, isStale: false, isExpired: false, label: `${Math.floor(ageSeconds/60)}m ago`, color: 'text-amber-400' }
  if (ageSeconds < 900)  return { ageSeconds, isFresh: false, isStale: true,  isExpired: false, label: `${Math.floor(ageSeconds/60)}m ago — stale`, color: 'text-orange-400' }
  return { ageSeconds, isFresh: false, isStale: false, isExpired: true, label: 'Expired — rescan recommended', color: 'text-red-400' }
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

export function runSafetyChecks(input: BotTradeInput & { volume24hUsd?: number; spreadAgeSeconds?: number }): SafetyCheck[] {
  const p              = computeProfitBreakdown(input)
  const supportedCoins = NETWORK_SUPPORTED_COINS[input.network] ?? []
  const contractCheck  = checkContractAddress(input.symbol, input.network)
  const volCheck       = validateVolume(input.amountUsd, input.volume24hUsd ?? 0)
  const transferTiming = getTransferTiming(input.network)

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
      id:     'contract_address',
      label:  'Contract address verified',
      status: contractCheck.isVerified ? 'pass' : contractCheck.warning ? 'warn' : 'fail',
      detail: contractCheck.isNative
        ? `${input.symbol} is a native coin on ${input.network} — no contract risk`
        : contractCheck.address
        ? `Contract: ${contractCheck.address.slice(0, 10)}...${contractCheck.address.slice(-6)}`
        : contractCheck.warning ?? `Unverified — check ${input.symbol} contract on both exchanges`,
    },
    {
      id:     'volume',
      label:  'Volume sufficient',
      status: volCheck.safe ? 'pass' : 'warn',
      detail: input.volume24hUsd && input.volume24hUsd > 0
        ? `Capital is ${volCheck.pct.toFixed(2)}% of $${(input.volume24hUsd / 1_000_000).toFixed(1)}M 24h vol${volCheck.warning ? ' — ' + volCheck.warning : ''}`
        : 'Volume data unavailable — proceed with caution on large positions',
    },
    {
      id:     'network_coin',
      label:  'Coin supported on network',
      status: supportedCoins.length === 0 || supportedCoins.includes(input.symbol) ? 'pass' : 'fail',
      detail: supportedCoins.includes(input.symbol) || supportedCoins.length === 0
        ? `${input.symbol} is transferable via ${input.network}`
        : `${input.symbol} is NOT supported on ${input.network}. Supported: ${supportedCoins.slice(0, 3).join(', ')}`,
    },
    {
      id:     'transfer_timing',
      label:  'Transfer timing',
      status: transferTiming.estimatedMins <= 5 ? 'pass' : transferTiming.estimatedMins <= 15 ? 'warn' : 'warn',
      detail: `~${transferTiming.estimatedMins}m transfer, ${transferTiming.minConfirmations} confirmations on ${input.network} (${transferTiming.blockTimeSecs}s/block)`,
    },
    {
      id:     'spread_freshness',
      label:  'Spread still fresh',
      status: !input.spreadAgeSeconds ? 'pass' :
               input.spreadAgeSeconds < 60  ? 'pass' :
               input.spreadAgeSeconds < 300 ? 'warn' : 'fail',
      detail: !input.spreadAgeSeconds
        ? 'Spread freshness unknown — confirm prices are current'
        : input.spreadAgeSeconds < 60
        ? `Detected ${input.spreadAgeSeconds}s ago — fresh`
        : input.spreadAgeSeconds < 300
        ? `Detected ${Math.floor(input.spreadAgeSeconds / 60)}m ago — may have closed`
        : `Detected ${Math.floor(input.spreadAgeSeconds / 60)}m ago — likely expired, rescan first`,
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
  ]
}
