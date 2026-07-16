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
