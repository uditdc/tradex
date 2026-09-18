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

function structureVerdict(
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

/**
 * Whether a position's original thesis still holds — and, unlike the plain
 * price-vs-level check `checkSlTp` runs for auto-close, always has an answer.
 * Prefers the live swing support/resistance of the coin/interval it was opened
 * on (a qualitative "does the setup still make sense" read); support/resistance
 * is only available for the currently active chart pair in this app's
 * single-subscription data model, so for any other coin this falls back to the
 * position's own Jev-suggested stop-loss/take-profit (`computeStopLossTakeProfit`
 * — always set since it ATR-falls-back when there's no swing level to anchor to)
 * via the same crossing check `checkSlTp` uses for auto-close.
 */
export function computePositionVerdict(
  position: Pick<SimPositionLike, 'side'> & { stopLoss?: number; takeProfit?: number },
  currentPrice: number,
  support: number | null,
  resistance: number | null,
): Verdict {
  if (support !== null || resistance !== null) {
    return structureVerdict(position.side, currentPrice, support, resistance)
  }
  const reason = checkSlTp(position, currentPrice)
  if (reason === 'stop_loss') return { verdict: 'CLOSE', note: 'Stop-loss hit — close position.' }
  if (reason === 'take_profit') return { verdict: 'CLOSE', note: 'Take-profit reached — close position.' }
  if (position.stopLoss == null && position.takeProfit == null) {
    return { verdict: 'KEEP', note: 'No stop-loss/take-profit set for this position.' }
  }
  return { verdict: 'KEEP', note: 'Within stop-loss/take-profit range.' }
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

export interface SlTpLevels {
  stopLoss: number
  takeProfit: number
}

/**
 * Stop-loss/take-profit for a newly opened position: anchored to the nearest swing
 * support/resistance, then both pushed further away by an ATR-scaled buffer sized by
 * Jev's `riskWidth` score (0 = tight, hugs the raw swing level with no buffer; 2 = wide,
 * a full ATR of extra room on both the stop and the target). `riskWidthScore` outside
 * 0-2 is clamped. When a side has no swing level to anchor to yet (`nearestSwingLevels`
 * returned `null` — e.g. price is making a fresh high/low with nothing to reference),
 * falls back to a pure ATR-multiple distance from price (1x ATR at tight, up to 3x at
 * wide) instead of leaving that level unset — every position gets some protection,
 * even one structure alone can't currently place.
 */
export function computeStopLossTakeProfit(
  side: 'long' | 'short',
  price: number,
  atrPercent: number,
  riskWidthScore: number,
  swingSupport: number | null,
  swingResistance: number | null,
): SlTpLevels {
  const widthFrac = Math.max(0, Math.min(1, riskWidthScore / 2))
  const buffer = price * (atrPercent / 100) * widthFrac
  const fallbackDistance = price * (atrPercent / 100) * (1 + widthFrac * 2)
  const near = side === 'long' ? swingSupport : swingResistance
  const far = side === 'long' ? swingResistance : swingSupport
  const nearSign = side === 'long' ? -1 : 1
  const farSign = side === 'long' ? 1 : -1
  return {
    stopLoss: near != null ? near + nearSign * buffer : price + nearSign * fallbackDistance,
    takeProfit: far != null ? far + farSign * buffer : price + farSign * fallbackDistance,
  }
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
