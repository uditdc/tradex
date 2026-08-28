import { useEffect, useRef } from 'react'
import { triggerReadFor } from './useAiRead'
import { intervalMs } from '../lib/hl/intervals'
import { candleSnapshot } from '../lib/hl/rest'
import { MIN_CANDLES, computeAll } from '../lib/indicators'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'

const POLL_INTERVAL_MS = 45_000
// Space out background reads so several coins closing a bar at once (e.g. the top
// of the hour) doesn't burst-fire simultaneous LLM calls into a rate limit.
const STAGGER_MS = 5_000

/**
 * Polls each watchlist coin on a timer for price/bias display data, and — on
 * detecting a newly closed bar for a coin that isn't the currently active
 * coin/interval (which already gets a live read via useAiRead) — background-
 * triggers an AI read for it so switching to it later is instant.
 */
export function useWatchlist(): void {
  const watchlist = useConfigStore((s) => s.watchlist)
  const defaultInterval = useConfigStore((s) => s.defaultInterval)
  const lookback = useConfigStore((s) => s.lookback)
  const setWatchlistEntry = useAppStore((s) => s.setWatchlistEntry)

  const lastOpenTimeRef = useRef<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false

    async function pollOnce() {
      let staggerDelay = 0

      for (const coin of watchlist) {
        if (cancelled) return
        try {
          const ms = intervalMs(defaultInterval)
          const candles = await candleSnapshot(coin, defaultInterval, Date.now() - lookback * ms, Date.now())
          if (cancelled || candles.length === 0) continue

          const latest = candles[candles.length - 1]
          const previousOpenTime = lastOpenTimeRef.current[coin]
          const barClosed = previousOpenTime !== undefined && latest.openTime > previousOpenTime
          lastOpenTimeRef.current[coin] = latest.openTime

          if (candles.length < MIN_CANDLES) continue

          const dict = computeAll(candles)
          setWatchlistEntry(coin, {
            price: dict.price,
            bias: dict.bias,
            regime: dict.regime,
            lastOpenTime: latest.openTime,
          })

          const active = useAppStore.getState()
          const isActivePair = coin === active.coin && defaultInterval === active.interval
          if (barClosed && !isActivePair) {
            const delay = staggerDelay
            staggerDelay += STAGGER_MS
            setTimeout(() => {
              if (!cancelled) void triggerReadFor(coin, defaultInterval, candles)
            }, delay)
          }
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
