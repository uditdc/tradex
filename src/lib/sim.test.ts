import { describe, expect, it } from 'vitest'
import {
  checkSlTp,
  computePortfolio,
  computePositionVerdict,
  computeStopLossTakeProfit,
  decideBotAction,
  formatSignedPct,
  formatSignedUsd,
  livePriceForPosition,
  pnlForPosition,
} from './sim'

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
    expect(computePositionVerdict({ side: 'long' }, 100, 90, 110)).toEqual({
      verdict: 'KEEP',
      note: 'Structure intact — bias unchanged.',
    })
  })

  it('closes a long once support breaks', () => {
    expect(computePositionVerdict({ side: 'long' }, 85, 90, 110).verdict).toBe('CLOSE')
  })

  it('closes a short once resistance reclaims', () => {
    expect(computePositionVerdict({ side: 'short' }, 115, 90, 110).verdict).toBe('CLOSE')
  })

  it('falls back to the position\'s own stop-loss/take-profit when no structure is available', () => {
    const position = { side: 'long' as const, stopLoss: 90, takeProfit: 110 }
    expect(computePositionVerdict(position, 100, null, null)).toEqual({
      verdict: 'KEEP',
      note: 'Within stop-loss/take-profit range.',
    })
    expect(computePositionVerdict(position, 90, null, null)).toEqual({
      verdict: 'CLOSE',
      note: 'Stop-loss hit — close position.',
    })
    expect(computePositionVerdict(position, 110, null, null)).toEqual({
      verdict: 'CLOSE',
      note: 'Take-profit reached — close position.',
    })
  })

  it('keeps a position with neither structure nor its own stop-loss/take-profit, rather than leaving it blank', () => {
    expect(computePositionVerdict({ side: 'long' }, 100, null, null)).toEqual({
      verdict: 'KEEP',
      note: 'No stop-loss/take-profit set for this position.',
    })
  })
})

describe('checkSlTp', () => {
  it('returns null when neither level is set', () => {
    expect(checkSlTp({ side: 'long' }, 100)).toBeNull()
  })

  it('returns null while a long sits between its stop and target', () => {
    expect(checkSlTp({ side: 'long', stopLoss: 90, takeProfit: 110 }, 100)).toBeNull()
  })

  it('closes a long on stop-loss when price drops to or below it', () => {
    expect(checkSlTp({ side: 'long', stopLoss: 90, takeProfit: 110 }, 90)).toBe('stop_loss')
    expect(checkSlTp({ side: 'long', stopLoss: 90, takeProfit: 110 }, 85)).toBe('stop_loss')
  })

  it('closes a long on take-profit when price rises to or above it', () => {
    expect(checkSlTp({ side: 'long', stopLoss: 90, takeProfit: 110 }, 110)).toBe('take_profit')
    expect(checkSlTp({ side: 'long', stopLoss: 90, takeProfit: 110 }, 120)).toBe('take_profit')
  })

  it('flips direction for a short: stop above entry, target below', () => {
    expect(checkSlTp({ side: 'short', stopLoss: 110, takeProfit: 90 }, 100)).toBeNull()
    expect(checkSlTp({ side: 'short', stopLoss: 110, takeProfit: 90 }, 110)).toBe('stop_loss')
    expect(checkSlTp({ side: 'short', stopLoss: 110, takeProfit: 90 }, 90)).toBe('take_profit')
  })

  it('only honors the levels that are actually set', () => {
    expect(checkSlTp({ side: 'long', stopLoss: 90 }, 85)).toBe('stop_loss')
    expect(checkSlTp({ side: 'long', stopLoss: 90 }, 200)).toBeNull()
    expect(checkSlTp({ side: 'long', takeProfit: 110 }, 110)).toBe('take_profit')
  })
})

describe('computePortfolio', () => {
  it('equals the starting balance with no realized or unrealized PnL', () => {
    expect(computePortfolio(0, 0, 10_000)).toEqual({ equity: 10_000, returnsPct: 0 })
  })

  it('adds realized and unrealized PnL to equity', () => {
    expect(computePortfolio(300, -50, 10_000)).toEqual({ equity: 10_250, returnsPct: 2.5 })
  })

  it('reflects a loss as negative returns', () => {
    const { equity, returnsPct } = computePortfolio(-500, -500, 10_000)
    expect(equity).toBe(9_000)
    expect(returnsPct).toBeCloseTo(-10)
  })
})

describe('formatSignedUsd', () => {
  it('prefixes a gain with +', () => {
    expect(formatSignedUsd(12.3)).toBe('+$12.30')
  })

  it('prefixes a loss with - (not just relying on color)', () => {
    expect(formatSignedUsd(-0.3)).toBe('-$0.30')
  })

  it('shows exactly zero with no sign', () => {
    expect(formatSignedUsd(0)).toBe('$0.00')
  })
})

describe('formatSignedPct', () => {
  it('prefixes a gain with +', () => {
    expect(formatSignedPct(2.5)).toBe('+2.50%')
  })

  it('prefixes a loss with -', () => {
    expect(formatSignedPct(-10)).toBe('-10.00%')
  })

  it('shows exactly zero with no sign', () => {
    expect(formatSignedPct(0)).toBe('0.00%')
  })
})

