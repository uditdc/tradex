import type { Candle, OrderBook } from '../hl/types'
import type { IndicatorDict } from '../indicators/types'

/** Payload sent to /api/read and /api/ask, per CLAUDE.md's AI read contract. */
export interface AiContext {
  symbol: string
  interval: string
  candles: Candle[]
  indicators: IndicatorDict
  funding: number
  openInterest: number
  book: OrderBook
}

export interface KeyLevel {
  price: number
  kind: string
  note: string
}

/** A shaded supply/demand price range, drawn as a band on the chart. Optional — the model may return none. */
export interface Zone {
  from: number
  to: number
  label: string
}

/** Strict output contract the model is asked to produce for /api/read. */
export interface AiRead {
  bias: string
  key_levels: KeyLevel[]
  zones?: Zone[]
  invalidation: string
  confidence: number
  rationale: string
}

export interface ReadState {
  status: 'streaming' | 'done' | 'error'
  text: string
  parsed: AiRead | null
  error?: string
}

export interface AskState {
  status: 'streaming' | 'done' | 'error'
  text: string
  question: string
  error?: string
}

/** One entry in the session's downloadable read/ask log. */
export interface LogEntry {
  timestamp: number
  coin: string
  interval: string
  kind: 'read' | 'ask'
  question?: string
  text: string
  parsed: AiRead | null
}
