import { buildContext } from '../lib/ai/context'
import { requestAsk } from '../lib/ai/client'
import { MIN_CANDLES, computeAll } from '../lib/indicators'
import { l2Book } from '../lib/hl/rest'
import { useAppStore } from '../store'

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
    addLogEntry({ timestamp: Date.now(), coin, interval, question, text })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('AI ask failed:', err)
    setAskState({ status: 'error', text: '', question, error: message })
  }
}
