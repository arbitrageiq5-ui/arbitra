export interface CoinRate {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number | null
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_percentage_24h: number
  price_change_24h: number
  market_cap_change_24h: number
  market_cap_change_percentage_24h: number
  circulating_supply: number
  total_supply: number
  ath: number
  atl: number
  ath_change_percentage: number
  ath_date: string
  atl_date: string
  roi: { times: number; currency: string; percentage: number } | null
  last_updated: string
}

export interface LendingRate {
  coin: string
  network: string
  apy: number
  minDeposit: number
  maxDeposit: number
  locked: boolean
  duration?: string
}

export interface LendingPool {
  id: string
  name: string
  description: string
  rates: LendingRate[]
  tvl: number
  lastUpdated: string
}
