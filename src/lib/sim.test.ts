import { describe, expect, it } from 'vitest'
import { computePositionVerdict, livePriceForPosition, pnlForPosition, suggestionSideFromBias } from './sim'

describe('livePriceForPosition', () => {
  it('uses the active price when the position is on the active coin', () => {
    expect(livePriceForPosition({ coin: 'BTC' }, 'BTC', 65000, {})).toBe(65000)
  })

  it('falls back to watchlist data for a non-active coin', () => {
    const watchlistData = { ETH: { price: 3200, bias: 'long' as const, regime: 'trending' as const, lastOpenTime: 0 } }
    expect(livePriceForPosition({ coin: 'ETH' }, 'BTC', 65000, watchlistData)).toBe(3200)
  })

  it('returns null when no live source exists for the coin', () => {
    expect(livePriceForPosition({ coin: 'SOL' }, 'BTC', 65000, {})).toBeNull()
  })
})

describe('pnlForPosition', () => {
  it('is positive for a long that moved up', () => {
    const pnl = pnlForPosition({ coin: 'BTC', side: 'long', sizeUsd: 1000, leverage: 10, entryPrice: 100 }, 110)
    expect(pnl).toBeCloseTo(1000)
  })

  it('is positive for a short that moved down', () => {
    const pnl = pnlForPosition({ coin: 'BTC', side: 'short', sizeUsd: 1000, leverage: 10, entryPrice: 100 }, 90)
    expect(pnl).toBeCloseTo(1000)
  })
})

describe('computePositionVerdict', () => {
  it('keeps a long while price sits between support and resistance', () => {
    expect(computePositionVerdict('long', 100, 90, 110)).toEqual({
      verdict: 'KEEP',
      note: 'Structure intact — bias unchanged.',
    })
  })

  it('closes a long once support breaks', () => {
    expect(computePositionVerdict('long', 85, 90, 110).verdict).toBe('CLOSE')
  })

  it('closes a short once resistance reclaims', () => {
    expect(computePositionVerdict('short', 115, 90, 110).verdict).toBe('CLOSE')
  })
})

describe('suggestionSideFromBias', () => {
  it('reads short only when the bias clearly says so', () => {
    expect(suggestionSideFromBias('short')).toBe('short')
    expect(suggestionSideFromBias('long')).toBe('long')
    expect(suggestionSideFromBias('neutral')).toBe('long')
    expect(suggestionSideFromBias(undefined)).toBe('long')
  })
})
