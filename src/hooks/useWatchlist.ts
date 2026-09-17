import { useEffect, useRef } from 'react'
import { intervalMs } from '../lib/hl/intervals'
import { candleSnapshot } from '../lib/hl/rest'
import { MIN_CANDLES, computeAll } from '../lib/indicators'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'

const POLL_INTERVAL_MS = 45_000

/** Polls each watchlist coin on a timer for price/bias display data and the paper-trading engine's live-price fallback. */
export function useWatchlist(): void {
  const watchlist = useConfigStore((s) => s.watchlist)
  const defaultInterval = useConfigStore((s) => s.defaultInterval)
  const lookback = useConfigStore((s) => s.lookback)
  const setWatchlistEntry = useAppStore((s) => s.setWatchlistEntry)

  const lastOpenTimeRef = useRef<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false

    async function pollOnce() {
      for (const coin of watchlist) {
        if (cancelled) return
        try {
          const ms = intervalMs(defaultInterval)
          const candles = await candleSnapshot(coin, defaultInterval, Date.now() - lookback * ms, Date.now())
          if (cancelled || candles.length === 0) continue

          const latest = candles[candles.length - 1]
          lastOpenTimeRef.current[coin] = latest.openTime

          if (candles.length < MIN_CANDLES) continue

          const dict = computeAll(candles)
          setWatchlistEntry(coin, {
            price: dict.price,
            bias: dict.bias,
            regime: dict.regime,
            lastOpenTime: latest.openTime,
          })
        } catch (err) {
          console.error(`watchlist poll failed for ${coin}:`, err)
        }
      }
    }

    void pollOnce()
    const timer = setInterval(pollOnce, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [watchlist, defaultInterval, lookback, setWatchlistEntry])
}
