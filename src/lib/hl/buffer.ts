import type { Candle } from './types'

export interface MergeResult {
  candles: Candle[]
  /** The bar that just closed, if this tick started a new one; otherwise null. */
  closed: Candle | null
}

/**
 * Merge one live tick into a candle snapshot: updates the still-open bar in place
 * (same openTime), appends once the exchange starts a new bar, and drops anything
 * with an openTime at or behind the buffer's last bar so retries/out-of-order
 * delivery can never duplicate or rewind history.
 */
export function mergeCandle(candles: Candle[], incoming: Candle): MergeResult {
  if (candles.length === 0) {
    return { candles: [incoming], closed: null }
  }

  const last = candles[candles.length - 1]

  if (incoming.openTime === last.openTime) {
    return { candles: [...candles.slice(0, -1), incoming], closed: null }
  }

  if (incoming.openTime > last.openTime) {
    return { candles: [...candles, incoming], closed: last }
  }

  return { candles, closed: null }
}

export class CandleBuffer {
  private candles: Candle[]

  constructor(initial: Candle[] = []) {
    this.candles = [...initial]
  }

  get all(): Candle[] {
    return this.candles
  }

  /** Merges a live tick in place; returns the bar that just closed, if any. */
  push(incoming: Candle): Candle | null {
    const { candles, closed } = mergeCandle(this.candles, incoming)
    this.candles = candles
    return closed
  }
}
