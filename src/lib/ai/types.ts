import type { Candle, OrderBook } from '../hl/types'
import type { IndicatorDict } from '../indicators/types'

/** One of the user's open paper positions on this coin, given to the model for context. */
export interface OpenPositionContext {
  side: 'long' | 'short'
  entryPrice: number
  sizeUsd: number
  leverage: number
  stopLoss?: number
  takeProfit?: number
  /** null if no live price source is available for this coin right now. */
  unrealizedPnl: number | null
}

/** The model's own last stored read for this coin/interval (Phase 8's history), given back to it as context. */
export interface PriorSuggestion {
  bias: string
  key_levels: KeyLevel[]
  invalidation: string
  rationale: string
  timestamp: number
}

/** Payload sent to /api/read and /api/ask, per CLAUDE.md's AI read contract. */
export interface AiContext {
  symbol: string
  interval: string
  candles: Candle[]
  indicators: IndicatorDict
  funding: number
  openInterest: number
  book: OrderBook
  /** Only present when the user has open paper position(s) on this coin. */
  openPositions?: OpenPositionContext[]
  /** Only present when a prior read exists for this coin/interval. */
  priorSuggestion?: PriorSuggestion
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

/** An explicit call on the user's open position(s)/prior suggestion for this coin. Optional — only present when relevant. */
export interface PositionGuidance {
  action: 'keep' | 'close' | 'adjust'
  note: string
}

/** Strict output contract the model is asked to produce for /api/read. */
export interface AiRead {
  bias: string
  key_levels: KeyLevel[]
  zones?: Zone[]
  invalidation: string
  confidence: number
  rationale: string
  position_guidance?: PositionGuidance
}

export interface ReadState {
  status: 'loading' | 'done' | 'error'
  text: string
  parsed: AiRead | null
  error?: string
}

export interface AskState {
  status: 'loading' | 'done' | 'error'
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
