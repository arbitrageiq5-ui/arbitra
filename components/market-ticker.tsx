'use client'

import useSWR from 'swr'
import { WifiOff } from 'lucide-react'

type TickerEntry = {
  symbol: string
  price: number
  changePercent: number
}

type ApiResponse = {
  ok: boolean
  data: TickerEntry[]
  source: 'binance' | 'cache' | 'error'
  updatedAt: number
}

const fetcher = (url: string): Promise<ApiResponse> => fetch(url).then(res => res.json())

function formatPrice(price: number) {
  const decimals = price < 1 ? 4 : price < 100 ? 2 : 2
  return price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** Live market ticker fed by Binance's public 24hr ticker API, polled every 5s. */
export function MarketTicker({ variant }: { variant: 'desktop' | 'mobile' }) {
  const { data, error, isLoading } = useSWR<ApiResponse>('/api/market-ticker', fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: false,
    dedupingInterval: 4000,
  })

  const entries = data?.data ?? []
  const isStale = data?.source === 'cache'
  const isDown = !!error || (data && !data.ok && entries.length === 0)

  if (isDown) {
    return (
      <div className={variant === 'desktop' ? 'hidden lg:flex items-center gap-2 text-slate-500 text-xs mx-6' : 'flex items-center gap-2 text-slate-500 text-[10px] px-3 py-1.5'}>
        <WifiOff className="w-3 h-3" />
        <span>Live prices unavailable</span>
      </div>
    )
  }

  if (isLoading || entries.length === 0) {
    const skeletonCount = variant === 'desktop' ? 4 : 8
    return (
      <div className={variant === 'desktop' ? 'hidden lg:flex items-center gap-4 flex-1 mx-6 justify-center' : 'flex items-center gap-4 px-3 py-1.5'}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5 shrink-0">
            <div className="w-8 h-3 rounded bg-slate-800 animate-pulse" />
            <div className="w-14 h-3 rounded bg-slate-800 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'desktop') {
    return (
      <div className="hidden lg:flex items-center gap-4 overflow-hidden flex-1 mx-6 justify-center">
        {entries.slice(0, 4).map(t => (
          <div key={t.symbol} className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-400 text-xs font-semibold">{t.symbol}</span>
            <span className="text-white text-xs font-mono font-medium">${formatPrice(t.price)}</span>
            <span className={`text-[10px] font-bold ${t.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {t.changePercent >= 0 ? '+' : ''}{t.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
        {isStale && <span className="text-slate-600 text-[10px] shrink-0">(cached)</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 min-w-max px-3 py-1.5">
      {entries.map(t => (
        <div key={t.symbol} className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-500 text-[10px] font-semibold">{t.symbol}</span>
          <span className="text-white text-[10px] font-mono">${formatPrice(t.price)}</span>
          <span className={`text-[9px] font-bold ${t.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {t.changePercent >= 0 ? '+' : ''}{t.changePercent.toFixed(2)}%
          </span>
        </div>
      ))}
      {isStale && <span className="text-slate-600 text-[9px] shrink-0">(cached)</span>}
    </div>
  )
}
