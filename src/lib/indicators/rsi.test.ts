import { describe, expect, it } from 'vitest'
import { hype1h } from './__fixtures__/hype-1h'
import { rsi } from './rsi'

const closes = hype1h.map((c) => c.close)

describe('rsi', () => {
  it('is null before period+1 bars exist', () => {
    const series = rsi(closes, 14)
    expect(series[13]).toBeNull()
    expect(series[14]).not.toBeNull()
  })

  it('is 100 for a strictly rising series (avgLoss === 0)', () => {
    const rising = Array.from({ length: 20 }, (_, i) => i + 1)
    const series = rsi(rising, 14)
    expect(series[14]).toBe(100)
  })

  // Expected values cross-checked against an independent Wilder-smoothing reference
  // implementation in Python run over the same fixture (see ROADMAP.md Phase 1 notes).
  it('matches an independently computed reference for RSI 14', () => {
    const series = rsi(closes, 14)
    expect(series[150]).toBeCloseTo(50.228257, 4)
    expect(series[149]).toBeCloseTo(50.004139, 4)
    expect(series[148]).toBeCloseTo(44.56426, 4)
  })

  it('stays within [0, 100]', () => {
    const series = rsi(closes, 14)
    for (const value of series) {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
  })
})
