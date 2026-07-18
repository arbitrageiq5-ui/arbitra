/**
 * Single source of truth for base reference prices used across the entire app.
 * These approximate real-world mid-market prices as of mid-2025.
 * Update these periodically to stay realistic.
 */
export const BASE_PRICES: Record<string, number> = {
  // Major
  BTC: 103500, ETH: 3850,  BNB: 610,   SOL: 185,   XRP: 2.45,
  DOGE: 0.38,  ADA: 0.98,  TRX: 0.28,  AVAX: 41.5, DOT: 9.2,
  MATIC: 1.05, LTC: 105,   LINK: 18.5, UNI: 12.4,  ATOM: 8.9,
  NEAR: 6.8,   FIL: 7.2,   ICP: 11.5,  APT: 13.2,

  // Layer 2 / Infra
  ARB: 1.18,   OP: 2.45,   SUI: 1.62,  SEI: 0.58,  INJ: 28.4,
  STRK: 1.22,  ZK: 0.21,   METIS: 42.5, BOBA: 0.38, CELO: 0.88,

  // DeFi
  AAVE: 285,   MKR: 2150,  SNX: 3.2,   CRV: 0.82,  LDO: 2.85,
  RPL: 24.5,   COMP: 68,   YFI: 8400,  SUSHI: 1.68, BAL: 4.2,
  '1INCH': 0.54,

  // Gaming / Metaverse
  ENJ: 0.38,   MANA: 0.52, SAND: 0.48, AXS: 9.8,   GALA: 0.045,
  IMX: 2.85,   GODS: 0.34, PIXEL: 0.42, PORTAL: 1.15,

  // Meme
  SHIB: 0.0000248, PEPE: 0.0000148, FLOKI: 0.000198, BONK: 0.0000342,
  WIF: 2.84, POPCAT: 0.89, BRETT: 0.175, TURBO: 0.0082,
  MOG: 0.0000058, NEIRO: 0.00148, SUNDOG: 0.052, PONKE: 0.34,
  COQ: 0.0000012,

  // Telegram / TON eco
  TON: 6.85, NOT: 0.0145, DOGS: 0.00092, HAMSTER: 0.0102,

  // AI / Data
  WLD: 2.85,   RENDER: 8.4,  FET: 2.12,  AGIX: 0.98,  OCEAN: 0.88,
  TAO: 420,    ARKM: 1.85,   GRT: 0.28,  API3: 2.45,  BAND: 1.62,

  // Solana eco
  JUP: 1.05,   PYTH: 0.52,  JTO: 3.2,   TNSR: 0.88,  W: 0.28,

  // Misc alts
  ZRO: 4.2,    EIGEN: 3.85, SCR: 1.15,
}

/**
 * Per-coin realistic 24h trading volume in USD.
 * Used to make opportunity tables look realistic.
 */
export const COIN_VOLUME_24H: Record<string, number> = {
  BTC: 28_000_000_000, ETH: 14_000_000_000, BNB: 1_800_000_000,
  SOL: 3_200_000_000,  XRP: 2_400_000_000,  DOGE: 980_000_000,
  ADA: 620_000_000,    AVAX: 480_000_000,   MATIC: 380_000_000,
  LINK: 590_000_000,   LTC: 460_000_000,    DOT: 280_000_000,
  UNI: 180_000_000,    ATOM: 210_000_000,   NEAR: 310_000_000,
  ARB: 290_000_000,    OP: 195_000_000,     SUI: 870_000_000,
  APT: 320_000_000,    INJ: 155_000_000,    AAVE: 140_000_000,
  CRV: 85_000_000,     SHIB: 420_000_000,   PEPE: 680_000_000,
  WIF: 245_000_000,    BONK: 185_000_000,   TON: 290_000_000,
  FET: 125_000_000,    RENDER: 95_000_000,  TAO: 78_000_000,
  JUP: 145_000_000,    PYTH: 88_000_000,
}

/** Default volume when coin not in map */
export const DEFAULT_VOLUME = 50_000_000
