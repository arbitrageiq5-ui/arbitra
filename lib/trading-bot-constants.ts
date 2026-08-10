// Plain constants — NOT a 'use server' file.
// Kept separate so the 'use server' actions file only exports async functions.

export const DCA_PAIRS = [
  { symbol: 'BTC/USDT',   base: 'BTC',   quote: 'USDT', name: 'Bitcoin' },
  { symbol: 'ETH/USDT',   base: 'ETH',   quote: 'USDT', name: 'Ethereum' },
  { symbol: 'BNB/USDT',   base: 'BNB',   quote: 'USDT', name: 'BNB' },
  { symbol: 'SOL/USDT',   base: 'SOL',   quote: 'USDT', name: 'Solana' },
  { symbol: 'XRP/USDT',   base: 'XRP',   quote: 'USDT', name: 'XRP' },
  { symbol: 'ADA/USDT',   base: 'ADA',   quote: 'USDT', name: 'Cardano' },
  { symbol: 'DOGE/USDT',  base: 'DOGE',  quote: 'USDT', name: 'Dogecoin' },
  { symbol: 'AVAX/USDT',  base: 'AVAX',  quote: 'USDT', name: 'Avalanche' },
  { symbol: 'DOT/USDT',   base: 'DOT',   quote: 'USDT', name: 'Polkadot' },
  { symbol: 'MATIC/USDT', base: 'MATIC', quote: 'USDT', name: 'Polygon' },
  { symbol: 'LINK/USDT',  base: 'LINK',  quote: 'USDT', name: 'Chainlink' },
  { symbol: 'LTC/USDT',   base: 'LTC',   quote: 'USDT', name: 'Litecoin' },
  { symbol: 'UNI/USDT',   base: 'UNI',   quote: 'USDT', name: 'Uniswap' },
  { symbol: 'ATOM/USDT',  base: 'ATOM',  quote: 'USDT', name: 'Cosmos' },
  { symbol: 'TRX/USDT',   base: 'TRX',   quote: 'USDT', name: 'TRON' },
] as const

// Precious metals pairs — traded via CoinSwitch & Delta Exchange
export const PRECIOUS_METALS_PAIRS = [
  { symbol: 'XAU/USDT', base: 'XAU', quote: 'USDT', name: 'Gold',   icon: '⬛', usdApprox: 1950  },
  { symbol: 'XAG/USDT', base: 'XAG', quote: 'USDT', name: 'Silver', icon: '⬜', usdApprox: 23    },
  { symbol: 'XAUT/USDT',base: 'XAUT',quote: 'USDT', name: 'Tether Gold (XAUT)', icon: '🟡', usdApprox: 1950 },
  { symbol: 'PAXG/USDT',base: 'PAXG',quote: 'USDT', name: 'PAX Gold (PAXG)',    icon: '🟡', usdApprox: 1950 },
] as const

// Exchanges that support Gold / Silver spot trading
export const PRECIOUS_METALS_EXCHANGES = ['coinswitch', 'delta', 'binance', 'okx', 'bitget'] as const

export type PreciousMetalsPair = typeof PRECIOUS_METALS_PAIRS[number]

// Forex / metals / index pairs tradeable via MetaTrader 4 & 5 bridges
export const FOREX_PAIRS = [
  { symbol: 'EUR/USD', base: 'EUR', quote: 'USD', name: 'Euro / US Dollar' },
  { symbol: 'GBP/USD', base: 'GBP', quote: 'USD', name: 'British Pound / US Dollar' },
  { symbol: 'USD/JPY', base: 'USD', quote: 'JPY', name: 'US Dollar / Japanese Yen' },
  { symbol: 'USD/CHF', base: 'USD', quote: 'CHF', name: 'US Dollar / Swiss Franc' },
  { symbol: 'AUD/USD', base: 'AUD', quote: 'USD', name: 'Australian Dollar / US Dollar' },
  { symbol: 'USD/CAD', base: 'USD', quote: 'CAD', name: 'US Dollar / Canadian Dollar' },
  { symbol: 'NZD/USD', base: 'NZD', quote: 'USD', name: 'New Zealand Dollar / US Dollar' },
  { symbol: 'EUR/GBP', base: 'EUR', quote: 'GBP', name: 'Euro / British Pound' },
  { symbol: 'XAU/USD', base: 'XAU', quote: 'USD', name: 'Gold Spot' },
  { symbol: 'XAG/USD', base: 'XAG', quote: 'USD', name: 'Silver Spot' },
  { symbol: 'US30/USD', base: 'US30', quote: 'USD', name: 'Dow Jones 30 Index' },
  { symbol: 'NAS100/USD', base: 'NAS100', quote: 'USD', name: 'Nasdaq 100 Index' },
] as const

// MetaTrader platform/broker bridges supported for automated execution
export const META_TRADER_PLATFORMS = ['mt5', 'mt4'] as const

export type ForexPair = typeof FOREX_PAIRS[number]
export type MetaTraderPlatform = typeof META_TRADER_PLATFORMS[number]

export type DcaConfig = {
  baseOrderSize: number        // USDT for first buy
  safetyOrderSize: number      // USDT per safety order
  maxSafetyOrders: number      // 1–10
  priceDeviationPct: number    // % drop to trigger each safety order
  safetyOrderVolumePct: number // scale factor per safety order
  takeProfitPct: number        // % above avg buy price to take profit
  interval: string             // 'manual' | '1h' | '4h' | '1d'
  leverage?: number            // futures only (1–10)
  trailingDeviation?: number   // optional trailing stop %
}
