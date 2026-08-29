import { useEffect, useRef } from 'react'
import { buildContext } from '../lib/ai/context'
import { requestAsk, requestRead } from '../lib/ai/client'
import { parseAiRead } from '../lib/ai/parse'
import type { AiRead } from '../lib/ai/types'
import { MIN_CANDLES, computeAll } from '../lib/indicators'
import { l2Book, metaAndAssetCtxs } from '../lib/hl/rest'
import type { Candle, MarketCtx } from '../lib/hl/types'
import { getLatestRead, saveRead } from '../lib/storage/reads'
import { useAppStore } from '../store'

function cacheKey(coin: string, interval: string): string {
  return `${coin}:${interval}`
}

/** Core of an AI read for an arbitrary coin/interval; shared by the active-coin and background paths. */
async function runRead(coin: string, interval: string, candles: Candle[], marketCtx: MarketCtx): Promise<AiRead | null> {
  const { setAiRead, addLogEntry } = useAppStore.getState()
  const key = cacheKey(coin, interval)
  setAiRead(key, { status: 'loading', text: '', parsed: null })

  try {
    const indicators = computeAll(candles)
    const book = await l2Book(coin)
    const context = buildContext(coin, interval, candles, indicators, marketCtx, book)

    const text = await requestRead(context)

    const parsed = parseAiRead(text)
    if (!parsed) console.error('AI read did not parse as strict JSON:', text)
    setAiRead(key, {
      status: 'done',
      text,
      parsed,
      error: parsed ? undefined : 'Model did not return strict JSON — showing raw text.',
    })
    const timestamp = Date.now()
    addLogEntry({ timestamp, coin, interval, kind: 'read', text, parsed })
    void saveRead(coin, interval, { timestamp, text, parsed })
    return parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('AI read failed:', err)
    setAiRead(key, { status: 'error', text: '', parsed: null, error: message })
    return null
  }
}

/** Imperative trigger for /api/read on the currently active coin/interval. */
export async function triggerRead(): Promise<void> {
  const { coin, interval, candles, marketCtx } = useAppStore.getState()
  if (candles.length < MIN_CANDLES || !marketCtx) return
  await runRead(coin, interval, candles, marketCtx)
}

/**
 * Background read for a coin/interval that isn't necessarily the active one (the
 * watchlist's bar-close pre-compute). Fetches its own snapshot rather than reusing
 * the live buffer, since only the active coin has a live WS subscription.
 */
export async function triggerReadFor(coin: string, interval: string, candles: Candle[]): Promise<void> {
  if (candles.length < MIN_CANDLES) return
  const marketCtx = await metaAndAssetCtxs(coin)
  await runRead(coin, interval, candles, marketCtx)
}

/** Imperative trigger for /api/ask (the "/" ask-mode palette action). */
export async function triggerAsk(question: string): Promise<void> {
  const { coin, interval, candles, marketCtx, setAskState, addLogEntry } = useAppStore.getState()
  if (candles.length < MIN_CANDLES || !marketCtx) return

  setAskState({ status: 'loading', text: '', question })

  try {
    const indicators = computeAll(candles)
    const book = await l2Book(coin)
    const context = buildContext(coin, interval, candles, indicators, marketCtx, book)

    const text = await requestAsk(context, question)
    setAskState({ status: 'done', text, question })
    addLogEntry({ timestamp: Date.now(), coin, interval, kind: 'ask', question, text, parsed: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('AI ask failed:', err)
    setAskState({ status: 'error', text: '', question, error: message })
  }
}

/**
 * Wires the automatic read triggers — once per coin/interval switch (if not already
 * cached) and once per closed bar on the current coin/interval. Mount exactly once
 * (in App.tsx); manual triggers (palette "read" action, "/" ask) call
 * triggerRead/triggerAsk directly and don't need another instance of this hook.
 */
export function useAiRead(): void {
  const coin = useAppStore((s) => s.coin)
  const interval = useAppStore((s) => s.interval)
  const candlesLength = useAppStore((s) => s.candles.length)
  const marketCtx = useAppStore((s) => s.marketCtx)
  const lastBarCloseAt = useAppStore((s) => s.lastBarCloseAt)

  const key = cacheKey(coin, interval)
  const ready = candlesLength >= MIN_CANDLES && marketCtx !== null

  useEffect(() => {
    // Read the cache imperatively (not as a reactive selector) so this effect only
    // re-runs when [key, ready] change, not on every streamed token elsewhere.
    if (!ready || useAppStore.getState().aiReadCache[key]) return

    let cancelled = false
    void (async () => {
      // Try the durable per-coin history before generating a new one: a prior
      // session's read for this coin/interval shows instantly instead of
      // re-triggering the LLM on every reload/switch.
      const stored = await getLatestRead(coin, interval)
      if (cancelled || useAppStore.getState().aiReadCache[key]) return
      if (stored) {
        useAppStore.getState().setAiRead(key, {
          status: 'done',
          text: stored.text,
          parsed: stored.parsed,
          error: stored.parsed ? undefined : 'Model did not return strict JSON — showing raw text.',
        })
      } else {
        void triggerRead()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, ready, coin, interval])

  const prevBarCloseRef = useRef(lastBarCloseAt)
  useEffect(() => {
    if (ready && lastBarCloseAt !== null && lastBarCloseAt !== prevBarCloseRef.current) {
      prevBarCloseRef.current = lastBarCloseAt
      void triggerRead()
    }
  }, [lastBarCloseAt, ready])
}
