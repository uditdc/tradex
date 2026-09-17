import type { IndicatorDict } from '../indicators/types'

export type BotDecision = 'buy' | 'sell' | 'hold'
export type BotScenario = 'bull' | 'bear' | 'neutral'

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
 * Per-parameter breakdown behind `scenario`/`action`, one Score question per
 * indicator. `trend`/`momentum`/`levels` are directional (0 = strongly bearish,
 * 4 = strongly bullish) — they explain *which way* `scenario` leans.
 * `volatility`/`volume`/`regime` are conviction-only (0 = low, 2 = high) — these
 * indicators don't have a direction of their own, they say how much to trust
 * whatever direction the directional factors point in.
 */
export interface BotFactors {
  trend: FactorScore
  momentum: FactorScore
  levels: FactorScore
  volatility: FactorScore
  volume: FactorScore
  regime: FactorScore
}

/**
 * Jev's per-tick output on a coin: a ticker-level scenario (is this coin worth
 * considering for a trade at all), a trade action (what to do with the — for
 * now, single — open position on it), and the per-parameter factor breakdown
 * behind both. Independent questions in one call so `scenario` can later gate
 * which tickers get evaluated without changing how `action` drives a specific
 * trade.
 */
export interface BotDecisionResult {
  scenario: Judgment<BotScenario>
  action: Judgment<BotDecision>
  factors: BotFactors
}

export interface BotPositionContext {
  side: 'long' | 'short'
  entryPrice: number
  unrealizedPnl: number | null
}

/** Requests a fast typed buy/sell/hold judgment (TypeSafe's Jev, via /api/bot-decision) for one coin. */
export async function requestBotDecision(
  symbol: string,
  indicators: IndicatorDict,
  position: BotPositionContext | null,
): Promise<BotDecisionResult> {
  const res = await fetch('/api/bot-decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, indicators, position }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `/api/bot-decision failed: ${res.status}`)
  }
  return res.json()
}
