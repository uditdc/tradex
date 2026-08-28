import { describe, expect, it } from 'vitest'
import type { Candle } from '../hl/types'
import { nearestSwingLevels } from './swing'

// Hand-picked highs/lows, lookback=2:
//   index 3  high=15 is the max of [11,12,15,13,12] -> swing high
//   index 8  high=16 is the max of [11,14,16,13,12] -> swing high
//   index 6  low=9   is the min of [11,10,9,12,14]  -> swing low
// The last 2 bars (9, 10) are never confirmed swings (no future bars to confirm
// against), and index 0/1 are excluded the same way at the start of the series.
const highs = [10, 11, 12, 15, 13, 12, 11, 14, 16, 13, 12]
const lows = [9, 10, 11, 13, 11, 10, 9, 12, 14, 11, 10]

function makeCandles(closeAtEnd: number): Candle[] {
  return highs.map((high, i) => ({
    openTime: i,
    closeTime: i,
    symbol: 'TEST',
    interval: '1h',
    open: (high + lows[i]) / 2,
    high,
    low: lows[i],
    close: i === highs.length - 1 ? closeAtEnd : (high + lows[i]) / 2,
    volume: 1,
    trades: 1,
  }))
}

describe('nearestSwingLevels', () => {
  it('finds the nearest confirmed swing high/low around the current price', () => {
    const { support, resistance } = nearestSwingLevels(makeCandles(12.5), 2)

    expect(support?.price).toBe(9)
    expect(support?.distancePercent).toBeCloseTo(28, 10)
    expect(resistance?.price).toBe(15)
    expect(resistance?.distancePercent).toBeCloseTo(20, 10)
  })

  it('returns null when price is above every confirmed swing (no resistance)', () => {
    const { resistance } = nearestSwingLevels(makeCandles(100), 2)
    expect(resistance).toBeNull()
  })

  it('returns null when price is below every confirmed swing (no support)', () => {
    const { support } = nearestSwingLevels(makeCandles(1), 2)
    expect(support).toBeNull()
  })

  it('returns nulls for an empty candle set', () => {
    expect(nearestSwingLevels([], 2)).toEqual({ support: null, resistance: null })
  })
})
