import { useEffect, useRef } from 'react'
import { buildContext } from '../lib/ai/context'
import { requestAsk, requestRead } from '../lib/ai/client'
import { parseAiRead } from '../lib/ai/parse'
import { MIN_CANDLES, computeAll } from '../lib/indicators'
import { l2Book } from '../lib/hl/rest'
import { useAppStore } from '../store'

function cacheKey(coin: string, interval: string): string {
  return `${coin}:${interval}`
}

/** Imperative trigger for /api/read; safe to call directly (palette action, bar close, auto-trigger). */
export async function triggerRead(): Promise<void> {
  const { coin, interval, candles, marketCtx, setAiRead } = useAppStore.getState()
  if (candles.length < MIN_CANDLES || !marketCtx) return

  const key = cacheKey(coin, interval)
  setAiRead(key, { status: 'streaming', text: '', parsed: null })

  try {
    const indicators = computeAll(candles)
    const book = await l2Book(coin)
    const context = buildContext(coin, interval, candles, indicators, marketCtx, book)

    let acc = ''
    await requestRead(context, (token) => {
      acc += token
      setAiRead(key, { status: 'streaming', text: acc, parsed: null })
    })

    const parsed = parseAiRead(acc)
    if (!parsed) console.error('AI read did not parse as strict JSON:', acc)
    setAiRead(key, {
      status: 'done',
      text: acc,
      parsed,
      error: parsed ? undefined : 'Model did not return strict JSON — showing raw text.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('AI read failed:', err)
    setAiRead(key, { status: 'error', text: '', parsed: null, error: message })
  }
}

/** Imperative trigger for /api/ask (the "/" ask-mode palette action). */
export async function triggerAsk(question: string): Promise<void> {
  const { coin, interval, candles, marketCtx, setAskState } = useAppStore.getState()
  if (candles.length < MIN_CANDLES || !marketCtx) return

  setAskState({ status: 'streaming', text: '', question })

  try {
    const indicators = computeAll(candles)
    const book = await l2Book(coin)
    const context = buildContext(coin, interval, candles, indicators, marketCtx, book)

    let acc = ''
    await requestAsk(context, question, (token) => {
      acc += token
      setAskState({ status: 'streaming', text: acc, question })
    })
    setAskState({ status: 'done', text: acc, question })
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
    void triggerRead()
  }, [key, ready])

  const prevBarCloseRef = useRef(lastBarCloseAt)
  useEffect(() => {
    if (ready && lastBarCloseAt !== null && lastBarCloseAt !== prevBarCloseRef.current) {
      prevBarCloseRef.current = lastBarCloseAt
      void triggerRead()
    }
  }, [lastBarCloseAt, ready])
}
