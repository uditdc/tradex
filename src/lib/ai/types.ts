import type { Candle, OrderBook } from '../hl/types'
import type { IndicatorDict } from '../indicators/types'

/** Payload sent to /api/ask, per CLAUDE.md's AI context contract. */
export interface AiContext {
  symbol: string
  interval: string
  candles: Candle[]
  indicators: IndicatorDict
  funding: number
  openInterest: number
  book: OrderBook
}

export interface AskState {
  status: 'loading' | 'done' | 'error'
  text: string
  question: string
  error?: string
}

/** One entry in the session's ask log. */
export interface LogEntry {
  timestamp: number
  coin: string
  interval: string
  question: string
  text: string
}
