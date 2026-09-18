import type { OrderBookMetrics } from '../indicators/orderbook'
import type { TrendSnapshot } from '../indicators/trendSnapshot'
import type { IndicatorDict } from '../indicators/types'
import type { StrategyId } from '../strategies/types'

export type BotDecision = 'buy' | 'sell' | 'hold'
export type BotScenario = 'bull' | 'bear' | 'neutral'
export type { StrategyId }
export type { OrderBookMetrics }
export type { TrendSnapshot }

/** The `mtf-trend` strategy's extra request data: a `TrendSnapshot` per timeframe it looks at. */
export interface MtfTrendContext {
  major: TrendSnapshot
  intermediate: TrendSnapshot
}

export interface Judgment<T extends string> {
  choice: T
  confidence: number
  probabilities: Record<T, number>
}

/** One scored indicator behind `scenario`/`action` — a Jev Score question's expected value and confidence. */
export interface FactorScore {
  score: number
  confidence: number
}

/**
 * One entry in the per-parameter breakdown behind `scenario`/`action`, one Score
 * question per data point the active strategy looks at. `kind: 'directional'` means
 * the score is 0 (strongly bearish) .. 4 (strongly bullish) and explains *which way*
 * `scenario` leans; `kind: 'conviction'` means 0 (low) .. 2 (high) and explains how
 * much to trust whatever direction the directional factors point in — that data
 * point doesn't have a direction of its own. Which factors exist, and what they
 * mean, is defined per-strategy server-side (`server/strategies/*.ts`); the client
 * renders whatever list comes back generically.
 */
export interface FactorEntry extends FactorScore {
  key: string
  label: string
  kind: 'directional' | 'conviction'
}

/**
 * Jev's per-tick output on a coin: a ticker-level scenario (is this coin worth
 * considering for a trade at all), a trade action (what to do with the — for
 * now, single — open position on it), and the per-parameter factor breakdown
 * behind both. Independent questions in one call so `scenario` can later gate
 * which tickers get evaluated without changing how `action` drives a specific
 * trade.
 *
 * `riskWidth` is not explanatory like `factors` — it's operational.
 * `useTradingBot` turns it into an ATR-scaled buffer beyond the nearest swing
 * level for the new position's stop-loss/take-profit: 0 (tight) hugs the raw
 * swing level, 2 (wide) pushes both further away to give the trade more room.
 */
export interface BotDecisionResult {
  strategy: StrategyId
  scenario: Judgment<BotScenario>
  action: Judgment<BotDecision>
  factors: FactorEntry[]
  riskWidth: FactorScore
}

export interface BotPositionContext {
  side: 'long' | 'short'
  entryPrice: number
  unrealizedPnl: number | null
}

/**
 * Requests a fast typed buy/sell/hold judgment (TypeSafe's Jev, via /api/bot-decision)
 * for one coin, from the given strategy. `indicators` (base candle indicators) is
 * always sent — every strategy anchors stop-loss/take-profit to swing levels
 * regardless of what extra data it looks at. `orderBook` is only meaningful (and
 * only read server-side) for the `'orderbook'` strategy; `mtfTrend` only for
 * `'mtf-trend'`.
 */
export async function requestBotDecision(
  strategy: StrategyId,
  symbol: string,
  indicators: IndicatorDict,
  orderBook: OrderBookMetrics | null,
  position: BotPositionContext | null,
  mtfTrend: MtfTrendContext | null = null,
): Promise<BotDecisionResult> {
  const res = await fetch('/api/bot-decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy, symbol, indicators, orderBook, mtfTrend, position }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `/api/bot-decision failed: ${res.status}`)
  }
  return res.json()
}
