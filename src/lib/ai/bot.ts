import type { IndicatorDict } from '../indicators/types'

export type BotDecision = 'buy' | 'sell' | 'hold'

export interface BotDecisionResult {
  decision: BotDecision
  confidence: number
  probabilities: Record<BotDecision, number>
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
