import type { WatchlistEntry } from '../store'
import type { BotDecision } from './ai/bot'

export interface SimPositionLike {
  coin: string
  side: 'long' | 'short'
  sizeUsd: number
  leverage: number
  entryPrice: number
}

export interface Verdict {
  verdict: 'KEEP' | 'CLOSE'
  note: string
}

/**
 * Live price for a position: the active coin's live candle close if this position
 * is on it, else its last watchlist poll, else null (no live source for this coin
 * right now).
 */
export function livePriceForPosition(
  position: Pick<SimPositionLike, 'coin'>,
  activeCoin: string,
  activePrice: number | null,
  watchlistData: Record<string, WatchlistEntry>,
): number | null {
  if (position.coin === activeCoin) return activePrice
  return watchlistData[position.coin]?.price ?? null
}

export function pnlForPosition(position: SimPositionLike, currentPrice: number): number {
  const direction = position.side === 'long' ? 1 : -1
  return position.sizeUsd * position.leverage * ((currentPrice - position.entryPrice) / position.entryPrice) * direction
}

/**
 * Whether a position's original thesis still holds, from the live swing
 * support/resistance of the coin/interval it was opened on. Callers should only
 * call this when that coin/interval's indicators are actually loaded (i.e. it's
 * the currently active pair) — support/resistance for any other coin isn't
 * available in this app's single-subscription data model.
 */
export function computePositionVerdict(
  side: 'long' | 'short',
  currentPrice: number,
  support: number | null,
  resistance: number | null,
): Verdict {
  if (side === 'long') {
    if (support != null && currentPrice <= support) return { verdict: 'CLOSE', note: 'Support broken — thesis invalidated.' }
    if (resistance != null && currentPrice >= resistance) return { verdict: 'CLOSE', note: 'Target reached — take profit.' }
    return { verdict: 'KEEP', note: 'Structure intact — bias unchanged.' }
  }
  if (resistance != null && currentPrice >= resistance) return { verdict: 'CLOSE', note: 'Resistance reclaimed — thesis invalidated.' }
  if (support != null && currentPrice <= support) return { verdict: 'CLOSE', note: 'Target reached — take profit.' }
  return { verdict: 'KEEP', note: 'Structure intact — bias unchanged.' }
}

/** long unless the given bias string clearly says short (mirrors AI/indicator bias vocab: "long"/"short"/"neutral"). */
export function suggestionSideFromBias(bias: string | undefined): 'long' | 'short' {
  return (bias ?? '').toLowerCase().includes('short') ? 'short' : 'long'
}

export type SlTpReason = 'stop_loss' | 'take_profit'

/**
 * Whether a position's own stop-loss/take-profit has been crossed by the current
 * price. Direction flips for shorts: a stop sits above entry, a target below.
 * Returns null if neither level is set or neither has been crossed yet.
 */
export function checkSlTp(
  position: Pick<SimPositionLike, 'side'> & { stopLoss?: number; takeProfit?: number },
  currentPrice: number,
): SlTpReason | null {
  if (position.side === 'long') {
    if (position.stopLoss != null && currentPrice <= position.stopLoss) return 'stop_loss'
    if (position.takeProfit != null && currentPrice >= position.takeProfit) return 'take_profit'
  } else {
    if (position.stopLoss != null && currentPrice >= position.stopLoss) return 'stop_loss'
    if (position.takeProfit != null && currentPrice <= position.takeProfit) return 'take_profit'
  }
  return null
}

/** `+$12.34` / `-$12.34` / `$0.00` — always signed so a loss reads unambiguously without relying on color alone. */
export function formatSignedUsd(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

/** `+1.50%` / `-1.50%` / `0.00%`, same signing rule as `formatSignedUsd`. */
export function formatSignedPct(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}${Math.abs(n).toFixed(2)}%`
}

/**
 * Below this confidence, the bot does nothing regardless of `decision`. Auto Mode is meant
 * to act on every candle without waiting for a high-confidence setup — Jev's own `hold`
 * judgment is already the "don't trade" signal — so the default is 0 (no gate: any real
 * confidence value on a buy/sell qualifies). The parameter stays available for callers who
 * do want a real threshold (see the confidence-gated tests below).
 */
export const BOT_CONFIDENCE_THRESHOLD = 0

export type BotAction =
  | { type: 'open'; side: 'long' | 'short' }
  | { type: 'close_and_flip'; side: 'long' | 'short' }
  | { type: 'noop' }

/**
 * Turns a Jev buy/sell/hold judgment into a concrete trading-bot action. Pure policy, no I/O:
 * confidence gating and side-matching are deterministic rules, not something the model needs
 * to be asked about separately.
 */
export function decideBotAction(
  decision: BotDecision,
  confidence: number,
  heldSide: 'long' | 'short' | null,
  confidenceThreshold: number = BOT_CONFIDENCE_THRESHOLD,
): BotAction {
  if (confidence < confidenceThreshold) return { type: 'noop' }
  if (decision === 'hold') return { type: 'noop' }

  const side = decision === 'buy' ? 'long' : 'short'
  if (heldSide === null) return { type: 'open', side }
  if (heldSide === side) return { type: 'noop' }
  return { type: 'close_and_flip', side }
}

/** Starting balance of the global paper-trading account (CLAUDE.md's paper-trading simulator — no real funds). */
export const STARTING_BALANCE = 10_000

export interface Portfolio {
  equity: number
  returnsPct: number
}

/** Global paper-account equity: starting balance plus every realized close plus current open positions' unrealized PnL. */
export function computePortfolio(
  realizedPnl: number,
  unrealizedPnl: number,
  startingBalance: number = STARTING_BALANCE,
): Portfolio {
  const equity = startingBalance + realizedPnl + unrealizedPnl
  const returnsPct = ((equity - startingBalance) / startingBalance) * 100
  return { equity, returnsPct }
}
