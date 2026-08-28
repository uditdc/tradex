import type { WatchlistEntry } from '../store'

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
