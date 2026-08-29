import { useEffect } from 'react'
import { checkSlTp, livePriceForPosition } from '../lib/sim'
import { useAppStore } from '../store'

/**
 * Watches every open position's live price (active-coin candle ticks or watchlist
 * polls — the same live-data constraint as PnL/verdict display elsewhere) and
 * auto-closes it the moment price crosses its stop-loss or take-profit. Mount
 * exactly once (in App.tsx).
 */
export function usePositionMonitor(): void {
  const coin = useAppStore((s) => s.coin)
  const candles = useAppStore((s) => s.candles)
  const watchlistData = useAppStore((s) => s.watchlistData)

  useEffect(() => {
    const { positions, closePosition } = useAppStore.getState()
    if (positions.length === 0) return

    const activePrice = candles.length > 0 ? candles[candles.length - 1].close : null
    for (const position of positions) {
      const price = livePriceForPosition(position, coin, activePrice, watchlistData)
      if (price === null) continue
      const reason = checkSlTp(position, price)
      if (reason) closePosition(position.id, price, reason)
    }
  }, [coin, candles, watchlistData])
}
