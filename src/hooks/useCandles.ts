import { useEffect } from 'react'
import { CandleBuffer } from '../lib/hl/buffer'
import { DEFAULT_CANDLE_LOOKBACK, intervalMs } from '../lib/hl/intervals'
import { candleSnapshot, metaAndAssetCtxs } from '../lib/hl/rest'
import { subscribeCandles } from '../lib/hl/ws'
import { useAppStore } from '../store'

/**
 * Bootstraps a REST snapshot + subscribes to live WS ticks for `coin`/`interval`,
 * writing results into the shared store. Re-runs (and tears down the previous
 * subscription) whenever coin or interval changes.
 */
export function useCandles(coin: string, interval: string): void {
  const setCandles = useAppStore((s) => s.setCandles)
  const setMarketCtx = useAppStore((s) => s.setMarketCtx)
  const setWsStatus = useAppStore((s) => s.setWsStatus)
  const setLastUpdate = useAppStore((s) => s.setLastUpdate)
  const setLatencyMs = useAppStore((s) => s.setLatencyMs)
  const setLastBarCloseAt = useAppStore((s) => s.setLastBarCloseAt)

  useEffect(() => {
    let cancelled = false
    let subscription: { close: () => void } | null = null

    setCandles([])
    setMarketCtx(null)
    setWsStatus('connecting')

    async function bootstrap() {
      const ms = intervalMs(interval)
      const [snapshot, ctx] = await Promise.all([
        candleSnapshot(coin, interval, Date.now() - DEFAULT_CANDLE_LOOKBACK * ms, Date.now()),
        metaAndAssetCtxs(coin),
      ])
      if (cancelled) return

      const buffer = new CandleBuffer(snapshot)
      setCandles(buffer.all)
      setMarketCtx(ctx)
      setLastUpdate(Date.now())

      subscription = subscribeCandles(coin, interval, {
        onStatus: setWsStatus,
        onLatency: setLatencyMs,
        onCandle: (candle) => {
          const closed = buffer.push(candle)
          setCandles(buffer.all)
          setLastUpdate(Date.now())
          if (closed) setLastBarCloseAt(Date.now())
        },
      })
    }

    bootstrap().catch((err) => {
      if (!cancelled) console.error(err)
    })

    return () => {
      cancelled = true
      subscription?.close()
    }
  }, [coin, interval, setCandles, setMarketCtx, setWsStatus, setLastUpdate, setLatencyMs, setLastBarCloseAt])
}
