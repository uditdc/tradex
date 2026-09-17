import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { requestBotDecision } from '../lib/ai/bot'
import { intervalMs } from '../lib/hl/intervals'
import { candleSnapshot, l2Book } from '../lib/hl/rest'
import { MIN_CANDLES, computeAll } from '../lib/indicators'
import { computeOrderBookMetrics } from '../lib/indicators/orderbook'
import { computeStopLossTakeProfit, decideBotAction, pnlForPosition } from '../lib/sim'
import { useAppStore } from '../store'
import { useConfigStore } from '../store/config'

/** Fixed decision interval — deliberately independent of whatever the chart is displaying, so "on" always means fast. */
const BOT_INTERVAL = '1m'
const POLL_MS = 15_000
const BOT_LOOKBACK = 210

/**
 * Auto Mode: polls the active coin's 1m candles, and on each newly closed bar asks
 * Jev (TypeSafe's fast typed judgment, via /api/bot-decision) for a buy/sell/hold
 * call, then applies `decideBotAction`'s policy against the existing paper-trading
 * engine (open/close/ledger/toasts already built in earlier phases — this only
 * decides *when* to call them, never invents a new execution path). `hold` is
 * itself the "don't trade" signal — `decideBotAction`'s default confidence
 * threshold is 0, so any real buy/sell call acts immediately, without waiting for a
 * high-confidence setup. Only runs while `useConfigStore`'s `botEnabled` is on.
 * Mount exactly once (in App.tsx).
 */
export function useTradingBot(): void {
  const botEnabled = useConfigStore((s) => s.botEnabled)
  const activeStrategy = useConfigStore((s) => s.activeStrategy)
  const coin = useAppStore((s) => s.coin)
  const lastOpenTimeRef = useRef<number | undefined>(undefined)
  // Tracks whether the last decision request failed, so a persistent failure (e.g. no
  // TYPESAFE_API_KEY configured) surfaces once, not every 15s while the bot stays on.
  const lastErrorToastedRef = useRef(false)

  useEffect(() => {
    if (!botEnabled) return
    lastOpenTimeRef.current = undefined
    lastErrorToastedRef.current = false
    let cancelled = false

    async function pollOnce() {
      try {
        const ms = intervalMs(BOT_INTERVAL)
        const candles = await candleSnapshot(coin, BOT_INTERVAL, Date.now() - BOT_LOOKBACK * ms, Date.now())
        if (cancelled || candles.length < MIN_CANDLES) return

        const latest = candles[candles.length - 1]
        const previousOpenTime = lastOpenTimeRef.current
        const barClosed = previousOpenTime !== undefined && latest.openTime > previousOpenTime
        lastOpenTimeRef.current = latest.openTime
        if (!barClosed) return

        const indicators = computeAll(candles)
        const activePrice = latest.close

        let orderBook = null
        if (activeStrategy === 'orderbook') {
          try {
            orderBook = computeOrderBookMetrics(await l2Book(coin), activePrice)
          } catch (err) {
            console.error(`trading bot: failed to fetch order book for ${coin}:`, err)
            return
          }
        }

        const {
          positions,
          openPosition,
          closePosition,
          setBotStatus,
          addBotLogEntry,
          setBotAnalyzing,
          simSizeUsd,
          simLeverage,
        } = useAppStore.getState()
        const held = positions.find((p) => p.coin === coin) ?? null

        let result
        setBotAnalyzing(true)
        try {
          result = await requestBotDecision(
            activeStrategy,
            coin,
            indicators,
            orderBook,
            held ? { side: held.side, entryPrice: held.entryPrice, unrealizedPnl: pnlForPosition(held, activePrice) } : null,
          )
        } catch (err) {
          if (!lastErrorToastedRef.current) {
            lastErrorToastedRef.current = true
            const message = err instanceof Error ? err.message : String(err)
            toast.error(`Trading bot: ${message}`)
          }
          return
        } finally {
          setBotAnalyzing(false)
        }
        lastErrorToastedRef.current = false
        if (cancelled) return
        const decidedAt = Date.now()
        setBotStatus(coin, { ...result, timestamp: decidedAt })
        addBotLogEntry({ ...result, coin, timestamp: decidedAt })

        const action = decideBotAction(result.action.choice, result.action.confidence, held?.side ?? null)
        if (action.type === 'noop') return

        if (action.type === 'close_and_flip' && held) {
          closePosition(held.id, activePrice, 'bot')
        }
        const { stopLoss, takeProfit } = computeStopLossTakeProfit(
          action.side,
          activePrice,
          indicators.atrPercent,
          result.riskWidth.score,
          indicators.swingSupport?.price ?? null,
          indicators.swingResistance?.price ?? null,
        )
        openPosition({
          coin,
          interval: BOT_INTERVAL,
          side: action.side,
          sizeUsd: simSizeUsd,
          leverage: simLeverage,
          entryPrice: activePrice,
          stopLoss,
          takeProfit,
        })
      } catch (err) {
        console.error(`trading bot decision failed for ${coin}:`, err)
      }
    }

    void pollOnce()
    const timer = setInterval(pollOnce, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [botEnabled, coin, activeStrategy])
}