describe('computeStopLossTakeProfit', () => {
  it('hugs the raw swing levels with no buffer at riskWidth 0 (tight)', () => {
    expect(computeStopLossTakeProfit('long', 100, 2, 0, 95, 105)).toEqual({ stopLoss: 95, takeProfit: 105 })
    expect(computeStopLossTakeProfit('short', 100, 2, 0, 95, 105)).toEqual({ stopLoss: 105, takeProfit: 95 })
  })

  it('pushes both levels away from price by a fraction of ATR at riskWidth 1 (normal)', () => {
    // atrAbs = 100 * 2% = 2; widthFrac = 1/2 = 0.5 → buffer = 1
    expect(computeStopLossTakeProfit('long', 100, 2, 1, 95, 105)).toEqual({ stopLoss: 94, takeProfit: 106 })
    expect(computeStopLossTakeProfit('short', 100, 2, 1, 95, 105)).toEqual({ stopLoss: 106, takeProfit: 94 })
  })

  it('pushes both levels away from price by a full ATR at riskWidth 2 (wide)', () => {
    expect(computeStopLossTakeProfit('long', 100, 2, 2, 95, 105)).toEqual({ stopLoss: 93, takeProfit: 107 })
    expect(computeStopLossTakeProfit('short', 100, 2, 2, 95, 105)).toEqual({ stopLoss: 107, takeProfit: 93 })
  })

  it('clamps an out-of-range riskWidth score to the 0-2 buffer range', () => {
    expect(computeStopLossTakeProfit('long', 100, 2, -1, 95, 105)).toEqual({ stopLoss: 95, takeProfit: 105 })
    expect(computeStopLossTakeProfit('long', 100, 2, 5, 95, 105)).toEqual({ stopLoss: 93, takeProfit: 107 })
  })

  it('falls back to an ATR-multiple distance when its swing level does not exist yet', () => {
    // atrAbs = 2; widthFrac = 0.5 → fallbackDistance = atrAbs * (1 + 0.5*2) = 4
    expect(computeStopLossTakeProfit('long', 100, 2, 1, null, 105)).toEqual({ stopLoss: 96, takeProfit: 106 })
    expect(computeStopLossTakeProfit('long', 100, 2, 1, 95, null)).toEqual({ stopLoss: 94, takeProfit: 104 })
  })

  it('never leaves a level unset, even with no swing levels at all', () => {
    const { stopLoss, takeProfit } = computeStopLossTakeProfit('short', 100, 2, 2, null, null)
    expect(stopLoss).not.toBeUndefined()
    expect(takeProfit).not.toBeUndefined()
    // riskWidth 2 (wide) → fallbackDistance = atrAbs * 3 = 6; stop above, target below for a short.
    expect(stopLoss).toBeCloseTo(106)
    expect(takeProfit).toBeCloseTo(94)
  })
})

describe('decideBotAction', () => {
  it('opens a new position in the decided direction when nothing is held', () => {
    expect(decideBotAction('buy', 0.8, null)).toEqual({ type: 'open', side: 'long' })
    expect(decideBotAction('sell', 0.8, null)).toEqual({ type: 'open', side: 'short' })
  })

  it('does nothing on hold, regardless of confidence', () => {
    expect(decideBotAction('hold', 0.95, null)).toEqual({ type: 'noop' })
    expect(decideBotAction('hold', 0.95, 'long')).toEqual({ type: 'noop' })
  })

  it('acts on any real confidence by default (no gate — Auto Mode does not wait)', () => {
    expect(decideBotAction('buy', 0.01, null)).toEqual({ type: 'open', side: 'long' })
    expect(decideBotAction('sell', 0.99, null)).toEqual({ type: 'open', side: 'short' })
  })

  it('does nothing when confidence is below an explicit threshold', () => {
    expect(decideBotAction('buy', 0.59, null, 0.6)).toEqual({ type: 'noop' })
    expect(decideBotAction('buy', 0.6, null, 0.6)).toEqual({ type: 'open', side: 'long' })
  })

  it('does nothing when the decision agrees with the held side', () => {
    expect(decideBotAction('buy', 0.9, 'long')).toEqual({ type: 'noop' })
    expect(decideBotAction('sell', 0.9, 'short')).toEqual({ type: 'noop' })
  })

  it('closes and flips when the decision opposes the held side', () => {
    expect(decideBotAction('sell', 0.9, 'long')).toEqual({ type: 'close_and_flip', side: 'short' })
    expect(decideBotAction('buy', 0.9, 'short')).toEqual({ type: 'close_and_flip', side: 'long' })
  })

  it('honors a custom confidence threshold', () => {
    expect(decideBotAction('buy', 0.5, null, 0.4)).toEqual({ type: 'open', side: 'long' })
    expect(decideBotAction('buy', 0.3, null, 0.4)).toEqual({ type: 'noop' })
  })
})
